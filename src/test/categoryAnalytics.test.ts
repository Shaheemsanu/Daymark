import { describe, expect, it } from 'vitest';
import { buildCategoryDetails, buildCategoryComparison } from '../utils/categoryAnalytics';
import { buildFinancialAnalytics, AnalyticsFilters } from '../utils/financialAnalytics';
import { BudgetConfig, Expense } from '../types';

const budget: BudgetConfig = { monthlyBudget: 0, dailyBudget: 0, weeklyBudget: 0, currency: 'INR', categoryBudgets: {} };
const filters: AnalyticsFilters = { start: '2026-11-10', end: '2026-11-16', account: 'all', category: 'all', payment: 'all', type: 'all', grouping: 'daily' };
const transaction = (id: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, title: id, amount, date: '2026-11-11', category: 'Food', account: 'cash', paymentMethod: 'Cash', createdAt: 1, ...extra });

describe('category spending details', () => {
  it('hides zero categories while retaining values in either period, including reversals', () => {
    const report = buildFinancialAnalytics([transaction('food', 10), transaction('previous', 20, { category: 'Transport', date: '2026-11-05' }), transaction('refund', -5, { category: 'Refunded' })], budget, filters)!;
    const comparison = buildCategoryComparison(report, ['Unused custom category', 'Food']);
    expect(comparison).toContainEqual({ name: 'Food', current: 10, previous: 0 });
    expect(comparison).toContainEqual({ name: 'Transport', current: 0, previous: 20 });
    expect(comparison.some(row => row.name === 'Housing')).toBe(false);
    expect(comparison.some(row => row.name === 'Unused custom category')).toBe(false);
    expect(comparison).toContainEqual({ name: 'Refunded', current: -5, previous: 0 });
    expect(comparison.filter(row => row.name === 'Food')).toHaveLength(1);
    expect(comparison.some(row => row.name === 'Salary / Wages')).toBe(false);
    expect(comparison.reduce((sum, row) => sum + row.current, 0)).toBe(report.total.expenses);
  });

  it('hides a specifically selected category when neither period has a value', () => {
    const report = buildFinancialAnalytics([], budget, { ...filters, category: 'Custom empty' })!;
    expect(buildCategoryComparison(report, ['Unrelated'])).toEqual([]);
  });
  it('separates purchase statistics from reversals and includes zero-spend days in daily averages', () => {
    const rows = [transaction('one', 10.1), transaction('two', 20.2), transaction('three', 30.3, { date: '2026-11-12', paymentMethod: 'UPI', account: 'expense' }), transaction('reverse', -5.05), transaction('zero', 0), transaction('old', 25.55, { date: '2026-11-05' }), transaction('income', 100, { type: 'income' }), transaction('transfer', 200, { isTransfer: true })];
    const details = buildCategoryDetails(buildFinancialAnalytics([...rows, rows[0]], budget, filters)!);
    expect(details).toHaveLength(1);
    const food = details[0];
    expect(food).toMatchObject({ amount: 55.55, purchased: 60.6, reversed: 5.05, count: 5, purchaseCount: 3, averagePurchase: 20.2, minimum: 10.1, maximum: 30.3, median: 20.2, activeDays: 2, previous: 25.55, changeAmount: 30 });
    expect(food.dailyAverage).toBeCloseTo(55.55 / 7);
    expect(food.accounts.map(row => row.amount).reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(food.amount);
    expect(food.payments).toEqual([{ name: 'UPI', amount: 30.3 }, { name: 'Cash', amount: 25.25 }]);
    expect(food.rows).toHaveLength(5);
    expect(food.rows[0].id).toBe('three');
  });

  it('handles reversal-only categories and excludes previous-only categories from current cards', () => {
    const report = buildFinancialAnalytics([transaction('refund', -12), transaction('old', 20, { category: 'Transport', date: '2026-11-04' })], budget, filters)!;
    expect(report.categories).toHaveLength(2);
    const details = buildCategoryDetails(report);
    expect(details).toHaveLength(1);
    expect(details[0]).toMatchObject({ name: 'Food', purchased: 0, reversed: 12, averagePurchase: null, minimum: null, maximum: null, median: null, activeDays: 0 });
  });

  it('keeps category details scoped to shared account and payment filters', () => {
    const report = buildFinancialAnalytics([transaction('cash', 10), transaction('upi', 20, { paymentMethod: 'UPI' }), transaction('bank', 30, { account: 'expense' })], budget, { ...filters, account: 'cash', payment: 'UPI' })!;
    expect(buildCategoryDetails(report)[0]).toMatchObject({ amount: 20, count: 1, averagePurchase: 20 });
  });
});
