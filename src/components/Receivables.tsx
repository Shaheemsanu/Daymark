import React, { useEffect, useState } from 'react';
import { HandCoins, Plus, ArrowUpRight, ArrowDownLeft, CalendarDays, Pencil, Trash2, LoaderCircle } from 'lucide-react';
import { receivablesService, Receivable, LoanKind, LoanMovementLink, LoanEdits } from '../features/expenses/receivablesService';
import { formatCurrency, PAYMENT_METHODS } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import { countMonthlyPayments, nextMonthlyPaymentDate } from '../utils/loanSchedule';
import { Account, AccountVisibility } from '../utils/accounts';
import { Expense } from '../types';
import { isLoanMovement } from '../utils/loanMovement';

const field = 'mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const cents = (amount: number) => Math.round(amount * 100);
// Keep the current paise as the step base so the native spinner changes whole rupees.
const amountStepBase = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? ((cents(amount) % 100) / 100).toFixed(2) : '0';
};
const labels: Record<LoanKind, string> = { lent: 'Money lent', borrowed: 'Money borrowed', emi: 'EMI / loan' };
const message = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && ['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(String(error.code))) return 'The loans database setup is incomplete. Apply the loans and dues migrations and try again.';
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not save your changes. Please try again.';
};

function AccountSelect({ label, value, onChange, visibility }: { label: string; value: Account; onChange: (account: Account) => void; visibility: AccountVisibility }) {
  return <label className="text-xs text-slate-500">{label}<select className={field} value={value} onChange={event => onChange(event.target.value as Account)}><option value="expense">Expense Account</option>{visibility.cash && <option value="cash">Cash in Hand</option>}{visibility.savings && <option value="savings">Savings Account</option>}</select></label>;
}

function PaymentMethodSelect({ value, onChange, account }: { value: string; onChange: (value: string) => void; account: Account }) {
  const methods = account === 'cash' ? ['Cash'] : PAYMENT_METHODS;
  return <label className="text-xs text-slate-500">Payment method<select className={field} value={account === 'cash' ? 'Cash' : value} onChange={event => onChange(event.target.value)}>{account !== 'cash' && value && !(methods as readonly string[]).includes(value) && <option value={value}>{value}</option>}{methods.map(method => <option key={method} value={method}>{method}</option>)}</select></label>;
}

function Matches({ matches, selected, onSelect, money }: { matches: Expense[]; selected: string | null; onSelect: (id: string | null) => void; money: (value: number) => string }) {
  if (!matches.length) return null;
  return <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs dark:border-indigo-500/30 dark:bg-indigo-500/10"><p className="font-semibold text-indigo-700 dark:text-indigo-300">Possible matching ledger transactions</p><p className="mt-1 text-slate-600 dark:text-slate-400">Check the details. Select the same transaction to avoid adding it twice.</p><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{matches.map(row => <label key={row.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"><input type="radio" checked={selected === row.id} onChange={() => onSelect(row.id)} /><span className="flex-1">{row.title} · {row.category} · {formatDisplayDate(row.date)}</span><strong>{money(row.amount)}</strong></label>)}</div><button type="button" onClick={() => onSelect(null)} className="mt-2 font-semibold text-indigo-600 dark:text-indigo-300">Create a new transaction instead</button>{selected && <p className="mt-2 text-slate-600 dark:text-slate-400">The existing transaction keeps its current category and reporting treatment.</p>}</div>;
}

function EditPayment({ item, row, visibility, onSave, onCancel }: { item: Receivable; row: Expense; visibility: AccountVisibility; onSave: (row: Expense, amount: number, date: string, account: Account, method: string) => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState(String(row.amount));
  const [date, setDate] = useState(row.date);
  const [account, setAccount] = useState<Account>(row.account || 'expense');
  const [method, setMethod] = useState(row.paymentMethod || 'UPI / QR');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.abs(cents(value) - value * 100) > 0.000001 || cents(item.repaid) - cents(row.amount) + cents(value) > cents(item.amount)) { setError('Enter a valid amount that does not exceed the loan balance.'); return; }
    if (!date || date < item.lent_date) { setError('The payment date cannot be before the loan start date.'); return; }
    setError(''); setSaving(true);
    try { await onSave(row, value, date, account, account === 'cash' ? 'Cash' : method); } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="mt-2 w-full rounded-lg border border-indigo-200 p-3 dark:border-indigo-500/30"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-slate-500">Amount<input aria-label="Edit payment amount" className={field} type="number" min={amountStepBase(amount)} step="1" value={amount} onChange={e => setAmount(e.target.value)} required /></label><label className="text-xs text-slate-500">Date<input aria-label="Edit payment date" className={field} type="date" min={item.lent_date} value={date} onChange={e => setDate(e.target.value)} required /></label><AccountSelect label="Account" value={account} onChange={setAccount} visibility={visibility} /><PaymentMethodSelect value={method} onChange={setMethod} account={account} /></div><p className="mt-2 text-xs text-slate-500">Saving updates the ledger transaction and the loan balance.</p>{error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}<div className="mt-3 flex gap-3"><button disabled={saving} type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save payment</button><button disabled={saving} type="button" onClick={onCancel} className="text-xs text-slate-500">Cancel</button></div></form>;
}

