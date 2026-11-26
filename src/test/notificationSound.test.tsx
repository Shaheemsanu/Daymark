import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ onMessage: vi.fn(), unlock: vi.fn(), play: vi.fn(), unsubscribe: vi.fn(), soundEnabled: vi.fn(() => true) }));
vi.mock('firebase/messaging', () => ({ getMessaging: () => ({}), isSupported: () => Promise.resolve(true), onMessage: mocks.onMessage }));
vi.mock('../lib/firebase', () => ({ firebaseApp: {} }));
vi.mock('../lib/supabase', () => ({ supabase: null }));
vi.mock('../features/notifications/pushRegistration', () => ({ hasLocalPushRegistration: () => true, isPushSoundEnabled: mocks.soundEnabled, enablePush: () => Promise.resolve(), reportPushRestoreError: vi.fn() }));
vi.mock('../features/notifications/notificationSound', () => ({ unlockNotificationSound: mocks.unlock, playNotificationSound: mocks.play }));
import { ForegroundPush } from '../features/notifications/ForegroundPush';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('unlocks audio on interaction and plays a sound for a foreground push', async () => {
  mocks.onMessage.mockReturnValue(mocks.unsubscribe);
  mocks.unlock.mockResolvedValue(true);
  render(<ForegroundPush userId="user-a" onNavigate={vi.fn()} />);
  fireEvent.pointerDown(window);
  expect(mocks.unlock).toHaveBeenCalled();
  await vi.waitFor(() => expect(mocks.onMessage).toHaveBeenCalled());
  const receive = mocks.onMessage.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  receive({ messageId: 'notice', notification: { title: 'Reminder', body: 'Payment due' } });
  expect(mocks.play).toHaveBeenCalledTimes(1);
  await screen.findByText('Reminder');
  mocks.soundEnabled.mockReturnValue(false);
  receive({ notification: { title: 'Silent reminder' } });
  expect(mocks.play).toHaveBeenCalledTimes(1);
  cleanup();
  expect(mocks.unsubscribe).toHaveBeenCalled();
  receive({ notification: { title: 'Late event' } });
  expect(mocks.play).toHaveBeenCalledTimes(1);
});
