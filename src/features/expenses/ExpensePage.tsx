import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Expense, ExpenseCategory, BudgetConfig, PaymentMethod, SpendType } from '../../lib/types';
import { formatShortDate, getPastNDays, getTodayIso } from '../../lib/dateUtils';
import { formatDisplayDate } from '../../utils/dateFormatting';
import { exportExpensesAsCSV, downloadBlob } from '../../lib/exportUtils';
import {
  Plus,
  Search,
  Filter,
  Download,
  SlidersHorizontal,
  Trash2,
  Edit2,
  TrendingDown,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface ExpensePageProps {
  expenses: Expense[];
  budget: BudgetConfig;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (id: string, updates: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateBudget: (budget: BudgetConfig) => void;
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Housing: '#3B82F6',
  Groceries: '#10B981',
  'Food & Dining': '#F59E0B',
  Transportation: '#6366F1',
  Utilities: '#06B6D4',
  'Health & Fitness': '#14B8A6',
  Entertainment: '#EC4899',
  Shopping: '#8B5CF6',
  'Personal Care': '#F43F5E',
  Subscriptions: '#64748B',
  Education: '#0284C7',
  Other: '#94A3B8'
};

const CATEGORIES = Object.keys(CATEGORY_COLORS) as ExpenseCategory[];
const PAYMENT_METHODS: PaymentMethod[] = [
  'Credit Card',
  'Debit Card',
  'Cash',
  'Bank Transfer',
  'Digital Wallet'
];

export const ExpensePage: React.FC<ExpensePageProps> = ({
  expenses,
  budget,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onUpdateBudget
}) => {
  const [timeframe, setTimeframe] = useState<'this_month' | 'last_30_days' | 'this_week' | 'all'>('this_month');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Groceries');
  const [date, setDate] = useState(getTodayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [spendType, setSpendType] = useState<SpendType>('need');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  // Filter by timeframe
  const filteredByTimeframe = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return expenses.filter(e => {
      const eDate = new Date(e.entry_date + 'T00:00:00');
      if (timeframe === 'this_month') {
        return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonth;
      }
      if (timeframe === 'last_30_days') {
        const past30 = new Date(now);
        past30.setDate(past30.getDate() - 30);
        return eDate >= past30 && eDate <= now;
      }
      if (timeframe === 'this_week') {
        const past7 = new Date(now);
        past7.setDate(past7.getDate() - 7);
        return eDate >= past7 && eDate <= now;
      }
      return true;
    });
  }, [expenses, timeframe]);

  // Total Period Spend
  const totalPeriodSpend = useMemo(() => {
    return filteredByTimeframe.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredByTimeframe]);

  const daysElapsed = useMemo(() => {
    if (timeframe === 'this_month') return Math.max(1, new Date().getDate());
    if (timeframe === 'this_week') return 7;
    return 30;
  }, [timeframe]);

  const dailyBurnRate = totalPeriodSpend / daysElapsed;
  const projectedMonthSpend = timeframe === 'this_month' ? dailyBurnRate * 30 : totalPeriodSpend;
  const budgetUsedPct = Math.round((totalPeriodSpend / Math.max(budget.monthly_budget, 1)) * 100);
  const remainingBudget = Math.max(0, budget.monthly_budget - totalPeriodSpend);

  // Top category
  const topCategory = useMemo(() => {
    const totals = filteredByTimeframe.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    let highestCat = 'None';
    let highestAmt = 0;
    for (const [c, a] of Object.entries(totals)) {
      if (a > highestAmt) {
        highestAmt = a;
        highestCat = c;
      }
    }
    return { name: highestCat, amount: highestAmt };
  }, [filteredByTimeframe]);

  // Recharts Category Donut Data
  const categoryChartData = useMemo(() => {
    const totals = filteredByTimeframe.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    return (Object.keys(totals) as ExpenseCategory[])
      .filter(c => totals[c] > 0)
      .map(c => ({
        name: c,
        value: Number(totals[c].toFixed(2)),
        color: CATEGORY_COLORS[c] || '#94A3B8'
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredByTimeframe]);

  // Recharts Daily Velocity Data
  const dailyBarData = useMemo(() => {
    const days = getPastNDays(timeframe === 'this_week' ? 7 : 14);
    return days.map(d => {
      const dayExp = filteredByTimeframe.filter(e => e.entry_date === d);
      const total = dayExp.reduce((sum, e) => sum + e.amount, 0);
      return {
        date: formatShortDate(d),
        fullDate: d,
        Spend: Number(total.toFixed(2))
      };
    });
  }, [filteredByTimeframe, timeframe]);

  // 50/30/20 breakdown
  const framework50_30_20 = useMemo(() => {
    const needs = filteredByTimeframe.filter(e => e.spend_type === 'need').reduce((s, e) => s + e.amount, 0);
    const wants = filteredByTimeframe.filter(e => e.spend_type === 'want').reduce((s, e) => s + e.amount, 0);
    const savings = filteredByTimeframe.filter(e => e.spend_type === 'savings').reduce((s, e) => s + e.amount, 0);
    const total = Math.max(totalPeriodSpend, budget.monthly_budget, 1);

    return {
      needs,
      wants,
      savings,
      needsPct: Math.round((needs / total) * 100),
      wantsPct: Math.round((wants / total) * 100),
      savingsPct: Math.max(0, 100 - Math.round((needs / total) * 100) - Math.round((wants / total) * 100))
    };
  }, [filteredByTimeframe, totalPeriodSpend, budget.monthly_budget]);

  // Displayed Table records
  const displayedExpenses = useMemo(() => {
    return filteredByTimeframe.filter(e => {
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      const matchPay = selectedPayment === 'all' || e.payment_method === selectedPayment;
      const matchQ =
        !searchQuery ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCat && matchPay && matchQ;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
      if (sortBy === 'date_asc') return new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return 0;
    });
  }, [filteredByTimeframe, selectedCategory, selectedPayment, searchQuery, sortBy]);

  const handleOpenAdd = () => {
    setTitle('');
    setAmount('');
    setCategory('Groceries');
    setDate(getTodayIso());
    setPaymentMethod('Credit Card');
    setSpendType('need');
    setNotes('');
    setIsRecurring(false);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setAmount(exp.amount.toString());
    setCategory(exp.category);
    setDate(exp.entry_date);
    setPaymentMethod(exp.payment_method);
    setSpendType(exp.spend_type || 'need');
    setNotes(exp.notes || '');
    setIsRecurring(!!exp.is_recurring);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0) return;

    onAddExpense({
      user_id: budget.user_id,
      title: title.trim(),
      amount: amt,
      category,
      entry_date: date,
      payment_method: paymentMethod,
      spend_type: spendType,
      notes: notes.trim() || undefined,
      is_recurring: isRecurring
    });
    setIsAddOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0) return;

    onUpdateExpense(editingExpense.id, {
      title: title.trim(),
      amount: amt,
      category,
      entry_date: date,
      payment_method: paymentMethod,
      spend_type: spendType,
      notes: notes.trim() || undefined,
      is_recurring: isRecurring
    });
    setEditingExpense(null);
  };

  const handleExportCSV = () => {
    const csv = exportExpensesAsCSV(filteredByTimeframe);
    downloadBlob(csv, `daymark_expenses_${timeframe}.csv`, 'text/csv');
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Expense &amp; Budget Analysis
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>50/30/20 audit &amp; sector budgets</span>
            <span aria-hidden="true">·</span>
            <span>{filteredByTimeframe.length} logged entries</span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Timeframe selector */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setTimeframe('this_month')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                timeframe === 'this_month'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeframe('last_30_days')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                timeframe === 'last_30_days'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeframe('this_week')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                timeframe === 'this_week'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                timeframe === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={() => setIsBudgetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Budget Caps</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Period Spend</span>
            <span className="font-mono text-[11px] uppercase">{timeframe.replace('_', ' ')}</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            ${totalPeriodSpend.toFixed(2)}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span
              className={`font-mono font-medium ${
                budgetUsedPct > 90 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {budgetUsedPct}%
            </span>
            <span className="text-slate-400">of ${budget.monthly_budget} budget</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-2.5 overflow-hidden">
            <div
              className={`h-full ${
                budgetUsedPct > 100 ? 'bg-rose-500' : budgetUsedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Daily Burn Pace</span>
            <span className="font-mono text-[11px] text-slate-400">AVG/DAY</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            ${dailyBurnRate.toFixed(2)}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Projected 30-day: <strong className="font-mono text-slate-700 dark:text-slate-300">${projectedMonthSpend.toFixed(2)}</strong>
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Remaining Buffer</span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">SAFE POOL</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            ${remainingBudget.toFixed(2)}
          </div>
          <p className="mt-3 text-xs text-slate-400">Available unallocated budget</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Highest Outflow Sector</span>
            <span className="font-mono text-[11px] text-slate-400">PEAK</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {topCategory.name}
          </div>
          <p className="mt-3 text-xs text-slate-400 font-mono">
            ${topCategory.amount.toFixed(2)}{' '}
            <span className="text-[11px]">
              ({totalPeriodSpend > 0 ? Math.round((topCategory.amount / totalPeriodSpend) * 100) : 0}% of total)
            </span>
          </p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Recharts Donut */}
        <div className="lg:col-span-6 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Sector Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Outflow distribution across categories
              </p>
            </div>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {categoryChartData.length === 0 ? (
              <p className="text-xs text-slate-400">No disbursements recorded in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(data: any) => setSelectedCategory(data.name)}
                    className="cursor-pointer"
                  >
                    {categoryChartData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Spent']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Spending Velocity Bar Chart */}
        <div className="lg:col-span-6 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Daily Spending Velocity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Disbursement volume per calendar day
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Spend']}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none'
                  }}
                />
                <Bar dataKey="Spend" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 50/30/20 Framework */}
        <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                50 / 30 / 20 Financial Discipline Framework
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: Needs (50% Essential) · Wants (30% Discretionary) · Savings / Buffer (20%)
              </p>
            </div>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
            <div
              className="bg-blue-500 h-full"
              style={{ width: `${Math.min(framework50_30_20.needsPct, 100)}%` }}
              title={`Needs: ${framework50_30_20.needsPct}%`}
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${Math.min(framework50_30_20.wantsPct, 100)}%` }}
              title={`Wants: ${framework50_30_20.wantsPct}%`}
            />
            <div
              className="bg-emerald-500 h-full"
              style={{ width: `${Math.min(framework50_30_20.savingsPct, 100)}%` }}
              title={`Savings/Buffer: ${framework50_30_20.savingsPct}%`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                <span>Needs (50% Target)</span>
                <span className="font-mono">{framework50_30_20.needsPct}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                ${framework50_30_20.needs.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Rent, groceries, utilities, transit</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                <span>Wants (30% Target)</span>
                <span className="font-mono">{framework50_30_20.wantsPct}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                ${framework50_30_20.wants.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Dining out, entertainment, shopping</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                <span>Savings / Buffer (20% Target)</span>
                <span className="font-mono">{framework50_30_20.savingsPct}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                ${remainingBudget.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Retained budget &amp; emergency buffer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Ledger Transactions
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              ({displayedExpenses.length} records)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search merchant, notes..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={selectedPayment}
              onChange={e => setSelectedPayment(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Payments</option>
              {PAYMENT_METHODS.map(pm => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Merchant / Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                displayedExpenses.map(item => {
                  const catColor = CATEGORY_COLORS[item.category] || '#94A3B8';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatDisplayDate(item.entry_date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.title}
                          {item.is_recurring && (
                            <span className="ml-2 text-[10px] text-blue-600 dark:text-blue-400">
                              (Recurring)
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: catColor }}
                          />
                          <span>{item.category}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="capitalize text-slate-500">
                          {item.spend_type === 'need' ? 'Need (50%)' : item.spend_type === 'want' ? 'Want (30%)' : 'Savings (20%)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {item.payment_method}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        ${item.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteExpense(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Expense */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Log New Expense
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Merchant / Item Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Whole Foods, Electric Utility, Coffee..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {PAYMENT_METHODS.map(pm => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  50/30/20 Discipline Framework
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSpendType('need')}
                    className={`py-1.5 px-2 text-xs rounded-lg border font-medium ${
                      spendType === 'need'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Need (50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpendType('want')}
                    className={`py-1.5 px-2 text-xs rounded-lg border font-medium ${
                      spendType === 'want'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Want (30%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpendType('savings')}
                    className={`py-1.5 px-2 text-xs rounded-lg border font-medium ${
                      spendType === 'savings'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Savings (20%)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Tag (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Receipt, details, items included..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring-expense"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900"
                />
                <label htmlFor="recurring-expense" className="text-xs text-slate-700 dark:text-slate-300">
                  Recurring monthly commitment (rent, subscription, insurance)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Expense */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Edit Transaction
              </h3>
              <button
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Merchant / Item Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {PAYMENT_METHODS.map(pm => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white"
                >
                  Update Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Budget Settings */}
      {isBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Configure Budget Limits
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Set monthly budget baseline and category spending caps
                </p>
              </div>
              <button
                onClick={() => setIsBudgetOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Monthly Total Budget ($)
                </label>
                <input
                  type="number"
                  step="50"
                  min="100"
                  value={budget.monthly_budget}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    onUpdateBudget({
                      ...budget,
                      monthly_budget: val
                    });
                  }}
                  className="w-full max-w-xs px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Category Limits ($)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CATEGORIES.map(c => {
                    const currentCap = budget.category_budgets[c] || 0;
                    return (
                      <div
                        key={c}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[c] }}
                          />
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {c}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="25"
                          min="0"
                          value={currentCap}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            onUpdateBudget({
                              ...budget,
                              category_budgets: {
                                ...budget.category_budgets,
                                [c]: val
                              }
                            });
                          }}
                          className="w-24 px-2 py-1 text-xs font-mono text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsBudgetOpen(false)}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800"
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
