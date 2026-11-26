import { getMessaging, getToken, isSupported, deleteToken } from 'firebase/messaging';
import { firebaseApp } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';

const savedTokenKey = 'daymark-push-token';
const savedOwnerKey = 'daymark-push-token-owner';
const preferenceKey = (userId: string) => `daymark-push-enabled:${userId}`;
const soundPreferenceKey = (userId: string) => `daymark-push-sound:${userId}`;
let activeRegistration: Promise<void> | null = null;
const restoreErrors = new Map<string, string>();

export function hasLocalPushRegistration(userId: string) {
  try {
    const owner = localStorage.getItem(savedOwnerKey);
    const legacyToken = !!localStorage.getItem(savedTokenKey) && (!owner || owner === userId);
    return typeof Notification !== 'undefined' && Notification.permission === 'granted' && (localStorage.getItem(preferenceKey(userId)) === 'true' || legacyToken);
  }
  catch { return false; }
}
export function getPushRestoreError(userId: string) { return restoreErrors.get(userId) || ''; }
export function isPushSoundEnabled(userId: string) {
  try { return localStorage.getItem(soundPreferenceKey(userId)) !== 'off'; } catch { return true; }
}
export async function setPushSoundEnabled(userId: string, enabled: boolean) {
  if (activeRegistration) await activeRegistration;
  if (!supabase) throw new Error('Connect Supabase before changing notification sound.');
  const token = localStorage.getItem(savedTokenKey);
  const owner = localStorage.getItem(savedOwnerKey);
  if (!token || (owner && owner !== userId)) throw new Error('This device is not registered. Retry notification registration first.');
  const { data, error } = await supabase.from('push_tokens').update({ sound_enabled: enabled }).eq('token', token).eq('user_id', userId).select('token');
  if (error) throw error;
  if (!data?.length) throw new Error('This device is not registered. Retry notification registration first.');
  localStorage.setItem(soundPreferenceKey(userId), enabled ? 'on' : 'off');
  window.dispatchEvent(new Event('daymark-push-registration-change'));
}
export function reportPushRestoreError(userId: string, error: unknown) {
  restoreErrors.set(userId, error instanceof Error ? error.message : String(error));
  window.dispatchEvent(new Event('daymark-push-registration-change'));
}

async function validateVapidKey(value: string): Promise<string> {
  const key = value.trim();
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('Invalid encoding');
    const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
    if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Invalid length');
    await crypto.subtle.importKey('raw', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch {
    throw new Error('The Firebase Web Push public key in this app build is invalid or incomplete. Check VITE_FIREBASE_VAPID_KEY, restart the development server, or update the hosting environment and redeploy.');
  }
  return key;
}

async function registerPush(userId: string, refresh = false) {
  if (!supabase) throw new Error('Connect Supabase before enabling notifications.');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Push notifications are not supported in this browser.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Allow notifications in your browser’s site settings, then refresh this page.');
  // Request directly in response to the button click, including on iOS.
  const permission = refresh ? Notification.permission : await Notification.requestPermission();
  if (permission === 'denied') throw new Error('Notifications are blocked. Allow notifications in your browser’s site settings, then refresh this page.');
  if (permission !== 'granted') throw new Error('Please allow notifications in the browser permission prompt, then try again.');
  if (!await isSupported()) throw new Error('Firebase Messaging is not supported in this browser.');
  const configuredKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!configuredKey) throw new Error('The Firebase Web Push key is missing.');
  const vapidKey = await validateVapidKey(configuredKey);
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
  const { error } = await supabase.from('push_tokens').upsert({ token, user_id: userId, sound_enabled: isPushSoundEnabled(userId), updated_at: new Date().toISOString() });
  if (error) throw error;
  if (!refresh) {
    const { error: preferenceError } = await supabase.from('reminder_preferences').upsert({ user_id: userId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (preferenceError) throw preferenceError;
  }
  localStorage.setItem(savedTokenKey, token);
  localStorage.setItem(savedOwnerKey, userId);
  localStorage.setItem(preferenceKey(userId), 'true');
  restoreErrors.delete(userId);
  window.dispatchEvent(new Event('daymark-push-registration-change'));
}

export function enablePush(userId: string, refresh = false): Promise<void> {
  if (activeRegistration) return activeRegistration;
  const operation = registerPush(userId, refresh);
  activeRegistration = operation;
  void operation.finally(() => { if (activeRegistration === operation) activeRegistration = null; }).catch(() => {});
  return operation;
}

async function removeDeviceRegistration(userId: string, preservePreference: boolean) {
  if (activeRegistration) await activeRegistration.catch(() => {});
  const owner = localStorage.getItem(savedOwnerKey);
  if (owner && owner !== userId) {
    if (!preservePreference) localStorage.removeItem(preferenceKey(userId));
    return;
  }
  const token = localStorage.getItem(savedTokenKey);
  if (preservePreference && token) localStorage.setItem(preferenceKey(userId), 'true');
  if (token && supabase) {
    const { error } = await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', userId);
    if (error) throw error;
  }
  if (token && await isSupported()) await deleteToken(getMessaging(firebaseApp));
  localStorage.removeItem(savedTokenKey);
  localStorage.removeItem(savedOwnerKey);
  if (!preservePreference) localStorage.removeItem(preferenceKey(userId));
  restoreErrors.delete(userId);
  window.dispatchEvent(new Event('daymark-push-registration-change'));
}

export async function disablePush(userId: string) { await removeDeviceRegistration(userId, false); }
export async function suspendPush(userId: string) { await removeDeviceRegistration(userId, true); }
