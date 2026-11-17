import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Expense } from '../types';
import { buildExpenseReport, reportWeekStart } from '../utils/expenseReports';
import { ExpenseReports } from '../components/ExpenseReports';

vi.mock('../components/ExpenseCharts', () => ({ DailySpendingTrendChart: () => <div>Spending chart</div> }));
vi.mock('../components/ExpenseReportCharts', () => ({ ExpenseReportCharts: () => <div>Detailed charts</div> }));
afterEach(cleanup);
const entry = (id: string, date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, date, amount, title: id, category: 'Food', paymentMethod: 'Cash', createdAt: 1, ...extra });

it('includes zero-spend days in daily averages and calculates transaction extrema', () => {
  const report = buildExpenseReport([entry('Breakfast', '2026-11-01', 10.1), entry('Lunch', '2026-11-01', 20.2), entry('Dinner', '2026-11-03', 30.3)], '2026-11-01', '2026-11-03')!;
  expect(report.total).toBe(60.6);
  expect(report.dailyAverage).toBeCloseTo(20.2);
  expect(report.activeDayAverage).toBeCloseTo(30.3);
  expect(report.transactionAverage).toBeCloseTo(20.2);
  expect(report.noSpendDays).toBe(1);
  expect(report.lowestDay).toEqual({ date: '2026-11-02', amount: 0 });
  expect(report.highestDay).toEqual({ date: '2026-11-01', amount: 30.3 });
  expect(report.largestTransaction?.id).toBe('Dinner');
  expect(report.smallestTransaction?.id).toBe('Breakfast');
});

it('excludes income, transfers, adjustments, opening balances, and invalid amounts', () => {
  const report = buildExpenseReport([
    entry('spend', '2026-11-01', 25),
    entry('income', '2026-11-01', 1000, { type: 'income' }),
    entry('transfer', '2026-11-01', 500, { isTransfer: true }),
    entry('legacy', '2026-11-01', 500, { category: 'Transfer to Expense' }),
    entry('adjustment', '2026-11-01', 200, { category: 'Balance Adjustment' }),
    entry('opening', '2026-11-01', 200, { category: 'Opening Balance' }),
    entry('invalid', '2026-11-01', NaN), entry('negative', '2026-11-01', -50),
    entry('future', '2026-11-02', 90),
  ], '2026-11-01', '2026-11-01')!;
  expect(report.total).toBe(25);
  expect(report.entries).toHaveLength(1);
});

it('groups partial weeks and months across a year boundary and compares equal-length periods', () => {
  const report = buildExpenseReport([
    entry('previous', '2026-12-27', 10),
    entry('dec', '2026-12-31', 20), entry('jan', '2027-01-03', 40),
  ], '2026-12-31', '2027-01-04')!;
  expect(report.dayCount).toBe(5);
  expect(report.months.map(row => [row.period, row.days, row.amount])).toEqual([['2027-01', 4, 40], ['2026-12', 1, 20]]);
  expect(report.weeks.map(row => [row.period, row.days, row.amount])).toEqual([['2027-01-04', 1, 0], ['2026-12-28', 4, 60]]);
  expect(report.previousStart).toBe('2026-12-26');
  expect(report.previousEnd).toBe('2026-12-30');
  expect(report.previousTotal).toBe(10);
  expect(report.changePercent).toBe(500);
  expect(reportWeekStart('2027-01-03')).toBe('2026-12-28');
});

it('handles empty data, invalid dates, and leap days without invalid averages', () => {
  expect(buildExpenseReport([], '2026-11-02', '2026-11-01')).toBeNull();
  expect(buildExpenseReport([], '', '2026-11-01')).toBeNull();
  expect(buildExpenseReport([], '2026-02-30', '2026-03-01')).toBeNull();
  const report = buildExpenseReport([], '2024-02-28', '2024-03-01')!;
  expect(report.dayCount).toBe(3);
  expect(report.dailyAverage).toBe(0);
  expect(report.changePercent).toBeNull();
  expect(report.largestTransaction).toBeUndefined();
  expect(report.noSpendDays).toBe(3);
});

