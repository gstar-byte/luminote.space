// Service Worker for Firebase Cloud Messaging (Web Push)
// Loaded automatically by the browser to handle background push alerts.

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-e17fe",
  appId: "1:363947566256:web:e3b68f791bb09269630775",
  apiKey: "AIzaSyDrgLyVQKJpgglo1VUTPMJ3GgSJYFEiYUw",
  messagingSenderId: "363947566256",
  authDomain: "luminote.space",
  storageBucket: "ai-studio-applet-webapp-e17fe.firebasestorage.app"
};

// Initialize Firebase compat inside Service Worker
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW BackgroundMessage] Received background FCM message:', payload);

  const title = payload.notification?.title || 'Lumi Note Reminder';
  const options = {
    body: payload.notification?.body || '',
    icon: '/favicon-192.png',
    badge: '/favicon-48.png',
    data: payload.data,
    requireInteraction: true // Keep the notification visible until user clicks it
  };

  self.registration.showNotification(title, options);
});

// Handle clicking of notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing browser window if available
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          try {
            return client.focus();
          } catch (e) {
            console.error('[SW FCM] Failed to focus window:', e);
          }
        }
      }
      // Or open a new client window pointing to root
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
