import type { Request, Response } from 'express';
import { createApp } from '../src/server/app.ts';
import { ensureCloudSync, persistDatabaseToCloud } from '../src/server/cloud-sync.ts';

const app = createApp();
let syncPromise: Promise<void> | null = null;

export default async function handler(req: Request, res: Response) {
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN || Object.keys(process.env).some((k) => k.endsWith('BLOB_READ_WRITE_TOKEN')));
  if (hasBlobToken && !syncPromise) {
    syncPromise = ensureCloudSync();
  }
  if (syncPromise) {
    await syncPromise;
  }

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method || '')) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        persistDatabaseToCloud();
      }
    });
  }

  return app(req, res);
}