it('ranks categories by spending and computes their shares', () => {
  const report = buildExpenseReport([entry('food', '2026-11-01', 25), entry('rent', '2026-11-01', 75, { category: 'Rent' })], '2026-11-01', '2026-11-01')!;
  expect(report.categories).toEqual([{ category: 'Rent', amount: 75, share: 75 }, { category: 'Food', amount: 25, share: 25 }]);
});

it('applies account and period filters to the displayed report', () => {
  render(<ExpenseReports expenses={[
    entry('cash', '2026-11-01', 40, { account: 'cash' }),
    entry('bank', '2026-11-16', 60, { account: 'expense' }),
  ]} currency="INR" referenceDate="2026-11-16" />);
  expect(screen.getByText(/30 calendar days · 2 expenses/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Report account'), { target: { value: 'cash' } });
  expect(screen.getByText(/30 calendar days · 1 expenses/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Report period'), { target: { value: 'today' } });
  expect(screen.getByText(/1 calendar days · 0 expenses/)).toBeTruthy();
  expect(screen.getByText('No spending in this range for these filters.')).toBeTruthy();
  const total = screen.getByText('Total spending').parentElement!;
  expect(within(total).getByText(/0\.00/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByText(/30 calendar days · 2 expenses/)).toBeTruthy();
  expect(screen.queryByText('Median expense')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show all statistics +' }));
  expect(screen.getByText('Median expense')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Show fewer statistics −' }));
  expect(screen.queryByText('Median expense')).toBeNull();
});

it('calculates weekday averages, cumulative comparisons, median, recurring totals and streaks', () => {
  const report = buildExpenseReport([
    entry('prior', '2026-10-26', 50, { category: 'Food' }),
    entry('mon', '2026-11-02', 20, { account: 'cash', isRecurring: true, spendType: 'need' }),
    entry('sat', '2026-11-07', 40, { account: 'expense', paymentMethod: 'Card', spendType: 'want' }),
    entry('sun', '2026-11-08', 60, { account: 'cash', spendType: 'need' }),
  ], '2026-11-02', '2026-11-08')!;
  expect(report.median).toBe(40);
  expect(report.recurringTotal).toBe(20);
  expect(report.longestNoSpendStreak).toBe(4);
  expect(report.weekdays.map(day => day.average)).toEqual([20, 0, 0, 0, 0, 40, 60]);
  expect(report.cumulativeDays[0]).toMatchObject({ current: 20, previous: 50, day: 1 });
  expect(report.cumulativeDays[6]).toMatchObject({ current: 120, previous: 50, day: 7 });
  expect(report.accounts[0]).toMatchObject({ name: 'Cash in Hand', amount: 80, count: 2 });
  expect(report.payments[0]).toMatchObject({ name: 'Cash', amount: 80 });
  expect(report.spendTypes[0]).toMatchObject({ name: 'Needs', amount: 80 });
  expect(report.categoryChanges).toEqual([{ category: 'Food', amount: 120, previous: 50, difference: 70, changePercent: 140 }]);
  expect(report.topExpenses.map(expense => expense.id)).toEqual(['sun', 'sat', 'mon']);
});

it('uses calendar occurrences for weekday averages and handles even medians and vanished categories', () => {
  const report = buildExpenseReport([
    entry('prior', '2026-10-31', 25, { category: 'Old' }),
    entry('first', '2026-11-02', 10), entry('second', '2026-11-09', 30),
  ], '2026-11-02', '2026-11-15')!;
  expect(report.weekdays[0]).toMatchObject({ days: 2, amount: 40, average: 20 });
  expect(report.median).toBe(20);
  expect(report.categoryChanges.find(row => row.category === 'Old')).toMatchObject({ amount: 0, previous: 25, difference: -25, changePercent: -100 });
  expect(report.categoryChanges.find(row => row.category === 'Food')?.changePercent).toBeNull();
  const empty = buildExpenseReport([], '2026-11-01', '2026-11-03')!;
  expect(empty.longestNoSpendStreak).toBe(3);
  expect(empty.median).toBe(0);
  expect(empty.accounts).toEqual([]);
});
