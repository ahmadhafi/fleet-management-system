import * as webpush from 'web-push';
import type { AppDatabase } from './db.ts';
import { liveEvents } from './events.ts';

let vapidInitialized = false;
let publicVapidKey = '';

export function ensureVapidKeys(db: AppDatabase): { publicKey: string; privateKey: string } {
  try {
    const pubRow = db.prepare("SELECT value FROM system_settings WHERE key = 'vapid_public_key'").get() as { value: string } | undefined;
    const privRow = db.prepare("SELECT value FROM system_settings WHERE key = 'vapid_private_key'").get() as { value: string } | undefined;

    let publicKey = process.env.VAPID_PUBLIC_KEY || pubRow?.value;
    let privateKey = process.env.VAPID_PRIVATE_KEY || privRow?.value;

    if (!publicKey || !privateKey) {
      const generated = webpush.generateVAPIDKeys();
      publicKey = generated.publicKey;
      privateKey = generated.privateKey;
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('vapid_public_key', ?, datetime('now'))").run(publicKey);
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('vapid_private_key', ?, datetime('now'))").run(privateKey);
    }

    if (!vapidInitialized || publicVapidKey !== publicKey) {
      try {
        webpush.setVapidDetails('mailto:fleet-ops@company.internal', publicKey, privateKey);
        vapidInitialized = true;
        publicVapidKey = publicKey;
      } catch {
        // ignore in test environments if invalid key
      }
    }

    return { publicKey, privateKey };
  } catch (err) {
    console.warn('[GalaxyFleet Push] VAPID key initialization skipped:', (err as Error).message);
    return { publicKey: '', privateKey: '' };
  }
}

/**
 * Sanitizes notification text to comply with NTF-06:
 * No personal phone/licence numbers or exact GPS coordinates on lock screen notifications.
 */
export function sanitizeNotificationText(text: string): string {
  return text
    .replace(/-?\d{1,2}\.\d{3,},\s*-?\d{1,3}\.\d{3,}/g, '[location redacted]')
    .replace(/SIM-[A-Z0-9-]+/gi, '[licence]')
    .replace(/\+\d[\d-\s]{7,}/g, '[phone]');
}

export function sendUserNotification(
  db: AppDatabase,
  params: {
    userId: number;
    triggerType: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: number;
    channel?: string;
    skipSseBroadcast?: boolean;
  }
): number {
  const safeTitle = sanitizeNotificationText(params.title);
  const safeBody = sanitizeNotificationText(params.body);

  const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(params.userId) as Array<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>;

  const deliveryStatus = subs.length > 0 ? 'PUSH_AND_IN_APP_SENT' : 'IN_APP_STORED';

  const result = db.prepare(`
    INSERT INTO notifications (
      user_id, trigger_type, title, body, related_entity_type, related_entity_id,
      channel, delivery_status, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(
    params.userId,
    params.triggerType,
    safeTitle,
    safeBody,
    params.relatedEntityType ?? null,
    params.relatedEntityId ?? null,
    params.channel ?? 'IN_APP_AND_PUSH',
    deliveryStatus
  );

  if (subs.length > 0) {
    ensureVapidKeys(db);
    const payload = JSON.stringify({
      title: safeTitle,
      body: safeBody,
      triggerType: params.triggerType,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      timestamp: new Date().toISOString(),
    });

    for (const sub of subs) {
      if (sub.endpoint.startsWith('https://test-push.internal/')) {
        continue;
      }
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        .catch(() => {
          // Non-blocking best-effort push delivery (Section 8.3 & NTF-05)
        });
    }
  }

  const notificationId = Number(result.lastInsertRowid);
  if (!params.skipSseBroadcast) {
    try {
      liveEvents.broadcast({
        type: 'NOTIFICATION',
        userId: params.userId,
        data: {
          id: notificationId,
          user_id: params.userId,
          trigger_type: params.triggerType,
          title: safeTitle,
          body: safeBody,
          related_entity_type: params.relatedEntityType ?? null,
          related_entity_id: params.relatedEntityId ?? null,
          channel: params.channel ?? 'IN_APP_AND_PUSH',
          delivery_status: deliveryStatus,
          is_read: 0,
          created_at: new Date().toISOString(),
        },
      });
    } catch {}
  }

  return notificationId;
}

export function notifyAdmins(
  db: AppDatabase,
  params: {
    triggerType: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: number;
  }
): void {
  const admins = db.prepare("SELECT id FROM users WHERE role IN ('ADM', 'FM', 'HWS') AND is_active = 1 AND approval_status = 'APPROVED'").all() as Array<{ id: number }>;
  for (const admin of admins) {
    sendUserNotification(db, {
      userId: admin.id,
      ...params,
    });
  }
}

export function notifyRole(
  db: AppDatabase,
  role: string,
  params: {
    triggerType: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: number;
  }
): void {
  const users = db.prepare("SELECT id FROM users WHERE role = ? AND is_active = 1 AND approval_status = 'APPROVED'").all(role) as Array<{ id: number }>;
  for (const u of users) {
    sendUserNotification(db, {
      userId: u.id,
      ...params,
    });
  }
}

