/**
 * Cross-platform Notification Dispatcher
 *
 * Resolves Chrome on Android error:
 * "TypeError: Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead."
 *
 * Implements:
 * 1. ServiceWorkerRegistration.showNotification() for Android Chrome, PWA & modern browsers
 * 2. new Notification() fallback for desktop Safari and older desktop browsers
 * 3. Graceful try/catch error handling that never crashes page execution
 */
export async function triggerSystemNotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const WinNotification = (window as any).Notification;
  if (!WinNotification) return false;

  try {
    if (WinNotification.permission !== 'granted') return false;
  } catch {
    return false;
  }

  const defaultOptions: NotificationOptions = {
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    ...options,
  };

  const nav = typeof navigator !== 'undefined' ? navigator : (window as any).navigator;

  // 1. Primary standard for Android Chrome, PWAs & modern desktop: ServiceWorkerRegistration.showNotification()
  if (nav && 'serviceWorker' in nav && nav.serviceWorker) {
    try {
      const reg = await nav.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, defaultOptions);
        return true;
      }

      // Check navigator.serviceWorker.ready with a short timeout to prevent hanging
      if (nav.serviceWorker.ready) {
        const readyReg = await Promise.race([
          nav.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
        ]);
        if (readyReg && typeof (readyReg as ServiceWorkerRegistration).showNotification === 'function') {
          await (readyReg as ServiceWorkerRegistration).showNotification(title, defaultOptions);
          return true;
        }
      }
    } catch {
      // Proceed to desktop constructor fallback
    }
  }

  // 2. Secondary fallback for Desktop Safari/browsers where new Notification() constructor is legal
  try {
    new WinNotification(title, defaultOptions);
    return true;
  } catch {
    // Silently ignore "Illegal constructor" on mobile platforms where window.Notification constructor is restricted
    return false;
  }
}
