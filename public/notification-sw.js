// Service Worker Notification Scheduler (Plan 1)
// Handles native Notification Triggers & memory fallback timers when page is closed/backgrounded.

// Keep track of memory fallback timeouts for browsers without Notification Triggers support.
let activeTimers = [];

// Clear all active memory timers
function clearAllTimers() {
  activeTimers.forEach(item => clearTimeout(item.timerId));
  activeTimers = [];
}

// Schedules a single local notification reminder
async function scheduleReminder(reminder) {
  const now = Date.now();
  if (reminder.date <= now) return;

  const title = reminder.title || 'Lumi Note Reminder';
  const options = {
    body: reminder.body || '',
    tag: reminder.id,
    icon: '/favicon-192-v18.png',
    badge: '/favicon-48-v18.png',
    data: { id: reminder.id },
    requireInteraction: true // Keep the notification visible until user clicks it
  };

  // 1. Try to use native TimestampTrigger API if supported by browser/platform (triggers even when browser is closed)
  if ('showTrigger' in Notification.prototype && typeof TimestampTrigger !== 'undefined') {
    try {
      options.showTrigger = new TimestampTrigger(reminder.date);
      await self.registration.showNotification(title, options);
      console.log(`[SW] Scheduled native trigger for ${reminder.id} at ${new Date(reminder.date).toISOString()}`);
      return;
    } catch (e) {
      console.warn('[SW] Failed to set native TimestampTrigger, falling back to setTimeout:', e);
    }
  }

  // 2. Fallback: Schedule using memory-based setTimeout (runs as long as SW or background tabs remain active)
  const delay = reminder.date - now;
  // Ensure the delay doesn't overflow standard 32-bit signed integer (approx. 24.8 days)
  if (delay < 2147483647) {
    const timerId = setTimeout(async () => {
      // 如果页面当前处于前台（用户正在看），则跳过系统通知
      // 前台由应用内白色卡片处理，避免重复通知
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasFocusedClient = clients.some(c => c.visibilityState === 'visible');
      if (!hasFocusedClient) {
        self.registration.showNotification(title, {
          body: options.body,
          tag: options.tag,
          icon: options.icon,
          badge: options.badge,
          data: options.data,
          requireInteraction: options.requireInteraction
        });
      }
      // Remove from active list once fired
      activeTimers = activeTimers.filter(t => t.id !== reminder.id);
    }, delay);
    activeTimers.push({ id: reminder.id, timerId });
    console.log(`[SW] Scheduled fallback timer for ${reminder.id} in ${delay}ms`);
  }
}

// Listen to message events from client window to sync future reminders
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_REMINDERS') {
    const reminders = event.data.reminders || [];
    console.log('[SW] Received reminders to sync:', reminders);

    event.waitUntil((async () => {
      // 1. Cancel any active native triggers that are no longer needed
      if ('showTrigger' in Notification.prototype && typeof TimestampTrigger !== 'undefined') {
        try {
          const activeNotifications = await self.registration.getNotifications({ includeTriggered: true });
          const newReminderIds = new Set(reminders.map(r => r.id));

          for (const notification of activeNotifications) {
            // If there's an outstanding trigger that isn't in the incoming sync list, cancel it
            if (notification.tag && !newReminderIds.has(notification.tag)) {
              notification.close();
              console.log(`[SW] Cancelled native trigger for: ${notification.tag}`);
            }
          }
        } catch (e) {
          console.warn('[SW] Error cleaning native triggers:', e);
        }
      }

      // 2. Clear all active fallback timeouts
      clearAllTimers();

      // 3. Reschedule all upcoming reminders
      for (const reminder of reminders) {
        await scheduleReminder(reminder);
      }
    })());
  }
});

// Listen to notification click events to focus or open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus the first open application window
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          try {
            return client.focus();
          } catch (e) {
            console.error('[SW] Focus client failed:', e);
          }
        }
      }
      // If no window is open, open a new one pointing to root scope
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// ========================
// Web Push 服务端推送支持
// ========================
// 当 Supabase Edge Function 通过 Web Push API 发来推送时触发
// 即使页面关闭、浏览器在后台也能接收
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Lumi Note Reminder', body: event.data.text() };
  }

  const title = data.title || 'Lumi Note Reminder';
  const options = {
    body: data.body || '',
    tag: data.tag || 'lumi-push-' + Date.now(),
    icon: data.icon || '/favicon-192-v18.png',
    badge: data.badge || '/favicon-48-v18.png',
    data: data.data || {},
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
