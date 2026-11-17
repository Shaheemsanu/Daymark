import { describe, expect, it } from 'vitest';
import { buildSpendingSnapshot } from '../utils/spendingSnapshot';
import { Expense } from '../types';

const row = (id: string, date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, date, amount, title: id, category: 'Food', paymentMethod: 'Cash', createdAt: 1, ...extra });

describe('essential spending snapshot', () => {
  it('uses inclusive rolling periods across months and excludes future records and non-expenses', () => {
    const records = [row('today', '2026-11-02', 20), row('week-start', '2026-10-27', 30), row('month-start', '2026-10-04', 50), row('old', '2026-10-03', 500), row('future', '2026-11-03', 200), row('income', '2026-11-02', 1000, { type: 'income' }), row('transfer', '2026-11-02', 100, { isTransfer: true }), row('opening', '2026-11-02', 300, { category: 'Opening Balance' })];
    const periods = buildSpendingSnapshot([...records, records[0]], '2026-11-02');
    expect(periods.map(period => period.label)).toEqual(['Today', 'Last 7 days', 'Last 30 days']);
    expect(periods.map(period => period.total)).toEqual([20, 50, 100]);
    expect(periods.map(period => period.count)).toEqual([1, 2, 3]);
    expect(periods[1].start).toBe('2026-10-27');
    expect(periods[2].start).toBe('2026-10-04');
    expect(periods[1].averageDaily).toBeCloseTo(50 / 7);
    expect(periods[1].zeroSpendDays).toBe(5);
  });

  it('distinguishes daily net spending and positive purchase amounts with reversals', () => {
    const periods = buildSpendingSnapshot([row('a', '2026-11-16', 10.1), row('b', '2026-11-16', 20.2), row('reverse', '2026-11-15', -5.05)], '2026-11-16');
    expect(periods[1].total).toBe(25.25);
    expect(periods[1].averagePurchase).toBeCloseTo(15.15);
    expect(periods[1].minimumPurchase).toBe(10.1);
    expect(periods[1].maximumPurchase).toBe(20.2);
    expect(periods[1].highestDay).toEqual({ date: '2026-11-16', amount: 30.3 });
    expect(periods[1].lowestDay).toEqual({ date: '2026-11-15', amount: -5.05 });
    expect(periods[0].highestDay).toEqual(periods[0].lowestDay);
  });

  it('shows no purchase or daily extrema when no records exist', () => {
    const periods = buildSpendingSnapshot([], '2026-11-16');
    for (const period of periods) {
      expect(period).toMatchObject({ total: 0, averageDaily: 0, averagePurchase: null, highestDay: null, lowestDay: null, minimumPurchase: null, maximumPurchase: null, zeroSpendDays: period.dayCount });
    }
  });

  it('compares disjoint periods and reconciles category, account, and payment breakdowns', () => {
    const records = [
      row('one', '2026-11-10', 20, { account: 'cash' }),
      row('two', '2026-11-16', 10, { account: 'expense', paymentMethod: 'UPI' }),
      row('reverse', '2026-11-16', -5, { account: 'cash' }),
      row('groceries', '2026-11-12', 30, { category: 'Groceries', account: 'cash' }),
      row('previous-end', '2026-11-09', 40), row('previous-start', '2026-11-03', 10),
      row('too-old', '2026-11-02', 100), row('future', '2026-11-17', 900),
    ];
    const week = buildSpendingSnapshot(records, '2026-11-16')[1];
    expect(week).toMatchObject({ previousStart: '2026-11-03', previousEnd: '2026-11-09', previousTotal: 50,
      total: 55, changeAmount: 5, changePercent: 10, purchased: 60, reversed: 5, purchaseCount: 3,
      purchaseDays: 3, averageActiveDay: 20, medianPurchase: 20,
    });
    expect(week.topCategory).toMatchObject({ name: 'Groceries', amount: 30, count: 1 });
    expect(week.topCategory!.share).toBeCloseTo(30 / 55 * 100);
    expect(week.accounts).toEqual([{ name: 'Cash in Hand', amount: 45, count: 3, share: 45 / 55 * 100 }, { name: 'Expense Account', amount: 10, count: 1, share: 10 / 55 * 100 }]);
    for (const breakdown of [week.categories, week.accounts, week.payments]) {
      expect(breakdown.reduce((sum, item) => sum + item.amount, 0)).toBe(week.total);
      expect(breakdown.reduce((sum, item) => sum + item.count, 0)).toBe(week.count);
    }
  });

  it('does not invent shares or percentage comparisons with zero or negative totals', () => {
    const today = buildSpendingSnapshot([row('refund', '2026-11-16', -20), row('old-refund', '2026-11-15', -10)], '2026-11-16')[0];
    expect(today.changePercent).toBeNull();
    expect(today.changeAmount).toBe(-10);
    expect(today.topCategory).toBeNull();
    expect(today.categories[0].share).toBeNull();
    expect(today.averageActiveDay).toBeNull();
    expect(buildSpendingSnapshot([row('new', '2026-11-16', 10)], '2026-11-16')[0].changePercent).toBeNull();
  });
});
