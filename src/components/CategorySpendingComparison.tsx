import React from 'react';
import { CalendarDays, ChartNoAxesCombined, ReceiptText } from 'lucide-react';
import { FinancialAnalytics, analyticsGroupLabel } from '../utils/financialAnalytics';
import { formatCurrency } from '../utils/constants';
import { financePanel } from './FinancialCharts';

export default function CategorySpendingComparison({ months, currency }: { months: FinancialAnalytics['months']; currency: string }) {
  const maxAmount = Math.max(0, ...months.flatMap(month => Object.values(month.categories).map(Math.abs)));
  const money = (amount: number) => formatCurrency(amount, currency);
  return <section className={financePanel} aria-label="Category spending comparison">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="text-sm font-semibold">Category spending comparison</h4>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">See where your money went in each month of the selected range.</p></div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"><ChartNoAxesCombined aria-hidden="true" className="h-3.5 w-3.5" /> Shared bar scale</span>
    </header>
    <div className={`mt-4 grid gap-3 ${months.length > 1 ? 'md:grid-cols-2' : ''} ${months.length > 2 ? 'xl:grid-cols-3' : ''}`}>
      {months.map(month => {
        const categories = Object.entries(month.categories).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        return <article key={month.date} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white/60 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/30 sm:px-5">
            <div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><CalendarDays aria-hidden="true" className="h-4 w-4" /></span><div><h5 className="text-sm font-semibold">{analyticsGroupLabel(month)}</h5><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{month.days} {month.days === 1 ? 'day' : 'days'} included</p></div></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Net spent</p><p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{money(month.expenses)}</p></div>
          </div>
          {categories.length ? <div className="px-4 py-4 sm:px-5"><p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">Category breakdown <span className="ml-1 normal-case tracking-normal">· {categories.length}</span></p><ul className="max-h-80 space-y-4 overflow-y-auto pr-1">{categories.map(([name, amount]) => <li key={name}>
            <div className="flex items-baseline justify-between gap-3 text-xs"><span className="min-w-0 break-words font-medium text-slate-700 dark:text-slate-200">{name}</span><span className="shrink-0 font-semibold tabular-nums">{money(amount)}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/80" aria-hidden="true"><div className={`h-full rounded-full ${amount < 0 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-400'}`} style={{ width: `${maxAmount ? Math.abs(amount) / maxAmount * 100 : 0}%` }} /></div>
          </li>)}</ul></div> : <div className="flex min-h-36 flex-1 flex-col items-center justify-center px-4 py-8 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/70 text-slate-400 dark:bg-slate-700/60"><ReceiptText aria-hidden="true" className="h-5 w-5" /></span><p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">No spending recorded in this period.</p></div>}
        </article>;
      })}
    </div>
    <p className="mt-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Bars use the same scale across months. Amber indicates a net reversal. Partial months show only the included dates.</p>
  </section>;
}
