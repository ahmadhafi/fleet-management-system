import fs from 'node:fs';
import path from 'node:path';
import { put, head, list } from '@vercel/blob';
import { checkpointDb, flushAndCloseDb, getDb } from './db.ts';

const DB_FILENAME = 'fleet-management-v2.db';

export function getResolvedDbPath(): string {
  const isVercel = Boolean(process.env.VERCEL);
  return process.env.DB_PATH || (isVercel ? `/tmp/${DB_FILENAME}` : path.join(process.cwd(), 'data', DB_FILENAME));
}

export function getBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith('BLOB_READ_WRITE_TOKEN'));
  return key ? process.env[key] : undefined;
}

let lastSyncedUploadedAt: string | null = null;
let lastCheckTimeMs = 0;
let preferredAccessMode: 'public' | 'private' = 'public';
let activeSyncOperation: Promise<void> | null = null;
let blobSyncSuspended = false;

export function isBlobSyncSuspended(): boolean {
  return blobSyncSuspended;
}

export function resetBlobSyncSuspension(): void {
  blobSyncSuspended = false;
}

function handleBlobError(err: unknown, context: string): void {
  const msg = ((err as Error)?.message || String(err)).toLowerCase();
  if (
    msg.includes('usage') ||
    msg.includes('limit') ||
    msg.includes('paused') ||
    msg.includes('suspend') ||
    msg.includes('403') ||
    msg.includes('payment') ||
    msg.includes('forbidden')
  ) {
    if (!blobSyncSuspended) {
      blobSyncSuspended = true;
      console.warn(`[Vercel Blob Sync] Detected Vercel Blob store limit or suspension during ${context}: ${(err as Error)?.message}. Bypassing cloud sync to preserve fast local operations.`);
    }
  } else {
    console.warn(`[Vercel Blob Sync] ${context} notice:`, (err as Error)?.message);
  }
}

async function findBlobMeta(token: string): Promise<{ downloadUrl: string; uploadedAt: Date } | null> {
  if (blobSyncSuspended) return null;
  try {
    const meta = await head(DB_FILENAME, { token });
    if (meta && meta.downloadUrl) {
      return { downloadUrl: meta.downloadUrl, uploadedAt: new Date(meta.uploadedAt) };
    }
  } catch (err) {
    handleBlobError(err, 'head metadata lookup');
    if (blobSyncSuspended) return null;
  }
  try {
    const listed = await list({ prefix: DB_FILENAME, limit: 5, token });
    const match = listed.blobs.find((b) => b.pathname === DB_FILENAME) || listed.blobs[0];
    if (match && match.downloadUrl) {
      return { downloadUrl: match.downloadUrl, uploadedAt: new Date(match.uploadedAt) };
    }
  } catch (err) {
    handleBlobError(err, 'list fallback lookup');
  }
  return null;
}

export async function ensureCloudSync(forceCheck = false): Promise<void> {
  const token = getBlobToken();
  if (!token || blobSyncSuspended) return;

  const now = Date.now();
  // Avoid hammering head() on burst parallel GET requests within 800ms if already synced once
  if (!forceCheck && lastSyncedUploadedAt && now - lastCheckTimeMs < 800) {
    return;
  }

  if (activeSyncOperation) {
    await activeSyncOperation;
    if (!forceCheck && lastSyncedUploadedAt && Date.now() - lastCheckTimeMs < 800) {
      return;
    }
  }

  const runSync = async () => {
    lastCheckTimeMs = Date.now();
    const targetPath = getResolvedDbPath();
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      const meta = await findBlobMeta(token);
      if (!meta || !meta.downloadUrl) {
        return;
      }

      const remoteVersion = meta.uploadedAt.toISOString();
      const localFileExists = fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0;
      if (localFileExists && lastSyncedUploadedAt === remoteVersion) {
        return;
      }

      // Download remote snapshot (try with Authorization header for private stores, fallback to plain fetch)
      let resp = await fetch(meta.downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).catch(() => null);

      if (!resp || !resp.ok) {
        resp = await fetch(meta.downloadUrl, { cache: 'no-store' }).catch(() => null);
      }

      if (resp && resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 0) {
          flushAndCloseDb();
          const tmpPath = `${targetPath}.download`;
          fs.writeFileSync(tmpPath, Buffer.from(buffer));
          fs.renameSync(tmpPath, targetPath);
          lastSyncedUploadedAt = remoteVersion;
          // Re-initialize connection against restored file
          getDb();
          console.log(`[Vercel Blob Sync] Synchronized database (${buffer.byteLength} bytes, version ${remoteVersion})`);
        }
      }
    } catch (err) {
      console.warn('[Vercel Blob Sync] Restore check notice:', (err as Error).message);
    }
  };

  activeSyncOperation = runSync().finally(() => {
    activeSyncOperation = null;
  });

  await activeSyncOperation;
}

export async function persistDatabaseToCloudImmediate(): Promise<void> {
  const token = getBlobToken();
  if (!token || blobSyncSuspended) return;

  if (activeSyncOperation) {
    await activeSyncOperation;
  }

  const runPersist = async () => {
    if (blobSyncSuspended) return;
    const targetPath = getResolvedDbPath();
    // Ensure db exists and WAL is flushed to main file
    getDb();
    checkpointDb();

    if (!fs.existsSync(targetPath)) return;

    try {
      const buffer = fs.readFileSync(targetPath);
      if (buffer.length === 0) return;

      let result;
      try {
        result = await put(DB_FILENAME, buffer, {
          access: preferredAccessMode,
          addRandomSuffix: false,
          allowOverwrite: true,
          token,
        });
      } catch (firstErr) {
        handleBlobError(firstErr, 'persist database initial mode');
        if (blobSyncSuspended) return;

        // If user created a Private store instead of Public (or vice versa), automatically switch access mode
        const fallbackMode = preferredAccessMode === 'public' ? 'private' : 'public';
        result = await put(DB_FILENAME, buffer, {
          access: fallbackMode as 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          token,
        });
        preferredAccessMode = fallbackMode;
        console.log(`[Vercel Blob Sync] Switched blob access mode to '${preferredAccessMode}' (${(firstErr as Error).message})`);
      }

      // Refresh metadata timestamp so this instance knows it holds the latest snapshot
      const meta = await findBlobMeta(token);
      if (meta) {
        lastSyncedUploadedAt = meta.uploadedAt.toISOString();
      } else if (result) {
        lastSyncedUploadedAt = new Date().toISOString();
      }
      lastCheckTimeMs = Date.now();
      console.log(`[Vercel Blob Sync] Persisted database (${buffer.length} bytes) to Vercel Blob`);
    } catch (err) {
      handleBlobError(err, 'persist database fallback');
    }
  };

  activeSyncOperation = runPersist().finally(() => {
    activeSyncOperation = null;
  });

  await activeSyncOperation;
}

export function persistDatabaseToCloud(): Promise<void> {
  return persistDatabaseToCloudImmediate();
}
