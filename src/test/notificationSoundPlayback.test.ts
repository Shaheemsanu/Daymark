import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('unlocks audio after a gesture and plays the notification chime', async () => {
  const start = vi.fn(), stop = vi.fn(), disconnect = vi.fn();
  const oscillator = () => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect, start, stop, onended: null });
  const gain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
  class FakeAudioContext {
    state = 'suspended';
    currentTime = 10;
    destination = {};
    createOscillator = vi.fn(oscillator);
    createGain = vi.fn(gain);
    resume = vi.fn(async () => { this.state = 'running'; });
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  const { playNotificationSound, unlockNotificationSound } = await import('../features/notifications/notificationSound');
  expect(playNotificationSound()).toBe(false);
  expect(await unlockNotificationSound()).toBe(true);
  expect(playNotificationSound()).toBe(true);
  expect(start).toHaveBeenCalledTimes(2);
  expect(stop).toHaveBeenCalledTimes(2);
});
