import React, { useMemo, useState } from 'react';
import { CalendarDays, CalendarRange, Calendar, ChevronDown, Info, TrendingUp, TrendingDown, Minus, Tag } from 'lucide-react';
import { Expense } from '../types';
import { buildSpendingSnapshot } from '../utils/spendingSnapshot';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import { financePanel } from './FinancialCharts';

const appearance = [
  { Icon: CalendarDays, accent: 'text-indigo-600 dark:text-indigo-400', surface: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300', bar: '#818cf8', edge: 'from-indigo-400' },
  { Icon: CalendarRange, accent: 'text-sky-600 dark:text-sky-400', surface: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', bar: '#38bdf8', edge: 'from-sky-400' },
  { Icon: Calendar, accent: 'text-teal-600 dark:text-teal-400', surface: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300', bar: '#2dd4bf', edge: 'from-teal-400' },
];

export default function SpendingSnapshot({ expenses, referenceDate, currency }: { expenses: Expense[]; referenceDate: string; currency: string }) {
  const periods = useMemo(() => buildSpendingSnapshot(expenses, referenceDate), [expenses, referenceDate]);
  const [expanded, setExpanded] = useState(false);
  const money = (value: number | null) => value === null ? '—' : formatCurrency(value, currency);
  return <section className={financePanel} aria-label="Essential spending summary">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="text-lg font-semibold tracking-tight">Your spending at a glance</h3><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">All accounts · All categories · Through {formatDisplayDate(referenceDate)}</p></div>
      <button type="button" aria-expanded={expanded} aria-controls="snapshot-today-details snapshot-7days-details snapshot-30days-details" onClick={() => setExpanded(value => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800">{expanded ? 'Less detail' : 'More details'}<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
    </div>
    <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-3">{periods.map((period, index) => {
      const { Icon, accent, surface, bar, edge } = appearance[index];
      const maxAmount = Math.max(1, ...period.days.map(day => Math.abs(day.amount)));
      const activeDays = period.dayCount - period.zeroSpendDays;
      const TrendIcon = period.changeAmount > 0 ? TrendingUp : period.changeAmount < 0 ? TrendingDown : Minus;
      const trendColor = period.changeAmount > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' : period.changeAmount < 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
      return <article key={period.preset} aria-label={`${period.label} spending`} className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-sm dark:border-slate-700/70 dark:from-slate-900 dark:to-slate-950/50 dark:shadow-none">
        <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${edge} to-transparent`} />
        <header className="flex min-h-9 items-start gap-2.5"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${surface}`}><Icon aria-hidden="true" className="h-4 w-4" /></span><div className="min-w-0"><h4 className="text-sm font-semibold">{period.label}</h4><p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{period.start === period.end ? `Date: ${formatDisplayDate(period.end)}` : `Dates: ${formatDisplayDate(period.start)} – ${formatDisplayDate(period.end)}`}</p></div></header>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">Net spent</p>
        <p className={`mt-1 break-words text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl ${accent}`}>{money(period.total)}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{period.count ? `${period.count} expense ${period.count === 1 ? 'record' : 'records'}` : 'No expenses recorded'}</p>
        <div className="mt-2 text-xs" title={`Previous: ${money(period.previousTotal)} · ${formatDisplayDate(period.previousStart)} – ${formatDisplayDate(period.previousEnd)}`}>
          <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 font-medium ${trendColor}`}><TrendIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{period.changeAmount === 0 ? 'Unchanged' : `${money(Math.abs(period.changeAmount))} ${period.changeAmount > 0 ? 'more' : 'less'}`}{period.changePercent !== null && period.changeAmount !== 0 ? ` · ${Math.abs(period.changePercent).toFixed(1)}%` : ''}</span></span>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">vs. {period.preset === 'today' ? 'yesterday' : `previous ${period.dayCount} days`} <span className="text-slate-400 dark:text-slate-500">· {money(period.previousTotal)}</span></p>
        </div>
        <div className="mt-2 rounded-xl bg-white/70 px-2.5 pb-1 pt-2 ring-1 ring-slate-200/60 dark:bg-slate-800/35 dark:ring-slate-700/30">
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400"><span>Daily activity</span><span>{activeDays} of {period.dayCount} {period.dayCount === 1 ? 'day' : 'days'} with net spending</span></div>
          <svg viewBox="0 0 300 52" className="mt-1 h-8 w-full" role="img" aria-label={`${period.label} daily net spending: ${period.days.map(day => `${formatDisplayDate(day.date)} ${money(day.amount)}`).join('; ')}`}>
            {period.days.map((day, dayIndex) => {
              const width = 300 / period.days.length;
              const barWidth = Math.min(14, width * .7);
              const height = day.amount ? Math.max(3, Math.abs(day.amount) / maxAmount * 36) : 2;
              return <rect key={day.date} x={dayIndex * width + (width - barWidth) / 2} y={44 - height} width={barWidth} height={height} rx={Math.min(3, barWidth / 3)} fill={day.amount < 0 ? '#f59e0b' : day.amount === 0 ? '#94a3b8' : bar} opacity={day.amount === 0 ? .25 : 1}><title>{formatDisplayDate(day.date)}: {money(day.amount)}{day.amount < 0 ? ' · Net reversal' : ''}</title></rect>;
            })}
          </svg>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-y border-slate-200/70 py-2.5 dark:border-slate-700/50">{[
          ['Average per day', money(period.averageDaily)], ['Largest purchase', money(period.maximumPurchase)],
          ['Average purchase', money(period.averagePurchase)], ['Per purchase day', money(period.averageActiveDay)],
        ].map(([label, value], metricIndex) => <div key={label} className={metricIndex % 2 ? 'border-l border-slate-200/70 pl-3 dark:border-slate-700/50' : ''}><dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl>
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"><Tag aria-hidden="true" className="h-3 w-3" />Top spending category</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{period.topCategory?.name || 'No positive spending'}</p><p className={`text-sm font-semibold tabular-nums ${accent}`}>{period.topCategory ? money(period.topCategory.amount) : '—'}</p></div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{period.topCategory ? `${period.topCategory.share === null ? 'Share unavailable' : `${period.topCategory.share.toFixed(1)}% of net spending`} · ${period.categories.length} ${period.categories.length === 1 ? 'category' : 'categories'} used` : 'Your leading category will appear here'}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, period.topCategory?.share || 0))}%`, backgroundColor: bar }} /></div>
        </div>
        <div id={`snapshot-${period.preset}-details`} hidden={!expanded}>
          <h5 className="mt-3 text-xs font-semibold">Purchase & daily details</h5>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Compared with {formatDisplayDate(period.previousStart)}{period.previousStart !== period.previousEnd ? ` – ${formatDisplayDate(period.previousEnd)}` : ''}.</p>
          <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            {[
              ['Purchases before reversals', money(period.purchased)], ['Expense reversals', money(period.reversed)],
              ['Positive purchases', String(period.purchaseCount)], ['Purchase days', `${period.purchaseDays} of ${period.dayCount}`],
              ['Median purchase', money(period.medianPurchase)], ['Smallest purchase', money(period.minimumPurchase)],
              ['Days with no net spending', `${period.zeroSpendDays} of ${period.dayCount}`],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}
            {([['Highest spending day', period.highestDay], ['Lowest spending day', period.lowestDay]] as const).map(([label, day]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{label}</dt><dd className="text-right font-semibold tabular-nums">{day ? money(day.amount) : '—'}{day && <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-slate-400">On {formatDisplayDate(day.date)}</span>}</dd></div>)}
          </dl>
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">{([
            ['By category', period.categories], ['By account', period.accounts], ['By payment method', period.payments],
          ] as const).map(([label, breakdown]) => <section key={label} aria-label={`${period.label} ${label.toLowerCase()}`}><h5 className="mb-2 text-xs font-semibold">{label}</h5>{breakdown.length ? <dl className="max-h-48 space-y-2 overflow-y-auto pr-1">{breakdown.map(item => <div key={item.name} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50"><div className="flex items-start justify-between gap-2 text-xs"><dt className="min-w-0 break-words text-slate-600 dark:text-slate-300">{item.name}</dt><dd className="shrink-0 text-right font-semibold tabular-nums">{money(item.amount)}<span className="mt-0.5 block text-[10px] font-normal text-slate-500">{item.share === null ? 'Share N/A' : `${item.share.toFixed(1)}% of net spent`}</span></dd></div><p className="mt-1 text-[10px] text-slate-500">{item.count} {item.count === 1 ? 'record' : 'records'}</p></div>)}</dl> : <p className="text-xs text-slate-500">No expenses in this period.</p>}</section>)}</div>
        </div>
      </article>;
    })}</div>
    <div className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"><Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>Includes today. Daily averages include days without spending. These summaries stay independent of the filters below.</p></div>
    <details className="mt-2 text-[11px] text-slate-500 dark:text-slate-400"><summary className="w-fit cursor-pointer py-1 font-medium">How to read these numbers</summary><p className="mt-2 max-w-4xl leading-relaxed">Purchase statistics use positive expenses only; net totals include expense reversals. Per purchase day divides positive purchase totals by the number of days with a positive purchase. Comparisons use the preceding non-overlapping period of the same length; percentages are omitted when its net total is zero or negative. Shares divide net category, account, or payment spending by total net spending; reversals can produce negative shares or shares above 100%. Shares are unavailable when the net total is zero or negative. Income, transfers, and balance adjustments are excluded. Daily minimums include days with no spending; tied amounts use the earliest date. A dash means no recorded purchase or expense day is available. Each activity bar represents one day within its card; bar heights use that card’s own scale. Amber bars indicate net reversals.</p></details>
  </section>;
}
