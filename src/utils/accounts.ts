import { Expense } from '../types';

export type Account = NonNullable<Expense['account']>;

function balanceCalculation(current: number, target: number): string {
  const difference = Math.round(target * 100) - Math.round(current * 100);
  return `Balance adjusted to match the entered amount. ${current.toFixed(2)} ${difference < 0 ? '-' : '+'} ${(Math.abs(difference) / 100).toFixed(2)} = ${target.toFixed(2)}.`;
}

export function getBalanceAdjustmentNote(expense: Expense): string | undefined {
  if (expense.category !== 'Balance Adjustment') return expense.notes;
  return expense.notes
    ?.replace(/^Balance adjusted from (-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)\.$/,
      (_, current, target) => balanceCalculation(Number(current), Number(target)))
    .replace(/^(-?\d+(?:\.\d+)?) [+-] \d+(?:\.\d+)? = (-?\d+(?:\.\d+)?)$/,
      (_, current, target) => balanceCalculation(Number(current), Number(target)))
    .replace(/^Balance adjusted to match the entered amount\. Previous balance: (-?\d+(?:\.\d+)?) [+-] (?:Added|Deducted): \d+(?:\.\d+)? = New balance: (-?\d+(?:\.\d+)?)$/,
      (_, current, target) => balanceCalculation(Number(current), Number(target)))
    .replace(/^Balance correction: (-?\d+(?:\.\d+)?) [+-] \d+(?:\.\d+)? (?:added|deducted) = (-?\d+(?:\.\d+)?)$/,
      (_, current, target) => balanceCalculation(Number(current), Number(target)));
}

export function getAccountBalance(expenses: Expense[], account: Account, asOfDate: string): number {
  let cents = 0;
  for (const expense of expenses) {
    if (expense.date > asOfDate) continue;
    const amount = Math.round(expense.amount * 100);
    const isTransfer = expense.isTransfer || expense.category.includes('Transfer');
    const source = expense.account || (isTransfer ? 'savings' : 'expense');
    if (isTransfer) {
      const target = expense.transferToAccount
        || (/transfer to (expense|cash|savings)/i.exec(expense.category)?.[1]?.toLowerCase() as Account | undefined)
        || 'expense';
      if (source === account) cents -= amount;
      if (target === account) cents += amount;
    } else if (source === account) {
      cents += expense.type === 'income' ? amount : -amount;
    }
  }
  return cents / 100;
}

export function createBalanceEntry(expenses: Expense[], account: Account, targetBalance: number, date: string): Omit<Expense, 'id' | 'createdAt'> | null {
  const active = hasAccountTransactions(expenses, account);
  if (!Number.isFinite(targetBalance) || targetBalance < 0 || (!active && targetBalance === 0)) {
    throw new Error(active ? 'Enter a balance of zero or greater.' : 'Enter an amount greater than zero.');
  }
  const current = getAccountBalance(expenses, account, date);
  const targetCents = Math.round(targetBalance * 100);
  const difference = targetCents - Math.round(current * 100);
  if (difference === 0) return null;
  return {
    title: active ? 'Balance adjustment' : 'Opening balance',
    amount: Math.abs(difference) / 100,
    category: active ? 'Balance Adjustment' : 'Opening Balance',
    date,
    paymentMethod: account === 'cash' ? 'Cash' : 'Bank Transfer',
    type: difference > 0 ? 'income' : 'expense',
    account,
    isTransfer: false,
    notes: active ? balanceCalculation(current, targetCents / 100) : 'Starting balance added in Settings.',
  };
}

export function getOpeningBalance(expenses: Expense[], account: Account): Expense | undefined {
  return expenses.find(expense => (expense.account || 'expense') === account
    && expense.type === 'income' && !expense.isTransfer
    && expense.category === 'Opening Balance' && expense.title === 'Opening balance');
}

export function hasAccountTransactions(expenses: Expense[], account: Account): boolean {
  return expenses.some(expense => {
    const source = expense.account || (expense.isTransfer ? 'savings' : 'expense');
    if (source === account) return true;
    if (expense.isTransfer) {
      const target = expense.transferToAccount
        || (/transfer to (expense|cash|savings)/i.exec(expense.category)?.[1]?.toLowerCase() as Account | undefined)
        || 'expense';
      return target === account;
    }
    // Older savings transfers were stored using only their category.
    return expense.category.includes('Transfer') && (account === 'savings' || account === 'expense');
  });
}
