import React, { useState } from 'react';
import { Expense, ExpenseCategory, BudgetConfig, SpendType } from '../types';
import { CATEGORIES, formatCurrency } from '../utils/constants';

interface ExpenseChartsProps {
  expenses: Expense[];
  budget: BudgetConfig;
  selectedCategory: ExpenseCategory | 'all';
  onSelectCategory: (cat: ExpenseCategory | 'all') => void;
  currencySymbol: string;
}

export const CategoryDonutChart: React.FC<{
  expenses: Expense[];
  selectedCategory: ExpenseCategory | 'all';
  onSelectCategory: (cat: ExpenseCategory | 'all') => void;
  currencySymbol: string;
}> = ({ expenses, selectedCategory, onSelectCategory, currencySymbol }) => {
  const [hoveredCat, setHoveredCat] = useState<ExpenseCategory | null>(null);

  // Calculate totals per category
  const categoryTotals = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // Sort categories by amount descending
  const sortedCategories = (Object.keys(categoryTotals) as ExpenseCategory[])
    .filter(cat => categoryTotals[cat] > 0)
    .sort((a, b) => categoryTotals[b] - categoryTotals[a]);

  if (totalSpent === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 text-sm">
        <p>No expense data recorded in this period.</p>
        <p className="text-xs mt-1">Log an expense to see category distribution.</p>
      </div>
    );
  }

  // SVG Donut calculation
  const size = 220;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const slices = sortedCategories.map(cat => {
    const amount = categoryTotals[cat];
    const percent = amount / totalSpent;
    const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
    const strokeDashoffset = -circumference * accumulatedPercent;
    accumulatedPercent += percent;

    return {
      category: cat,
      amount,
      percent,
      strokeDasharray,
      strokeDashoffset,
      color: CATEGORIES[cat]?.color || '#94A3B8'
    };
  });

  const activeDisplay = hoveredCat
    ? {
        name: hoveredCat,
        amount: categoryTotals[hoveredCat] || 0,
        pct: (((categoryTotals[hoveredCat] || 0) / totalSpent) * 100).toFixed(1)
      }
    : selectedCategory !== 'all'
    ? {
        name: selectedCategory,
        amount: categoryTotals[selectedCategory] || 0,
        pct: (((categoryTotals[selectedCategory] || 0) / totalSpent) * 100).toFixed(1)
      }
    : {
        name: 'Total Period',
        amount: totalSpent,
        pct: '100'
      };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
      {/* SVG Donut */}
      <div className="md:col-span-6 flex flex-col items-center justify-center relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 overflow-visible"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth={strokeWidth}
          />
          {slices.map(slice => {
            const isHovered = hoveredCat === slice.category;
            const isSelected = selectedCategory === slice.category;
            return (
              <circle
                key={slice.category}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered || isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                className="transition-all duration-300 cursor-pointer origin-center"
                style={{
                  opacity:
                    selectedCategory !== 'all' && !isSelected && !isHovered
                      ? 0.35
                      : 1
                }}
                onMouseEnter={() => setHoveredCat(slice.category)}
                onMouseLeave={() => setHoveredCat(null)}
                onClick={() =>
                  onSelectCategory(
                    selectedCategory === slice.category ? 'all' : slice.category
                  )
                }
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
            {activeDisplay.name}
          </span>
          <span className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {formatCurrency(activeDisplay.amount, currencySymbol)}
          </span>
          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
            {activeDisplay.pct}%
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="md:col-span-6 space-y-2 max-h-64 overflow-y-auto pr-1">
        {slices.map(slice => {
          const isSelected = selectedCategory === slice.category;
          return (
            <button
              key={slice.category}
              onClick={() =>
                onSelectCategory(isSelected ? 'all' : slice.category)
              }
              onMouseEnter={() => setHoveredCat(slice.category)}
              onMouseLeave={() => setHoveredCat(null)}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors text-xs ${
                isSelected
                  ? 'bg-slate-200 dark:bg-slate-800'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {slice.category}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                <span>{formatCurrency(slice.amount, currencySymbol)}</span>
                <span className="text-slate-400 dark:text-slate-500 w-10 text-right">
                  {(slice.percent * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const DailySpendingTrendChart: React.FC<{
  expenses: Expense[];
  daysCount?: number;
  rangeStartDate?: string;
  rangeEndDate?: string;
  currencySymbol: string;
}> = ({ expenses, daysCount = 30, rangeStartDate, rangeEndDate, currencySymbol }) => {
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    amount: number;
    count: number;
  } | null>(null);

  // Use the selected custom range when both dates are valid; otherwise show the last N days.
  const today = new Date();
  const dayBuckets: { date: string; display: string; amount: number; count: number }[] = [];

  const customStart = rangeStartDate ? new Date(`${rangeStartDate}T00:00:00`) : null;
  const customEnd = rangeEndDate ? new Date(`${rangeEndDate}T00:00:00`) : null;
  const hasCustomRange = !!customStart && !!customEnd && !Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime()) && customStart <= customEnd;
  const rangeDayCount = hasCustomRange
    ? Math.floor((Date.UTC(customEnd!.getFullYear(), customEnd!.getMonth(), customEnd!.getDate()) - Date.UTC(customStart!.getFullYear(), customStart!.getMonth(), customStart!.getDate())) / 86400000) + 1
    : daysCount;

  for (let i = rangeDayCount - 1; i >= 0; i--) {
    const d = hasCustomRange ? new Date(customStart!) : new Date(today);
    if (hasCustomRange) d.setDate(d.getDate() + (rangeDayCount - 1 - i));
    else d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const display = `${d.getMonth() + 1}/${d.getDate()}`;

    const matching = expenses.filter(e => e.date === iso);
    const amount = matching.reduce((sum, e) => sum + e.amount, 0);

    dayBuckets.push({
      date: iso,
      display,
      amount,
      count: matching.length
    });
  }

  const maxSpend = Math.max(...dayBuckets.map(b => b.amount), 50);
  const totalPeriodSpend = dayBuckets.reduce((acc, b) => acc + b.amount, 0);
  const averageDailySpend = totalPeriodSpend / (dayBuckets.length || 1);

  return (
    <div className="space-y-4">
      {/* Header with average run rate */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-3">
          <span>
            Daily Average:{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {formatCurrency(averageDailySpend, currencySymbol)}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Peak Day:{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {formatCurrency(maxSpend, currencySymbol)}
            </strong>
          </span>
        </div>
        {hoveredDay && (
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {hoveredDay.date}:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatCurrency(hoveredDay.amount, currencySymbol)}
            </strong>{' '}
            ({hoveredDay.count} transaction{hoveredDay.count === 1 ? '' : 's'})
          </div>
        )}
      </div>

      {/* Bar Chart Canvas */}
      <div className="relative h-44 flex items-end gap-1 pt-6 pb-2">
        {/* Average line indicator */}
        {maxSpend > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-slate-300 dark:border-slate-700 pointer-events-none z-10"
            style={{
              bottom: `${(averageDailySpend / maxSpend) * 80 + 8}%`
            }}
          >
            <span className="absolute -top-4 right-0 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1 rounded">
              Avg: {formatCurrency(averageDailySpend, currencySymbol)}
            </span>
          </div>
        )}

        {dayBuckets.map(b => {
          const heightPercent = maxSpend > 0 ? (b.amount / maxSpend) * 85 : 0;
          const isToday = b.date === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const isHigh = b.amount > averageDailySpend * 1.5;

          return (
            <div
              key={b.date}
              className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
              onMouseEnter={() => setHoveredDay(b)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Bar */}
              <div
                className={`w-full max-w-[14px] rounded-t-sm transition-all duration-200 ${
                  b.amount === 0
                    ? 'bg-slate-200/50 dark:bg-slate-800/40 h-1'
                    : isToday
                    ? 'bg-blue-600 dark:bg-blue-500 group-hover:brightness-110'
                    : isHigh
                    ? 'bg-amber-500 dark:bg-amber-400 group-hover:brightness-110'
                    : 'bg-slate-700 dark:bg-slate-400 group-hover:bg-blue-500'
                }`}
                style={{
                  height: b.amount > 0 ? `${Math.max(heightPercent, 4)}%` : '4px'
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Axis dates */}
      <div className="flex justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500">
        <span>{dayBuckets[0]?.display}</span>
        <span>{dayBuckets[Math.floor(dayBuckets.length / 2)]?.display}</span>
        <span>{hasCustomRange ? 'End date' : 'Today'} ({dayBuckets[dayBuckets.length - 1]?.display})</span>
      </div>
    </div>
  );
};

export const FinancialHealth50_30_20: React.FC<{
  expenses: Expense[];
  monthlyIncomeOrBudget: number;
  currencySymbol: string;
}> = ({ expenses, monthlyIncomeOrBudget, currencySymbol }) => {
  // Compute totals by derived classification (Needs, Wants, Savings)
  const totalsBySpendType = expenses.reduce(
    (acc, e) => {
      if (e.type === 'income' || e.isTransfer) return acc;
      const type = e.spendType || CATEGORIES[e.category]?.defaultSpendType || 'want';
      acc[type] = (acc[type] || 0) + e.amount;
      return acc;
    },
    { need: 0, want: 0, savings: 0 } as Record<SpendType, number>
  );

  // Group top categories per classification
  const needsCategories = expenses
    .filter(e => e.type !== 'income' && !e.isTransfer && (e.spendType || CATEGORIES[e.category]?.defaultSpendType || 'want') === 'need')
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  const wantsCategories = expenses
    .filter(e => e.type !== 'income' && !e.isTransfer && (e.spendType || CATEGORIES[e.category]?.defaultSpendType || 'want') === 'want')
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  const totalSpent = totalsBySpendType.need + totalsBySpendType.want;
  const baseDenominator = Math.max(monthlyIncomeOrBudget, totalSpent, 1);

  const needsPct = Math.round((totalsBySpendType.need / baseDenominator) * 100);
  const wantsPct = Math.round((totalsBySpendType.want / baseDenominator) * 100);
  const remainingOrSavings = Math.max(0, monthlyIncomeOrBudget - totalSpent);
  const savingsPct = Math.max(0, 100 - needsPct - wantsPct);

  const topNeeds = Object.entries(needsCategories).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topWants = Object.entries(wantsCategories).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* 3-segment progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>50 / 30 / 20 Rule Classification Breakdown</span>
          <span className="font-mono text-slate-500">
            Total Spent: {formatCurrency(totalSpent, currencySymbol)} ({Math.round((totalSpent / baseDenominator) * 100)}% of budget)
          </span>
        </div>
        <div className="w-full h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 flex overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-800">
          <div
            className="bg-blue-500 h-full rounded-l-full transition-all duration-300"
            style={{ width: `${Math.min(needsPct, 100)}%` }}
            title={`Needs: ${needsPct}% (${formatCurrency(totalsBySpendType.need, currencySymbol)})`}
          />
          <div
            className="bg-amber-500 h-full transition-all duration-300"
            style={{ width: `${Math.min(wantsPct, 100)}%` }}
            title={`Wants: ${wantsPct}% (${formatCurrency(totalsBySpendType.want, currencySymbol)})`}
          />
          <div
            className="bg-emerald-500 h-full rounded-r-full transition-all duration-300"
            style={{ width: `${Math.min(savingsPct, 100)}%` }}
            title={`Remaining Buffer: ${savingsPct}% (${formatCurrency(remainingOrSavings, currencySymbol)})`}
          />
        </div>
      </div>

      {/* Grid of 3 Pillars with Status & Category Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Needs Card */}
        <div className="p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span>Essential Needs (Target: 50%)</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                needsPct <= 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
              }`}>
                {needsPct <= 50 ? 'Within Target' : 'Above Target'}
              </span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {formatCurrency(totalsBySpendType.need, currencySymbol)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Housing, Groceries, Utilities, Transport, Health, Education
            </p>
          </div>

          {topNeeds.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-blue-200/60 dark:border-blue-900/40 text-[11px] space-y-1">
              <span className="text-slate-400 font-medium block">Top Needs Spends:</span>
              {topNeeds.map(([cat, amt]) => (
                <div key={cat} className="flex justify-between text-slate-700 dark:text-slate-300 font-mono">
                  <span className="truncate">{cat}:</span>
                  <strong className="text-blue-600 dark:text-blue-400">{formatCurrency(amt, currencySymbol)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wants Card */}
        <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>Discretionary Wants (Target: 30%)</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                wantsPct <= 30 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
              }`}>
                {wantsPct <= 30 ? 'Controlled' : 'Elevated'}
              </span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {formatCurrency(totalsBySpendType.want, currencySymbol)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Food &amp; Dining, Entertainment, Shopping, Subscriptions
            </p>
          </div>

          {topWants.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] space-y-1">
              <span className="text-slate-400 font-medium block">Top Wants Spends:</span>
              {topWants.map(([cat, amt]) => (
                <div key={cat} className="flex justify-between text-slate-700 dark:text-slate-300 font-mono">
                  <span className="truncate">{cat}:</span>
                  <strong className="text-amber-600 dark:text-amber-400">{formatCurrency(amt, currencySymbol)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Savings Buffer Card */}
        <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Savings &amp; Buffer (Target: 20%)</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                savingsPct >= 20 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
              }`}>
                {savingsPct >= 20 ? 'Healthy Buffer' : 'Tight Margin'}
              </span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(remainingOrSavings, currencySymbol)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Unspent budget reserve &amp; savings pool ({savingsPct}% of total allocation)
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-slate-600 dark:text-slate-300 font-mono flex justify-between">
            <span>Budget Allocation:</span>
            <strong>{formatCurrency(baseDenominator, currencySymbol)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AccountIntelligenceReport: React.FC<{
  expenses: Expense[];
  currencySymbol: string;
  savingsCurrentBalance: number;
  expenseAccCurrentBalance: number;
  cashCurrentBalance: number;
}> = ({ expenses, currencySymbol, savingsCurrentBalance, expenseAccCurrentBalance, cashCurrentBalance }) => {
  const [reportTimeframe, setReportTimeframe] = useState<'this_month' | 'last_30_days' | 'all' | 'custom'>('this_month');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportAccountFilter, setReportAccountFilter] = useState<'all' | 'expense' | 'savings' | 'cash'>('all');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredExpenses = expenses.filter(e => {
    const eDate = new Date(e.date + 'T00:00:00');
    if (reportAccountFilter !== 'all' && (e.account || 'expense') !== reportAccountFilter) return false;
    if (reportTimeframe === 'custom' && ((reportStartDate && e.date < reportStartDate) || (reportEndDate && e.date > reportEndDate))) return false;
    if (reportTimeframe === 'this_month') {
      if (eDate.getFullYear() !== currentYear || eDate.getMonth() !== currentMonth) return false;
    } else if (reportTimeframe === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (eDate < thirtyDaysAgo) return false;
    }
    return true;
  });

  const accountMetrics = {
    expense: {
      spend: filteredExpenses.filter(e => (e.account || 'expense') === 'expense' && e.type !== 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0),
      income: filteredExpenses.filter(e => (e.account || 'expense') === 'expense' && e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0),
      count: filteredExpenses.filter(e => (e.account || 'expense') === 'expense').length,
      balance: expenseAccCurrentBalance
    },
    cash: {
      spend: filteredExpenses.filter(e => e.account === 'cash' && e.type !== 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0),
      income: filteredExpenses.filter(e => e.account === 'cash' && e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0),
      count: filteredExpenses.filter(e => e.account === 'cash').length,
      balance: cashCurrentBalance
    },
    savings: {
      spend: filteredExpenses.filter(e => e.account === 'savings' && (e.type !== 'income' || e.isTransfer)).reduce((sum, e) => sum + e.amount, 0),
      income: filteredExpenses.filter(e => e.account === 'savings' && e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0),
      count: filteredExpenses.filter(e => e.account === 'savings').length,
      balance: savingsCurrentBalance
    }
  };

  const totalPeriodSpend = accountMetrics.expense.spend + accountMetrics.cash.spend + accountMetrics.savings.spend;
  const totalPeriodIncome = accountMetrics.expense.income + accountMetrics.cash.income + accountMetrics.savings.income;

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account Filter:</span>
          <select
            value={reportAccountFilter}
            onChange={e => setReportAccountFilter(e.target.value as any)}
            className="text-xs py-1.5 px-3 font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Accounts Combined</option>
            <option value="expense">💳 Expense Account</option>
            <option value="cash">💵 Cash in Hand</option>
            <option value="savings">🏦 Savings Account</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Timeframe:</span>
          <select
            value={reportTimeframe}
            onChange={e => setReportTimeframe(e.target.value as any)}
            className="text-xs py-1.5 px-3 font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="custom">Custom Dates</option>
            <option value="all">All Time Records</option>
          </select>
        </div>
        {reportTimeframe === 'custom' && <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <label className="text-[11px] font-medium text-slate-500">From<input type="date" max={reportEndDate || undefined} value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" /></label>
          <label className="text-[11px] font-medium text-slate-500">To<input type="date" min={reportStartDate || undefined} value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" /></label>
        </div>}
      </div>

      {/* 3 Account Cards: Expense, Cash, Savings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Expense Card */}
        <div className="p-5 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/15 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-100 dark:border-rose-900/40">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <span className="p-1 rounded bg-rose-100 dark:bg-rose-900/40">💳</span>
                <span>Expense Account</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">{accountMetrics.expense.count} txns</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-500 uppercase font-medium">Spent in Period</span>
                <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight tabular-nums mt-0.5">
                  {formatCurrency(accountMetrics.expense.spend, currencySymbol)}
                </div>
              </div>

              <div className="pt-2 border-t border-rose-100 dark:border-rose-900/40 flex justify-between text-xs font-mono">
                <span className="text-slate-500">Available Balance:</span>
                <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(accountMetrics.expense.balance, currencySymbol)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Cash in Hand Card */}
        <div className="p-5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/15 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-100 dark:border-amber-900/40">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <span className="p-1 rounded bg-amber-100 dark:bg-amber-900/40">💵</span>
                <span>Cash in Hand</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">{accountMetrics.cash.count} txns</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-500 uppercase font-medium">Spent in Period</span>
                <div className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight tabular-nums mt-0.5">
                  {formatCurrency(accountMetrics.cash.spend, currencySymbol)}
                </div>
              </div>

              <div className="pt-2 border-t border-amber-100 dark:border-amber-900/40 flex justify-between text-xs font-mono">
                <span className="text-slate-500">Current Balance:</span>
                <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(accountMetrics.cash.balance, currencySymbol)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Account Card */}
        <div className="p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/15 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-100 dark:border-emerald-900/40">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-100 dark:bg-emerald-900/40">🏦</span>
                <span>Savings Account</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">{accountMetrics.savings.count} txns</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-500 uppercase font-medium">Transferred / Outflow</span>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums mt-0.5">
                  {formatCurrency(accountMetrics.savings.spend, currencySymbol)}
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex justify-between text-xs font-mono">
                <span className="text-slate-500">Current Balance:</span>
                <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(accountMetrics.savings.balance, currencySymbol)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Insights & Totals */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Period Financial Summary ({reportTimeframe.replace('_', ' ')})
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 block">Total Outflows (Spends)</span>
            <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              {formatCurrency(totalPeriodSpend, currencySymbol)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 block">Total Inflows (Income)</span>
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(totalPeriodIncome, currencySymbol)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 block">Net Period Cash Flow</span>
            <span className={`text-xl font-bold font-mono tabular-nums ${totalPeriodIncome >= totalPeriodSpend ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(totalPeriodIncome - totalPeriodSpend, currencySymbol)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
