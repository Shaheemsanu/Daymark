import { Expense } from '../types';

export type Account = NonNullable<Expense['account']>;

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
