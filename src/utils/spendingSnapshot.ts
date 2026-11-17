import { Expense } from '../types';
import { accountNames, sourceAccount, isOperatingTransaction, resolveAnalyticsRange } from './financialAnalytics';
import { shiftReportDate } from './expenseReports';

export function buildSpendingSnapshot(expenses: Expense[], referenceDate: string) {
  const records = [...new Map(expenses.map(row => [row.id, row])).values()]
    .filter(row => row.type !== 'income' && isOperatingTransaction(row));
  return ([['today', 'Today', 1], ['7days', 'Last 7 days', 7], ['30days', 'Last 30 days', 30]] as const).map(([preset, label, dayCount]) => {
    const range = resolveAnalyticsRange(preset, referenceDate);
    const rows = records.filter(row => row.date >= range.start && row.date <= range.end);
    const previousStart = shiftReportDate(range.start, -dayCount);
    const previousEnd = shiftReportDate(range.start, -1);
    const previousTotal = records.filter(row => row.date >= previousStart && row.date <= previousEnd)
      .reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
    const daily = new Map<string, number>();
    let totalCents = 0, purchaseCents = 0, purchaseCount = 0;
    let minimumPurchase: number | null = null, maximumPurchase: number | null = null;
    for (const row of rows) {
      const amount = Math.round(row.amount * 100);
      totalCents += amount;
      daily.set(row.date, (daily.get(row.date) || 0) + amount);
      if (amount > 0) {
        purchaseCents += amount; purchaseCount++;
        minimumPurchase = Math.min(minimumPurchase ?? row.amount, row.amount);
        maximumPurchase = Math.max(maximumPurchase ?? row.amount, row.amount);
      }
    }
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = shiftReportDate(range.start, index);
      return { date, amount: (daily.get(date) || 0) / 100 };
    });
    const total = totalCents / 100;
    const breakdown = (key: (row: Expense) => string) => {
      const sums = new Map<string, { cents: number; count: number }>();
      for (const row of rows) {
        const name = key(row), value = sums.get(name) || { cents: 0, count: 0 };
        value.cents += Math.round(row.amount * 100); value.count++;
        sums.set(name, value);
      }
      return [...sums].map(([name, value]) => ({ name, amount: value.cents / 100, count: value.count,
        share: total > 0 ? value.cents / totalCents * 100 : null,
      })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    };
    const categories = breakdown(row => row.category);
    const purchaseDays = new Set(rows.filter(row => row.amount > 0).map(row => row.date)).size;
    const sortedPurchases = rows.filter(row => row.amount > 0).map(row => row.amount).sort((a, b) => a - b);
    return { preset, label, ...range, days, dayCount, total: totalCents / 100, count: rows.length,
      previousStart, previousEnd, previousTotal,
      changeAmount: (totalCents - Math.round(previousTotal * 100)) / 100,
      changePercent: previousTotal > 0 ? (total - previousTotal) / previousTotal * 100 : null,
      categories, accounts: breakdown(row => accountNames[sourceAccount(row)]), payments: breakdown(row => row.paymentMethod),
      topCategory: categories.find(row => row.amount > 0) || null,
      purchaseCount, purchaseDays, purchased: purchaseCents / 100, reversed: (purchaseCents - totalCents) / 100,
      averageActiveDay: purchaseDays ? purchaseCents / 100 / purchaseDays : null,
      medianPurchase: sortedPurchases.length ? (sortedPurchases[Math.floor((sortedPurchases.length - 1) / 2)] + sortedPurchases[Math.floor(sortedPurchases.length / 2)]) / 2 : null,
      averageDaily: totalCents / 100 / dayCount,
      averagePurchase: purchaseCount ? purchaseCents / 100 / purchaseCount : null,
      minimumPurchase, maximumPurchase,
      highestDay: rows.length ? days.reduce((best, day) => day.amount > best.amount ? day : best) : null,
      lowestDay: rows.length ? days.reduce((best, day) => day.amount < best.amount ? day : best) : null,
      zeroSpendDays: days.filter(day => day.amount === 0).length,
    };
  });
}
