// Fleet Management System Service Worker (WEB-02, WEB-03, NTF-01, Revision #5)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications for Driver, Admin, and User
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Fleet Management Update',
    body: 'You have a new update in the Fleet Management System.',
    triggerType: 'SYSTEM_UPDATE',
  };

  if (event.data) {
    try {
      payload = Object.assign(payload, event.data.json());
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: payload.triggerType || 'fleet-notification',
    renotify: true,
    data: payload,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// WEB-03: Never serve cached business API data as current when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'Active network connection required. Offline business data caching is disabled to prevent stale fleet records (WEB-03).',
            offline: true,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
  }
});
