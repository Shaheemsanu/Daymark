import { describe, expect, it } from 'vitest';
import { BudgetConfig, Expense } from '../types';
import { AnalyticsFilters, buildFinancialAnalytics, budgetStatus, percentChange, resolveAnalyticsRange, automaticChartGrouping, analyticsGroupLabel } from '../utils/financialAnalytics';
import { financialReportCSV } from '../utils/financialExports';
import { getAccountBalance } from '../utils/accounts';

const budget: BudgetConfig = { monthlyBudget: 3000, dailyBudget: 100, weeklyBudget: 700, currency: 'INR', categoryBudgets: { Food: 600 } };
const filters: AnalyticsFilters = { start: '2026-11-10', end: '2026-11-16', account: 'all', category: 'all', type: 'all', grouping: 'daily' };
const tx = (id: string, date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, date, amount, title: id, category: 'Food', paymentMethod: 'Cash', account: 'expense', createdAt: 1, ...extra });
const records: Expense[] = [
  tx('opening', '2026-11-01', 1000, { type: 'income', category: 'Opening Balance' }),
  tx('salary', '2026-11-10', 500, { type: 'income', category: 'Salary' }),
  tx('purchase', '2026-11-11', 120),
  tx('transfer', '2026-11-12', 200, { isTransfer: true, category: 'Transfer to Cash', transferToAccount: 'cash' }),
  tx('adjustment', '2026-11-13', 50, { category: 'Balance Adjustment' }),
  tx('repayment', '2026-11-14', 40, { category: 'Credit Card Payment' }),
  tx('reversal', '2026-11-15', -20),
];

