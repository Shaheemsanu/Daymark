import { FinancialAnalytics, accountNames, sourceAccount } from './financialAnalytics';
import { CATEGORIES } from './constants';
import { Expense } from '../types';

export function buildCategoryComparison(report: FinancialAnalytics, categoryNames: string[] = []) {
  const names = report.filters.category === 'all'
    ? [...new Set([...Object.entries(CATEGORIES).filter(([, info]) => info.defaultSpendType !== 'savings').map(([name]) => name), ...categoryNames, ...report.categories.map(row => row.name)])]
    : [report.filters.category];
  const amounts = new Map(report.categories.map(row => [row.name, row]));
  return names.map(name => ({ name, current: amounts.get(name)?.amount || 0, previous: amounts.get(name)?.previous || 0 }))
    .filter(row => row.current !== 0 || row.previous !== 0)
    .sort((a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name));
}

/** Category details use the same filtered, deduplicated records as the report. */
export function buildCategoryDetails(report: FinancialAnalytics) {
  const buckets = new Map<string, Expense[]>();
  for (const row of report.current) {
    if (row.type === 'income') continue;
    const rows = buckets.get(row.category) || [];
    rows.push(row);
    buckets.set(row.category, rows);
  }
  return report.categories.filter(category => category.count > 0).map(category => {
    const rows = [...(buckets.get(category.name) || [])].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
    const purchases = rows.filter(row => row.amount > 0);
    const sum = (values: Expense[]) => values.reduce((total, row) => total + Math.round(row.amount * 100), 0) / 100;
    const purchased = sum(purchases), reversed = -sum(rows.filter(row => row.amount < 0));
    const amounts = purchases.map(row => row.amount).sort((a, b) => a - b);
    const breakdown = (key: (row: Expense) => string) => {
      const values = new Map<string, number>();
      for (const row of rows) values.set(key(row), (values.get(key(row)) || 0) + Math.round(row.amount * 100));
      return [...values].map(([name, cents]) => ({ name, amount: cents / 100 })).sort((a, b) => b.amount - a.amount);
    };
    return { ...category, rows, purchased, reversed, purchaseCount: purchases.length,
      averagePurchase: purchases.length ? purchased / purchases.length : null,
      dailyAverage: category.amount / report.dayCount,
      activeDays: new Set(purchases.map(row => row.date)).size,
      minimum: amounts[0] ?? null, maximum: amounts[amounts.length - 1] ?? null,
      median: amounts.length ? (amounts[Math.floor((amounts.length - 1) / 2)] + amounts[Math.floor(amounts.length / 2)]) / 2 : null,
      accounts: breakdown(row => accountNames[sourceAccount(row)]),
      payments: breakdown(row => row.paymentMethod),
      changeAmount: Math.round((category.amount - category.previous) * 100) / 100,
    };
  });
}
