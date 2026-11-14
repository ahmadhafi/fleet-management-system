import type { Request, Response } from 'express';
import { createApp } from '../src/server/app.ts';
import { ensureCloudSync, getBlobToken, persistDatabaseToCloudImmediate } from '../src/server/cloud-sync.ts';

const app = createApp();

export default async function handler(req: Request, res: Response) {
  const hasBlobToken = Boolean(getBlobToken());
  const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes((req.method || '').toUpperCase());

  if (hasBlobToken) {
    // Always verify latest Blob snapshot before mutations or auth/user queries
    const forceSync = isMutation || (req.url || '').includes('/auth/') || (req.url || '').includes('/users');
    await ensureCloudSync(forceSync);
  }

  if (hasBlobToken && isMutation) {
    let persisted = false;
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);

    res.json = ((body: unknown) => {
      if (!persisted && res.statusCode >= 200 && res.statusCode < 300) {
        persisted = true;
        persistDatabaseToCloudImmediate()
          .catch((err) => console.error('[Vercel Handler] Sync error on json:', err))
          .finally(() => {
            origJson(body);
          });
        return res;
      }
      return origJson(body);
    }) as typeof res.json;

    res.send = ((body?: unknown) => {
      if (!persisted && res.statusCode >= 200 && res.statusCode < 300) {
        persisted = true;
        persistDatabaseToCloudImmediate()
          .catch((err) => console.error('[Vercel Handler] Sync error on send:', err))
          .finally(() => {
            origSend(body);
          });
        return res;
      }
      return origSend(body);
    }) as typeof res.send;
  }

  return app(req, res);
}
