import { BudgetConfig, Expense } from '../types';
import { Account, getAccountBalance } from './accounts';
import { buildExpenseReport, reportWeekStart, shiftReportDate } from './expenseReports';
import { isLoanMovement } from './loanMovement';
import { formatDisplayDate } from './dateFormatting';

export type AnalyticsFilters = { start: string; end: string; account: Account | 'all'; category: string; payment?: string; type: 'all' | 'income' | 'expense'; grouping: 'daily' | 'weekly' | 'monthly' | 'yearly' };
export function automaticChartGrouping(start: string, end: string): AnalyticsFilters['grouping'] {
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  return days <= 45 ? 'daily' : days <= 180 ? 'weekly' : days <= 730 ? 'monthly' : 'yearly';
}

export function analyticsGroupLabel(row: { start: string; end: string }) {
  if (row.start === row.end) return formatDisplayDate(row.start);
  return `${formatDisplayDate(row.start)} – ${formatDisplayDate(row.end)}`;
}
export const accountNames: Record<Account, string> = { expense: 'Expense Account', cash: 'Cash in Hand', savings: 'Savings Account' };
export const analyticsAccounts: Account[] = ['expense', 'cash', 'savings'];
const cents = (amount: number) => Math.round(amount * 100);
export const percentChange = (current: number, previous: number) => previous !== 0 ? (current - previous) / previous * 100 : null;
export const isInternalTransfer = (expense: Expense) => Boolean(expense.isTransfer || /transfer/i.test(expense.category));
export const transferTarget = (expense: Expense): Account => expense.transferToAccount || (/transfer to (expense|cash|savings)/i.exec(expense.category)?.[1]?.toLowerCase() as Account) || 'expense';
export const sourceAccount = (expense: Expense): Account => expense.account || (isInternalTransfer(expense) ? 'savings' : 'expense');
const isAdjustment = (expense: Expense) => /^(opening balance|balance adjustment)$/i.test(expense.category);
export const isCardRepayment = (expense: Expense) => /^credit card (payment|repayment)$/i.test(expense.category);
export const isOperatingTransaction = (expense: Expense) => Number.isFinite(expense.amount) && !isInternalTransfer(expense) && !isAdjustment(expense) && !isCardRepayment(expense) && !isLoanMovement(expense);
const monthDays = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

