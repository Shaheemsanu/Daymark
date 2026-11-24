import { Expense } from '../types';
import { isLoanMovement } from './loanMovement';

const DAY = 86400000;
export const shiftReportDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const reportWeekStart = (date: string) => shiftReportDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

export function isReportExpense(expense: Expense) {
  const category = expense.category.toLowerCase();
  return (expense.type || 'expense') === 'expense' && !expense.isTransfer && !isLoanMovement(expense) && !category.includes('transfer')
    && !['opening balance', 'balance adjustment'].includes(category)
    && Number.isFinite(expense.amount) && expense.amount > 0;
}

export function buildExpenseReport(expenses: Expense[], start: string, end: string) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!validDate(start) || !validDate(end) || start > end) return null;
  const dayCount = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1;
  const eligible = expenses.filter(isReportExpense);
  const entries = eligible.filter(expense => expense.date >= start && expense.date <= end);
  const dailyCents = new Map<string, number>();
  const categories = new Map<string, number>();
  let cents = 0;
  for (const expense of entries) {
    const amount = Math.round(expense.amount * 100);
    cents += amount;
    dailyCents.set(expense.date, (dailyCents.get(expense.date) || 0) + amount);
    categories.set(expense.category, (categories.get(expense.category) || 0) + amount);
  }
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = shiftReportDate(start, index);
    return { date, amount: (dailyCents.get(date) || 0) / 100 };
  });
  const groupDays = (key: (date: string) => string) => {
    const groups = new Map<string, { period: string; start: string; end: string; days: number; amount: number }>();
    for (const day of days) {
      const period = key(day.date);
      const group = groups.get(period) || { period, start: day.date, end: day.date, days: 0, amount: 0 };
      group.end = day.date;
      group.days++;
      group.amount = Math.round((group.amount + day.amount) * 100) / 100;
      groups.set(period, group);
    }
    return [...groups.values()].reverse();
  };
  const previousEnd = shiftReportDate(start, -1);
  const previousStart = shiftReportDate(start, -dayCount);
  const previousTotal = eligible.filter(expense => expense.date >= previousStart && expense.date <= previousEnd)
    .reduce((sum, expense) => sum + Math.round(expense.amount * 100), 0) / 100;
  const sortedDays = [...days].sort((a, b) => a.amount - b.amount);
  const sortedEntries = [...entries].sort((a, b) => a.amount - b.amount);
  const summarize = (key: (expense: Expense) => string) => {
    const groups = new Map<string, { name: string; amount: number; count: number }>();
    for (const expense of entries) {
      const name = key(expense);
      const group = groups.get(name) || { name, amount: 0, count: 0 };
      group.amount = Math.round((group.amount + expense.amount) * 100) / 100;
      group.count++;
      groups.set(name, group);
    }
    return [...groups.values()].sort((a, b) => b.amount - a.amount).map(group => ({ ...group, share: cents ? group.amount / (cents / 100) * 100 : 0 }));
  };
  const previousEntries = eligible.filter(expense => expense.date >= previousStart && expense.date <= previousEnd);
  const previousDays = new Map<string, number>();
  const previousCategories = new Map<string, number>();
  for (const expense of previousEntries) {
    previousDays.set(expense.date, (previousDays.get(expense.date) || 0) + Math.round(expense.amount * 100));
    previousCategories.set(expense.category, (previousCategories.get(expense.category) || 0) + Math.round(expense.amount * 100));
  }
  let cumulative = 0, previousCumulative = 0, noSpendStreak = 0, longestNoSpendStreak = 0;
  const cumulativeDays = days.map((day, index) => {
    cumulative += Math.round(day.amount * 100);
    previousCumulative += previousDays.get(shiftReportDate(previousStart, index)) || 0;
    noSpendStreak = day.amount === 0 ? noSpendStreak + 1 : 0;
    longestNoSpendStreak = Math.max(longestNoSpendStreak, noSpendStreak);
    return { date: day.date, day: index + 1, current: cumulative / 100, previous: previousCumulative / 100 };
  });
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name, index) => {
    const matching = days.filter(day => (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7 === index);
    const amount = matching.reduce((sum, day) => sum + Math.round(day.amount * 100), 0) / 100;
    return { name, days: matching.length, amount, average: matching.length ? amount / matching.length : 0 };
  });
  const median = sortedEntries.length ? sortedEntries.length % 2 ? sortedEntries[Math.floor(sortedEntries.length / 2)].amount
    : (sortedEntries[sortedEntries.length / 2 - 1].amount + sortedEntries[sortedEntries.length / 2].amount) / 2 : 0;
  const categoryChanges = [...new Set([...categories.keys(), ...previousCategories.keys()])].map(category => {
    const amount = (categories.get(category) || 0) / 100;
    const previous = (previousCategories.get(category) || 0) / 100;
    return { category, amount, previous, difference: Math.round((amount - previous) * 100) / 100, changePercent: previous ? (amount - previous) / previous * 100 : null };
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  return {
    median, longestNoSpendStreak, cumulativeDays, weekdays, categoryChanges,
    payments: summarize(expense => expense.paymentMethod || 'Unspecified'),
    accounts: summarize(expense => expense.account === 'cash' ? 'Cash in Hand' : expense.account === 'savings' ? 'Savings Account' : 'Expense Account'),
    spendTypes: summarize(expense => expense.spendType === 'want' ? 'Wants' : expense.spendType === 'need' ? 'Needs' : expense.spendType === 'savings' ? 'Savings' : 'Unclassified'),
    recurringTotal: entries.filter(expense => expense.isRecurring).reduce((sum, expense) => sum + Math.round(expense.amount * 100), 0) / 100,
    topExpenses: [...entries].sort((a, b) => b.amount - a.amount).slice(0, 10),
    entries, days, dayCount, total: cents / 100, previousTotal, previousStart, previousEnd,
    changePercent: previousTotal > 0 ? ((cents / 100 - previousTotal) / previousTotal) * 100 : null,
    dailyAverage: cents / 100 / dayCount,
    activeDayAverage: dailyCents.size ? cents / 100 / dailyCents.size : 0,
    transactionAverage: entries.length ? cents / 100 / entries.length : 0,
    noSpendDays: dayCount - dailyCents.size,
    lowestDay: sortedDays[0], highestDay: [...days].sort((a, b) => b.amount - a.amount)[0],
    smallestTransaction: sortedEntries[0], largestTransaction: sortedEntries[sortedEntries.length - 1],
    weeks: groupDays(reportWeekStart), months: groupDays(date => date.slice(0, 7)),
    categories: [...categories].map(([category, amount]) => ({ category, amount: amount / 100, share: cents ? amount / cents * 100 : 0 })).sort((a, b) => b.amount - a.amount),
  };
}
