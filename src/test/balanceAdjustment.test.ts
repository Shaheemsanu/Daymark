import { describe, expect, it } from 'vitest';
import { Account, createBalanceEntry, getAccountBalance, getBalanceAdjustmentNote } from '../utils/accounts';
import { Expense } from '../types';

const today = '2026-11-16';
const transaction = (changes: Partial<Expense> = {}): Expense => ({
  id: 'original', title: 'Opening balance', category: 'Opening Balance', amount: 500,
  date: '2026-11-01', account: 'expense', type: 'income', paymentMethod: 'Bank Transfer', createdAt: 1,
  ...changes,
});

describe('Balance adjustments', () => {
  it('shows the full calculation for increases, decreases and existing adjustment notes', () => {
    const increaseNote = 'Balance adjusted to match the entered amount. -220.00 + 320.00 = 100.00.';
    expect(createBalanceEntry([transaction({ amount: 220, type: 'expense' })], 'expense', 100, today)?.notes).toBe(increaseNote);
    expect(createBalanceEntry([transaction()], 'expense', 100, today)?.notes).toBe('Balance adjusted to match the entered amount. 500.00 - 400.00 = 100.00.');
    expect(getBalanceAdjustmentNote(transaction({ category: 'Balance Adjustment', notes: 'Balance adjusted from -220.00 to 100.00.' }))).toBe(increaseNote);
    expect(getBalanceAdjustmentNote(transaction({ category: 'Balance Adjustment', notes: '-220.00 + 320.00 = 100.00' }))).toBe(increaseNote);
    expect(getBalanceAdjustmentNote(transaction({ category: 'Balance Adjustment', notes: 'Balance adjusted to match the entered amount. Previous balance: -220.00 + Added: 320.00 = New balance: 100.00' }))).toBe(increaseNote);
    expect(getBalanceAdjustmentNote(transaction({ notes: 'Other note' }))).toBe('Other note');
    expect(getBalanceAdjustmentNote(transaction({ category: 'Balance Adjustment', notes: 'Balance correction: -220.00 + 320.00 added = 100.00' }))).toBe(increaseNote);
  });
  it.each(['expense', 'cash', 'savings'] as Account[])('sets the %s balance to the entered amount by recording only the difference', account => {
    const expenses = [transaction({ account })];
    const increase = createBalanceEntry(expenses, account, 700, today)!;
    expect(increase).toMatchObject({ title: 'Balance adjustment', category: 'Balance Adjustment', amount: 200, type: 'income', date: today, account });
    const increased = [...expenses, { ...increase, id: 'increase', createdAt: 2 }];
    expect(getAccountBalance(increased, account, today)).toBe(700);

    const decrease = createBalanceEntry(increased, account, 450, today)!;
    expect(decrease).toMatchObject({ title: 'Balance adjustment', amount: 250, type: 'expense', date: today });
    const decreased = [...increased, { ...decrease, id: 'decrease', createdAt: 3 }];
    expect(getAccountBalance(decreased, account, today)).toBe(450);
    expect(expenses[0]).toEqual(transaction({ account }));
    expect(getAccountBalance(decreased, account, '2026-11-15')).toBe(500);
  });

  it('includes income, outflows and both sides of transfers when calculating current balances', () => {
    const expenses = [
      transaction({ account: 'savings', amount: 1000 }),
      transaction({ id: 'transfer', account: 'savings', amount: 300, isTransfer: true, transferToAccount: 'expense' }),
      transaction({ id: 'spend', account: 'expense', amount: 100, type: 'expense' }),
      transaction({ id: 'cash-transfer', account: 'expense', amount: 50, isTransfer: true, transferToAccount: 'cash' }),
      transaction({ id: 'future', amount: 999, date: '2026-11-17' }),
    ];
    expect(getAccountBalance(expenses, 'savings', today)).toBe(700);
    expect(getAccountBalance(expenses, 'expense', today)).toBe(150);
    expect(getAccountBalance(expenses, 'cash', today)).toBe(50);
    expect(createBalanceEntry(expenses, 'expense', 100, today)).toMatchObject({ amount: 50, type: 'expense' });
  });

  it('supports clearing to zero, ignores unchanged balances and preserves cents', () => {
    const expenses = [transaction({ amount: 100.1 }), transaction({ type: 'expense', amount: 0.2 })];
    expect(createBalanceEntry(expenses, 'expense', 100, today)).toMatchObject({ amount: 0.1, type: 'income' });
    expect(createBalanceEntry(expenses, 'expense', 0, today)).toMatchObject({ amount: 99.9, type: 'expense' });
    expect(createBalanceEntry(expenses, 'expense', 99.9, today)).toBeNull();
    expect(() => createBalanceEntry(expenses, 'expense', -1, today)).toThrow();
    expect(() => createBalanceEntry(expenses, 'expense', NaN, today)).toThrow();
  });

  it('uses Opening balance for a new account', () => {
    expect(createBalanceEntry([], 'cash', 200, today)).toMatchObject({ title: 'Opening balance', category: 'Opening Balance', amount: 200, type: 'income', date: today });
    expect(() => createBalanceEntry([], 'cash', 0, today)).toThrow();
  });
});
