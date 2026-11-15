import React, { useRef, useState } from 'react';
import { ArrowUpRight, Banknote, CheckCircle2, CreditCard, Info, LoaderCircle, LockKeyhole, PiggyBank, Wallet } from 'lucide-react';
import { Expense } from '../types';
import { Account, hasAccountTransactions } from '../utils/accounts';

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
  const [message, setMessage] = useState<{ account: Account; error: boolean; text: string } | null>(null);

  return (
    <section aria-labelledby="opening-balances-heading" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <div className="flex items-start gap-2.5 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 id="opening-balances-heading" className="text-base font-semibold tracking-tight">Opening Balances</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Start with what you already have. Set a balance for each account before its first transaction.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
        {accounts.map(account => {
          const unavailable = hasAccountTransactions(expenses, account.id);
          const Icon = account.icon;
          // Anchor whole-unit spinner steps to the entered fractional amount.
          const enteredAmount = Number(amounts[account.id] || 0);
          const stepBase = Number.isFinite(enteredAmount) && enteredAmount > 0
            ? ((Math.round(enteredAmount * 100) % 100) / 100).toFixed(2)
            : '0';
          return (
            <form key={account.id} noValidate className="flex min-w-0 flex-col rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-950/30 p-3 transition-colors focus-within:border-emerald-400 dark:focus-within:border-emerald-700" onSubmit={async event => {
              event.preventDefault();
              if (disabled || savingRef.current || unavailable) return;
              const amount = Number(amounts[account.id]);
              if (!Number.isFinite(amount) || amount <= 0) {
                setMessage({ account: account.id, error: true, text: 'Enter an amount greater than zero.' });
                return;
              }
              savingRef.current = true;
              setSaving(account.id);
              setMessage(null);
              try {
                const result = await onSave(account.id, amount);
                setMessage({ account: account.id, error: result !== true, text: result === true ? 'Opening balance saved.' : typeof result === 'string' ? result : 'Unable to save. Please try again.' });
                if (result === true) setAmounts(current => ({ ...current, [account.id]: '' }));
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
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${unavailable ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                  {unavailable ? <LockKeyhole className="h-3 w-3" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  {unavailable ? 'Already active' : 'Ready to set up'}
                </span>
              </div>
              {unavailable ? (
                <div className="mt-3 flex flex-1 items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Transactions already recorded. Opening balance is unavailable.</p>
                </div>
              ) : (
                <>
                  <label className="mt-3 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Starting amount
                    <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15 transition-shadow">
                      <span aria-hidden="true" className="shrink-0 text-base font-medium text-slate-400">{currency}</span>
                    {/* Validate on submit so typed decimals remain valid with whole-unit arrow steps. */}
                    <input aria-label={`${account.label} opening balance`} type="number" inputMode="decimal" min={stepBase} step="1" required value={amounts[account.id] || ''} disabled={disabled || saving !== null}
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
                  <button type="submit" disabled={disabled || saving !== null} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-800 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving === account.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    {saving === account.id ? 'Saving...' : 'Set opening balance'}
                    {saving !== account.id && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </>
              )}
              {message?.account === account.id && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-xs ${message.error ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{message.text}</p>}
            </form>
          );
        })}
      </div>
      <p className="flex items-start gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2 sm:px-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Saved as an income transaction labeled Opening balance. Available only for accounts with no transactions.
      </p>
    </section>
  );
}
