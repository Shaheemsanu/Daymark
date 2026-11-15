import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { WellnessGoals } from '../types';

export function WellnessGoalSettings({ goals, onSave }: { goals: WellnessGoals; onSave: (goals: WellnessGoals) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [water, setWater] = useState(String(goals.waterMl));
  const [sleep, setSleep] = useState(String(goals.sleepHours));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900';
  return <>
    <button type="button" aria-expanded={open} disabled={busy} onClick={() => {
      if (!open) { setWater(String(goals.waterMl)); setSleep(String(goals.sleepHours)); setError(''); }
      setOpen(!open);
    }} className="inline-flex justify-self-start sm:justify-self-end items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Settings2 className="h-3.5 w-3.5" />Set wellness goals</button>
    {open && <form aria-label="Wellness goals" className="col-span-full rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40" onSubmit={async event => {
      event.preventDefault();
      const waterMl = Number(water), sleepHours = Number(sleep);
      if (busy) return;
      if (!Number.isFinite(waterMl) || waterMl <= 0 || waterMl > 5000 || !Number.isFinite(sleepHours) || sleepHours <= 0 || sleepHours > 16) { setError('Choose water between 1 and 5,000 ml and sleep above 0 and up to 16 hours.'); return; }
      setBusy(true); setError('');
      try {
        if (await onSave({ waterMl, sleepHours })) setOpen(false);
        else setError('Could not save your goals. Please try again.');
      } catch { setError('Could not save your goals. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">Daily water goal (ml)<input type="number" min="1" max="5000" step="1" required disabled={busy} value={water} onChange={event => setWater(event.target.value)} className={field} /></label>
        <label className="text-xs font-medium">Daily sleep goal (hours)<input type="number" min="0.1" max="16" step="any" required disabled={busy} value={sleep} onChange={event => setSleep(event.target.value)} className={field} /></label>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Your goals apply to progress bars and wellness analytics. One glass of water is 250 ml.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}
      <div className="mt-3 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xs text-slate-500">Cancel</button><button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save goals'}</button></div>
    </form>}
  </>;
}
