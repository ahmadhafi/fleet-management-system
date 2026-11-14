import fs from 'node:fs';
import path from 'node:path';
import { put, head } from '@vercel/blob';

const DB_FILENAME = 'fleet-management.db';

export function getResolvedDbPath(): string {
  const isVercel = Boolean(process.env.VERCEL);
  return process.env.DB_PATH || (isVercel ? `/tmp/${DB_FILENAME}` : path.join(process.cwd(), 'data', DB_FILENAME));
}

let syncInitiated = false;

export async function ensureCloudSync(): Promise<void> {
  if (syncInitiated || !process.env.BLOB_READ_WRITE_TOKEN) {
    return;
  }
  syncInitiated = true;

  const targetPath = getResolvedDbPath();
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const meta = await head(DB_FILENAME).catch(() => null);
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
    console.warn('[Vercel Blob Sync] Notice on restore (will use seeded database):', (err as Error).message);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

export function persistDatabaseToCloud(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
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
        });
        console.log(`[Vercel Blob Sync] Persisted database (${buffer.length} bytes) to Vercel Blob`);
      }
    } catch (err) {
      console.error('[Vercel Blob Sync] Error persisting database to Vercel Blob:', (err as Error).message);
    }
  }, 1500);
}