function PaymentHistory({ item, expenses, links, linksUnavailable, visibility, money, onSave, onDelete }: { item: Receivable; expenses: Expense[]; links: LoanMovementLink[]; linksUnavailable: boolean; visibility: AccountVisibility; money: (value: number) => string; onSave: (row: Expense, amount: number, date: string, account: Account, method: string) => Promise<void>; onDelete: (row: Expense) => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deletePayment = async (row: Expense) => {
    if (!window.confirm(`Delete the ${money(row.amount)} payment dated ${formatDisplayDate(row.date)}? This will also delete the associated expense ledger transaction and update the account and loan balances.`)) return;
    setDeleteError(''); setDeletingId(row.id);
    try { await onDelete(row); setEditing(null); } catch (reason) { setDeleteError(message(reason)); } finally { setDeletingId(null); }
  };
  const linked = new Set(links.filter(link => link.loan_id === item.id).map(link => link.expense_id));
  const direction = item.record_kind === 'lent' ? 'income' : 'expense';
  const payments = expenses.filter(row => (row.type || 'expense') === direction && (row.notes === `Loan record: ${item.id}` || linked.has(row.id)) && (row.account === undefined || row.account === 'expense' || visibility[row.account])).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const knownTotal = payments.reduce((total, row) => total + cents(row.amount), 0);
  const accounts: Record<Account, string> = { expense: 'Expense Account', cash: 'Cash in Hand', savings: 'Savings Account' };
  return <details className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-300">Payment history · {payments.length} {payments.length === 1 ? 'payment' : 'payments'}</summary>
    {deleteError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{deleteError}</p>}
    {payments.length ? <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{payments.map(row => <li key={row.id} className="py-2 text-xs"><div className="flex items-center justify-between gap-3"><div><p className="font-medium text-slate-700 dark:text-slate-200">{item.record_kind === 'lent' ? 'Received' : 'Paid'} · {formatDisplayDate(row.date)}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{accounts[row.account || 'expense']}{row.paymentMethod ? ` · ${row.paymentMethod}` : ''}</p></div><div className="flex items-center gap-3"><span className="font-semibold tabular-nums">{money(row.amount)}</span><button type="button" aria-label={`Edit payment ${formatDisplayDate(row.date)} ${money(row.amount)}`} disabled={deletingId !== null} onClick={() => setEditing(row.id)} title="Edit payment" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-indigo-600 hover:bg-slate-100 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-800"><Pencil aria-hidden="true" className="h-4 w-4" /></button><button type="button" disabled={deletingId !== null} aria-label={deletingId === row.id ? `Deleting payment ${formatDisplayDate(row.date)} ${money(row.amount)}` : `Delete payment ${formatDisplayDate(row.date)} ${money(row.amount)}`} aria-busy={deletingId === row.id} title="Delete payment" onClick={() => deletePayment(row)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:text-rose-300 dark:hover:bg-rose-950/30">{deletingId === row.id ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}</button></div></div>{deletingId === row.id && <p role="status" className="mt-1 text-xs text-slate-500 dark:text-slate-400">Deleting payment?</p>}{editing === row.id && deletingId !== row.id && <EditPayment key={row.id} item={item} row={row} visibility={visibility} onSave={async (...args) => { await onSave(...args); setEditing(null); }} onCancel={() => setEditing(null)} />}</li>)}</ul> : <p className="mt-3 text-xs text-slate-500">No payment details available yet.</p>}
    {(linksUnavailable || knownTotal !== cents(item.repaid)) && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Some payment details may be unavailable. The total {item.record_kind === 'lent' ? 'received' : 'paid'} above is {money(item.repaid)}.</p>}
  </details>;
}

function EditLoanForm({ item, busy, onSave, onCancel }: { item: Receivable; busy: boolean; onSave: (changes: LoanEdits) => Promise<void>; onCancel: () => void }) {
  const [person, setPerson] = useState(item.person);
  const [amount, setAmount] = useState(String(item.amount));
  const [dueDate, setDueDate] = useState(item.due_date || '');
  const [endDate, setEndDate] = useState(item.end_date || '');
  const [paymentDay, setPaymentDay] = useState(item.payment_day?.toString() || '');
  const [installment, setInstallment] = useState(item.installment_amount?.toString() || '');
  const [note, setNote] = useState(item.note || '');
  const [error, setError] = useState('');
  const emi = item.record_kind === 'emi';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const total = Number(amount), installmentValue = Number(installment);
    if (!person.trim() || !Number.isFinite(total) || total <= 0 || total >= 1e10 || cents(total) < cents(item.repaid)) { setError('Enter a name and a total at least as large as the amount already paid or received.'); return; }
    if ((dueDate && dueDate < item.lent_date) || (endDate && endDate < item.lent_date)) { setError('The due or end date cannot be before the start date.'); return; }
    if (emi && installment && (!Number.isFinite(installmentValue) || cents(installmentValue) <= 0 || installmentValue >= 1e10)) { setError('Enter a valid installment amount.'); return; }
    setError('');
    await onSave({ person: person.trim(), amount: emi ? cents(total) / 100 : item.amount, due_date: emi ? item.due_date : dueDate || null, end_date: emi ? endDate || null : item.end_date, payment_day: emi ? paymentDay ? Number(paymentDay) : null : item.payment_day, installment_amount: emi ? installment ? cents(installmentValue) / 100 : null : item.installment_amount, note: note.trim() || null });
  };
  return <form onSubmit={submit} className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/5">
    <h6 className="text-sm font-semibold">Edit {labels[item.record_kind].toLowerCase()}</h6>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs text-slate-500">Name<input aria-label="Edit name" className={field} value={person} onChange={e => setPerson(e.target.value)} maxLength={120} required /></label>
      {emi && <label className="text-xs text-slate-500">Total payable<input aria-label="Edit total payable" className={field} type="number" min={amountStepBase(amount)} max="9999999999.99" step="1" value={amount} onChange={e => setAmount(e.target.value)} required /></label>}
      {emi ? <><label className="text-xs text-slate-500">End date (optional)<input aria-label="Edit end date" className={field} type="date" min={item.lent_date} value={endDate} onChange={e => setEndDate(e.target.value)} /></label><label className="text-xs text-slate-500">Monthly payment day<select aria-label="Edit monthly payment day" className={field} value={paymentDay} onChange={e => setPaymentDay(e.target.value)}><option value="">Not set</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label><label className="text-xs text-slate-500">Installment amount (optional)<input aria-label="Edit installment amount" className={field} type="number" min={amountStepBase(installment)} step="1" max="9999999999.99" value={installment} onChange={e => setInstallment(e.target.value)} /></label></> : <label className="text-xs text-slate-500">{item.record_kind === 'lent' ? 'Expected back' : 'Due date'} (optional)<input aria-label="Edit due date" className={field} type="date" min={item.lent_date} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
      <label className="text-xs text-slate-500">Note (optional)<input aria-label="Edit note" className={field} value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
    </div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{emi ? 'Total payable includes amounts already paid. ' : 'The original amount and date are kept with the ledger movement. '}Editing these details does not change past transactions or payments.</p>
    {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    <div className="mt-3 flex gap-3"><button disabled={busy} type="submit" className="min-h-10 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Save changes</button><button disabled={busy} type="button" onClick={onCancel} className="px-2 text-xs text-slate-500">Cancel edit</button></div>
  </form>;
}

export default function Receivables({ currency, today, expenses = [], accountVisibility = { cash: true, savings: true }, onTransactionAdded, onTransactionUpdated, onTransactionDeleted }: { currency: string; today: string; expenses?: Expense[]; accountVisibility?: AccountVisibility; onTransactionAdded?: (expense: Expense) => void; onTransactionUpdated?: (expense: Expense) => void; onTransactionDeleted?: (id: string) => void }) {
  const [items, setItems] = useState<Receivable[]>([]);
  const [movementLinks, setMovementLinks] = useState<LoanMovementLink[]>([]);
  const [linksUnavailable, setLinksUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<LoanKind>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [installment, setInstallment] = useState('');
  const [installmentEdited, setInstallmentEdited] = useState(false);
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [account, setAccount] = useState<Account>('expense');
  const [paymentAccount, setPaymentAccount] = useState<Account>('expense');
  const [initialMethod, setInitialMethod] = useState('UPI / QR');
  const [repaymentMethod, setRepaymentMethod] = useState('UPI / QR');
  const [recordMovement, setRecordMovement] = useState(true);
  const [recordEmiReceipt, setRecordEmiReceipt] = useState(false);
  const [initialReceived, setInitialReceived] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [note, setNote] = useState('');
  const [repaymentId, setRepaymentId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);
  const [repayment, setRepayment] = useState('');
  const [initialMatch, setInitialMatch] = useState<string | null>(null);
  const [paymentMatch, setPaymentMatch] = useState<string | null>(null);
  const money = (value: number) => formatCurrency(value, currency);
  const matches = (value: string, entryDate: string, selectedAccount: Account, direction: 'income' | 'expense') => expenses.filter(row => Number(value) > 0 && cents(row.amount) === cents(Number(value)) && row.date === entryDate && (row.account || 'expense') === selectedAccount && (row.type || 'expense') === direction && !row.isTransfer && !row.category.toLowerCase().includes('transfer') && !isLoanMovement(row));
  const initialMatches = matches(kind === 'emi' ? initialReceived : amount, date, account, kind === 'lent' ? 'expense' : 'income');
  useEffect(() => { setInitialMatch(null); }, [kind, amount, initialReceived, date, account]);
  useEffect(() => { setPaymentMatch(null); }, [repayment, paymentDate, paymentAccount, repaymentId]);
  const total = (isLent: boolean) => items.filter(item => (item.record_kind === 'lent') === isLent).reduce((sum, item) => sum + cents(item.amount) - cents(item.repaid), 0) / 100;
  const nextScheduled = paymentDay && date ? nextMonthlyPaymentDate(Number(paymentDay), date, today, endDate || null) : null;
  const estimateDay = paymentDay ? Number(paymentDay) : Number(date.slice(8, 10));
  const paymentCount = endDate ? countMonthlyPayments(date, endDate, estimateDay) : 0;
  const estimatedCents = paymentCount && Number(amount) > 0 && Number.isFinite(Number(amount)) ? Math.round(cents(Number(amount)) / paymentCount) : 0;

  useEffect(() => {
    if (kind === 'emi' && !installmentEdited) setInstallment(estimatedCents > 0 ? (estimatedCents / 100).toFixed(2) : '');
  }, [kind, installmentEdited, estimatedCents]);

  useEffect(() => {
    if (account !== 'expense' && !accountVisibility[account]) setAccount('expense');
    if (paymentAccount !== 'expense' && !accountVisibility[paymentAccount]) setPaymentAccount('expense');
  }, [account, paymentAccount, accountVisibility.cash, accountVisibility.savings]);

  useEffect(() => {
    let active = true;
    receivablesService.list().then(rows => { if (active) setItems(rows); }).catch(reason => { if (active) setError(message(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    receivablesService.listMovementLinks().then(links => { if (active) setMovementLinks(current => [...links, ...current.filter(row => !links.some(link => link.expense_id === row.expense_id))]); }).catch(() => { if (active) setLinksUnavailable(true); });
    return () => { active = false; };
  }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount), installmentValue = Number(installment);
    if (!person.trim() || !Number.isFinite(value) || value <= 0 || cents(value) <= 0 || value >= 1e10 || !date) { setError('Enter a name, date and valid total greater than zero.'); return; }
    if (kind !== 'emi' && dueDate && dueDate < date) { setError('The due date cannot be before the start date.'); return; }
    if (kind === 'emi' && endDate && endDate < date) { setError('The end date cannot be before the start date.'); return; }
    if (kind === 'emi' && (!paymentDay || !Number.isInteger(Number(paymentDay)) || Number(paymentDay) < 1 || Number(paymentDay) > 31)) { setError('Choose a monthly payment day from 1 to 31.'); return; }
    if (kind === 'emi' && installment && (!Number.isFinite(installmentValue) || cents(installmentValue) <= 0 || installmentValue >= 1e10)) { setError('Enter a valid installment amount greater than zero.'); return; }
    if (kind === 'emi' && recordEmiReceipt && (!Number.isFinite(Number(initialReceived)) || cents(Number(initialReceived)) <= 0 || Number(initialReceived) >= 1e10)) { setError('Enter the amount actually received from the lender.'); return; }
    setBusy(true); setError('');
    try {
      const created = await receivablesService.create({ person: person.trim(), amount: cents(value) / 100, lent_date: date, due_date: kind === 'emi' ? null : dueDate || null, end_date: kind === 'emi' ? endDate || null : null, payment_day: kind === 'emi' && paymentDay ? Number(paymentDay) : null, note: note.trim() || null, record_kind: kind, installment_amount: kind === 'emi' && installment ? cents(installmentValue) / 100 : null, ...(kind === 'emi' && recordEmiReceipt ? { initial_received: cents(Number(initialReceived)) / 100 } : {}), ...(initialMatch ? { existing_expense_id: initialMatch } : {}), ...(!initialMatch && (kind === 'emi' ? recordEmiReceipt : recordMovement) ? { payment_method: account === 'cash' ? 'Cash' : initialMethod } : {}) }, (kind === 'emi' ? recordEmiReceipt : recordMovement || !!initialMatch) ? account : null);
      setItems(current => [created.loan, ...current]); if (created.transaction) onTransactionAdded?.(created.transaction); setPerson(''); setAmount(''); setInstallment(''); setInstallmentEdited(false); setDueDate(''); setEndDate(''); setPaymentDay(''); setInitialReceived(''); setRecordEmiReceipt(false); setNote('');
    } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  const saveRepayment = async (event: React.FormEvent, item: Receivable) => {
    event.preventDefault();
    const value = Number(repayment), remaining = cents(item.amount) - cents(item.repaid);
    if (!Number.isFinite(value) || value <= 0 || cents(value) <= 0 || cents(value) > remaining) { setError('Enter an amount greater than zero and no more than the remaining balance.'); return; }
    setBusy(true); setError('');
    if (!paymentDate || paymentDate < item.lent_date) { setError('The payment date cannot be before the start date.'); setBusy(false); return; }
    try { const updated = await (paymentMatch ? receivablesService.repay(item, value, paymentDate, paymentAccount, paymentMatch) : receivablesService.repay(item, value, paymentDate, paymentAccount, undefined, paymentAccount === 'cash' ? 'Cash' : repaymentMethod)); setItems(current => current.map(row => row.id === item.id ? updated.loan : row)); if (updated.transaction) onTransactionAdded?.(updated.transaction); if (paymentMatch) setMovementLinks(current => [...current, { loan_id: item.id, expense_id: paymentMatch }]); setRepaymentId(null); setRepayment(''); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  const saveEdit = async (item: Receivable, changes: LoanEdits) => {
    setBusy(true); setError('');
    try { const updated = await receivablesService.update(item, changes); setItems(current => current.map(row => row.id === item.id ? updated : row)); setEditId(null); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  const savePaymentEdit = async (item: Receivable, row: Expense, amount: number, paymentDate: string, paymentAccount: Account, method: string) => {
    const updated = await receivablesService.editPayment(item, row, amount, paymentDate, paymentAccount, method);
    setItems(current => current.map(entry => entry.id === item.id ? updated.loan : entry));
    onTransactionUpdated?.(updated.transaction);
  };
  const removePayment = async (item: Receivable, row: Expense) => {
    const updated = await receivablesService.deletePayment(item, row);
    setItems(current => current.map(entry => entry.id === item.id ? updated : entry));
    setMovementLinks(current => current.filter(link => link.expense_id !== row.id));
    onTransactionDeleted?.(row.id);
  };
  const removeLoan = async (item: Receivable) => {
    if (deletingLoanId || !window.confirm(`Delete the ${labels[item.record_kind].toLowerCase()} record for ${item.person}? This will also delete its original expense transaction and all linked payment transactions from the ledger, including existing entries you linked. Account balances will change.`)) return;
    setError(''); setDeletingLoanId(item.id);
    try {
      const deletedIds = await receivablesService.delete(item);
      deletedIds.forEach(id => onTransactionDeleted?.(id));
      setItems(current => current.filter(row => row.id !== item.id));
      setMovementLinks(current => current.filter(link => link.loan_id !== item.id));
      setEditId(current => current === item.id ? null : current);
      setRepaymentId(current => current === item.id ? null : current);
    } catch (reason) { setError(message(reason)); } finally { setDeletingLoanId(null); }
  };
  return <section aria-label="Loans and dues" className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5"><h3 className="flex items-center gap-2 text-base font-semibold"><HandCoins className="h-5 w-5 text-indigo-500" />Loans and dues</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Track money lent, money borrowed and EMI payments.</p>      <div className="mt-5">
        <div role="tablist" aria-label="Record type" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/60">{([
          { value: 'lent', title: 'Money lent', detail: 'Someone owes you', Icon: ArrowUpRight },
          { value: 'borrowed', title: 'Money borrowed', detail: 'You owe someone', Icon: ArrowDownLeft },
          { value: 'emi', title: 'EMI / loan', detail: 'Track loan payments', Icon: CalendarDays },
        ] as const).map(({ value, title, detail, Icon }, index, choices) => <button key={value} id={`loan-kind-${value}`} type="button" role="tab" aria-selected={kind === value} aria-controls="loan-kind-details" tabIndex={kind === value ? 0 : -1} onClick={() => setKind(value)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
          setKind(choices[next].value);
          document.getElementById(`loan-kind-${choices[next].value}`)?.focus();
        }} className={`flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:justify-start sm:px-4 ${kind === value ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kind === value ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-slate-200/70 dark:bg-slate-700/60'}`}><Icon aria-hidden="true" className="h-4 w-4" /></span>
          <span className="min-w-0"><span className="block text-xs font-semibold sm:text-sm">{title}</span><span className="mt-0.5 hidden text-[11px] font-normal text-slate-500 dark:text-slate-400 sm:block">{detail}</span></span>
        </button>)}</div>
      </div>
<p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">All records</p><div className="mt-2 grid gap-3 sm:grid-cols-2">{[['To receive', total(true)], ['To pay', total(false)]].map(([label, value]) => <div key={label} className="rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-500/10"><p className="text-[10px] font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{money(Number(value))}</p></div>)}</div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Recorded loan movements update the selected account and appear in the transaction ledger. They are excluded from spending and income reports; EMI interest is not separated. Scheduled dates do not show payment status.</p></div>
    <div id="loan-kind-details" role="tabpanel" aria-labelledby={`loan-kind-${kind}`} className="space-y-4">
    <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <h4 className="text-base font-semibold">Add a record</h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kind === 'lent' ? 'Add money you lent to someone.' : kind === 'borrowed' ? 'Add money you borrowed from someone.' : 'Add a loan and its payment schedule.'}</p>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
        {kind !== 'emi' ? <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={recordMovement} onChange={event => { setRecordMovement(event.target.checked); setInitialMatch(null); }} className="accent-indigo-500" /><span>Add the original {kind === 'lent' ? 'payment' : 'receipt'} in the selected account. Select a matching transaction below if it is already in the ledger.</span></label> : <><label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={recordEmiReceipt} onChange={event => { setRecordEmiReceipt(event.target.checked); setInitialMatch(null); }} className="accent-indigo-500" /><span>Record money received from the lender in an account.</span></label><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Use the start date and amount actually received. If already recorded, select the matching ledger transaction below.</p></>}
        {kind !== 'emi' && !recordMovement && <p className="mt-2 text-xs text-slate-500">Tracking only: no transaction will be created or linked.</p>}
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"><h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300">{kind === 'emi' ? 'Loan details' : 'Details'}</h5>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-500">{kind === 'emi' ? 'Lender or provider' : 'Person'}<input className={field} value={person} onChange={event => setPerson(event.target.value)} maxLength={120} required placeholder="Name" /></label>
          <label className="text-xs text-slate-500">{kind === 'emi' ? 'Total remaining to pay' : 'Amount'}<input className={field} type="number" min={amountStepBase(amount)} step="1" max="9999999999.99" value={amount} onChange={event => setAmount(event.target.value)} required placeholder="0.00" /></label>
          <label className="text-xs text-slate-500">{kind === 'lent' ? 'Date lent' : 'Start date'}<input className={field} type="date" value={date} onChange={event => setDate(event.target.value)} required /></label>
          {(kind !== 'emi' || recordEmiReceipt) && <AccountSelect label={kind === 'lent' ? 'Paid from account' : 'Received into account'} value={account} onChange={setAccount} visibility={accountVisibility} />}
          {((kind !== 'emi' && recordMovement) || (kind === 'emi' && recordEmiReceipt)) && !initialMatch && <PaymentMethodSelect value={initialMethod} onChange={setInitialMethod} account={account} />}
          {kind === 'emi' && recordEmiReceipt && <label className="text-xs text-slate-500">Amount received from lender<input className={field} type="number" min={amountStepBase(initialReceived)} step="1" max="9999999999.99" value={initialReceived} onChange={event => setInitialReceived(event.target.value)} required placeholder="0.00" /></label>}
          {kind !== 'emi' && <label className="text-xs text-slate-500">{kind === 'lent' ? 'Expected back' : 'Due date'} (optional)<input className={field} type="date" min={date} value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>}
          {kind === 'emi' && <><label className="text-xs text-slate-500">End date (optional)<input className={field} type="date" min={date} value={endDate} onChange={event => setEndDate(event.target.value)} /></label><label className="text-xs text-slate-500">Monthly payment day<select className={field} value={paymentDay} onChange={event => setPaymentDay(event.target.value)} required><option value="">Choose a day</option>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><label className="text-xs text-slate-500">Installment amount (optional)<input className={field} type="number" min={amountStepBase(installment)} step="1" max="9999999999.99" value={installment} onChange={event => { setInstallmentEdited(true); setInstallment(event.target.value); }} placeholder="0.00" /></label></>}
        </div>
        {kind === 'emi' && endDate && <div className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{paymentCount > 0 && estimatedCents > 0 ? <><p>Estimated from {paymentCount} scheduled {paymentCount === 1 ? 'payment' : 'payments'} between the start and end dates{paymentDay ? '' : ', using the start day until you choose a payment day'}. The final payment may differ slightly due to rounding. You can edit the amount.</p>{installmentEdited && <button type="button" className="mt-1 font-semibold text-indigo-600 dark:text-indigo-300" onClick={() => setInstallmentEdited(false)}>Use calculated amount</button>}</> : <p>No estimate available. Check the dates and amount or enter the installment manually.</p>}</div>}
        {kind === 'emi' && <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 dark:border-indigo-400/20 dark:bg-indigo-500/10"><p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Next scheduled payment</p><p className="mt-1 text-sm font-semibold">{nextScheduled ? formatDisplayDate(nextScheduled) : paymentDay ? 'No scheduled date within the loan period' : 'Choose a monthly payment day'}</p><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Based on the schedule, not payment status. If a month has fewer days, the last day is used.</p></div>}
        {kind === 'emi' && <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Enter the full amount still payable, including any interest or fees you expect to pay.</p>}

        {((kind !== 'emi' && recordMovement) || (kind === 'emi' && recordEmiReceipt)) && <div className="mt-4"><Matches matches={initialMatches} selected={initialMatch} onSelect={setInitialMatch} money={money} /></div>}

        <label className="mt-4 block text-xs text-slate-500">Note (optional)<input className={field} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Add a note" /></label>
      </div>
      <button type="submit" disabled={busy || loading} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Plus className="h-4 w-4" />Save record</button>
    </form>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5"><h4 className="text-sm font-semibold">{labels[kind]} records</h4>{loading ? <p role="status" className="mt-3 text-xs text-slate-500">Loading records…</p> : !items.some(item => item.record_kind === kind) ? <p className="mt-3 text-xs text-slate-500">No {labels[kind].toLowerCase()} records yet. Add one above.</p> : <div className="mt-3 space-y-3">{items.filter(item => item.record_kind === kind).map(item => { const remaining = (cents(item.amount) - cents(item.repaid)) / 100; const lent = item.record_kind === 'lent'; const scheduled = remaining > 0 && item.record_kind === 'emi' && item.payment_day ? nextMonthlyPaymentDate(item.payment_day, item.lent_date, today, item.end_date) : null; return <article key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><h5 className="text-sm font-semibold">{item.person}</h5><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{labels[item.record_kind]} · {formatDisplayDate(item.lent_date)}{item.due_date ? ` · ${item.record_kind === 'emi' ? 'Next due' : 'Due'} ${formatDisplayDate(item.due_date)}` : ''}</p>{scheduled && <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">Next scheduled: {formatDisplayDate(scheduled)}</p>}{item.record_kind === 'emi' && item.end_date && <p className="mt-1 text-xs text-slate-500">End date: {formatDisplayDate(item.end_date)}</p>}{item.record_kind === 'emi' && item.payment_day !== null && <p className="mt-1 text-xs text-slate-500">Monthly payment day: {item.payment_day}</p>}{item.installment_amount !== null && <p className="mt-1 text-xs text-slate-500">Installment: {money(item.installment_amount)}</p>}{item.note && <p className="mt-1 break-words text-xs text-slate-500">{item.note}</p>}</div><div className="text-right"><p className="text-[10px] uppercase tracking-wide text-slate-500">{remaining ? lent ? 'To receive' : 'To pay' : 'Settled'}</p><p className="mt-1 text-base font-semibold tabular-nums">{money(remaining)}</p></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800"><p className="text-slate-500 dark:text-slate-400">Total {money(item.amount)} · {lent ? 'Received' : 'Paid'} {money(item.repaid)}</p><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={deletingLoanId !== null} aria-label={deletingLoanId === item.id ? `Deleting ${item.person}` : `Delete ${item.person}`} aria-busy={deletingLoanId === item.id} title="Delete record" onClick={() => removeLoan(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:text-rose-300 dark:hover:bg-rose-950/30">{deletingLoanId === item.id ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}</button><button type="button" disabled={deletingLoanId !== null} aria-label={`Edit ${item.person}`} title="Edit record" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { setEditId(item.id); setRepaymentId(null); setError(''); }}><Pencil aria-hidden="true" className="h-4 w-4" /></button>{remaining > 0 && repaymentId !== item.id && <button type="button" disabled={deletingLoanId !== null} className="min-h-9 rounded-lg bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700" onClick={() => { setEditId(null); setRepaymentId(item.id); setRepayment(String(item.record_kind === 'emi' && item.installment_amount ? Math.min(item.installment_amount, remaining) : remaining)); setPaymentDate(today < item.lent_date ? item.lent_date : today); setError(''); }}>{lent ? 'Mark received' : 'Mark payment'}</button>}</div></div>{deletingLoanId === item.id && <p role="status" className="mt-2 text-xs text-slate-500 dark:text-slate-400">Deleting record?</p>}{repaymentId === item.id && !deletingLoanId && <form onSubmit={event => saveRepayment(event, item)} className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-32 flex-1 text-xs text-slate-500">{lent ? 'Amount received' : 'Amount paid'}<input aria-label={`${lent ? 'Amount received from' : 'Amount paid to'} ${item.person}`} className={field} type="number" min={amountStepBase(repayment)} max={remaining} step="1" value={repayment} onChange={event => setRepayment(event.target.value)} required /></label><label className="min-w-32 flex-1 text-xs text-slate-500">Payment date<input className={field} type="date" min={item.lent_date} value={paymentDate} onChange={event => setPaymentDate(event.target.value)} required /></label><div className="min-w-40 flex-1"><AccountSelect label={lent ? 'Received into account' : 'Paid from account'} value={paymentAccount} onChange={setPaymentAccount} visibility={accountVisibility} /></div><div className="min-w-40 flex-1">{!paymentMatch && <PaymentMethodSelect value={repaymentMethod} onChange={setRepaymentMethod} account={paymentAccount} />}</div><p className="w-full text-xs text-slate-500 dark:text-slate-400">{lent ? 'This records money coming into the selected account.' : 'This records money going out of the selected account.'}</p><Matches matches={matches(repayment, paymentDate, paymentAccount, lent ? 'income' : 'expense')} selected={paymentMatch} onSelect={setPaymentMatch} money={money} /><button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Confirm {lent ? 'received' : 'payment'}</button><button type="button" className="min-h-10 px-2 text-xs text-slate-500" onClick={() => setRepaymentId(null)}>Cancel</button></form>}{editId === item.id && !deletingLoanId && <EditLoanForm key={item.id} item={item} busy={busy} onSave={changes => saveEdit(item, changes)} onCancel={() => setEditId(null)} />}{!deletingLoanId && <PaymentHistory item={item} expenses={expenses} links={movementLinks} linksUnavailable={linksUnavailable} visibility={accountVisibility} money={money} onSave={(row, value, paymentDate, paymentAccount, method) => savePaymentEdit(item, row, value, paymentDate, paymentAccount, method)} onDelete={row => removePayment(item, row)} />}</article>; })}</div>}</div>
    </div>
  </section>;
}
