import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(), deleteToken: vi.fn(), isSupported: vi.fn(), getMessaging: vi.fn(),
  upsert: vi.fn(), remove: vi.fn(), update: vi.fn(), soundResult: vi.fn(), requestPermission: vi.fn(),
}));
vi.mock('firebase/messaging', () => ({ getToken: mocks.getToken, deleteToken: mocks.deleteToken, isSupported: mocks.isSupported, getMessaging: mocks.getMessaging }));
vi.mock('../lib/firebase', () => ({ firebaseApp: {} }));
vi.mock('../lib/supabase', () => ({ supabase: { from: (table: string) => table === 'push_tokens' ? { upsert: mocks.upsert, update: (value: unknown) => { mocks.update(value); return { eq: () => ({ eq: () => ({ select: mocks.soundResult }) }) }; }, delete: () => ({ eq: () => ({ eq: mocks.remove }) }) } : { upsert: mocks.upsert } } }));

import { disablePush, enablePush, hasLocalPushRegistration, isPushSoundEnabled, setPushSoundEnabled, suspendPush } from '../features/notifications/pushRegistration';

describe('device notification preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getToken.mockResolvedValue('device-token');
    mocks.deleteToken.mockResolvedValue(true);
    mocks.isSupported.mockResolvedValue(true);
    mocks.getMessaging.mockReturnValue({});
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.soundResult.mockResolvedValue({ data: [{ token: 'device-token' }], error: null });
    mocks.requestPermission.mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: mocks.requestPermission });
    vi.stubGlobal('crypto', { subtle: { importKey: vi.fn().mockResolvedValue({}) } });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn().mockResolvedValue({ active: {} }) } });
    vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'B' + 'A'.repeat(86));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); localStorage.clear(); });

  it('remembers the account preference across sign-out and restores registration on sign-in', async () => {
    await enablePush('user-a');
    expect(hasLocalPushRegistration('user-a')).toBe(true);
    expect(hasLocalPushRegistration('user-b')).toBe(false);
    await suspendPush('user-a');
    expect(mocks.remove).toHaveBeenCalledWith('user_id', 'user-a');
    expect(localStorage.getItem('daymark-push-token')).toBeNull();
    expect(hasLocalPushRegistration('user-a')).toBe(true);
    expect(hasLocalPushRegistration('user-b')).toBe(false);
    await enablePush('user-a', true);
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ token: 'device-token', user_id: 'user-a' }));
    await disablePush('user-a');
    expect(hasLocalPushRegistration('user-a')).toBe(false);
    await suspendPush('user-a');
    expect(hasLocalPushRegistration('user-a')).toBe(false);
  });

  it('retains a legacy device preference on sign-out', async () => {
    localStorage.setItem('daymark-push-token', 'legacy-token');
    await suspendPush('user-a');
    expect(hasLocalPushRegistration('user-a')).toBe(true);
    expect(hasLocalPushRegistration('user-b')).toBe(false);
  });

  it('saves sound per account and restores it when the device re-registers', async () => {
    await enablePush('user-a');
    expect(isPushSoundEnabled('user-a')).toBe(true);
    await setPushSoundEnabled('user-a', false);
    expect(mocks.update).toHaveBeenCalledWith({ sound_enabled: false });
    expect(isPushSoundEnabled('user-a')).toBe(false);
    expect(isPushSoundEnabled('user-b')).toBe(true);
    await suspendPush('user-a');
    await enablePush('user-a', true);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ token: 'device-token', user_id: 'user-a', sound_enabled: false }));
    await setPushSoundEnabled('user-a', true);
    expect(isPushSoundEnabled('user-a')).toBe(true);
  });

  it('keeps the previous sound preference when the server update fails', async () => {
    await enablePush('user-a');
    mocks.soundResult.mockResolvedValue({ data: null, error: new Error('Could not update') });
    await expect(setPushSoundEnabled('user-a', false)).rejects.toThrow('Could not update');
    expect(isPushSoundEnabled('user-a')).toBe(true);
  });

  it('finishes an in-flight registration before removing the token on sign-out', async () => {
    let finish!: (token: string) => void;
    mocks.getToken.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
    const enabling = enablePush('user-a');
    const signingOut = suspendPush('user-a');
    await vi.waitFor(() => expect(mocks.getToken).toHaveBeenCalled());
    finish('device-token');
    await Promise.all([enabling, signingOut]);
    expect(mocks.remove).toHaveBeenCalledWith('user_id', 'user-a');
    expect(localStorage.getItem('daymark-push-token')).toBeNull();
    expect(hasLocalPushRegistration('user-a')).toBe(true);
  });
});
