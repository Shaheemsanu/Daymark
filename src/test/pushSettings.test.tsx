import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ registered: vi.fn(), sound: vi.fn(), setSound: vi.fn() }));
vi.mock('../features/notifications/pushRegistration', () => ({
  hasLocalPushRegistration: mocks.registered, isPushSoundEnabled: mocks.sound, setPushSoundEnabled: mocks.setSound,
  getPushRestoreError: () => '', disablePush: vi.fn(), enablePush: vi.fn(),
}));
vi.mock('../features/notifications/notificationSound', () => ({ unlockNotificationSound: vi.fn(), playNotificationSound: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: null }));
import { PushSettings } from '../features/notifications/PushSettings';

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('shows the sound switch only when notifications are enabled and saves the choice', async () => {
  mocks.registered.mockReturnValue(false);
  mocks.sound.mockReturnValue(true);
  const view = render(<PushSettings userId="user-a" />);
  expect(screen.queryByRole('switch', { name: 'Notification sound on this device' })).not.toBeInTheDocument();
  mocks.registered.mockReturnValue(true);
  mocks.setSound.mockImplementation(async () => { mocks.sound.mockReturnValue(false); window.dispatchEvent(new Event('daymark-push-registration-change')); });
  view.rerender(<PushSettings userId="user-b" />);
  const sound = screen.getByRole('switch', { name: 'Notification sound on this device' });
  expect(sound).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(sound);
  await waitFor(() => expect(sound).toHaveAttribute('aria-checked', 'false'));
  expect(mocks.setSound).toHaveBeenCalledWith('user-b', false);
});
