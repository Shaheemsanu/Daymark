import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Habit, DailyTask, Expense, DailyWellness, BudgetConfig } from '../../types';
import { formatCurrency } from '../../utils/constants';
import {
  getPastNDays,
  getPastNWeeks,
  getPastNMonths,
  getPastNYears,
  formatShortDate
} from '../../lib/dateUtils';
import {
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Droplet,
  Moon,
  Flame,
  ListTodo,
  Sparkles,
  PieChart as PieIcon,
  Zap,
  Activity
} from 'lucide-react';

export type ReportModule = 'all' | 'expenses' | 'habits' | 'tasks' | 'wellness';

interface ReportsPageProps {
  habits: Habit[];
  tasks: DailyTask[];
  expenses: Expense[];
  wellness: Record<string, DailyWellness>;
  budget?: BudgetConfig;
  defaultModule?: ReportModule;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  habits = [],
  tasks = [],
  expenses = [],
  wellness = {},
  budget = { monthlyBudget: 30000, currency: '₹', categoryBudgets: {} },
  defaultModule = 'all'
}) => {
  const [selectedModule, setSelectedModule] = useState<ReportModule>(defaultModule);
  const [timeframe, setTimeframe] = useState<'7' | '14' | '30'>('14');

  const currSymbol = budget?.currency || '₹';

  // Time grain toggles for Habit and Task Analytics
  const [habitTimeGrain, setHabitTimeGrain] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [taskTimeGrain, setTaskTimeGrain] = useState<'day' | 'week' | 'month' | 'year'>('day');

  const daysList = useMemo(() => {
    return getPastNDays(parseInt(timeframe));
  }, [timeframe]);

  // -------------------------------------------------------------
  // 1. EXPENSES ANALYTICS DATA (EXPENSE FIRST)
  // -------------------------------------------------------------
  // A. Daily Expense Velocity series
  const expenseVelocityData = useMemo(() => {
    return daysList.map(dateStr => {
      const dayExp = expenses.filter(e => e.date === dateStr);
      const totalOutflow = dayExp
        .filter(e => (e.type || 'expense') === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalInflow = dayExp
        .filter(e => e.type === 'income')
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        date: formatShortDate(dateStr),
        fullDate: dateStr,
        Spend: Number(totalOutflow.toFixed(2)),
        Income: Number(totalInflow.toFixed(2))
      };
    });
  }, [daysList, expenses]);

  // B. Category Outflow Breakdown
  const expenseCategoryData = useMemo(() => {
    const relevant = expenses.filter(e => daysList.includes(e.date) && (e.type || 'expense') === 'expense');
    const totals = relevant.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const palette: Record<string, string> = {
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
      Salary: '#10B981',
      Other: '#94A3B8'
    };

    return Object.entries(totals)
      .filter(([_, amt]) => amt > 0)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
        color: palette[name] || '#94A3B8'
      }))
      .sort((a, b) => b.value - a.value);
  }, [daysList, expenses]);

  // C. 50/30/20 Need vs Want vs Savings Breakdown
  const classificationData = useMemo(() => {
    const relevant = expenses.filter(e => daysList.includes(e.date) && (e.type || 'expense') === 'expense');
    let need = 0;
    let want = 0;
    let savings = 0;

    relevant.forEach(e => {
      const type = e.spendType || 'need';
      if (type === 'need') need += e.amount;
      else if (type === 'want') want += e.amount;
      else if (type === 'savings') savings += e.amount;
    });

    const total = need + want + savings;
    return [
      { name: 'Needs (Essentials)', value: need, pct: total > 0 ? Math.round((need / total) * 100) : 0, color: '#3B82F6' },
      { name: 'Wants (Lifestyle)', value: want, pct: total > 0 ? Math.round((want / total) * 100) : 0, color: '#F59E0B' },
      { name: 'Savings & Investments', value: savings, pct: total > 0 ? Math.round((savings / total) * 100) : 0, color: '#10B981' }
    ];
  }, [daysList, expenses]);

  // -------------------------------------------------------------
  // 2. HABITS ANALYTICS DATA (Day, Week, Month, Year)
  // -------------------------------------------------------------
  const habitGrainTrend = useMemo(() => {
    if (habitTimeGrain === 'day') {
      return daysList.map(dateStr => {
        const completedCount = habits.filter(h => h.completedDates.includes(dateStr)).length;
        const rate = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;
        return {
          date: formatShortDate(dateStr),
          fullDate: dateStr,
          Completed: completedCount,
          Total: habits.length,
          Rate: rate
        };
      });
    }

    if (habitTimeGrain === 'week') {
      return getPastNWeeks(8).map(w => {
        let completed = 0;
        w.days.forEach(d => {
          completed += habits.filter(h => h.completedDates.includes(d)).length;
        });
        const maxPoss = habits.length * w.days.length;
        const rate = maxPoss > 0 ? Math.round((completed / maxPoss) * 100) : 0;
        return {
          date: w.label,
          fullDate: w.subLabel || w.label,
          Completed: completed,
          Total: maxPoss,
          Rate: rate
        };
      });
    }

    if (habitTimeGrain === 'month') {
      return getPastNMonths(6).map(m => {
        let completed = 0;
        m.days.forEach(d => {
          completed += habits.filter(h => h.completedDates.includes(d)).length;
        });
        const maxPoss = habits.length * m.days.length;
        const rate = maxPoss > 0 ? Math.round((completed / maxPoss) * 100) : 0;
        return {
          date: m.label,
          fullDate: m.subLabel || m.label,
          Completed: completed,
          Total: maxPoss,
          Rate: rate
        };
      });
    }

    // Year
    return getPastNYears(3).map(y => {
      let completed = 0;
      y.days.forEach(d => {
        completed += habits.filter(h => h.completedDates.includes(d)).length;
      });
      const maxPoss = habits.length * y.days.length;
      const rate = maxPoss > 0 ? Math.round((completed / maxPoss) * 100) : 0;
      return {
        date: y.label,
        fullDate: y.label,
        Completed: completed,
        Total: maxPoss,
        Rate: rate
      };
    });
  }, [habitTimeGrain, daysList, habits]);

  // Consistency by Individual Habit
  const habitPerformanceByHabit = useMemo(() => {
    return habits.map(h => {
      const countInWindow = daysList.filter(d => h.completedDates.includes(d)).length;
      const windowTotal = daysList.length;
      const pct = Math.round((countInWindow / windowTotal) * 100);
      return {
        name: h.title,
        shortName: h.title.length > 16 ? h.title.substring(0, 15) + '…' : h.title,
        CompletedDays: countInWindow,
        CurrentStreak: h.streak,
        BestStreak: h.bestStreak,
        CompletionPct: pct,
        color: h.color || '#10B981',
        category: h.category
      };
    });
  }, [daysList, habits]);

  // Habit Category Breakdown
  const habitCategoryData = useMemo(() => {
    const counts = habits.reduce((acc, h) => {
      acc[h.category] = (acc[h.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const palette: Record<string, string> = {
      Health: '#06B6D4',
      Fitness: '#10B981',
      Productivity: '#6366F1',
      Mindfulness: '#F59E0B',
      Personal: '#EC4899'
    };
    const dynamicPalette = ['#06B6D4', '#10B981', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#3B82F6', '#F43F5E'];

    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: palette[name] || dynamicPalette[idx % dynamicPalette.length]
    }));
  }, [habits]);

  // -------------------------------------------------------------
  // 3. DAILY TASKS ANALYTICS DATA (Day, Week, Month, Year)
  // -------------------------------------------------------------
  const taskGrainTrend = useMemo(() => {
    if (taskTimeGrain === 'day') {
      return daysList.map(dateStr => {
        const dayTasks = tasks.filter(t => t.date === dateStr);
        const completed = dayTasks.filter(t => t.completed).length;
        const pending = dayTasks.filter(t => !t.completed).length;
        return {
          date: formatShortDate(dateStr),
          fullDate: dateStr,
          Completed: completed,
          Pending: pending,
          Total: dayTasks.length
        };
      });
    }

    if (taskTimeGrain === 'week') {
      return getPastNWeeks(8).map(w => {
        const weekTasks = tasks.filter(t => w.days.includes(t.date));
        const completed = weekTasks.filter(t => t.completed).length;
        const pending = weekTasks.filter(t => !t.completed).length;
        return {
          date: w.label,
          fullDate: w.subLabel || w.label,
          Completed: completed,
          Pending: pending,
          Total: weekTasks.length
        };
      });
    }

    if (taskTimeGrain === 'month') {
      return getPastNMonths(6).map(m => {
        const monthTasks = tasks.filter(t => m.days.includes(t.date));
        const completed = monthTasks.filter(t => t.completed).length;
        const pending = monthTasks.filter(t => !t.completed).length;
        return {
          date: m.label,
          fullDate: m.subLabel || m.label,
          Completed: completed,
          Pending: pending,
          Total: monthTasks.length
        };
      });
    }

    // Year
    return getPastNYears(3).map(y => {
      const yearTasks = tasks.filter(t => y.days.includes(t.date));
      const completed = yearTasks.filter(t => t.completed).length;
      const pending = yearTasks.filter(t => !t.completed).length;
      return {
        date: y.label,
        fullDate: y.label,
        Completed: completed,
        Pending: pending,
        Total: yearTasks.length
      };
    });
  }, [taskTimeGrain, daysList, tasks]);

  const taskStatusData = useMemo(() => {
    const relevantTasks = tasks.filter(t => daysList.includes(t.date));
    const completed = relevantTasks.filter(t => t.completed).length;
    const pending = relevantTasks.filter(t => !t.completed).length;
    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'Pending', value: pending, color: '#64748B' }
    ].filter(i => i.value > 0);
  }, [daysList, tasks]);

  const taskPriorityData = useMemo(() => {
    const relevant = tasks.filter(t => daysList.includes(t.date));
    const high = relevant.filter(t => t.priority === 'high');
    const med = relevant.filter(t => t.priority === 'medium');
    const low = relevant.filter(t => t.priority === 'low');

    return [
      {
        priority: 'High',
        Total: high.length,
        Completed: high.filter(t => t.completed).length,
        fill: '#F43F5E'
      },
      {
        priority: 'Medium',
        Total: med.length,
        Completed: med.filter(t => t.completed).length,
        fill: '#F59E0B'
      },
      {
        priority: 'Low',
        Total: low.length,
        Completed: low.filter(t => t.completed).length,
        fill: '#64748B'
      }
    ];
  }, [daysList, tasks]);

  // -------------------------------------------------------------
  // 4. WELLNESS & SLEEP ANALYTICS DATA
  // -------------------------------------------------------------
  const wellnessTrendData = useMemo(() => {
    return daysList.map(dateStr => {
      const log = wellness[dateStr];
      const waterLiters = log ? Number(((log.waterGlasses * 250) / 1000).toFixed(2)) : 0;
      const sleepHours = log ? log.sleepHours : 0;
      const energy = log ? log.energyScore : 0;

      return {
        date: formatShortDate(dateStr),
        fullDate: dateStr,
        SleepHours: sleepHours,
        WaterLiters: waterLiters,
        EnergyScore: energy
      };
    });
  }, [daysList, wellness]);

  // High-level aggregate totals
  const totalTasksCompleted = tasks.filter(t => daysList.includes(t.date) && t.completed).length;
  const totalPeriodSpend = expenseVelocityData.reduce((acc, d) => acc + d.Spend, 0);
  const totalPeriodIncome = expenseVelocityData.reduce((acc, d) => acc + d.Income, 0);
  const avgDailySpend = totalPeriodSpend / parseInt(timeframe);

  const avgSleepHours = useMemo(() => {
    const valid = wellnessTrendData.filter(d => d.SleepHours > 0);
    return valid.length > 0
      ? (valid.reduce((acc, d) => acc + d.SleepHours, 0) / valid.length).toFixed(1)
      : '0';
  }, [wellnessTrendData]);

  const avgWaterLiters = useMemo(() => {
    const valid = wellnessTrendData.filter(d => d.WaterLiters > 0);
    return valid.length > 0
      ? (valid.reduce((acc, d) => acc + d.WaterLiters, 0) / valid.length).toFixed(1)
      : '0';
  }, [wellnessTrendData]);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Analytics &amp; Performance Trends
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Modular visual intelligence</span>
            <span aria-hidden="true">·</span>
            <span>Expenses velocity, habits, daily tasks &amp; wellness</span>
          </div>
        </div>

        {/* Timeframe window selector */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setTimeframe('7')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              timeframe === '7'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Past 7 Days
          </button>
          <button
            onClick={() => setTimeframe('14')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              timeframe === '14'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Past 14 Days
          </button>
          <button
            onClick={() => setTimeframe('30')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              timeframe === '30'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Past 30 Days
          </button>
        </div>
      </div>

      {/* Module Selector Filter Ribbon (EXPENSE TOP / FIRST) */}
      <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium overflow-x-auto gap-1">
        <button
          onClick={() => setSelectedModule('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedModule === 'all'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>All Modules Combined</span>
        </button>

        <button
          onClick={() => setSelectedModule('expenses')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedModule === 'expenses'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-purple-500" />
          <span>Expense Analytics &amp; Accounts</span>
        </button>

        <button
          onClick={() => setSelectedModule('habits')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedModule === 'habits'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span>Habit Analytics</span>
        </button>

        <button
          onClick={() => setSelectedModule('tasks')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedModule === 'tasks'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5 text-blue-500" />
          <span>Daily Tasks Analytics</span>
        </button>

        <button
          onClick={() => setSelectedModule('wellness')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedModule === 'wellness'
              ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Sleep &amp; Hydration Curves</span>
        </button>
      </div>

      {/* Overview KPI Cards (EXPENSE FIRST AT TOP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. EXPENSE KPI CARD (TOP / FIRST) */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
              💳 Window Disbursements
            </span>
            <span className="font-mono text-purple-500 font-bold">SPEND</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {formatCurrency(totalPeriodSpend, currSymbol)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Avg: {formatCurrency(avgDailySpend, currSymbol)} / day</span>
            {totalPeriodIncome > 0 && (
              <span className="text-emerald-600 font-semibold font-mono">
                +{formatCurrency(totalPeriodIncome, currSymbol)}
              </span>
            )}
          </div>
        </div>

        {/* 2. HABITS KPI CARD */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Habits Active</span>
            <span className="font-mono text-amber-500 font-bold">🔥 STREAKS</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {habits.length} <span className="text-sm font-normal text-slate-400">routines</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Top streak: {Math.max(...habits.map(h => h.streak), 0)} days
          </p>
        </div>

        {/* 3. TASKS KPI CARD */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Tasks Completed</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">DONE</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {totalTasksCompleted}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">In the {timeframe}-day window</p>
        </div>

        {/* 4. WELLNESS KPI CARD */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Sleep &amp; Water</span>
            <span className="font-mono text-indigo-500 font-bold">REST</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {avgSleepHours}h <span className="text-sm font-normal text-slate-400">· {avgWaterLiters}L</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Daily recorded averages</p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 1: EXPENSE ANALYTICS (EXPENSE FIRST AT TOP!)            */}
      {/* ------------------------------------------------------------- */}
      {(selectedModule === 'all' || selectedModule === 'expenses') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                <DollarSign className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Expense Analytics: Disbursement Velocity &amp; 50/30/20 Classification
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Module 1: Expense &amp; Accounts
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Expense Velocity Trend Line Chart */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Expense Velocity ({currSymbol} Daily Spend)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Daily outflow volume tracking spending surges across {timeframe} days
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                  Total: {formatCurrency(totalPeriodSpend, currSymbol)}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={expenseVelocityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any, name?: any) => [formatCurrency(Number(val), currSymbol), name]}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Spend"
                      name="Outflow Spend"
                      stroke="#8B5CF6"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    {totalPeriodIncome > 0 && (
                      <Line
                        type="monotone"
                        dataKey="Income"
                        name="Inflow Income"
                        stroke="#10B981"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Category Distribution Donut */}
            <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Category Outflow Share
                </h4>
                <p className="text-xs text-slate-400">Distribution by expense category</p>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {expenseCategoryData.length === 0 ? (
                  <p className="text-xs text-slate-400">No disbursements recorded in this window.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expenseCategoryData.map(entry => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [formatCurrency(Number(val), currSymbol), 'Spent']}
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

            {/* Chart 3: 50/30/20 Need vs Want vs Savings Classification */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    50 / 30 / 20 Budget Allocation Breakdown
                  </h4>
                  <p className="text-xs text-slate-400">
                    Categorizing outflows into Essential Needs, Lifestyle Wants, and Savings / Investments
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {classificationData.map(item => (
                  <div
                    key={item.name}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>{item.name}</span>
                      <span className="font-mono text-purple-600 dark:text-purple-400">{item.pct}%</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
                      {formatCurrency(item.value, currSymbol)}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 2: HABITS ANALYTICS (Recharts Completion Consistency)  */}
      {/* ------------------------------------------------------------- */}
      {(selectedModule === 'all' || selectedModule === 'habits') && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                <Flame className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Habit Analytics: Completion Consistency &amp; Streaks
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Grain:</span>
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                {(['day', 'week', 'month', 'year'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setHabitTimeGrain(g)}
                    className={`px-2.5 py-1 rounded-md uppercase tracking-wider transition-colors cursor-pointer ${
                      habitTimeGrain === g
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Habit Completion Consistency Rate Area/Bar Chart */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Habit Completion Consistency ({habitTimeGrain.toUpperCase()})
                  </h4>
                  <p className="text-xs text-slate-400">
                    {habitTimeGrain === 'day'
                      ? 'Daily habit completion consistency percentage'
                      : `Habit check-offs aggregated by ${habitTimeGrain}`}
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {habitTimeGrain === 'day' ? (
                    <AreaChart data={habitGrainTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="habitRateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip
                        formatter={(val: any) => [`${val}%`, 'Consistency Rate']}
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                          border: 'none'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Rate"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#habitRateGrad)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={habitGrainTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val: any, name?: any) => [
                          val,
                          name === 'Completed' ? 'Total Completions' : name
                        ]}
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                          border: 'none'
                        }}
                      />
                      <Bar dataKey="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Category Share Donut */}
            <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Habits by Category
                </h4>
                <p className="text-xs text-slate-400">Distribution across life pillars</p>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={habitCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {habitCategoryData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
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
              </div>
            </div>

            {/* Chart 3: Habit Streaks Comparison (Current vs Best) */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Streak Leaderboard: Current Streak vs. Best Recorded Streak
                </h4>
                <p className="text-xs text-slate-400">
                  Day count comparison for each tracked habit
                </p>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={habitPerformanceByHabit} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="CurrentStreak" name="Current Streak (Days)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="BestStreak" name="Best Streak (Days)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 3: DAILY TASKS ANALYTICS (Task Status Share & Trends)  */}
      {/* ------------------------------------------------------------- */}
      {(selectedModule === 'all' || selectedModule === 'tasks') && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                <ListTodo className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Daily Tasks Analytics: Completion Consistency &amp; Status Share
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Grain:</span>
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                {(['day', 'week', 'month', 'year'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setTaskTimeGrain(g)}
                    className={`px-2.5 py-1 rounded-md uppercase tracking-wider transition-colors cursor-pointer ${
                      taskTimeGrain === g
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Tasks Stacked Execution Bar Chart */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Task Execution Velocity ({taskTimeGrain.toUpperCase()})
                </h4>
                <p className="text-xs text-slate-400">
                  Completed vs. Pending throughput grouped by {taskTimeGrain}
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskGrainTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Completed" stackId="a" fill="#10B981" radius={[0, 0, 2, 2]} />
                    <Bar dataKey="Pending" stackId="a" fill="#94A3B8" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Task Status Share Donut */}
            <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Task Status Share
                </h4>
                <p className="text-xs text-slate-400">Aggregate completion ratio</p>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {taskStatusData.length === 0 ? (
                  <p className="text-xs text-slate-400">No tasks logged in this window.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {taskStatusData.map(entry => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
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

            {/* Chart 3: Tasks by Priority Breakdown */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Task Execution by Priority (High / Medium / Low)
                </h4>
                <p className="text-xs text-slate-400">
                  Completed vs Total scheduled items per priority level
                </p>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskPriorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Total" name="Total Scheduled" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Completed" name="Completed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 4: WELLNESS ANALYTICS (Sleep vs. Hydration Curves)     */}
      {/* ------------------------------------------------------------- */}
      {(selectedModule === 'all' || selectedModule === 'wellness') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600">
                <Moon className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Wellness Analytics: Sleep vs. Hydration Curves
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Module 4: Daily Wellness
            </span>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Sleep Hours vs. Water Hydration (Liters) Correlation
                </h4>
                <p className="text-xs text-slate-400">
                  Dual-axis health curve tracking restorative rest and hydration intake
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-indigo-600 dark:text-indigo-400">
                  Sleep Avg: {avgSleepHours}h
                </span>
                <span className="text-cyan-600 dark:text-cyan-400">
                  Water Avg: {avgWaterLiters}L
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wellnessTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="SleepHours"
                    name="Sleep (Hours)"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="WaterLiters"
                    name="Water Hydration (Liters)"
                    stroke="#06B6D4"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
