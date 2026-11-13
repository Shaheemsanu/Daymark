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
  getDaysInInterval,
  formatShortDate,
  getTodayIso
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

type ReportDateRange = '7' | '14' | '30' | 'custom';

interface DateRangeControlProps {
  value: ReportDateRange;
  onChange: (value: ReportDateRange) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  label: string;
}

const DateRangeControl: React.FC<DateRangeControlProps> = ({ value, onChange, startDate, onStartDateChange, endDate, onEndDateChange, label }) => (
  <div className="order-first col-span-full flex w-full min-w-0 flex-wrap items-center gap-2 sm:order-none sm:col-span-auto sm:w-auto sm:flex-nowrap" aria-label={`${label} date range`}>
    <div className="flex w-full flex-nowrap items-center rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800 sm:w-auto">
      {([
        ['7', 'Past 7 Days'], ['14', 'Past 14 Days'], ['30', 'Past 30 Days'], ['custom', 'Custom']
      ] as const).map(([range, title]) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`flex-1 whitespace-nowrap rounded-md px-1.5 py-2 text-center transition-colors sm:flex-none sm:px-2.5 sm:py-1.5 ${value === range ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}
        >
          {title}
        </button>
      ))}
    </div>
    {value === 'custom' && <>
      <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        From
        <input type="date" aria-label={`${label} start date`} value={startDate} max={endDate} onChange={event => onStartDateChange(event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
      </label>
      <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        To
        <input type="date" aria-label={`${label} end date`} value={endDate} min={startDate} max={getTodayIso()} onChange={event => onEndDateChange(event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
      </label>
    </>}
  </div>
);

function getReportDays(range: ReportDateRange, startDate: string, endDate: string): string[] {
  return range === 'custom' ? getDaysInInterval(startDate, endDate) : getPastNDays(Number(range));
}

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
  budget = { monthlyBudget: 30000, dailyBudget: 1000, weeklyBudget: 7000, currency: '₹', categoryBudgets: {} },
  defaultModule = 'all'
}) => {
  const [selectedModule, setSelectedModule] = useState<ReportModule>(defaultModule);
  const [expenseRange, setExpenseRange] = useState<ReportDateRange>('14');
  const [habitRange, setHabitRange] = useState<ReportDateRange>('14');
  const [taskRange, setTaskRange] = useState<ReportDateRange>('14');
  const [wellnessRange, setWellnessRange] = useState<ReportDateRange>('14');
  const [expenseStartDate, setExpenseStartDate] = useState(() => getPastNDays(14)[0]);
  const [habitStartDate, setHabitStartDate] = useState(() => getPastNDays(14)[0]);
  const [taskStartDate, setTaskStartDate] = useState(() => getPastNDays(14)[0]);
  const [wellnessStartDate, setWellnessStartDate] = useState(() => getPastNDays(14)[0]);
  const [expenseEndDate, setExpenseEndDate] = useState(() => {
    const initialDays = getPastNDays(14);
    return initialDays[initialDays.length - 1] || '';
  });
  const [habitEndDate, setHabitEndDate] = useState(() => getTodayIso());
  const [taskEndDate, setTaskEndDate] = useState(() => getTodayIso());
  const [wellnessEndDate, setWellnessEndDate] = useState(() => getTodayIso());

  const currSymbol = budget?.currency || '₹';

  // Time grain toggles for Habit and Task Analytics
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseAccountFilter, setExpenseAccountFilter] = useState('all');
  const [expenseFlowFilter, setExpenseFlowFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [habitCategoryFilter, setHabitCategoryFilter] = useState('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [wellnessMetric, setWellnessMetric] = useState<'sleep_water' | 'sleep' | 'water' | 'energy'>('sleep_water');
  const [wellnessMoodFilter, setWellnessMoodFilter] = useState<'all' | 'great' | 'good' | 'neutral' | 'low' | 'stressed'>('all');

  const expenseDays = useMemo(() => getReportDays(expenseRange, expenseStartDate, expenseEndDate), [expenseRange, expenseStartDate, expenseEndDate]);
  const habitDays = useMemo(() => getReportDays(habitRange, habitStartDate, habitEndDate), [habitRange, habitStartDate, habitEndDate]);
  const taskDays = useMemo(() => getReportDays(taskRange, taskStartDate, taskEndDate), [taskRange, taskStartDate, taskEndDate]);
  const wellnessDays = useMemo(() => getReportDays(wellnessRange, wellnessStartDate, wellnessEndDate), [wellnessRange, wellnessStartDate, wellnessEndDate]);

  const filteredExpenses = useMemo(() => expenses.filter(expense =>
    expenseDays.includes(expense.date) &&
    (expenseCategoryFilter === 'all' || expense.category === expenseCategoryFilter) &&
    (expenseAccountFilter === 'all' || (expense.account || 'expense') === expenseAccountFilter) &&
    (expenseFlowFilter === 'all' || (expense.type || 'expense') === expenseFlowFilter)
  ), [expenses, expenseDays, expenseCategoryFilter, expenseAccountFilter, expenseFlowFilter]);

  const filteredHabits = useMemo(() => habits.filter(habit =>
    habitCategoryFilter === 'all' || habit.category === habitCategoryFilter
  ), [habits, habitCategoryFilter]);

  const filteredTasks = useMemo(() => tasks.filter(task =>
    (taskCategoryFilter === 'all' || (task.category || 'General') === taskCategoryFilter) &&
    (taskPriorityFilter === 'all' || task.priority === taskPriorityFilter) &&
    (taskStatusFilter === 'all' || (taskStatusFilter === 'completed' ? task.completed : !task.completed))
  ), [tasks, taskCategoryFilter, taskPriorityFilter, taskStatusFilter]);
  const tasksInSelectedRange = useMemo(() => filteredTasks.filter(task => taskDays.includes(task.date)), [filteredTasks, taskDays]);

  const expenseCategories = useMemo(() => Array.from(new Set(expenses.map(item => item.category))).sort(), [expenses]);
  const expenseAccounts = useMemo(() => Array.from(new Set(expenses.map(item => item.account || 'expense'))).sort(), [expenses]);
  const habitCategories = useMemo(() => Array.from(new Set(habits.map(item => item.category))).sort(), [habits]);
  const taskCategories = useMemo(() => Array.from(new Set(tasks.map(item => item.category || 'General'))).sort(), [tasks]);

  // -------------------------------------------------------------
  // 1. EXPENSES ANALYTICS DATA (EXPENSE FIRST)
  // -------------------------------------------------------------
  // A. Daily Expense Velocity series
  const expenseVelocityData = useMemo(() => {
    return expenseDays.map(dateStr => {
      const dayExp = filteredExpenses.filter(e => e.date === dateStr);
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
  }, [expenseDays, filteredExpenses]);

  // B. Category Outflow Breakdown
  const expenseCategoryData = useMemo(() => {
    const relevant = filteredExpenses.filter(e => (e.type || 'expense') === 'expense');
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
  }, [filteredExpenses]);

  // C. 50/30/20 Need vs Want vs Savings Breakdown
  const classificationData = useMemo(() => {
    const relevant = filteredExpenses.filter(e => (e.type || 'expense') === 'expense');
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
  }, [filteredExpenses]);
  const spendTypeBreakdownData = useMemo(() => classificationData.filter(item => item.value > 0), [classificationData]);

  const expenseAccountData = useMemo(() => {
    const totals = filteredExpenses.reduce((result, expense) => {
      const account = expense.account || 'expense';
      const bucket = result[account] || { Expense: 0, Income: 0 };
      if ((expense.type || 'expense') === 'income') bucket.Income += expense.amount;
      else bucket.Expense += expense.amount;
      result[account] = bucket;
      return result;
    }, {} as Record<string, { Expense: number; Income: number }>);
    return Object.entries(totals).map(([account, values]) => ({
      account: account === 'expense' ? 'Expense account' : account === 'savings' ? 'Savings account' : account === 'cash' ? 'Cash' : account,
      ...values
    }));
  }, [filteredExpenses]);

  // -------------------------------------------------------------
  // 2. HABITS ANALYTICS DATA
  // -------------------------------------------------------------
  const habitGrainTrend = useMemo(() => habitDays.map(dateStr => {
    const completedCount = filteredHabits.filter(h => h.completedDates.includes(dateStr)).length;
    const rate = filteredHabits.length > 0 ? Math.round((completedCount / filteredHabits.length) * 100) : 0;
    return {
      date: formatShortDate(dateStr),
      fullDate: dateStr,
      Completed: completedCount,
      Total: filteredHabits.length,
      Rate: rate
    };
  }), [habitDays, filteredHabits]);

  // Consistency by Individual Habit
  const habitPerformanceByHabit = useMemo(() => {
    return filteredHabits.map(h => {
      const countInWindow = habitDays.filter(d => h.completedDates.includes(d)).length;
      const windowTotal = habitDays.length;
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
  }, [habitDays, filteredHabits]);

  // Habit Category Breakdown
  const habitCategoryData = useMemo(() => {
    const counts = filteredHabits.reduce((acc, h) => {
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
  }, [filteredHabits]);

  const habitWeekdayData = useMemo(() => {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels.map((day, weekday) => {
      const dueDates = habitDays.filter(date => new Date(`${date}T12:00:00`).getDay() === weekday);
      const dueCount = filteredHabits.reduce((total, habit) => {
        const scheduledDays = habit.weekdays?.length ? habit.weekdays : [0, 1, 2, 3, 4, 5, 6];
        return total + (scheduledDays.includes(weekday) ? dueDates.length : 0);
      }, 0);
      const completedCount = filteredHabits.reduce((total, habit) => {
        const scheduledDays = habit.weekdays?.length ? habit.weekdays : [0, 1, 2, 3, 4, 5, 6];
        return total + dueDates.filter(date => scheduledDays.includes(weekday) && habit.completedDates.includes(date)).length;
      }, 0);
      return { day, Rate: dueCount ? Math.round(completedCount / dueCount * 100) : 0, Completed: completedCount, Scheduled: dueCount };
    });
  }, [habitDays, filteredHabits]);

  // -------------------------------------------------------------
  // 3. DAILY TASKS ANALYTICS DATA
  // -------------------------------------------------------------
  const taskGrainTrend = useMemo(() => taskDays.map(dateStr => {
    const dayTasks = tasksInSelectedRange.filter(t => t.date === dateStr);
    const completed = dayTasks.filter(t => t.completed).length;
    const pending = dayTasks.filter(t => !t.completed).length;
    return {
      date: formatShortDate(dateStr),
      fullDate: dateStr,
      Completed: completed,
      Pending: pending,
      Total: dayTasks.length
    };
  }), [taskDays, tasksInSelectedRange]);

  const taskStatusData = useMemo(() => {
    const relevantTasks = tasksInSelectedRange;
    const completed = relevantTasks.filter(t => t.completed).length;
    const pending = relevantTasks.filter(t => !t.completed).length;
    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'Pending', value: pending, color: '#64748B' }
    ].filter(i => i.value > 0);
  }, [tasksInSelectedRange]);

  const taskPriorityData = useMemo(() => {
    const relevant = tasksInSelectedRange;
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
  }, [tasksInSelectedRange]);

  const taskCategoryData = useMemo(() => {
    const counts = tasksInSelectedRange.reduce((acc, task) => {
      const category = task.category || 'General';
      const current = acc[category] || { Completed: 0, Pending: 0 };
      if (task.completed) current.Completed++;
      else current.Pending++;
      acc[category] = current;
      return acc;
    }, {} as Record<string, { Completed: number; Pending: number }>);
    return Object.entries(counts).map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.Completed + b.Pending - a.Completed - a.Pending);
  }, [tasksInSelectedRange]);

  // -------------------------------------------------------------
  // 4. WELLNESS & SLEEP ANALYTICS DATA
  // -------------------------------------------------------------
  const wellnessTrendData = useMemo(() => {
    const visibleDays = wellnessDays.filter(dateStr => wellnessMoodFilter === 'all' || wellness[dateStr]?.mood === wellnessMoodFilter);
    return visibleDays.map(dateStr => {
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
  }, [wellnessDays, wellness, wellnessMoodFilter]);

  const wellnessMoodData = useMemo(() => {
    const colors: Record<string, string> = { great: '#10B981', good: '#06B6D4', neutral: '#64748B', low: '#F59E0B', stressed: '#F43F5E' };
    const counts = wellnessDays.reduce((result, date) => {
      const mood = wellness[date]?.mood;
      if (mood) result[mood] = (result[mood] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value, color: colors[name] }));
  }, [wellnessDays, wellness]);

  // High-level aggregate totals
  const totalTasksCompleted = tasksInSelectedRange.filter(task => task.completed).length;
  const totalPeriodSpend = expenseVelocityData.reduce((acc, d) => acc + d.Spend, 0);
  const totalPeriodIncome = expenseVelocityData.reduce((acc, d) => acc + d.Income, 0);
  const avgDailySpend = totalPeriodSpend / Math.max(expenseDays.length, 1);
  const expenseDaysLabel = expenseRange === 'custom' ? `${expenseDays.length}-day custom range` : `${expenseRange} days`;
  const taskTimeframeLabel = taskRange === 'custom' ? 'selected date range' : `the past ${taskRange} days`;

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

      </div>

      <div className="flex flex-col-reverse gap-8">
      {/* Module Selector Filter Ribbon (EXPENSE TOP / FIRST) */}
      <div aria-label="Analytics modules" className="report-module-tabs grid w-full min-w-0 grid-cols-4 items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5 text-[10px] font-medium shadow-inner dark:border-slate-700/70 dark:bg-slate-800 sm:flex sm:flex-nowrap sm:overflow-x-auto sm:text-xs">
        <button
          aria-label="All Modules Combined"
          onClick={() => setSelectedModule('all')}
          className={`col-span-full flex min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-1 py-2 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-700/80 dark:focus-visible:ring-offset-slate-800 sm:col-span-auto sm:flex-row sm:shrink-0 sm:snap-start sm:gap-1.5 sm:border-0 sm:px-3.5 ${
            selectedModule === 'all'
              ? 'border-slate-300 bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 font-semibold dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="sm:hidden">All Modules</span>
          <span className="hidden sm:inline">All Modules Combined</span>
        </button>

        <button
          aria-label="Expense Analytics & Accounts"
          onClick={() => setSelectedModule('expenses')}
          className={`col-span-1 flex min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-1 py-2 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-700/80 dark:focus-visible:ring-offset-slate-800 sm:col-span-auto sm:flex-row sm:shrink-0 sm:snap-start sm:gap-1.5 sm:border-0 sm:px-3.5 ${
            selectedModule === 'expenses'
              ? 'border-purple-300 bg-white text-purple-700 shadow-sm ring-1 ring-purple-900/5 font-semibold dark:border-purple-500/60 dark:bg-slate-900 dark:text-purple-300 dark:ring-purple-400/20'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-purple-500" />
          <span className="sm:hidden">Expenses</span>
          <span className="hidden sm:inline">Expense Analytics &amp; Accounts</span>
        </button>

        <button
          aria-label="Habit Analytics"
          onClick={() => setSelectedModule('habits')}
          className={`col-span-1 flex min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-1 py-2 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-700/80 dark:focus-visible:ring-offset-slate-800 sm:col-span-auto sm:flex-row sm:shrink-0 sm:snap-start sm:gap-1.5 sm:border-0 sm:px-3.5 ${
            selectedModule === 'habits'
              ? 'border-emerald-300 bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-900/5 font-semibold dark:border-emerald-500/60 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-400/20'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span className="sm:hidden">Habits</span>
          <span className="hidden sm:inline">Habit Analytics</span>
        </button>

        <button
          aria-label="Daily Tasks Analytics"
          onClick={() => setSelectedModule('tasks')}
          className={`col-span-1 flex min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-1 py-2 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-700/80 dark:focus-visible:ring-offset-slate-800 sm:col-span-auto sm:flex-row sm:shrink-0 sm:snap-start sm:gap-1.5 sm:border-0 sm:px-3.5 ${
            selectedModule === 'tasks'
              ? 'border-blue-300 bg-white text-blue-700 shadow-sm ring-1 ring-blue-900/5 font-semibold dark:border-blue-500/60 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-400/20'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5 text-blue-500" />
          <span className="sm:hidden">Tasks</span>
          <span className="hidden sm:inline">Daily Tasks Analytics</span>
        </button>

        <button
          aria-label="Sleep & Hydration Curves"
          onClick={() => setSelectedModule('wellness')}
          className={`col-span-1 flex min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-1 py-2 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-700/80 dark:focus-visible:ring-offset-slate-800 sm:col-span-auto sm:flex-row sm:shrink-0 sm:snap-start sm:gap-1.5 sm:border-0 sm:px-3.5 ${
            selectedModule === 'wellness'
              ? 'border-cyan-300 bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-900/5 font-semibold dark:border-cyan-500/60 dark:bg-slate-900 dark:text-cyan-300 dark:ring-cyan-400/20'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-indigo-500" />
          <span className="sm:hidden">Wellness</span>
          <span className="hidden sm:inline">Sleep &amp; Hydration Curves</span>
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
            {filteredHabits.length} <span className="text-sm font-normal text-slate-400">routines</span>
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
          <p className="text-[11px] text-slate-400 mt-2">Tasks in {taskTimeframeLabel}</p>
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
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 1: EXPENSE ANALYTICS (EXPENSE FIRST AT TOP!)            */}
      {/* ------------------------------------------------------------- */}
      {(selectedModule === 'all' || selectedModule === 'expenses') && (
        <div className="space-y-4 pt-2">
            <div className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center xl:flex-nowrap">
            <div className="flex min-w-0 items-center gap-2 xl:flex-1">
              <span className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                <DollarSign className="w-4 h-4" />
              </span>
              <h3 className="min-w-0 text-base font-bold text-slate-900 dark:text-slate-100 xl:text-lg">
                Expense Analytics: Disbursement Velocity &amp; 50/30/20 Classification
              </h3>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap xl:max-w-[68%] xl:flex-nowrap xl:overflow-x-auto">
              <select aria-label="Filter expenses by category" value={expenseCategoryFilter} onChange={event => setExpenseCategoryFilter(event.target.value)} className="min-h-10 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="all">All categories</option>
                {expenseCategories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <select aria-label="Filter expenses by account" value={expenseAccountFilter} onChange={event => setExpenseAccountFilter(event.target.value)} className="min-h-10 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="all">All accounts</option>
                {expenseAccounts.map(account => <option key={account} value={account}>{account === 'expense' ? 'Expense account' : account === 'savings' ? 'Savings account' : account === 'cash' ? 'Cash' : account}</option>)}
              </select>
              <select aria-label="Filter expenses by flow" value={expenseFlowFilter} onChange={event => setExpenseFlowFilter(event.target.value as typeof expenseFlowFilter)} className="col-span-full min-h-10 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:col-span-auto sm:w-auto">
                <option value="all">Income &amp; expenses</option>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
              </select>
              <DateRangeControl label="Expense analytics" value={expenseRange} onChange={setExpenseRange} startDate={expenseStartDate} onStartDateChange={setExpenseStartDate} endDate={expenseEndDate} onEndDateChange={setExpenseEndDate} />
            </div>
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
                    Daily outflow volume tracking spending surges across {expenseDaysLabel}
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

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:col-span-8 gap-4">
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
                <div className="h-56 lg:col-span-4">
                  {spendTypeBreakdownData.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-slate-400">No outflows to classify.</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={spendTypeBreakdownData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3}>
                          {spendTypeBreakdownData.map(item => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip formatter={(value: any) => [formatCurrency(Number(value), currSymbol), 'Amount']} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Chart 4: Cash Flow by Account */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cash Flow by Account</h4>
                <p className="text-xs text-slate-400">Compare income and expenses across your selected accounts</p>
              </div>
              <div className="h-56 w-full">
                {expenseAccountData.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-slate-400">No transactions match these filters.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseAccountData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="account" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value), currSymbol)]} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Expense" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
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
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between xl:flex-nowrap">
            <div className="flex min-w-0 items-center gap-2 xl:flex-1">
              <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                <Flame className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 xl:text-lg">
                Habit Analytics: Completion Consistency &amp; Streaks
              </h3>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap xl:max-w-[68%] xl:flex-nowrap xl:overflow-x-auto">
              <DateRangeControl label="Habit analytics" value={habitRange} onChange={setHabitRange} startDate={habitStartDate} onStartDateChange={setHabitStartDate} endDate={habitEndDate} onEndDateChange={setHabitEndDate} />
              <select aria-label="Filter habits by category" value={habitCategoryFilter} onChange={event => setHabitCategoryFilter(event.target.value)} className="col-span-full min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:col-span-auto sm:w-auto">
                <option value="all">All categories</option>
                {habitCategories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Habit Completion Consistency Rate Area/Bar Chart */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Daily Habit Completion Consistency
                  </h4>
                  <p className="text-xs text-slate-400">
                    Habit completion consistency for each day in this range
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
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

            {/* Chart 4: Weekday Habit Consistency */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Consistency by Weekday</h4>
                <p className="text-xs text-slate-400">Completion rate on scheduled days within the selected date range</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={habitWeekdayData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(value: any, name: any, item: any) => [name === 'Rate' ? `${value}% (${item.payload.Completed}/${item.payload.Scheduled})` : value, name === 'Rate' ? 'Completion rate' : name]} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                    <Bar dataKey="Rate" name="Completion Rate" fill="#10B981" radius={[4, 4, 0, 0]} />
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
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between xl:flex-nowrap">
            <div className="flex min-w-0 items-center gap-2 xl:flex-1">
              <span className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                <ListTodo className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 xl:text-lg">
                Daily Tasks Analytics: Completion Consistency &amp; Status Share
              </h3>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap xl:max-w-[68%] xl:flex-nowrap xl:overflow-x-auto">
              <DateRangeControl label="Task analytics" value={taskRange} onChange={setTaskRange} startDate={taskStartDate} onStartDateChange={setTaskStartDate} endDate={taskEndDate} onEndDateChange={setTaskEndDate} />
              <select aria-label="Filter tasks by category" value={taskCategoryFilter} onChange={event => setTaskCategoryFilter(event.target.value)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="all">All categories</option>
                {taskCategories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <select aria-label="Filter tasks by priority" value={taskPriorityFilter} onChange={event => setTaskPriorityFilter(event.target.value as typeof taskPriorityFilter)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="all">All priorities</option>
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
              <select aria-label="Filter tasks by status" value={taskStatusFilter} onChange={event => setTaskStatusFilter(event.target.value as typeof taskStatusFilter)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Tasks Stacked Execution Bar Chart */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Daily Task Execution
                </h4>
                <p className="text-xs text-slate-400">
                  Completed and pending tasks for each day in this range
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

            {/* Chart 4: Task Category Breakdown */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tasks by Category</h4>
                <p className="text-xs text-slate-400">Completed and pending tasks in each category for the selected filters</p>
              </div>
              <div className="h-64 w-full">
                {taskCategoryData.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-slate-400">No tasks match these filters.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskCategoryData} margin={{ top: 10, right: 10, left: -20, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Completed" stackId="task-category" fill="#10B981" radius={[0, 0, 2, 2]} />
                      <Bar dataKey="Pending" stackId="task-category" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
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
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between xl:flex-nowrap">
            <div className="flex min-w-0 items-center gap-2 xl:flex-1">
              <span className="p-1 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600">
                <Moon className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 xl:text-lg">
                Wellness Analytics: Sleep vs. Hydration Curves
              </h3>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap xl:max-w-[68%] xl:flex-nowrap xl:overflow-x-auto">
              <select aria-label="Select wellness chart metric" value={wellnessMetric} onChange={event => setWellnessMetric(event.target.value as typeof wellnessMetric)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="sleep_water">Sleep &amp; water</option>
                <option value="sleep">Sleep hours</option>
                <option value="water">Water intake</option>
                <option value="energy">Energy score</option>
              </select>
              <select aria-label="Filter wellness by mood" value={wellnessMoodFilter} onChange={event => setWellnessMoodFilter(event.target.value as typeof wellnessMoodFilter)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto">
                <option value="all">All moods</option>
                <option value="great">Great</option>
                <option value="good">Good</option>
                <option value="neutral">Neutral</option>
                <option value="low">Low</option>
                <option value="stressed">Stressed</option>
              </select>
              <DateRangeControl label="Wellness analytics" value={wellnessRange} onChange={setWellnessRange} startDate={wellnessStartDate} onStartDateChange={setWellnessStartDate} endDate={wellnessEndDate} onEndDateChange={setWellnessEndDate} />
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {wellnessMetric === 'energy' ? 'Daily Energy Score Trend' : wellnessMetric === 'sleep' ? 'Daily Sleep Hours' : wellnessMetric === 'water' ? 'Daily Water Intake' : 'Sleep Hours vs. Water Hydration (Liters)'}
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
                  {(wellnessMetric === 'sleep_water' || wellnessMetric === 'sleep') && <Line
                    type="monotone"
                    dataKey="SleepHours"
                    name="Sleep (Hours)"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />}
                  {(wellnessMetric === 'sleep_water' || wellnessMetric === 'water') && <Line
                    type="monotone"
                    dataKey="WaterLiters"
                    name="Water Hydration (Liters)"
                    stroke="#06B6D4"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />}
                  {wellnessMetric === 'energy' && <Line
                    type="monotone"
                    dataKey="EnergyScore"
                    name="Energy Score (1–5)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mood Distribution</h4>
              <p className="text-xs text-slate-400">Daily mood logs in the selected date range</p>
            </div>
            <div className="h-60 w-full flex items-center justify-center">
              {wellnessMoodData.length === 0 ? <p className="text-xs text-slate-400">No mood entries in this range.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={wellnessMoodData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                      {wellnessMoodData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
