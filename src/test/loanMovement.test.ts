import { describe, expect, it } from 'vitest';
import { Expense } from '../types';
import { getAccountBalance } from '../utils/accounts';
import { isReportExpense } from '../utils/expenseReports';
import { buildFinancialAnalytics, isOperatingTransaction } from '../utils/financialAnalytics';
import { LOAN_MOVEMENT_CATEGORIES, LOAN_MOVEMENT_CATEGORY } from '../utils/loanMovement';

describe('loan account movements', () => {
  it('affect the account balance but not operating income or expense reports', () => {
    const movement: Expense = { id: 'loan', title: 'Loan to Sam', amount: 200, category: LOAN_MOVEMENT_CATEGORY, date: '2026-11-24', paymentMethod: 'Cash', type: 'expense', account: 'cash', createdAt: 1 };
    expect(getAccountBalance([movement], 'cash', '2026-11-24')).toBe(-200);
    expect(isReportExpense(movement)).toBe(false);
    expect(isOperatingTransaction(movement)).toBe(false);
    expect(isOperatingTransaction({ ...movement, type: 'income' })).toBe(false);
    for (const category of LOAN_MOVEMENT_CATEGORIES) {
      expect(isOperatingTransaction({ ...movement, category })).toBe(false);
      expect(isReportExpense({ ...movement, category })).toBe(false);
      expect(getAccountBalance([{ ...movement, category, type: 'income' }], 'cash', '2026-11-24')).toBe(200);
    }
    const report = buildFinancialAnalytics([movement], { monthlyBudget: 1000, weeklyBudget: 200, dailyBudget: 30, currency: 'INR', categoryBudgets: {} }, { start: '2026-11-24', end: '2026-11-24', account: 'cash', category: 'all', type: 'all', grouping: 'daily' })!;
    expect(report.total.expenses).toBe(0);
    expect(report.closingBalance).toBe(-200);
  });
});
