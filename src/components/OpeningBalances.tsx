import React, { useRef, useState } from 'react';
import { ArrowUpRight, Banknote, CreditCard, Info, LoaderCircle, PiggyBank, Wallet } from 'lucide-react';
import { Expense } from '../types';
import { Account, getAccountBalance, hasAccountTransactions } from '../utils/accounts';
import { formatDate } from '../utils/constants';

interface OpeningBalancesProps {
  expenses: Expense[];
  currency: string;
  disabled: boolean;
  onSave: (account: Account, amount: number) => Promise<boolean | string>;
}

const accounts = [
  { id: 'expense', label: 'Expense Account', description: 'Everyday spending', icon: CreditCard, accent: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
  { id: 'cash', label: 'Cash in Hand', description: 'Your physical cash', icon: Banknote, accent: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  { id: 'savings', label: 'Savings Account', description: 'Money set aside', icon: PiggyBank, accent: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' },
] as const;

export function OpeningBalances({ expenses, currency, disabled, onSave }: OpeningBalancesProps) {
  const [amounts, setAmounts] = useState<Partial<Record<Account, string>>>({});
  const [saving, setSaving] = useState<Account | null>(null);
  const savingRef = useRef(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [confirmAccount, setConfirmAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState<{ account: Account; error: boolean; text: string } | null>(null);

  return (
    <section aria-labelledby="opening-balances-heading" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <div className="flex items-start gap-2.5 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 id="opening-balances-heading" className="text-base font-semibold tracking-tight">Account Balances</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Set a starting balance or adjust an account to its current balance. Editing requires confirmation.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
        {accounts.map(account => {
          const alreadyActive = hasAccountTransactions(expenses, account.id);
          const isEditing = editingAccount === account.id;
          const locked = alreadyActive && !isEditing;
          const displayedAmount = amounts[account.id] ?? (alreadyActive ? getAccountBalance(expenses, account.id, formatDate(new Date())).toFixed(2) : '');
          const Icon = account.icon;
          // Anchor whole-unit spinner steps to the entered fractional amount.
          const enteredAmount = Number(displayedAmount || 0);
          const validAmount = displayedAmount.trim() !== '' && Number.isFinite(enteredAmount) && (alreadyActive ? enteredAmount >= 0 : enteredAmount > 0);
          const buttonDisabled = disabled || saving !== null || (!locked && !validAmount);
          const stepBase = Number.isFinite(enteredAmount) && enteredAmount > 0
            ? ((Math.round(enteredAmount * 100) % 100) / 100).toFixed(2)
            : '0';
          return (
            <form key={account.id} noValidate className="flex min-w-0 flex-col rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-950/30 p-3 transition-colors focus-within:border-emerald-400 dark:focus-within:border-emerald-700" onSubmit={async event => {
              event.preventDefault();
              if (disabled || savingRef.current || locked) return;
              const amount = Number(displayedAmount);
              if (displayedAmount.trim() === '' || !Number.isFinite(amount) || amount < 0 || (!alreadyActive && amount === 0)) {
                setMessage({ account: account.id, error: true, text: alreadyActive ? 'Enter a balance of zero or greater.' : 'Enter an amount greater than zero.' });
                return;
              }
              savingRef.current = true;
              setSaving(account.id);
              setMessage(null);
              try {
                const result = await onSave(account.id, amount);
                setMessage({ account: account.id, error: result !== true, text: result === true ? alreadyActive ? 'Balance saved.' : 'Opening balance saved.' : typeof result === 'string' ? result : 'Unable to save. Please try again.' });
                if (result === true) {
                  setAmounts(current => { const next = { ...current }; delete next[account.id]; return next; });
                  setEditingAccount(null);
                }
              } catch (error) {
                setMessage({ account: account.id, error: true, text: error instanceof Error ? error.message : 'Unable to save. Please try again.' });
              } finally {
                savingRef.current = false;
                setSaving(null);
              }
            }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${account.accent}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <h4 className="text-sm font-semibold">{account.label}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{account.description}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {alreadyActive ? 'Active' : 'Ready to set up'}
                </span>
              </div>
                <>
                  <label className="mt-3 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {alreadyActive ? 'Current balance' : 'Starting amount'}
                    <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15 transition-shadow">
                      <span aria-hidden="true" className="shrink-0 text-base font-medium text-slate-400">{currency}</span>
                    {/* Validate on submit so typed decimals remain valid with whole-unit arrow steps. */}
                    <input aria-label={`${account.label} opening balance`} type="number" inputMode="decimal" min={stepBase} step="1" required value={displayedAmount} disabled={disabled || saving !== null || locked}
                      onChange={event => {
                        const input = event.target;
                        const nativeEvent = event.nativeEvent as InputEvent;
                        // Browser spinner changes have no text-insertion input type.
                        const value = !nativeEvent.inputType && input.value !== '' && Number.isFinite(input.valueAsNumber)
                          ? input.valueAsNumber.toFixed(2)
                          : input.value;
                        setAmounts(current => ({ ...current, [account.id]: value }));
                      }}
                      onBlur={event => {
                        const amount = event.target.valueAsNumber;
                        if (Number.isFinite(amount)) setAmounts(current => ({ ...current, [account.id]: amount.toFixed(2) }));
                      }}
                      placeholder="0.00" className="min-w-0 w-full bg-transparent py-2 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none disabled:opacity-50" />
                    </span>
                  </label>
                  <button type={locked ? 'button' : 'submit'} onClick={locked ? () => setConfirmAccount(account.id) : undefined} disabled={buttonDisabled} aria-busy={saving === account.id} className={`mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors ${buttonDisabled ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-500 disabled:cursor-not-allowed' : locked ? 'cursor-pointer border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600' : 'cursor-pointer border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700'}`}>
                    {saving === account.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    {saving === account.id ? 'Saving...' : locked ? 'Edit balance' : alreadyActive ? 'Save balance' : 'Set opening balance'}
                    {saving !== account.id && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                  {!locked && !validAmount && !disabled && saving === null && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{alreadyActive ? 'Enter zero or a positive amount to enable saving.' : 'Enter an amount greater than zero to enable this button.'}</p>}
                  {isEditing && <button type="button" disabled={disabled || saving !== null} onClick={() => {
                    setEditingAccount(null);
                    setAmounts(current => { const next = { ...current }; delete next[account.id]; return next; });
                    setMessage(null);
                  }} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400">Cancel</button>}
                </>
              {message?.account === account.id && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-xs ${message.error ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{message.text}</p>}
            </form>
          );
        })}
      </div>
      <p className="flex items-start gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2 sm:px-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Initial amounts are saved as Opening balance. Edits add or subtract the difference as a Balance adjustment in transaction history.
      </p>
      {confirmAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="edit-opening-balance-title" aria-describedby="edit-opening-balance-warning" onKeyDown={event => { if (event.key === 'Escape') setConfirmAccount(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 id="edit-opening-balance-title" className="text-base font-semibold">Edit {accounts.find(account => account.id === confirmAccount)?.label} balance?</h3>
            <p id="edit-opening-balance-warning" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Saving will set the current balance to the amount you enter. The difference will be added or subtracted as a Balance adjustment dated today in transaction history. Previous entries will be kept. Click OK to enable editing.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirmAccount(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Cancel</button>
              <button type="button" disabled={disabled || saving !== null} onClick={() => {
                setAmounts(current => ({ ...current, [confirmAccount]: getAccountBalance(expenses, confirmAccount, formatDate(new Date())).toFixed(2) }));
                setEditingAccount(confirmAccount);
                setMessage(null);
                setConfirmAccount(null);
              }} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">OK</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
