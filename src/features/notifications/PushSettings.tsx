import { useEffect, useState } from 'react';
import { disablePush, enablePush, hasLocalPushRegistration } from './pushRegistration';
import { supabase } from '../../lib/supabase';

export function PushSettings({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(hasLocalPushRegistration);
  useEffect(() => {
    if (!hasLocalPushRegistration()) return;
    let cancelled = false;
    setBusy(true);
    void enablePush(userId).then(() => {
      if (!cancelled) setEnabled(true);
    }).catch(error => {
      if (!cancelled) setMessage(`Could not refresh notification registration: ${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
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
      setMessage(`Test sent to ${data.sent} of ${data.total} registered devices.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };
  return <section aria-label="Notifications" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Receive push notifications on this device.</p></div>
      <button type="button" role="switch" aria-label="Push notifications on this device" aria-checked={enabled} disabled={busy} onClick={() => void run(!enabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'left-1 translate-x-5' : 'left-1'}`} />
      </button>
    </div>
    <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Advanced</summary>
      <button type="button" disabled={busy} onClick={() => void sendTest()} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700">Send test notification</button>
    </details>
    {message && <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
  </section>;
}
