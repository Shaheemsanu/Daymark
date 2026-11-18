import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = { label: string; value: string; onChange: (value: string) => void };

export function HabitTimeInput({ label, value, onChange }: Props) {
  const [hours, minutes] = value ? value.split(':').map(Number) : [9, 0];
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  const [hourDraft, setHourDraft] = useState(value ? String(hour12) : '');
  const [minuteDraft, setMinuteDraft] = useState(value ? String(minutes).padStart(2, '0') : '');
  const [openList, setOpenList] = useState<'hour' | 'minute' | null>(null);
  const containerRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!openList) return;
    const close = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpenList(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenList(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [openList]);
  useEffect(() => {
    setHourDraft(value ? String(hour12) : '');
    setMinuteDraft(value ? String(minutes).padStart(2, '0') : '');
  }, [value, hour12, minutes]);
  const update = (hour: number, minute: number, ampm: string) => {
    const hour24 = (hour % 12) + (ampm === 'PM' ? 12 : 0);
    onChange(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  const selectClass = 'min-w-0 w-full appearance-none bg-transparent py-2.5 text-center text-sm font-medium text-slate-900 [color-scheme:light] focus:rounded focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 dark:text-slate-100 dark:[color-scheme:dark] [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-800 dark:[&>option]:text-slate-100';
  const commitHour = () => {
    const hour = Number(hourDraft);
    if (hourDraft && hour >= 1 && hour <= 12) update(hour, minutes, period);
    else setHourDraft(value ? String(hour12) : '');
  };
  const commitMinute = () => {
    const minute = Number(minuteDraft);
    if (minuteDraft && minute >= 0 && minute <= 59) update(hour12, minute, period);
    else setMinuteDraft(value ? String(minutes).padStart(2, '0') : '');
  };
  return <fieldset ref={containerRef} className="min-w-0">
    <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</legend>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,0.9fr)] items-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
      <div className="relative flex min-w-0 items-center">
        <input aria-label={`${label} hour`} inputMode="numeric" type="text" maxLength={2} placeholder="hh" value={hourDraft} onChange={event => setHourDraft(event.target.value.replace(/\D/g, ''))} onBlur={commitHour} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} className={`${selectClass} pl-1 pr-4`} />
        <button type="button" aria-label={`${label} choose hour`} aria-expanded={openList === 'hour'} onClick={() => setOpenList(openList === 'hour' ? null : 'hour')} className="absolute inset-y-0 right-0 flex w-5 items-center justify-center text-slate-500 dark:text-slate-400"><ChevronDown aria-hidden="true" className="h-3 w-3" /></button>
        {openList === 'hour' && <div role="group" aria-label={`${label} hour options`} className="absolute bottom-full left-0 z-50 mb-1 max-h-36 min-w-16 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">{Array.from({ length: 12 }, (_, index) => index + 1).map(hour => <button type="button" key={hour} onClick={() => { update(hour, minutes, period); setOpenList(null); }} className="block w-full rounded px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-800">{hour}</button>)}</div>}
      </div>
      <span aria-hidden="true" className="text-sm text-slate-400">:</span>
      <div className="relative flex min-w-0 items-center">
        <input aria-label={`${label} minute`} inputMode="numeric" type="text" maxLength={2} placeholder="mm" value={minuteDraft} onChange={event => setMinuteDraft(event.target.value.replace(/\D/g, ''))} onBlur={commitMinute} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} className={`${selectClass} pl-1 pr-4`} />
        <button type="button" aria-label={`${label} choose minute`} aria-expanded={openList === 'minute'} onClick={() => setOpenList(openList === 'minute' ? null : 'minute')} className="absolute inset-y-0 right-0 flex w-5 items-center justify-center text-slate-500 dark:text-slate-400"><ChevronDown aria-hidden="true" className="h-3 w-3" /></button>
        {openList === 'minute' && <div role="group" aria-label={`${label} minute options`} className="absolute bottom-full left-0 z-50 mb-1 max-h-36 min-w-16 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">{Array.from({ length: 60 }, (_, minute) => <button type="button" key={minute} onClick={() => { update(hour12, minute, period); setOpenList(null); }} className="block w-full rounded px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-800">{String(minute).padStart(2, '0')}</button>)}</div>}
      </div>
      <select aria-label={`${label} AM or PM`} value={value ? period : ''} onChange={event => event.target.value && update(hour12, minutes, event.target.value)} className={`${selectClass} border-l border-slate-200 text-emerald-700 dark:border-slate-700 dark:text-emerald-400`}>
        {!value && <option value="">AM</option>}
        <option value="AM">AM</option><option value="PM">PM</option>
      </select>
    </div>
  </fieldset>;
}
