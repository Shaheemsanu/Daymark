import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../utils/constants';

export function CompactDateNavigator({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const today = formatDate(new Date());
  const isToday = date === today;
  const selected = new Date(`${date}T12:00:00`);
  const displayDate = selected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const nearbyDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(selected);
    day.setDate(day.getDate() + index - 3);
    return { date: formatDate(day), label: day.toLocaleDateString('en-US', { weekday: 'short' }), number: day.getDate() };
  });
  const move = (offset: number) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + offset);
    onChange(formatDate(next));
  };
  const button = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
  return (
    <div role="group" aria-label="Date navigation" className="mb-3 flex h-10 w-full max-w-full items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex min-w-0 flex-1 items-center rounded-lg bg-slate-50 px-0.5 md:flex-none dark:bg-slate-950/50">
      <button type="button" aria-label="Previous day" title="Previous day" className={button} onClick={() => move(-1)}><ChevronLeft className="h-3.5 w-3.5" /></button>
      <div className="relative flex h-8 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 transition-colors hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 md:flex-none dark:hover:bg-slate-800/70">
        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
        <span aria-hidden="true" className="truncate whitespace-nowrap font-semibold tabular-nums text-slate-800 dark:text-slate-100"><span className="mr-1.5 font-normal text-slate-500 dark:text-slate-400">{selected.toLocaleDateString('en-US', { weekday: 'short' })}</span>{displayDate}</span>
        <input type="date" aria-label="Selected date" title="Choose date" value={date}
          onClick={event => { event.currentTarget.showPicker?.(); }}
          onChange={event => { if (event.target.value && !Number.isNaN(event.target.valueAsNumber)) onChange(event.target.value); }}
          className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0" />
      </div>
      <button type="button" aria-label="Next day" title="Next day" className={button} onClick={() => move(1)}><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
      <div className="hidden min-w-0 flex-1 grid-cols-7 gap-1 border-l border-slate-200 pl-1.5 md:grid dark:border-slate-800">
        {nearbyDays.map(day => (
          <button key={day.date} type="button" aria-label={`Select ${day.date}`} aria-pressed={day.date === date} aria-current={day.date === today ? 'date' : undefined} onClick={() => onChange(day.date)}
            className={`flex h-8 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${day.date === date
              ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}>
            <span className={`text-[9px] font-medium uppercase leading-none tracking-wider ${day.date === date ? 'text-blue-100' : ''}`}>{day.label}</span>
            <span className="relative text-[13px] font-semibold leading-none tabular-nums">{day.number}
              {day.date === today && <span aria-hidden="true" className={`absolute -right-2 top-0.5 h-1 w-1 rounded-full ${day.date === date ? 'bg-white' : 'bg-emerald-500'}`} />}
            </span>
          </button>
        ))}
      </div>
      <button type="button" disabled={isToday} onClick={() => onChange(today)} className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isToday ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-400'}`}>
        {isToday && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-500" />}Today
      </button>
    </div>
  );
}
