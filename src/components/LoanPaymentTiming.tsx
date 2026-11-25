import { useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { InstallmentAssignment, LoanKind, LoanMovementLink, Receivable } from '../features/expenses/receivablesService';
import type { Expense } from '../types';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import { nextMonthlyPaymentDate } from '../utils/loanSchedule';

type Timing = 'Before' | 'On date' | 'After' | 'No date';
const categories: { label: Timing; color: string; dot: string }[] = [
  { label: 'Before', color: 'bg-emerald-500', dot: 'text-emerald-600 dark:text-emerald-300' },
  { label: 'On date', color: 'bg-indigo-500', dot: 'text-indigo-600 dark:text-indigo-300' },
  { label: 'After', color: 'bg-amber-500', dot: 'text-amber-700 dark:text-amber-300' },
  { label: 'No date', color: 'bg-slate-400', dot: 'text-slate-500 dark:text-slate-400' },
];

export default function LoanPaymentTiming({ loans, kind, expenses, links, linksUnavailable, assignments, currency, today }: {
  loans: Receivable[]; kind: LoanKind; expenses: Expense[]; links: LoanMovementLink[]; linksUnavailable: boolean; assignments: InstallmentAssignment[]; currency: string; today: string;
}) {
  const [selectedAmountGroup, setSelectedAmountGroup] = useState<string | null>(null);
  const rows = loans.flatMap(loan => {
    const linked = new Set(links.filter(link => link.loan_id === loan.id).map(link => link.expense_id));
    return expenses.filter(row => (row.type || 'expense') === (kind === 'lent' ? 'income' : 'expense') && !row.isTransfer && (row.notes === `Loan record: ${loan.id}` || linked.has(row.id))).map(row => {
      const month = `${row.date.slice(0, 7)}-01`;
      const candidate = kind === 'emi' && loan.payment_day ? nextMonthlyPaymentDate(loan.payment_day, loan.lent_date, month, loan.end_date) : null;
      const assigned = assignments.find(entry => entry.loan_id === loan.id && entry.expense_id === row.id);
      const reference = kind === 'emi' ? (assigned?.installment_date || (candidate?.slice(0, 7) === row.date.slice(0, 7) ? candidate : null)) : loan.due_date;
      const timing: Timing = !reference ? 'No date' : row.date < reference ? 'Before' : row.date > reference ? 'After' : 'On date';
      return { loan, row, reference, timing };
    });
  });
  const available = rows.filter(({ row }) => row.date <= today).sort((a, b) => b.row.date.localeCompare(a.row.date) || b.row.createdAt - a.row.createdAt);
  const missing = linksUnavailable || loans.some(loan => Math.round(loan.repaid * 100) !== rows.filter(entry => entry.loan.id === loan.id).reduce((sum, entry) => sum + Math.round(entry.row.amount * 100), 0));
  const counts = categories.map(category => {
    const matching = available.filter(entry => entry.timing === category.label);
    return { ...category, count: matching.length, amount: matching.reduce((sum, entry) => sum + Math.round(entry.row.amount * 100), 0) };
  });
  const compared = available.filter(entry => entry.reference);
  const onTime = compared.filter(entry => entry.timing === 'Before' || entry.timing === 'On date').length;
  const late = compared.filter(entry => entry.timing === 'After');
  const daysBetween = (date: string, reference: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${reference}T00:00:00Z`)) / 86400000);
  const averageLate = late.length ? late.reduce((sum, entry) => sum + daysBetween(entry.row.date, entry.reference!), 0) / late.length : null;
  const installments = new Map<string, { loan: Receivable; date: string; amount: number; payments: number }>();
  if (kind === 'emi') for (const { loan, row } of available) {
    const date = assignments.find(entry => entry.loan_id === loan.id && entry.expense_id === row.id)?.installment_date;
    if (!date) continue;
    const key = `${loan.id}:${date}`;
    const current = installments.get(key) || { loan, date, amount: 0, payments: 0 };
    current.amount += Math.round(row.amount * 100);
    current.payments += 1;
    installments.set(key, current);
  }
  const installmentRows = [...installments.values()].sort((a, b) => b.date.localeCompare(a.date) || a.loan.person.localeCompare(b.loan.person));
  const amountGroups = [
    { label: 'Below', color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', rows: installmentRows.filter(entry => entry.loan.installment_amount !== null && entry.amount < Math.round(entry.loan.installment_amount * 100)) },
    { label: 'Matches', color: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-300', rows: installmentRows.filter(entry => entry.loan.installment_amount !== null && entry.amount === Math.round(entry.loan.installment_amount * 100)) },
    { label: 'Above', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300', rows: installmentRows.filter(entry => entry.loan.installment_amount !== null && entry.amount > Math.round(entry.loan.installment_amount * 100)) },
    { label: 'Amount not set', color: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', rows: installmentRows.filter(entry => entry.loan.installment_amount === null) },
  ];
  const selectedGroup = amountGroups.find(group => group.label === selectedAmountGroup);

  return <section aria-label="Payment timing" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><Clock3 className="h-4 w-4" aria-hidden="true" /></span><div><h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Payment timing</h5><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{kind === 'lent' ? 'When money was received' : 'When payments were made'} compared with {kind === 'emi' ? 'the assigned installment date' : 'the expected date'}. Each payment is counted separately, including partial payments.</p></div></div>
    {available.length ? <>
      <div className={kind === 'emi' ? 'mt-4 grid gap-4 lg:grid-cols-2' : 'mt-4'}><div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-900/50 sm:p-5"><div className="flex items-start justify-between gap-2"><div><h6 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Payment dates</h6><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Recorded payments by timing</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{available.length} total</span></div>
      <div role="img" aria-label={counts.map(({ label, count }) => `${label}: ${count}`).join(', ')} className={`mt-4 grid h-24 flex-1 items-end gap-2 border-b border-slate-200 dark:border-slate-700 ${counts.some(entry => entry.label === 'No date' && entry.count > 0) ? 'grid-cols-4' : 'grid-cols-3'}`}>{counts.filter(entry => entry.label !== 'No date' || entry.count > 0).map(({ label, color, count }) => <div key={label} className="flex h-full flex-col items-center justify-end gap-1"><span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">{count}</span><span className={`w-full max-w-12 rounded-t-md ${color}`} style={{ height: `${count ? Math.max(6, count / Math.max(...counts.map(entry => entry.count)) * 64) : 2}px`, opacity: count ? 1 : 0.25 }} /></div>)}</div>
      <div className={`mt-2 grid gap-2 ${counts.some(entry => entry.label === 'No date' && entry.count > 0) ? 'grid-cols-4' : 'grid-cols-3'}`}>{counts.filter(entry => entry.label !== 'No date' || entry.count > 0).map(({ label, color, count, amount, dot }) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 px-1.5 py-2 dark:bg-slate-800/60 sm:px-3 sm:py-3"><p className={`break-words text-[10px] font-medium sm:text-[11px] ${dot}`}><span aria-hidden="true" className={`mr-1 inline-block h-2 w-2 rounded-full ${color}`} />{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{count} <span className="hidden text-[10px] font-normal text-slate-500 dark:text-slate-400 sm:inline">{count === 1 ? 'payment' : 'payments'}</span></p><p className="mt-1 break-words text-[10px] tabular-nums text-slate-500 dark:text-slate-400 sm:text-[11px]">{formatCurrency(amount / 100, currency)}</p></div>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"><p className="text-[11px] text-slate-500 dark:text-slate-400">On or before date</p><p className="mt-1 text-sm font-semibold tabular-nums">{compared.length ? `${Math.round(onTime / compared.length * 100)}%` : '—'}</p><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{onTime} of {compared.length} comparable payments</p></div>
        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"><p className="text-[11px] text-slate-500 dark:text-slate-400">Average days after</p><p className="mt-1 text-sm font-semibold tabular-nums">{averageLate === null ? '—' : `${Number(averageLate.toFixed(1))} days`}</p><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Based on {late.length} {late.length === 1 ? 'payment' : 'payments'} after the date</p></div>
        <div className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 sm:col-span-1"><p className="text-[11px] text-slate-500 dark:text-slate-400">Payments compared</p><p className="mt-1 text-sm font-semibold tabular-nums">{compared.length} of {available.length}</p><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Payments without a date are excluded</p></div>
      </div>
      </div>{kind === 'emi' && <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-900/50 sm:p-5">
        <div className="flex items-start justify-between gap-2"><h6 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Installment amounts</h6><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{installmentRows.length} assigned</span></div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Circle size shows the number of installments. Select one for details.</p>
        {installmentRows.length ? <>
          <span role="img" aria-label={amountGroups.map(group => group.label + ': ' + group.rows.length).join(', ')} className="sr-only" />
          <div className={`mt-4 grid grid-cols-2 gap-2 ${amountGroups[3].rows.length ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>{amountGroups.filter(group => group.label !== 'Amount not set' || group.rows.length > 0).map(group => {
            const size = group.rows.length ? 40 + Math.sqrt(group.rows.length / installmentRows.length) * 20 : 40;
            return <button key={group.label} type="button" aria-expanded={selectedAmountGroup === group.label} disabled={!group.rows.length} onClick={() => setSelectedAmountGroup(selectedAmountGroup === group.label ? null : group.label)} className={`flex min-h-24 flex-col-reverse items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 ${selectedAmountGroup === group.label ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10' : 'border-transparent bg-slate-50 hover:border-slate-300 dark:bg-slate-800/60 dark:hover:border-slate-600'}`}><span className={'text-[11px] font-medium ' + group.text}>{group.label}</span><span className={`grid shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums text-white ${group.color}`} style={{ width: size, height: size }}>{group.rows.length}</span></button>;
          })}</div>
          {selectedGroup && <div className="mt-3 flex flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/30"><p className="text-xs font-semibold">{selectedGroup.label} installment amount</p><ul className="mt-1 flex max-h-40 flex-1 flex-col justify-evenly divide-y divide-slate-200 overflow-y-auto dark:divide-slate-700">{selectedGroup.rows.map(({ loan, date, amount, payments }) => { const target = loan.installment_amount === null ? null : Math.round(loan.installment_amount * 100); const difference = target === null ? null : amount - target; return <li key={loan.id + ':' + date} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"><div><p className="font-medium text-slate-700 dark:text-slate-200">{loan.person} &middot; {formatDisplayDate(date)}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Paid {formatCurrency(amount / 100, currency)}{target !== null ? ' of ' + formatCurrency(target / 100, currency) : ''} &middot; {payments} {payments === 1 ? 'payment' : 'payments'}</p></div><span className={'text-[11px] font-semibold ' + selectedGroup.text}>{difference === null ? 'Installment amount not set' : difference < 0 ? formatCurrency(-difference / 100, currency) + ' below' : difference > 0 ? formatCurrency(difference / 100, currency) + ' above' : 'Matches installment'}</span></li>; })}</ul><p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">Uses the current amount. The final installment may be lower; extra does not carry over.</p></div>}
        {!selectedGroup && <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">Choose a category to see its assigned installments and payment amounts.</p>}</> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">Assign a payment to an installment to see its amount here.</p>}
      </div>}</div>
      <details className="mt-4 rounded-xl border border-slate-200 px-4 dark:border-slate-700"><summary className="cursor-pointer py-3 text-xs font-semibold text-indigo-600 dark:text-indigo-300">Recent payments · {available.length} {available.length === 1 ? 'payment' : 'payments'}</summary><ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">{available.slice(0, 5).map(({ loan, row, reference, timing }) => <li key={`${loan.id}-${row.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 text-xs"><div><p className="font-medium text-slate-700 dark:text-slate-200">{loan.person} <span className="font-normal text-slate-500">· {formatCurrency(row.amount, currency)}</span></p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{formatDisplayDate(row.date)}{reference ? ` · Scheduled ${formatDisplayDate(reference)}` : ' · No date to compare'}</p></div><span className={`text-[11px] font-semibold ${categories.find(category => category.label === timing)?.dot}`}>{timing}</span></li>)}</ul>
      {available.length > 5 && <p className="pb-3 text-[11px] text-slate-500 dark:text-slate-400">Showing the 5 most recent payments. The chart includes all recorded payments.</p>}</details>
    </> : <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No recorded payments available to compare yet.</p>}
    <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Timing uses saved dates; editing them can change these results. {kind === 'emi' && 'Unassigned payments are compared with the scheduled date in their payment month. Choose an installment in payment history to identify early or late payments for another month.'}</p>
    {missing && <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">Some payment details are unavailable, so this comparison may be incomplete.</p>}
  </section>;
}