export function resolveAnalyticsRange(preset: string, reference: string) {
  const month = reference.slice(0, 7) + '-01';
  const priorMonthEnd = shiftReportDate(month, -1);
  if (preset === 'today') return { start: reference, end: reference };
  if (preset === 'yesterday') return { start: shiftReportDate(reference, -1), end: shiftReportDate(reference, -1) };
  if (preset === '7days') return { start: shiftReportDate(reference, -6), end: reference };
  if (preset === '30days') return { start: shiftReportDate(reference, -29), end: reference };
  if (preset === 'lastmonth') return { start: priorMonthEnd.slice(0, 7) + '-01', end: priorMonthEnd };
  if (preset === '3months') {
    const date = new Date(`${month}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 2);
    return { start: date.toISOString().slice(0, 10), end: reference };
  }
  return { start: preset === 'year' ? reference.slice(0, 4) + '-01-01' : month, end: reference };
}

export const budgetStatus = (utilization: number) => utilization > 100 ? 'Over budget' : utilization >= 90 ? 'Warning' : utilization >= 70 ? 'Approaching limit' : 'Normal';

export function buildFinancialAnalytics(expenses: Expense[], budget: BudgetConfig, filters: AnalyticsFilters, enabledAccounts: Account[] = analyticsAccounts) {
  const skeleton = buildExpenseReport([], filters.start, filters.end);
  if (!skeleton) return null;
  // A single row per ID; deleted records are absent from the workspace model.
  const records = [...new Map(expenses.filter(expense => Number.isFinite(expense.amount)).map(expense => [expense.id, expense])).values()];
  const scoped = records.filter(expense => isOperatingTransaction(expense) && enabledAccounts.includes(sourceAccount(expense)) &&
    (filters.account === 'all' || sourceAccount(expense) === filters.account) &&
    (filters.category === 'all' || expense.category === filters.category) &&
    (!filters.payment || filters.payment === 'all' || expense.paymentMethod === filters.payment) &&
    (filters.type === 'all' || (expense.type || 'expense') === filters.type));
  const current = scoped.filter(expense => expense.date >= filters.start && expense.date <= filters.end);
  const previous = scoped.filter(expense => expense.date >= skeleton.previousStart && expense.date <= skeleton.previousEnd);
  const totals = (rows: Expense[]) => {
    let income = 0, spending = 0;
    for (const row of rows) row.type === 'income' ? income += cents(row.amount) : spending += cents(row.amount);
    return { income: income / 100, expenses: spending / 100, net: (income - spending) / 100,
      savingsRate: income > 0 ? (income - spending) / income * 100 : null,
      expenseRatio: income > 0 ? spending / income * 100 : null, count: rows.length };
  };
  const total = totals(current), prior = totals(previous);
  const expenseRows = current.filter(expense => expense.type !== 'income');
  const daily = new Map<string, { income: number; expenses: number; count: number; categories: Record<string, number>; accounts: Record<string, number> }>();
  const previousDaily = new Map<string, { income: number; expenses: number }>();
  for (const row of current) {
    const day = daily.get(row.date) || { income: 0, expenses: 0, count: 0, categories: {}, accounts: {} };
    if (row.type === 'income') day.income += cents(row.amount);
    else {
      day.expenses += cents(row.amount);
      day.categories[row.category] = (day.categories[row.category] || 0) + cents(row.amount);
      day.accounts[sourceAccount(row)] = (day.accounts[sourceAccount(row)] || 0) + cents(row.amount);
    }
    day.count++;
    daily.set(row.date, day);
  }
  for (const row of previous) {
    const day = previousDaily.get(row.date) || { income: 0, expenses: 0 };
    row.type === 'income' ? day.income += cents(row.amount) : day.expenses += cents(row.amount);
    previousDaily.set(row.date, day);
  }
  const selectedAccounts = filters.account === 'all' ? enabledAccounts : enabledAccounts.filter(account => account === filters.account);
  const accountMovements = new Map<string, Record<Account, number>>();
  for (const row of records) {
    if (row.date < filters.start || row.date > filters.end) continue;
    const movement = accountMovements.get(row.date) || { expense: 0, cash: 0, savings: 0 };
    if (isInternalTransfer(row)) {
      movement[sourceAccount(row)] -= cents(row.amount);
      movement[transferTarget(row)] += cents(row.amount);
    } else movement[sourceAccount(row)] += cents(row.amount) * (row.type === 'income' ? 1 : -1);
    accountMovements.set(row.date, movement);
  }
  const balanceRecords = records.map(row => ({ ...row, isTransfer: isInternalTransfer(row) }));
  const opening = Object.fromEntries(analyticsAccounts.map(account => [account, getAccountBalance(balanceRecords, account, skeleton.previousEnd)])) as Record<Account, number>;
  const running = { ...opening };
  let runningIncome = 0, runningExpenses = 0;
  const days = skeleton.days.map((day, index) => {
    const data = daily.get(day.date);
    const movement = accountMovements.get(day.date);
    for (const account of analyticsAccounts) running[account] = (cents(running[account]) + (movement?.[account] || 0)) / 100;
    runningIncome += data?.income || 0; runningExpenses += data?.expenses || 0;
    const before = previousDaily.get(shiftReportDate(skeleton.previousStart, index));
    return { date: day.date, income: (data?.income || 0) / 100, expenses: (data?.expenses || 0) / 100, count: data?.count || 0,
      net: ((data?.income || 0) - (data?.expenses || 0)) / 100,
      previousExpenses: (before?.expenses || 0) / 100,
      cumulativeIncome: runningIncome / 100, cumulativeExpenses: runningExpenses / 100,
      categories: data?.categories || {}, accounts: data?.accounts || {}, balances: { ...running } };
  });
  const groupKey = (date: string, grouping: AnalyticsFilters['grouping']) => grouping === 'yearly' ? date.slice(0, 4) : grouping === 'monthly' ? date.slice(0, 7) : grouping === 'weekly' ? reportWeekStart(date) : date;
  const group = (grouping: AnalyticsFilters['grouping']) => {
    const buckets = new Map<string, { date: string; start: string; end: string; income: number; expenses: number; net: number; count: number; days: number; rate: number | null; categories: Record<string, number>; accounts: Record<string, number>; balances: Record<Account, number> }>();
    for (const day of days) {
      const date = groupKey(day.date, grouping);
      const row = buckets.get(date) || { date, start: day.date, end: day.date, income: 0, expenses: 0, net: 0, count: 0, days: 0, rate: null, categories: {}, accounts: {}, balances: day.balances };
      row.end = day.date;
      row.income = (cents(row.income) + cents(day.income)) / 100; row.expenses = (cents(row.expenses) + cents(day.expenses)) / 100;
      row.net = (cents(row.income) - cents(row.expenses)) / 100; row.count += day.count; row.days++;
      row.rate = row.income > 0 ? row.net / row.income * 100 : null;
      for (const [name, value] of Object.entries(day.categories)) row.categories[name] = (row.categories[name] || 0) + value / 100;
      for (const [name, value] of Object.entries(day.accounts)) row.accounts[name] = (row.accounts[name] || 0) + value / 100;
      row.balances = day.balances; buckets.set(date, row);
    }
    return [...buckets.values()];
  };
  const groups = group(filters.grouping), months = group('monthly');
  const currentCategories = new Map<string, { amount: number; count: number }>(), priorCategories = new Map<string, number>();
  for (const row of expenseRows) { const value = currentCategories.get(row.category) || { amount: 0, count: 0 }; value.amount += cents(row.amount); value.count++; currentCategories.set(row.category, value); }
  for (const row of previous) if (row.type !== 'income') priorCategories.set(row.category, (priorCategories.get(row.category) || 0) + cents(row.amount));
  const categories = [...new Set([...currentCategories.keys(), ...priorCategories.keys()])].map(name => {
    const data = currentCategories.get(name), amount = (data?.amount || 0) / 100;
    const old = (priorCategories.get(name) || 0) / 100;
    return { name, amount, previous: old, change: percentChange(amount, old), count: data?.count || 0, share: total.expenses > 0 ? amount / total.expenses * 100 : 0 };
  }).sort((a, b) => b.amount - a.amount);
  const monthWeights = new Map<string, number>();
  for (const day of days) monthWeights.set(day.date.slice(0, 7), (monthWeights.get(day.date.slice(0, 7)) || 0) + 1 / monthDays(day.date.slice(0, 7)));
  const weight = [...monthWeights.values()].reduce((sum, value) => sum + value, 0);
  const budgetAmount = filters.category === 'all' ? budget.monthlyBudget : budget.categoryBudgets[filters.category] || 0;
  const periodBudget = Math.round(budgetAmount * weight * 100) / 100;
  let previousWeight = 0;
  for (let index = 0; index < days.length; index++) previousWeight += 1 / monthDays(shiftReportDate(skeleton.previousStart, index).slice(0, 7));
  const previousBudget = Math.round(budgetAmount * previousWeight * 100) / 100;
  const budgetRows = Object.entries(budget.categoryBudgets).filter(([name, cap]) => !!cap && cap > 0 && (filters.category === 'all' || filters.category === name)).map(([name, cap]) => {
    const amount = Math.round((cap || 0) * weight * 100) / 100;
    const spent = categories.find(row => row.name === name)?.amount || 0;
    return { name, budget: amount, spent, remaining: amount - spent, utilization: amount > 0 ? spent / amount * 100 : 0 };
  });
  const closingBalance = selectedAccounts.reduce((sum, account) => sum + cents(running[account]), 0) / 100;
  const openingBalance = selectedAccounts.reduce((sum, account) => sum + cents(opening[account]), 0) / 100;
  const accounts = selectedAccounts.map(account => {
    const rows = current.filter(row => sourceAccount(row) === account), values = totals(rows);
    const funds = selectedAccounts.reduce((sum, name) => sum + Math.max(0, running[name]), 0);
    return { account, name: accountNames[account], ...values, opening: opening[account], balance: running[account], share: funds > 0 ? Math.max(0, running[account]) / funds * 100 : null };
  });
  const weekday = Array.from({ length: 7 }, (_, index) => {
    const matching = days.filter(day => (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7 === index);
    const amount = matching.reduce((sum, day) => sum + cents(day.expenses), 0) / 100;
    return { name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], amount, days: matching.length, average: matching.length ? amount / matching.length : 0 };
  });
  const sortedAmounts = expenseRows.filter(row => row.amount > 0).map(row => row.amount).sort((a, b) => a - b);
  const median = sortedAmounts.length ? (sortedAmounts[Math.floor((sortedAmounts.length - 1) / 2)] + sortedAmounts[Math.floor(sortedAmounts.length / 2)]) / 2 : 0;
  const unusual = median > 0 && sortedAmounts.length >= 5 ? expenseRows.filter(row => row.amount > median * 3) : [];
  const recurringGroups = new Map<string, Expense[]>();
  for (const row of expenseRows.filter(row => row.amount > 0)) {
    const key = `${row.title.toLowerCase().replace(/\s+/g, ' ').trim()}|${row.category}`;
    const group = recurringGroups.get(key) || [];
    group.push(row); recurringGroups.set(key, group);
  }
  const recurring = [...recurringGroups.values()].map(rows => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const amount = sorted.reduce((sum, row) => sum + cents(row.amount), 0) / 100 / sorted.length;
    const gaps = sorted.slice(1).map((row, index) => (Date.parse(row.date) - Date.parse(sorted[index].date)) / 86400000).filter(value => value > 0);
    const cadence = gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : 0;
    const regular = gaps.length > 0 && gaps.every(value => Math.abs(value - cadence) <= Math.max(3, cadence * .2));
    const sameAmount = sorted.every(row => Math.abs(row.amount - amount) <= Math.max(1, amount * .1));
    const confirmed = sorted.some(row => row.isRecurring);
    const signatures = new Set<string>();
    const possibleDuplicate = sorted.some(row => { const key = `${row.date}|${cents(row.amount)}`; if (signatures.has(key)) return true; signatures.add(key); return false; });
    return { name: sorted[0].title, category: sorted[0].category, count: sorted.length, amount, cadence, confirmed,
      detected: regular && sameAmount && cadence >= 5 && cadence <= 370,
      monthlyEstimate: cadence > 0 && regular ? amount * 30.4375 / cadence : null,
      possibleDuplicate, lastDate: sorted[sorted.length - 1].date };
  }).filter(row => row.confirmed || row.detected || row.possibleDuplicate);
  const endMonth = filters.end.slice(0, 7), elapsed = Number(filters.end.slice(-2));
  const monthSpent = expenseRows.filter(row => row.date.startsWith(endMonth)).reduce((sum, row) => sum + cents(row.amount), 0) / 100;
  const projection = filters.start <= endMonth + '-01' && filters.end.slice(-2) !== String(monthDays(endMonth)).padStart(2, '0') ? monthSpent / elapsed * monthDays(endMonth) : null;
  const budgetHistory = months.map(month => {
    const cap = budgetAmount * month.days / monthDays(month.date);
    return { date: month.date, budget: Math.round(cap * 100) / 100, expenses: month.expenses, utilization: cap > 0 ? month.expenses / cap * 100 : null };
  });
  const cashOther = Math.round((closingBalance - openingBalance - total.income + total.expenses) * 100) / 100;
  const changes = { income: percentChange(total.income, prior.income), expenses: percentChange(total.expenses, prior.expenses), net: percentChange(total.net, prior.net),
    savingsRate: total.savingsRate !== null && prior.savingsRate !== null ? total.savingsRate - prior.savingsRate : null,
    count: percentChange(total.count, prior.count), daily: percentChange(total.expenses, prior.expenses),
    balance: percentChange(closingBalance, openingBalance), budget: periodBudget > 0 ? percentChange(periodBudget - total.expenses, previousBudget - prior.expenses) : null };
  return { filters, total, prior, changes, current, previous, days, groups, months, categories, accounts, weekday, median, unusual, recurring,
    dayCount: days.length, dailyAverage: total.expenses / days.length,
    noSpendDays: days.filter(day => day.expenses === 0).length,
    highestDay: [...days].sort((a, b) => b.expenses - a.expenses)[0], lowestDay: [...days].sort((a, b) => a.expenses - b.expenses)[0],
    periodBudget, budgetRows, budgetHistory, budgetAmount, projection, closingBalance, openingBalance, cashOther,
    previousStart: skeleton.previousStart, previousEnd: skeleton.previousEnd,
    transfers: records.filter(row => isInternalTransfer(row) && enabledAccounts.includes(sourceAccount(row)) && enabledAccounts.includes(transferTarget(row)) && row.date >= filters.start && row.date <= filters.end &&
      (filters.account === 'all' || sourceAccount(row) === filters.account || transferTarget(row) === filters.account) &&
      (filters.category === 'all' || row.category === filters.category) && (!filters.payment || filters.payment === 'all' || row.paymentMethod === filters.payment) && filters.type === 'all'),
    mostFrequent: [...categories].sort((a, b) => b.count - a.count)[0] };
}

export type FinancialAnalytics = NonNullable<ReturnType<typeof buildFinancialAnalytics>>;
