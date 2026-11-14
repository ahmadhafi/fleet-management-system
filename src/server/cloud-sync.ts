import fs from 'node:fs';
import path from 'node:path';
import { put, head } from '@vercel/blob';

const DB_FILENAME = 'fleet-management-v2.db';

export function getResolvedDbPath(): string {
  const isVercel = Boolean(process.env.VERCEL);
  return process.env.DB_PATH || (isVercel ? `/tmp/${DB_FILENAME}` : path.join(process.cwd(), 'data', DB_FILENAME));
}

function getBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith('BLOB_READ_WRITE_TOKEN'));
  return key ? process.env[key] : undefined;
}

let syncInitiated = false;

export async function ensureCloudSync(): Promise<void> {
  const token = getBlobToken();
  if (syncInitiated || !token) {
    return;
  }
  syncInitiated = true;

  const targetPath = getResolvedDbPath();
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const meta = await head(DB_FILENAME, { token }).catch(() => null);
    if (meta && meta.downloadUrl) {
      console.log(`[Vercel Blob Sync] Downloading persisted database from ${meta.downloadUrl}...`);
      const resp = await fetch(meta.downloadUrl);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 0) {
          fs.writeFileSync(targetPath, Buffer.from(buffer));
          console.log(`[Vercel Blob Sync] Successfully restored database (${buffer.byteLength} bytes) to ${targetPath}`);
          return;
        }
      }
    }
  } catch (err) {
    console.warn('[Vercel Blob Sync] Notice on restore (will use fresh production database):', (err as Error).message);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

export function persistDatabaseToCloud(): void {
  const token = getBlobToken();
  if (!token) {
    return;
  }

  // Debounce consecutive rapid writes within 1.5 seconds
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    const targetPath = getResolvedDbPath();
    if (!fs.existsSync(targetPath)) return;

    try {
      const buffer = fs.readFileSync(targetPath);
      if (buffer.length > 0) {
        await put(DB_FILENAME, buffer, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          token,
        });
        console.log(`[Vercel Blob Sync] Persisted database (${buffer.length} bytes) to Vercel Blob`);
      }
    } catch (err) {
      console.error('[Vercel Blob Sync] Error persisting database to Vercel Blob:', (err as Error).message);
    }
  }, 1500);
}
