// These Firebase web configuration values are public and passed by the app.
const params = new URL(self.location.href).searchParams;
// Register before Firebase so its default click handler does not consume the tap.
self.addEventListener('notificationclick', (event) => {
  const view = event.notification.data?.FCM_MSG?.data?.view;
  if (!['daily', 'expenses', 'habits', 'tasks', 'notes', 'reports', 'history', 'ai'].includes(view)) return;
  event.stopImmediatePropagation();
  event.notification.close();
  const base = new URL('./', self.location.href);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => {
      const url = new URL(client.url);
      return url.origin === base.origin && url.pathname.startsWith(base.pathname);
    });
    if (existing) {
      existing.postMessage({ type: 'daymark-notification-navigation', view });
      await existing.focus();
    } else {
      base.searchParams.set('notificationView', view);
      await self.clients.openWindow(base.href);
    }
  })());
});
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});
firebase.messaging();
