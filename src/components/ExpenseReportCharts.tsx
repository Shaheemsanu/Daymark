import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { buildExpenseReport } from '../utils/expenseReports';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';

type Report = NonNullable<ReturnType<typeof buildExpenseReport>>;
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#f43f5e'];
const panelClass = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';

export function ExpenseReportCharts({ report, currency }: { report: Report; currency: string }) {
  const [view, setView] = useState<'trends' | 'breakdown' | 'calendar'>('trends');
  const money = (amount: number) => formatCurrency(amount, currency);
  const tooltip = (value: unknown) => money(Number(value));
  const axis = { fontSize: 10, fill: '#94a3b8' };
  const weeks = [...report.weeks].reverse().slice(-26).map(row => ({ name: formatDisplayDate(row.start), amount: row.amount }));
  const months = [...report.months].reverse().slice(-12).map(row => ({ name: row.period, amount: row.amount }));
  const stride = Math.max(1, Math.ceil(report.cumulativeDays.length / 120));
  const cumulative = report.cumulativeDays.filter((_, index) => index % stride === 0 || index === report.cumulativeDays.length - 1);
  const calendar = report.days.slice(-84);
  const offset = calendar.length ? (new Date(`${calendar[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const maxDay = Math.max(...calendar.map(day => day.amount), 1);
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h4 className="text-base font-semibold">Explore your spending</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Switch views to see trends, spending habits, or individual days.</p></div>
      <div role="group" aria-label="Chart view" className="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['trends', 'breakdown', 'calendar'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-10 rounded-lg px-3 text-xs font-semibold capitalize transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${view === value ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>{value}</button>)}
      </div>
    </div>
    {view === 'trends' && <div className={panelClass}>
      <h4 className="text-sm font-semibold">Cumulative spending comparison</h4>
      <p className="mt-1 text-xs text-slate-500">Current and previous equal-length periods, aligned by day number. Long ranges show sampled points.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs"><span className="text-indigo-500">● Current period</span><span className="text-amber-500">● Previous period</span></div>
      <div className="mt-3 h-64" aria-label="Cumulative spending chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cumulative} margin={{ left: 8, right: 12 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} /><XAxis dataKey="day" tick={axis} /><YAxis tick={axis} width={65} /><Tooltip formatter={tooltip} labelFormatter={value => `Day ${value}`} /><Area type="monotone" dataKey="previous" name="Previous period" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} /><Area type="monotone" dataKey="current" name="Current period" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} /></AreaChart></ResponsiveContainer></div>
    </div>}
    {view !== 'calendar' && <div className="grid gap-5 xl:grid-cols-2">
      {[{ title: 'Weekly spending trend', detail: 'Up to 26 weeks; first and last weeks may be partial.', data: weeks }, { title: 'Monthly spending trend', detail: 'Up to 12 months within your range; edge months may be partial.', data: months }, { title: 'Average spending by weekday', detail: 'Total for each weekday divided by its occurrences, including zero-spend days.', data: report.weekdays.map(day => ({ name: day.name, amount: day.average })) }, { title: 'Spending by account', detail: 'Actual expenses from each account; transfers excluded.', data: report.accounts }].filter((_, index) => view === 'trends' ? index < 2 : index >= 2).map(chart => <div key={chart.title} className={panelClass}>
        <h4 className="text-sm font-semibold">{chart.title}</h4><p className="mt-1 min-h-8 text-xs text-slate-500">{chart.detail}</p>
        <div className="mt-3 h-60" aria-label={chart.title}><ResponsiveContainer width="100%" height="100%"><BarChart data={chart.data} margin={{ left: 8, right: 12 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} /><XAxis dataKey="name" tick={axis} interval="preserveStartEnd" /><YAxis tick={axis} width={65} /><Tooltip formatter={tooltip} /><Bar dataKey="amount" name="Spending" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </div>)}
    </div>}
    {view === 'breakdown' && <div className="grid gap-5 xl:grid-cols-2">
      {[{ title: 'Payment method mix', data: report.payments }, { title: 'Needs, wants & other spending', data: report.spendTypes }].map(chart => <div key={chart.title} className={panelClass}>
        <h4 className="text-sm font-semibold">{chart.title}</h4>
        {!chart.data.length ? <p className="py-12 text-center text-xs text-slate-500">No expenses to chart.</p> : <>
          <div className="h-56" aria-label={chart.title}><ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer><Pie data={chart.data} dataKey="amount" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={2}>{chart.data.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={tooltip} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-2">{chart.data.map((row, index) => <div key={row.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="break-words">{row.name} ({row.count})</span></span><span className="shrink-0">{money(row.amount)} · {row.share.toFixed(1)}%</span></div>)}</div>
        </>}
      </div>)}
    </div>}
    {view === 'calendar' && <div className={panelClass}>
      <h4 className="text-sm font-semibold">Daily spending calendar</h4><p className="mt-1 text-xs text-slate-500">Last {calendar.length} days in this range. Darker purple means higher spending; gray means no recorded spending. Hover or focus a day for details.</p>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`pad-${index}`} />)}{calendar.map(day => <div key={day.date} tabIndex={0} aria-label={`${formatDisplayDate(day.date)}: ${money(day.amount)}`} title={`${formatDisplayDate(day.date)}: ${money(day.amount)}`} className={`flex h-9 items-center justify-center rounded-md border border-slate-200/30 text-xs focus-visible:outline-2 focus-visible:outline-indigo-400 ${day.amount ? 'text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`} style={day.amount ? { backgroundColor: `rgba(99,102,241,${0.4 + day.amount / maxDay * 0.6})` } : undefined}>{Number(day.date.slice(-2))}</div>)}</div>
    </div>}
  </div>;
}
