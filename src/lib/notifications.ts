/**
 * Safe notification utility to avoid "Illegal constructor" errors in environments
 * where 'new Notification()' is prohibited (e.g., some mobile browsers or PWA contexts).
 */
export async function showSystemNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  // Try using ServiceWorkerRegistration if available
  if ('serviceWorker' in navigator) {
    try {
      // Use getRegistration() instead of .ready to avoid hanging indefinitely if no SW is registered
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        return await registration.showNotification(title, options);
      }
    } catch (err) {
      console.error('Failed to show notification via Service Worker:', err);
    }
  }

  // Fallback to standard constructor
  try {
    return new Notification(title, options);
  } catch (err) {
    // In some mobile environments, this will throw "TypeError: Illegal constructor"
    console.error('Failed to construct Notification:', err);
  }
}
