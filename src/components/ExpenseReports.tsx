import React, { useMemo, useState } from 'react';
import { Expense } from '../types';
import { buildExpenseReport, isReportExpense } from '../utils/expenseReports';
import { resolveAnalyticsRange } from '../utils/financialAnalytics';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import { DailySpendingTrendChart } from './ExpenseCharts';
import { ExpenseReportCharts } from './ExpenseReportCharts';

export function ExpenseReports({ expenses, currency, referenceDate }: { expenses: Expense[]; currency: string; referenceDate: string }) {
  const [period, setPeriod] = useState('30days');
  const [account, setAccount] = useState('all');
  const [category, setCategory] = useState('all');
  const [payment, setPayment] = useState('all');
  const [showDetails, setShowDetails] = useState(false);
  const [customStart, setCustomStart] = useState(referenceDate.slice(0, 7) + '-01');
  const [customEnd, setCustomEnd] = useState(referenceDate);
  const eligible = useMemo(() => expenses.filter(isReportExpense), [expenses]);
  const filtered = useMemo(() => eligible.filter(expense =>
    (account === 'all' || (expense.account || 'expense') === account) &&
    (category === 'all' || expense.category === category) &&
    (payment === 'all' || expense.paymentMethod === payment)
  ), [eligible, account, category, payment]);
  const range = period === 'custom' ? { start: customStart, end: customEnd } : resolveAnalyticsRange(period, referenceDate);
  const { start, end } = range;
  const report = useMemo(() => buildExpenseReport(filtered, start, end), [filtered, start, end]);
  const money = (value: number) => formatCurrency(value, currency);
  const selectClass = 'h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  const panelClass = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5';
  const resetFilters = () => { setPeriod('30days'); setAccount('all'); setCategory('all'); setPayment('all'); };
  return <section className="space-y-5" aria-label="Spending reports">
    <div className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Your spending at a glance</h3><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Choose a period to explore where your money goes.</p></div>
        <button type="button" onClick={resetFilters} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Reset filters</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-slate-500">Period<select aria-label="Report period" className={selectClass} value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="custom">Custom range</option>
        </select></label>
        <label className="space-y-1 text-xs text-slate-500">Account<select aria-label="Report account" className={selectClass} value={account} onChange={event => setAccount(event.target.value)}><option value="all">All accounts</option><option value="expense">Expense Account</option><option value="cash">Cash in Hand</option><option value="savings">Savings Account</option></select></label>
        <label className="space-y-1 text-xs text-slate-500">Category<select aria-label="Report category" className={selectClass} value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(eligible.map(expense => expense.category))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-500">Payment<select aria-label="Report payment" className={selectClass} value={payment} onChange={event => setPayment(event.target.value)}><option value="all">All payment methods</option>{[...new Set(eligible.map(expense => expense.paymentMethod))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      {period === 'custom' && <div className="mt-3 grid grid-cols-2 gap-3"><label className="space-y-1 text-xs text-slate-500">From<input aria-label="Report start date" type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} className={selectClass} /></label><label className="space-y-1 text-xs text-slate-500">To<input aria-label="Report end date" type="date" value={customEnd} min={customStart} max={referenceDate} onChange={event => setCustomEnd(event.target.value)} className={selectClass} /></label></div>}
      {report && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatDisplayDate(start)} – {formatDisplayDate(end)} · {report.dayCount} calendar days · {report.entries.length} expenses</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Income, transfers, and balance adjustments are excluded. Averages include days without recorded spending.</p>
    </div>
    {!report ? <p role="alert" className="text-sm text-rose-500">Choose a valid start and end date.</p> : <>
      {!report.entries.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/30"><p className="text-sm font-medium text-slate-600 dark:text-slate-300">No spending in this range for these filters.</p><p className="mt-1 text-xs text-slate-500">Try another period or clear your account, category, and payment filters.</p><button type="button" onClick={resetFilters} className="mt-3 min-h-10 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700">Clear filters</button></div>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ['Total spending', money(report.total), `${report.entries.length} expenses`],
          ['Average per day', money(report.dailyAverage), 'Includes zero-spend days'],
          ['Largest expense', report.largestTransaction ? money(report.largestTransaction.amount) : '—', report.largestTransaction?.title || 'No expenses'],
          ['Days without spending', `${report.noSpendDays} / ${report.dayCount}`, 'Based on recorded expenses'],
          ['Average per spending day', money(report.activeDayAverage), `${report.dayCount - report.noSpendDays} spending days`],
          ['Average transaction', money(report.transactionAverage), 'Per expense'],
          ['Median expense', money(report.median), 'Middle transaction value; less affected by large purchases'],
          ['Recurring spending', money(report.recurringTotal), `${report.total ? (report.recurringTotal / report.total * 100).toFixed(1) : 0}% of spending · Marked recurring expenses`],
          ['Longest zero-spend streak', `${report.longestNoSpendStreak} days`, 'Consecutive calendar days in this range'],
          ['Spending frequency', `${(100 * (report.dayCount - report.noSpendDays) / report.dayCount).toFixed(1)}%`, 'Share of days with at least one recorded expense'],
          ['Highest spending day', report.entries.length ? money(report.highestDay.amount) : '—', report.entries.length ? formatDisplayDate(report.highestDay.date) : 'No spending'],
          ['Lowest spending day', money(report.lowestDay.amount), `${formatDisplayDate(report.lowestDay.date)} · Includes zero-spend days`],
          ['Smallest expense', report.smallestTransaction ? money(report.smallestTransaction.amount) : '—', report.smallestTransaction?.title || 'No expenses'],
        ].filter((_, index) => showDetails || index < 4).map(([label, value, detail], index) => <div key={label} className={`${panelClass} ${index === 0 ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/20' : ''}`}><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-2 break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${index === 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p><p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p></div>)}
      </div>
      <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails(value => !value)} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950/40">{showDetails ? 'Show fewer statistics −' : 'Show all statistics +'}</button>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={panelClass}><h4 className="text-sm font-semibold">Zero-spend days</h4><p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">{report.noSpendDays} of {report.dayCount} days</p><p className="mt-1 text-xs text-slate-500">Based on recorded expenses matching your filters.</p></div>
        <div className={panelClass}><h4 className="text-sm font-semibold">Previous equal-length period</h4><p className="mt-2 text-xl font-bold">{money(report.previousTotal)}</p><p className="mt-1 text-xs text-slate-500">{formatDisplayDate(report.previousStart)} – {formatDisplayDate(report.previousEnd)} · {report.changePercent === null ? 'No prior spending to compare' : `${Math.abs(report.changePercent).toFixed(1)}% ${report.changePercent > 0 ? 'more' : report.changePercent < 0 ? 'less' : 'change'} spending this period`}</p></div>
      </div>
      {report.dayCount <= 90 && <div className={panelClass}><h4 className="mb-4 text-sm font-semibold">Daily spending trend</h4><DailySpendingTrendChart expenses={report.entries} rangeStartDate={start} rangeEndDate={end} currencySymbol={currency} /></div>}
      <ExpenseReportCharts report={report} currency={currency} />
      <div className={panelClass}>
        <h4 className="text-sm font-semibold">Spending insights</h4>
        <div className="mt-3 grid gap-4 text-xs sm:grid-cols-3">
          <div><p className="font-semibold text-indigo-600 dark:text-indigo-400">Top spending category</p><p className="mt-1 text-slate-600 dark:text-slate-300">{report.categories[0] ? `${report.categories[0].category}: ${money(report.categories[0].amount)} (${report.categories[0].share.toFixed(1)}% of spending).` : 'No spending recorded for these filters.'}</p></div>
          <div><p className="font-semibold text-indigo-600 dark:text-indigo-400">Highest average weekday</p><p className="mt-1 text-slate-600 dark:text-slate-300">{report.total ? (() => { const day = [...report.weekdays].sort((a, b) => b.average - a.average)[0]; return `${day.name}: ${money(day.average)} per occurrence, across ${day.days} recorded calendar ${day.days === 1 ? 'day' : 'days'}.`; })() : 'No spending recorded for these filters.'}</p></div>
          <div><p className="font-semibold text-indigo-600 dark:text-indigo-400">Weekend spending</p><p className="mt-1 text-slate-600 dark:text-slate-300">{money(report.weekdays.slice(5).reduce((sum, day) => sum + day.amount, 0))} on Saturdays and Sundays ({report.total ? (report.weekdays.slice(5).reduce((sum, day) => sum + day.amount, 0) / report.total * 100).toFixed(1) : 0}% of spending).</p></div>
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {([['Weekly spending', report.weeks], ['Monthly spending', report.months]] as const).map(([title, rows]) => <details key={title} className={panelClass}>
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-indigo-500">{title} details <span className="ml-2 text-xs font-normal text-slate-400">{rows.length} periods</span></summary><p className="mt-3 text-xs text-slate-500">Within the selected range. Weeks start Monday; edge periods may be partial.</p>
          <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2">Period covered</th><th className="py-2 text-right">Spend</th><th className="py-2 text-right">Avg/day</th></tr></thead><tbody>{rows.map(row => <tr key={row.period} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3 pr-2">{formatDisplayDate(row.start)} – {formatDisplayDate(row.end)}</td><td className="py-3 text-right font-mono">{money(row.amount)}</td><td className="py-3 pl-2 text-right font-mono">{money(row.amount / row.days)}</td></tr>)}</tbody></table></div>
        </details>)}
      </div>
      <div className={panelClass}><h4 className="mb-3 text-sm font-semibold">Category spending</h4><div className="space-y-3">{report.categories.length ? report.categories.map(row => <div key={row.category}><div className="mb-1 flex justify-between gap-3 text-xs"><span>{row.category}</span><span>{money(row.amount)} · {row.share.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.share}%` }} /></div></div>) : <p className="text-xs text-slate-500">No category spending to show.</p>}</div></div>
      <details className={panelClass}>
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-indigo-500">Category changes vs. previous period</summary><p className="mt-3 text-xs text-slate-500">Same filters and equal number of days. Sorted by the largest absolute change.</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2 pr-3">Category</th><th className="py-2 text-right">Current</th><th className="py-2 text-right">Previous</th><th className="py-2 text-right">Difference</th><th className="py-2 text-right">Change</th></tr></thead><tbody>{report.categoryChanges.map(row => <tr key={row.category} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3 pr-3">{row.category}</td><td className="px-2 py-3 text-right">{money(row.amount)}</td><td className="px-2 py-3 text-right">{money(row.previous)}</td><td className={`px-2 py-3 text-right ${row.difference > 0 ? 'text-rose-600 dark:text-rose-400' : row.difference < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{row.difference > 0 ? '+' : row.difference < 0 ? '−' : ''}{money(Math.abs(row.difference))}</td><td className="py-3 pl-2 text-right">{row.changePercent === null ? 'No prior spending' : `${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(1)}%`}</td></tr>)}</tbody></table>{!report.categoryChanges.length && <p className="py-3 text-xs text-slate-500">No category spending in either period.</p>}</div>
      </details>
      <details className={panelClass}>
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-indigo-500">Top 10 expenses <span className="ml-2 text-xs font-normal text-slate-400">View transactions</span></summary><p className="mt-3 text-xs text-slate-500">Largest individual expenses matching the selected filters.</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2 pr-3">Expense</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Payment</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{report.topExpenses.map(row => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3 pr-3 font-medium">{row.title}</td><td className="whitespace-nowrap py-3 pr-3">{formatDisplayDate(row.date)}</td><td className="py-3 pr-3">{row.category}</td><td className="py-3 pr-3">{row.paymentMethod}</td><td className="py-3 text-right font-mono">{money(row.amount)}</td></tr>)}</tbody></table>{!report.topExpenses.length && <p className="py-3 text-xs text-slate-500">No expenses to rank.</p>}</div>
      </details>
    </>}
  </section>;
}
