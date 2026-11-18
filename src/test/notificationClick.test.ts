import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

it.each([true, false])('opens the notification section with an existing window: %s', async existing => {
  let click!: (event: any) => void;
  const client = { url: 'https://example.com/app/', focus: vi.fn(async () => client), postMessage: vi.fn() };
  const clients = { matchAll: vi.fn(async () => existing ? [client] : []), openWindow: vi.fn(async () => null) };
  const self = { location: { href: 'https://example.com/app/firebase-messaging-sw.js', origin: 'https://example.com' }, clients, addEventListener: (name: string, handler: typeof click) => { if (name === 'notificationclick') click = handler; } };
  runInNewContext(readFileSync('public/firebase-messaging-sw.js', 'utf8'), { self, URL, importScripts: () => {}, firebase: { initializeApp: () => {}, messaging: () => {} } });
  let completion!: Promise<void>;
  click({ notification: { data: { FCM_MSG: { data: { view: 'tasks' } } }, close: vi.fn() }, stopImmediatePropagation: vi.fn(), waitUntil: (promise: Promise<void>) => { completion = promise; } });
  await completion;
  if (existing) {
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'daymark-notification-navigation', view: 'tasks' });
    expect(client.focus).toHaveBeenCalled();
  } else expect(clients.openWindow).toHaveBeenCalledWith('https://example.com/app/?notificationView=tasks');
});
