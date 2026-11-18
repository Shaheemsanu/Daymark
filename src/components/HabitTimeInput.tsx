type Props = { label: string; value: string; onChange: (value: string) => void };

export function HabitTimeInput({ label, value, onChange }: Props) {
  const [hours, minutes] = value ? value.split(':').map(Number) : [9, 0];
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  const update = (hour: number, minute: number, ampm: string) => {
    const hour24 = (hour % 12) + (ampm === 'PM' ? 12 : 0);
    onChange(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  const selectClass = 'min-w-0 w-full appearance-none bg-transparent py-2.5 text-center text-sm font-medium text-slate-900 [color-scheme:light] focus:rounded focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 dark:text-slate-100 dark:[color-scheme:dark] [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-800 dark:[&>option]:text-slate-100';
  return <fieldset className="min-w-0">
    <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</legend>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1.15fr)] items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <select aria-label={`${label} hour`} value={value ? hour12 : ''} onChange={event => event.target.value && update(Number(event.target.value), minutes, period)} className={selectClass}>
        {!value && <option value="">hh</option>}
        {Array.from({ length: 12 }, (_, index) => index + 1).map(hour => <option key={hour} value={hour}>{hour}</option>)}
      </select>
      <span aria-hidden="true" className="text-sm text-slate-400">:</span>
      <select aria-label={`${label} minute`} value={value ? minutes : ''} onChange={event => event.target.value !== '' && update(hour12, Number(event.target.value), period)} className={selectClass}>
        {!value && <option value="">mm</option>}
        {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}
      </select>
      <select aria-label={`${label} AM or PM`} value={value ? period : ''} onChange={event => event.target.value && update(hour12, minutes, event.target.value)} className={`${selectClass} border-l border-slate-200 text-emerald-700 dark:border-slate-700 dark:text-emerald-400`}>
        {!value && <option value="">AM</option>}
        <option value="AM">AM</option><option value="PM">PM</option>
      </select>
    </div>
  </fieldset>;
}
