import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { buildCategoryDetails } from '../utils/categoryAnalytics';
import { FinancialAnalytics, accountNames, sourceAccount } from '../utils/financialAnalytics';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';

type CategoryDetail = ReturnType<typeof buildCategoryDetails>[number];

export default function CategorySpendingDialog({ row, report, currency, onClose }: { row: CategoryDetail; report: FinancialAnalytics; currency: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [visibleRows, setVisibleRows] = useState(50);
  const money = (value: number | null) => value === null ? 'N/A' : formatCurrency(value, currency);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="category-detail-title" aria-describedby="category-detail-dates" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }} className="fixed inset-0 m-auto max-h-[88dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6"><div><p className="text-[10px] font-medium uppercase tracking-wider text-indigo-500">Category details</p><h3 id="category-detail-title" className="mt-1 text-lg font-semibold">{row.name}</h3><p id="category-detail-dates" className="mt-1 text-xs text-slate-500">{formatDisplayDate(report.filters.start)} – {formatDisplayDate(report.filters.end)} · Current report filters</p></div><button type="button" autoFocus onClick={onClose} aria-label="Close category details" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></header>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-500/10"><div><p className="text-xs text-slate-500">Net spent</p><p className="mt-1 text-3xl font-semibold tabular-nums">{money(row.amount)}</p></div><div className="text-right"><p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{report.total.expenses > 0 ? `${row.share.toFixed(1)}% of spending` : 'Share N/A'}</p><p className="mt-1 text-xs text-slate-500">{row.count} expense records · {row.activeDays} purchase days</p></div></div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[
        ['Per calendar day', money(row.dailyAverage)], ['Average purchase', money(row.averagePurchase)], ['Median purchase', money(row.median)],
        ['Smallest purchase', money(row.minimum)], ['Largest purchase', money(row.maximum)], ['Positive purchases', String(row.purchaseCount)],
        ['Purchases before reversals', money(row.purchased)], ['Expense reversals', money(row.reversed)], ['Purchase days', `${row.activeDays} of ${report.dayCount}`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 break-words text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <section className="rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60"><h4 className="font-semibold">Previous period comparison</h4><p className="mt-1 text-slate-500">{formatDisplayDate(report.previousStart)} – {formatDisplayDate(report.previousEnd)}</p><p className="mt-2">{money(row.previous)} previously · {row.changeAmount === 0 ? 'Unchanged' : `${money(Math.abs(row.changeAmount))} ${row.changeAmount > 0 ? 'more' : 'less'}`}{row.change !== null && row.previous > 0 ? ` (${Math.abs(row.change).toFixed(1)}%)` : ' · Percentage change N/A'}</p></section>
      <div className="grid gap-4 sm:grid-cols-2">{([['By account', row.accounts], ['By payment method', row.payments]] as const).map(([label, values]) => <section key={label} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><h4 className="text-sm font-semibold">{label}</h4><dl className="mt-3 space-y-3 text-xs">{values.map(item => <div key={item.name} className="flex justify-between gap-3"><dt className="text-slate-500">{item.name}</dt><dd className="font-semibold tabular-nums">{money(item.amount)}</dd></div>)}</dl></section>)}</div>
      <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Transactions</h4><p className="text-xs text-slate-500">Showing {Math.min(visibleRows, row.rows.length)} of {row.rows.length}</p></div><div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full text-left text-xs"><caption className="sr-only">{row.name} transactions</caption><thead className="bg-slate-50 text-slate-500 dark:bg-slate-800"><tr>{['Date', 'Description', 'Account / Payment', 'Amount'].map(label => <th key={label} className={`p-3 ${label === 'Amount' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody>{row.rows.slice(0, visibleRows).map(transaction => <tr key={transaction.id} className="border-t border-slate-100 dark:border-slate-800"><td className="whitespace-nowrap p-3">{formatDisplayDate(transaction.date)}</td><td className="min-w-36 p-3"><span className="font-medium">{transaction.title}</span>{transaction.notes && <p className="mt-1 whitespace-pre-wrap text-slate-500">{transaction.notes}</p>}{transaction.amount < 0 && <span className="mt-1 block text-amber-600 dark:text-amber-400">Expense reversal</span>}</td><td className="p-3">{accountNames[sourceAccount(transaction)]}<span className="mt-1 block text-slate-500">{transaction.paymentMethod}</span></td><td className="whitespace-nowrap p-3 text-right font-semibold tabular-nums">{money(transaction.amount)}</td></tr>)}</tbody></table></div>{visibleRows < row.rows.length && <button type="button" className="mt-3 min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => setVisibleRows(value => value + 50)}>Show more transactions</button>}</section>
      <p className="text-[11px] leading-relaxed text-slate-500">Daily averages include all {report.dayCount} selected calendar days. Purchase statistics use positive expenses only. Net totals and account/payment breakdowns include reversals.</p>
    </div>
  </dialog>;
}
