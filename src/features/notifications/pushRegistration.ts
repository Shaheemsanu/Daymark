import { getMessaging, getToken, isSupported, deleteToken } from 'firebase/messaging';
import { firebaseApp } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';

const savedTokenKey = 'daymark-push-token';

export function hasLocalPushRegistration() {
  try { return typeof Notification !== 'undefined' && Notification.permission === 'granted' && !!localStorage.getItem(savedTokenKey); }
  catch { return false; }
}

export async function enablePush(userId: string) {
  if (!supabase) throw new Error('Connect Supabase before enabling notifications.');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Push notifications are not supported in this browser.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Allow notifications in your browser’s site settings, then refresh this page.');
  // Request directly in response to the button click, including on iOS.
  const permission = await Notification.requestPermission();
  if (permission === 'denied') throw new Error('Notifications are blocked. Allow notifications in your browser’s site settings, then refresh this page.');
  if (permission !== 'granted') throw new Error('Please allow notifications in the browser permission prompt, then try again.');
  if (!await isSupported()) throw new Error('Firebase Messaging is not supported in this browser.');
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('The Firebase Web Push key is missing.');
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  const workerUrl = new URL('firebase-messaging-sw.js', base);
  workerUrl.search = params.toString();
  const registration = await navigator.serviceWorker.register(workerUrl.href, { scope: new URL('firebase-push/', base).pathname });
  const worker = registration.installing || registration.waiting;
  if (worker && !registration.active) {
    await new Promise<void>((resolve, reject) => {
      const check = () => {
        if (worker.state === 'activated') resolve();
        else if (worker.state === 'redundant') reject(new Error('The notification service worker could not start.'));
      };
      worker.addEventListener('statechange', check);
      check();
    });
  }
  const token = await getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Firebase did not return a device token.');
  const { error } = await supabase.from('push_tokens').upsert({ token, user_id: userId, updated_at: new Date().toISOString() });
  if (error) throw error;
  const { error: preferenceError } = await supabase.from('reminder_preferences').upsert({ user_id: userId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (preferenceError) throw preferenceError;
  localStorage.setItem(savedTokenKey, token);
}

export async function disablePush(userId: string) {
  const token = localStorage.getItem(savedTokenKey);
  if (token && supabase) {
    const { error } = await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', userId);
    if (error) throw error;
  }
  if (token && await isSupported()) await deleteToken(getMessaging(firebaseApp));
  localStorage.removeItem(savedTokenKey);
}