describe('financial calculations', () => {
  it('automatically selects readable chart intervals and labels partial periods inside the selected dates', () => {
    expect(automaticChartGrouping('2026-11-16', '2026-11-16')).toBe('daily');
    expect(automaticChartGrouping('2026-10-18', '2026-11-16')).toBe('daily');
    expect(automaticChartGrouping('2026-08-01', '2026-11-16')).toBe('weekly');
    expect(automaticChartGrouping('2026-01-01', '2026-11-16')).toBe('monthly');
    expect(automaticChartGrouping('2020-01-01', '2026-11-16')).toBe('yearly');
    const report = buildFinancialAnalytics(records, budget, { ...filters, start: '2026-11-12', end: '2026-11-16', grouping: 'weekly' })!;
    expect(report.groups.map(row => [row.start, row.end])).toEqual([['2026-11-12', '2026-11-15'], ['2026-11-16', '2026-11-16']]);
    expect(report.groups.map(analyticsGroupLabel)).toEqual(['12 Nov – 15 Nov', '16 Nov']);
    expect(analyticsGroupLabel({ start: '2026-12-31', end: '2027-01-02' })).toBe('31 Dec 2026 – 2 Jan 2027');
  });
  it('separates operating totals from balance movements and reconciles cash flow', () => {
    const report = buildFinancialAnalytics(records, budget, filters)!;
    expect(report.total).toMatchObject({ income: 500, expenses: 100, net: 400, savingsRate: 80, expenseRatio: 20, count: 3 });
    expect(report.openingBalance).toBe(1000);
    expect(report.closingBalance).toBe(1310);
    expect(report.cashOther).toBe(-90);
    expect(report.openingBalance + report.total.income - report.total.expenses + report.cashOther).toBe(report.closingBalance);
    expect(report.transfers).toHaveLength(1);
    expect(report.dailyAverage).toBeCloseTo(100 / 7);
    expect(report.days[1].expenses).toBe(120);
    expect(report.days[5].expenses).toBe(-20);
    for (const account of report.accounts) expect(account.balance).toBe(getAccountBalance(records, account.account, filters.end));
  });

  it('counts both transfer ends for balances but never as operating spending', () => {
    const cash = buildFinancialAnalytics(records, budget, { ...filters, account: 'cash' })!;
    expect(cash.total.expenses).toBe(0);
    expect(cash.closingBalance).toBe(200);
    expect(cash.transfers).toHaveLength(1);
    expect(cash.cashOther).toBe(200);
    const expense = buildFinancialAnalytics(records, budget, { ...filters, account: 'expense' })!;
    expect(expense.closingBalance).toBe(1110);
    expect(expense.cashOther).toBe(-290);
  });

  it('applies category and type filters to current and previous periods', () => {
    const report = buildFinancialAnalytics([...records, tx('prior', '2026-11-04', 50), tx('other', '2026-11-11', 300, { category: 'Shopping' })], budget, { ...filters, category: 'Food', type: 'expense' })!;
    expect(report.total.income).toBe(0);
    expect(report.total.expenses).toBe(100);
    expect(report.prior.expenses).toBe(50);
    expect(report.changes.expenses).toBe(100);
    expect(report.closingBalance).toBe(960);
    expect(report.periodBudget).toBe(140);
    expect(report.transfers).toEqual([]);
    expect(report.total.savingsRate).toBeNull();
  });

  it('prorates budgets across months and labels budget thresholds at exact boundaries', () => {
    const report = buildFinancialAnalytics([], budget, { ...filters, start: '2026-01-31', end: '2026-02-01' })!;
    expect(report.periodBudget).toBeCloseTo(Math.round((3000 / 31 + 3000 / 28) * 100) / 100);
    expect(report.budgetHistory.map(row => row.budget)).toEqual([96.77, 107.14]);
    expect([69.9, 70, 89.9, 90, 100, 100.1].map(budgetStatus)).toEqual(['Normal', 'Approaching limit', 'Approaching limit', 'Warning', 'Warning', 'Over budget']);
  });

  it('handles empty data, invalid ranges, zero denominators, duplicate IDs, and deleted records', () => {
    const empty = buildFinancialAnalytics([], budget, filters)!;
    expect(empty.total.savingsRate).toBeNull();
    expect(empty.changes.income).toBeNull();
    expect(empty.noSpendDays).toBe(7);
    expect(empty.closingBalance).toBe(0);
    expect(buildFinancialAnalytics([], budget, { ...filters, start: '2026-02-30' })).toBeNull();
    expect(buildFinancialAnalytics([], budget, { ...filters, start: '2026-11-17' })).toBeNull();
    expect(buildFinancialAnalytics([...records, records[2]], budget, filters)!.total.expenses).toBe(100);
    expect(buildFinancialAnalytics(records.filter(row => row.id !== 'purchase'), budget, filters)!.total.expenses).toBe(-20);
    expect(percentChange(1, 0)).toBeNull();
    expect(percentChange(-50, -100)).toBe(-50);
  });

  it('resolves local-calendar presets across leap days and year boundaries', () => {
    expect(resolveAnalyticsRange('7days', '2026-01-03')).toEqual({ start: '2025-12-28', end: '2026-01-03' });
    expect(resolveAnalyticsRange('lastmonth', '2024-03-15')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(resolveAnalyticsRange('3months', '2026-01-15')).toEqual({ start: '2025-11-01', end: '2026-01-15' });
    expect(resolveAnalyticsRange('today', '2026-11-16')).toEqual({ start: '2026-11-16', end: '2026-11-16' });
    expect(resolveAnalyticsRange('yesterday', '2026-01-01')).toEqual({ start: '2025-12-31', end: '2025-12-31' });
    expect(resolveAnalyticsRange('30days', '2026-11-16')).toEqual({ start: '2026-10-18', end: '2026-11-16' });
  });

  it('groups balances and income/expenses consistently by week, month, and year', () => {
    const rows = [tx('income', '2026-12-31', 200, { type: 'income' }), tx('spend', '2027-01-01', 50)];
    const report = buildFinancialAnalytics(rows, budget, { ...filters, start: '2026-12-31', end: '2027-01-02', grouping: 'yearly' })!;
    expect(report.groups.map(row => [row.date, row.income, row.expenses])).toEqual([['2026', 200, 0], ['2027', 0, 50]]);
    expect(report.groups[1].balances.expense).toBe(150);
    const weekly = buildFinancialAnalytics(rows, budget, { ...report.filters, grouping: 'weekly' })!;
    expect(weekly.groups).toHaveLength(1);
    expect(weekly.groups[0].date).toBe('2026-12-28');
  });

  it('detects regular payments and possible same-day duplicates without assuming every repeat is a subscription', () => {
    const report = buildFinancialAnalytics([
      tx('a', '2026-09-01', 100, { title: 'Streaming' }), tx('b', '2026-10-01', 100, { title: 'Streaming' }), tx('c', '2026-11-01', 100, { title: 'Streaming' }),
      tx('d', '2026-11-02', 20, { title: 'Coffee' }), tx('e', '2026-11-02', 20, { title: 'Coffee' }),
      tx('f', '2026-11-03', 500, { title: 'Marked bill', isRecurring: true }),
    ], budget, { ...filters, start: '2026-09-01', end: '2026-11-16' })!;
    expect(report.recurring.find(row => row.name === 'Streaming')).toMatchObject({ detected: true, confirmed: false, count: 3 });
    expect(report.recurring.find(row => row.name === 'Streaming')!.monthlyEstimate).toBeCloseTo(99.8, 0);
    expect(report.recurring.find(row => row.name === 'Coffee')).toMatchObject({ possibleDuplicate: true, detected: false, monthlyEstimate: null });
    expect(report.recurring.find(row => row.name === 'Marked bill')).toMatchObject({ confirmed: true, monthlyEstimate: null });
  });

  it('only projects month-end when the range includes the beginning of an unfinished month', () => {
    const rows = [tx('one', '2026-11-05', 100)];
    expect(buildFinancialAnalytics(rows, budget, { ...filters, start: '2026-11-01', end: '2026-11-10' })!.projection).toBe(300);
    expect(buildFinancialAnalytics(rows, budget, filters)!.projection).toBeNull();
    expect(buildFinancialAnalytics(rows, budget, { ...filters, start: '2026-11-01', end: '2026-11-30' })!.projection).toBeNull();
  });

  it('flags unusual transactions only with sufficient evidence', () => {
    const rows = [10, 10, 10, 10, 100].map((amount, index) => tx(String(index), '2026-11-10', amount));
    expect(buildFinancialAnalytics(rows, budget, filters)!.unusual).toHaveLength(1);
    expect(buildFinancialAnalytics(rows.slice(1), budget, filters)!.unusual).toHaveLength(0);
  });

  it('exports the same filtered totals and escapes CSV content', () => {
    const report = buildFinancialAnalytics([...records, tx('unsafe', '2026-11-10', 1, { title: '=SUM(1,2) "test"' })], budget, { ...filters, type: 'expense' })!;
    const csv = financialReportCSV(report, 'transactions');
    expect(csv).toContain('"Expenses","101.00"');
    expect(csv).toContain('"\'=SUM(1,2) ""test"""');
    expect(csv).not.toContain('"salary"');
    expect(csv).not.toContain('"transfer"');
    expect(financialReportCSV(report, 'monthly')).toContain('"2026-11","0.00","101.00","-101.00","N/A"');
    expect(financialReportCSV(report, 'categories')).toContain('"Food","101.00"');
    expect(financialReportCSV(report, 'accounts')).toContain('"Expense Account"');
  });
});
