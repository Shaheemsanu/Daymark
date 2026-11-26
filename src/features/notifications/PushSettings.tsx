import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushRestoreError, hasLocalPushRegistration, isPushSoundEnabled, setPushSoundEnabled } from './pushRegistration';
import { supabase } from '../../lib/supabase';
import { playNotificationSound, unlockNotificationSound } from './notificationSound';

export function PushSettings({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(() => hasLocalPushRegistration(userId));
  const [soundEnabled, setSoundEnabled] = useState(() => isPushSoundEnabled(userId));
  const [restoreError, setRestoreError] = useState(() => getPushRestoreError(userId));
  useEffect(() => {
    const update = () => { setEnabled(hasLocalPushRegistration(userId)); setSoundEnabled(isPushSoundEnabled(userId)); setRestoreError(getPushRestoreError(userId)); };
    update();
    window.addEventListener('daymark-push-registration-change', update);
    return () => window.removeEventListener('daymark-push-registration-change', update);
  }, [userId]);
  const run = async (enable: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      if (enable) await enablePush(userId); else await disablePush(userId);
      setEnabled(enable);
      setMessage(enable ? 'This device is registered for notifications.' : 'Notifications disabled for this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };
  const sendTest = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (!supabase) throw new Error('Connect Supabase first.');
      const { data, error } = await supabase.functions.invoke('push-test', { method: 'POST' });
      if (error) throw error;
      setMessage(`Firebase accepted the test for ${data.sent} of ${data.total} registered devices. To test a locked phone, send the test from another signed-in device while the phone is locked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };
  const testSound = async () => {
    const ready = await unlockNotificationSound();
    setMessage(ready && playNotificationSound() ? 'Notification sound played.' : 'The browser could not play the sound. Check your device and browser sound settings.');
  };
  const toggleSound = async () => {
    setBusy(true); setMessage('');
    try { await setPushSoundEnabled(userId, !soundEnabled); setMessage(!soundEnabled ? 'Notification sound is on for this device.' : 'Notification sound is off for this device.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Notifications" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Receive push notifications on this device.</p></div>
      <button type="button" role="switch" aria-label="Push notifications on this device" aria-checked={enabled} disabled={busy} onClick={() => void run(!enabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'left-1 translate-x-5' : 'left-1'}`} />
      </button>
    </div>
    {enabled && <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800"><div><h3 className="text-sm font-semibold">Notification sound</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Play a sound for notifications on this device.</p></div><button type="button" role="switch" aria-label="Notification sound on this device" aria-checked={soundEnabled} disabled={busy} onClick={() => void toggleSound()} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${soundEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${soundEnabled ? 'left-1 translate-x-5' : 'left-1'}`} /></button></div>}
    <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Advanced</summary>
      <button type="button" disabled={busy} onClick={() => void sendTest()} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700">Send test notification</button>
      {enabled && soundEnabled && <button type="button" disabled={busy} onClick={() => void testSound()} className="ml-2 mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700">Test sound</button>}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Background notification sounds follow your browser and device settings.</p>
    </details>
    {restoreError && <div role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300"><p>Could not restore notifications: {restoreError}</p><button type="button" disabled={busy} onClick={() => void run(true)} className="mt-1 font-semibold underline">Retry registration</button></div>}
    {message && <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
  </section>;
}
