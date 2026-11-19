import React, { useState, useEffect } from 'react';
import { formatHabitTime } from '../utils/habitTime';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Plus,
  Droplet,
  Moon,
  Smile,
  Zap,
  BookOpen,
  Calendar,
  Clock,
  Sparkles,
  LoaderCircle,
  Wallet,
  ListTodo
} from 'lucide-react';
import { Habit, DailyTask, DailyWellness, Expense, MoodType, BudgetConfig, WellnessGoals } from '../types';
import { normalizeWellnessGoals } from '../utils/wellnessGoals';
import { orderTasks } from '../utils/taskOrder';
import { orderHabits } from '../utils/habitOrder';
import { getAccountBalance } from '../utils/accounts';
import { formatCurrency, formatDate, CATEGORIES } from '../utils/constants';
import { WellnessNotes } from './WellnessNotes';

interface DailyOverviewProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  habits: Habit[];
  tasks: DailyTask[];
  savingKeys?: Set<string>;
  wellness: Record<string, DailyWellness>;
  expenses: Expense[];
  budget: BudgetConfig;
  onToggleHabit: (habitId: string, date: string) => void;
  onToggleTask: (taskId: string) => void | boolean | Promise<boolean>;
  onAddTask: (task: Omit<DailyTask, 'id' | 'completed'>) => void | boolean | Promise<void | boolean>;
  onOpenAddTask?: () => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateWellness: (date: string, data: Partial<DailyWellness>) => void;
  onQuickLogExpense: () => void;
  onOpenAddHabit: () => void;
  wellnessGoals?: WellnessGoals;
  taskOrder?: string[];
  habitOrder?: string[];
}

const MOODS: { type: MoodType; label: string; icon: string; color: string }[] = [
  { type: 'great', label: 'Great', icon: '😄', color: 'text-emerald-500' },
  { type: 'good', label: 'Good', icon: '🙂', color: 'text-blue-500' },
  { type: 'neutral', label: 'Neutral', icon: '😐', color: 'text-slate-400' },
  { type: 'low', label: 'Low', icon: '😔', color: 'text-amber-500' },
  { type: 'stressed', label: 'Stressed', icon: '😫', color: 'text-rose-500' }
];

const OverviewItemList: React.FC<{ count: number; label: string; children: React.ReactNode; sharedHeight?: number; onMeasure: (height: number) => void }> = ({ count, label, children, sharedHeight, onMeasure }) => {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || count <= 15) {
      setHeight(undefined);
      return;
    }
    const measure = () => {
      const lastVisible = list.children.item(14);
      if (lastVisible) {
        const measured = lastVisible.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop;
        setHeight(measured);
        onMeasure(measured);
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(list);
    Array.from(list.children).slice(0, 15).forEach(child => observer?.observe(child));
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [count, children, onMeasure]);

  return <div ref={listRef} role={count > 15 ? 'region' : undefined} aria-label={count > 15 ? label : undefined} tabIndex={count > 15 ? 0 : undefined} className="space-y-2 overflow-y-auto" style={count > 15 && height !== undefined ? { maxHeight: sharedHeight ?? height, ...(sharedHeight ? { height: sharedHeight } : {}) } : undefined}>{children}</div>;
};

export const DailyOverview: React.FC<DailyOverviewProps> = ({
  selectedDate,
  onSelectDate,
  habits,
  tasks,
  savingKeys,
  wellness,
  expenses,
  budget,
  onToggleHabit,
  onToggleTask,
  onAddTask,
  onOpenAddTask,
  onUpdateWellness,
  onQuickLogExpense,
  onOpenAddHabit,
  wellnessGoals,
  taskOrder,
  habitOrder
}) => {
  const [taskSearch, setTaskSearch] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all');
  const [habitSearch, setHabitSearch] = useState('');
  const [habitListHeight, setHabitListHeight] = useState(0);
  const [taskListHeight, setTaskListHeight] = useState(0);
  const [habitCategoryFilter, setHabitCategoryFilter] = useState('all');
  const [habitStatusFilter, setHabitStatusFilter] = useState('all');

  const todayIso = formatDate(new Date());
  const isToday = selectedDate === todayIso;
  const accountBalances = (['expense', 'cash', 'savings'] as const).map(account => ({ account, balance: getAccountBalance(expenses, account, todayIso) }));
  const totalAccountBalance = accountBalances.reduce((total, item) => total + item.balance, 0);
  const latestTransaction = expenses.filter(item => item.date <= todayIso).reduce<Expense | undefined>((latest, item) =>
    !latest || item.date > latest.date || (item.date === latest.date && item.createdAt > latest.createdAt) ? item : latest, undefined);
  const negativeAccountCount = accountBalances.filter(({ balance }) => balance < 0).length;

  const availableTaskCategories = React.useMemo(() => {
    const defaults = ['General', 'Work', 'Personal', 'Health', 'Finance', 'Errands', 'Learning'];
    const existing = tasks.map(t => t.category).filter(Boolean) as string[];
    return Array.from(new Set([...defaults, ...existing]));
  }, [tasks]);

  // Selected date object
  const currentDateObj = new Date(selectedDate + 'T00:00:00');

  // Format header date
  const formattedHeaderDate = currentDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Calculate 7-day strip
  const dateStrip = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(currentDateObj);
    d.setDate(d.getDate() - (3 - idx));
    const iso = formatDate(d);
    return {
      iso,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isCurrent: iso === selectedDate,
      isRealToday: iso === todayIso
    };
  });

  // Navigate date
  const changeDateBy = (days: number) => {
    const d = new Date(currentDateObj);
    d.setDate(d.getDate() + days);
    onSelectDate(formatDate(d));
  };

  // Day's specific records
  const dayExpenses = expenses.filter(e => e.date === selectedDate);
  const isTransferEntry = (expense: Expense) => expense.isTransfer || expense.category.toLowerCase().includes('transfer');
  const dayOutflow = dayExpenses.filter(e => !isTransferEntry(e) && (e.type || 'expense') === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const dayInflow = dayExpenses.filter(e => !isTransferEntry(e) && e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const dayTransfers = dayExpenses.filter(isTransferEntry).reduce((sum, e) => sum + e.amount, 0);
  const dayTotalSpent = dayOutflow; // for backwards compatibility calculations
  const dailyTargetBalance = Math.round(((budget.dailyBudget || budget.monthlyBudget / 30) - dayOutflow) * 100) / 100;

  const dayTasks = (taskOrder?.length ? orderTasks(tasks, taskOrder) : tasks).filter(t => t.date === selectedDate);
  const filteredDayTasks = dayTasks.filter(task => task.title.toLowerCase().includes(taskSearch.trim().toLowerCase()) && (taskPriorityFilter === 'all' || task.priority === taskPriorityFilter) && (taskCategoryFilter === 'all' || (task.category || 'General') === taskCategoryFilter));
  const completedTasksCount = dayTasks.filter(t => t.completed).length;

  const selectedWeekday = new Date(`${selectedDate}T00:00:00`).getDay();
  const habitsForSelectedDay = orderHabits(habits, habitOrder).filter(habit =>
    (habit.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(selectedWeekday)
  ).sort((a, b) =>
    Number(a.completedDates.includes(selectedDate)) - Number(b.completedDates.includes(selectedDate))
  );
  const habitCategories = Array.from(new Set(habits.map(habit => habit.category).filter(Boolean))).sort();
  const filteredHabits = habitsForSelectedDay.filter(habit => habit.title.toLowerCase().includes(habitSearch.trim().toLowerCase()) && (habitCategoryFilter === 'all' || habit.category === habitCategoryFilter) && (habitStatusFilter === 'all' || (habitStatusFilter === 'completed') === habit.completedDates.includes(selectedDate)));
  const sharedListHeight = filteredHabits.length > 15 && filteredDayTasks.length > 15 && habitListHeight && taskListHeight ? Math.max(habitListHeight, taskListHeight) : undefined;
  const completedHabitsCount = habitsForSelectedDay.filter(habit => habit.completedDates.includes(selectedDate)).length;
  const nextHabit = habitsForSelectedDay.find(habit => !habit.completedDates.includes(selectedDate));
  const nextTask = dayTasks.find(task => !task.completed);

  const dayWellness: DailyWellness = wellness[selectedDate] || {
    date: selectedDate,
    mood: undefined,
    waterGlasses: 0,
    sleepHours: 3,
    energyScore: 0,
    journalNotes: '',
    gratitude: ''
  };
  const [waterGlassesDraft, setWaterGlassesDraft] = useState<number | null>(null);
  const waterGlasses = waterGlassesDraft ?? dayWellness.waterGlasses ?? 0;
  const goals = normalizeWellnessGoals(wellnessGoals);

  useEffect(() => {
    setWaterGlassesDraft(wellness[selectedDate]?.waterGlasses ?? 0);
  }, [selectedDate, wellness[selectedDate]?.waterGlasses]);

  // Water helper
  const adjustWater = (delta: number) => {
    const next = Math.max(0, Math.min(20, waterGlasses + delta));
    setWaterGlassesDraft(next);
    onUpdateWellness(selectedDate, { waterGlasses: next });
  };

  return (
    <div className="space-y-8">
      {/* Date Header & 7-Day Quick Strip */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formattedHeaderDate}
                </h2>
                {isToday && (
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">
                    Today
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily execution rhythm · Habitation, tasks, wellness & spend
              </p>
            </div>

            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isToday && (
              <button
                onClick={() => onSelectDate(todayIso)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Jump to Today
              </button>
            )}

            <input
              type="date"
              value={selectedDate}
              onChange={e => e.target.value && onSelectDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {/* 7-Day Strip with multi-metric status dots */}
        <div className="grid grid-cols-7 gap-2 pt-4">
          {dateStrip.map(item => {
            const itemWeekday = new Date(`${item.iso}T00:00:00`).getDay();
            const habitsForDay = habits.filter(habit =>
              (habit.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(itemWeekday)
            );
            const habitsDoneForDay = habitsForDay.filter(habit => habit.completedDates.includes(item.iso)).length;
            const tasksDoneForDay = tasks.filter(t => t.date === item.iso && t.completed).length;
            const spendForDay = expenses.filter(e => e.date === item.iso).reduce((sum, e) => sum + e.amount, 0);

            return (
              <button
                key={item.iso}
                onClick={() => onSelectDate(item.iso)}
                className={`py-3 px-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                  item.isCurrent
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-md font-semibold ring-2 ring-slate-900/10 dark:ring-white/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold tracking-wider opacity-75">{item.dayName}</span>
                <span className="text-base font-mono font-bold tabular-nums mt-0.5">{item.dayNumber}</span>
                
                {/* Status dots row */}
                <div className="flex items-center gap-1 mt-1.5 h-1.5">
                  {habitsDoneForDay > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isCurrent ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-emerald-500'
                      }`}
                      title={`${habitsDoneForDay} habits checked`}
                    />
                  )}
                  {tasksDoneForDay > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isCurrent ? 'bg-sky-400 dark:bg-sky-600' : 'bg-sky-500'
                      }`}
                      title={`${tasksDoneForDay} tasks completed`}
                    />
                  )}
                  {spendForDay > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isCurrent ? 'bg-violet-300 dark:bg-violet-700' : 'bg-violet-500'
                      }`}
                      title={`$${Math.round(spendForDay)} spent`}
                    />
                  )}
                  {habitsDoneForDay === 0 && tasksDoneForDay === 0 && spendForDay === 0 && (
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 opacity-40" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Snapshot Cards - Expense First */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Today's Finance & Accounts Snapshot (EXPENSE FIRST) */}
        <div className="grid min-w-0 row-span-5 grid-rows-subgrid gap-y-2 px-4 py-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-emerald-500" />Daily Finances
              </span>
              <span className="font-mono text-[11px] text-slate-400">{dayExpenses.length} txns</span>
            </div>
            <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200/80 bg-slate-50/80 py-1.5 dark:divide-slate-700 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="min-w-0 px-1.5 text-center">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Outflow</span>
                <span className="mt-0.5 block whitespace-nowrap text-[clamp(0.58rem,2.7vw,0.75rem)] font-bold font-mono tabular-nums text-rose-700 dark:text-rose-300">{formatCurrency(dayOutflow, budget.currency)}</span>
              </div>
              <div className="min-w-0 px-1.5 text-center">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Inflow</span>
                <span className="mt-0.5 block whitespace-nowrap text-[clamp(0.58rem,2.7vw,0.75rem)] font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(dayInflow, budget.currency)}</span>
              </div>
              <div className="min-w-0 px-1.5 text-center">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Transfer</span>
                <span className="mt-0.5 block whitespace-nowrap text-[clamp(0.58rem,2.7vw,0.75rem)] font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(dayTransfers, budget.currency)}</span>
              </div>
            </div>
          </div>
          <div className="w-full shrink-0 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                dayOutflow > (budget.dailyBudget || budget.monthlyBudget / 30) ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{
                width: `${Math.min(100, (dayOutflow / Math.max(1, budget.dailyBudget || budget.monthlyBudget / 30)) * 100)}%`
              }}
            />
          </div>
          <div className="grid min-w-0 row-span-3 grid-rows-subgrid gap-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{dailyTargetBalance < 0 ? 'Over target' : dailyTargetBalance > 0 ? 'Remaining balance' : 'On target'}</span>
              <strong className={`break-words text-lg font-semibold tabular-nums ${dailyTargetBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(Math.abs(dailyTargetBalance), budget.currency)}</strong>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{Math.round(dayOutflow / Math.max(1, budget.dailyBudget || budget.monthlyBudget / 30) * 100)}% of daily target used</p>
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80 text-xs text-slate-500">
              <span className="text-[10px]">Target {formatCurrency(budget.dailyBudget || budget.monthlyBudget / 30, budget.currency)}</span>
              <button
                onClick={onQuickLogExpense}
                className="inline-flex min-h-8 items-center rounded-md text-[11px] font-semibold text-blue-600 transition-colors hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Log Finance
              </button>
            </div>
          </div>
        </div>

        {/* Current account balances */}
        <div className="grid min-w-0 row-span-5 grid-rows-subgrid gap-y-2 px-4 py-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="min-w-0">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Wallet className="h-3.5 w-3.5 text-blue-500" />Total Balance</span>
            <div className="mt-2 flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className={`h-8 w-1 shrink-0 rounded-full ${totalAccountBalance < 0 ? 'bg-rose-500' : 'bg-blue-500'}`} />
              <span className={`min-w-0 break-words text-3xl font-bold leading-none tracking-tight tabular-nums ${totalAccountBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(totalAccountBalance, budget.currency)}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Across all accounts as of today</p>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="flex min-w-0 row-span-3 flex-col gap-2">
            {accountBalances.map(({ account, balance }) => <div key={account} className="flex min-w-0 items-center justify-between gap-2 text-[11px]"><span className="inline-flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${account === 'expense' ? 'bg-blue-500' : account === 'cash' ? 'bg-amber-500' : 'bg-emerald-500'}`} />{account === 'cash' ? 'Cash in hand' : account === 'savings' ? 'Savings account' : 'Expense account'}</span><span className={`break-all text-right font-semibold tabular-nums ${balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>{formatCurrency(balance, budget.currency)}</span></div>)}
            <div className="mt-auto border-t border-slate-100 pt-2 text-[10px] dark:border-slate-800/80">
              {latestTransaction ? (
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-500 dark:text-slate-400" title={latestTransaction.title}>Latest · {latestTransaction.title}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${latestTransaction.isTransfer || latestTransaction.category.toLowerCase().includes('transfer') ? 'text-slate-600 dark:text-slate-300' : latestTransaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {latestTransaction.isTransfer || latestTransaction.category.toLowerCase().includes('transfer') ? '' : latestTransaction.type === 'income' ? '+' : '−'}{formatCurrency(latestTransaction.amount, budget.currency)}
                  </span>
                </div>
              ) : <span className="text-slate-500 dark:text-slate-400">No transactions yet</span>}
              {negativeAccountCount > 0 && <p className="mt-1 font-medium text-rose-600 dark:text-rose-400">{negativeAccountCount} {negativeAccountCount === 1 ? 'account is' : 'accounts are'} negative</p>}
            </div>
          </div>
        </div>

        {/* 2. Habit Completion */}
        <div className="grid min-w-0 row-span-5 grid-rows-subgrid gap-y-2 px-4 py-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Habits Consistency</span>
              <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {habitsForSelectedDay.length > 0 ? Math.round((completedHabitsCount / habitsForSelectedDay.length) * 100) : 0}%
              </span>
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {completedHabitsCount} <span className="text-sm text-slate-400 font-normal">/ {habitsForSelectedDay.length}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Habits completed</p>
          </div>
          <div className="w-full shrink-0 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${habitsForSelectedDay.length > 0 ? (completedHabitsCount / habitsForSelectedDay.length) * 100 : 0}%`
              }}
            />
          </div>
          <div className="grid min-w-0 row-span-3 grid-rows-subgrid gap-y-1">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{nextHabit ? 'Next habit' : habitsForSelectedDay.length ? 'All done' : 'No habits scheduled'}</p>
              {nextHabit && <div className="mt-0.5 flex min-w-0 items-start gap-2"><span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: nextHabit.color }} /><p className="min-w-0 line-clamp-2 break-words text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{nextHabit.title}</p></div>}
            </div>
            <div className="min-w-0">{nextHabit?.category && <dl className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[10px]"><dt className="text-slate-400 dark:text-slate-500">Category</dt><dd className="break-words font-medium text-slate-600 dark:text-slate-300">{nextHabit.category}</dd></dl>}</div>
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400">
              <span>{habitsForSelectedDay.length - completedHabitsCount} remaining</span>
            </div>
          </div>
        </div>

        {/* 3. Priority Tasks */}
        <div className="grid min-w-0 row-span-5 grid-rows-subgrid gap-y-2 px-4 py-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><ListTodo className="h-3.5 w-3.5 text-sky-500" />Tasks Throughput</span>
              <span className="font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                {dayTasks.length > 0 ? Math.round((completedTasksCount / dayTasks.length) * 100) : 0}%
              </span>
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {completedTasksCount} <span className="text-sm text-slate-400 font-normal">/ {dayTasks.length}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Tasks completed</p>
          </div>
          <div className="w-full shrink-0 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{
                width: `${dayTasks.length > 0 ? (completedTasksCount / dayTasks.length) * 100 : 0}%`
              }}
            />
          </div>
          <div className="grid min-w-0 row-span-3 grid-rows-subgrid gap-y-1">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">{nextTask ? 'Next task' : dayTasks.length ? 'All done' : 'No tasks scheduled'}</p>
              {nextTask && <div className="mt-0.5 flex min-w-0 items-start gap-2"><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${nextTask.priority === 'high' ? 'bg-rose-500' : nextTask.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} /><p className="min-w-0 line-clamp-2 break-words text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{nextTask.title}</p></div>}
            </div>
            <div className="min-w-0">{nextTask && <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10px]">
              <div className="flex items-baseline gap-1.5"><dt className="text-slate-400 dark:text-slate-500">Priority</dt><dd className={`font-semibold capitalize ${nextTask.priority === 'high' ? 'text-rose-500' : nextTask.priority === 'medium' ? 'text-amber-500' : 'text-slate-400'}`}>{nextTask.priority}</dd></div>
              {nextTask.timeEstimateMin != null && nextTask.timeEstimateMin > 0 && <div className="flex items-baseline gap-1.5"><dt className="text-slate-400 dark:text-slate-500">Time</dt><dd className="font-medium tabular-nums text-slate-600 dark:text-slate-300">{nextTask.timeEstimateMin} min</dd></div>}
            </dl>}</div>
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400">
              <span>{dayTasks.length - completedTasksCount} pending</span>
              <span className="text-[10px] text-slate-400">{dayTasks.filter(t => t.priority === 'high' && !t.completed).length} high priority</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Habits, Tasks & Wellness */}
      <div className="grid grid-cols-1 items-stretch lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 lg:min-w-0">
          {/* Card: Daily Wellness & Mood */}
          <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="mb-3 sm:mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Daily Wellness Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Physical and mental state check-in
              </p>
            </div>

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
            {/* Mood selector buttons */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 sm:p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 sm:mb-2">
                Today&apos;s Mood
              </label>
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                {MOODS.map(m => (
                  <button
                    key={m.type}
                    onClick={() => onUpdateWellness(selectedDate, { mood: dayWellness.mood === m.type ? undefined : m.type })}
                    aria-pressed={dayWellness.mood === m.type}
                    aria-label={m.label}
                    className={`min-w-0 min-h-11 sm:min-h-14 py-1 sm:py-2 px-1 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      dayWellness.mood === m.type
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg leading-none">{m.icon}</span>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>


            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="col-span-2 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Energy</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-bold tabular-nums">
                    {dayWellness.energyScore || '—'} / 5
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => onUpdateWellness(selectedDate, { energyScore: dayWellness.energyScore === score ? 0 : score })}
                      aria-label={`Energy level ${score}`}
                      aria-pressed={dayWellness.energyScore === score}
                      className={`flex-1 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                        dayWellness.energyScore === score
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Sleep</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-bold tabular-nums">
                    {dayWellness.sleepHours ?? 3}h
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Target: {goals.sleepHours} hrs</p>
                <div role="progressbar" aria-label="Sleep target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((dayWellness.sleepHours ?? 3) / goals.sleepHours * 100))} className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (dayWellness.sleepHours ?? 3) / goals.sleepHours * 100)}%` }} />
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() =>
                      onUpdateWellness(selectedDate, {
                        sleepHours: Math.max(0, (dayWellness.sleepHours ?? 3) - 0.5)
                      })
                    }
                    className="flex-1 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    -0.5
                  </button>
                  <button
                    onClick={() =>
                      onUpdateWellness(selectedDate, {
                        sleepHours: Math.min(16, (dayWellness.sleepHours ?? 3) + 0.5)
                      })
                    }
                    className="flex-1 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    +0.5
                  </button>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 p-2 sm:p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200"><Droplet className="h-3.5 w-3.5 text-blue-500" />Hydration</span>
                  <span className="whitespace-nowrap font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">{(waterGlasses * 250).toLocaleString()} ml</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Target: {goals.waterMl.toLocaleString()} ml</p>
                <div role="progressbar" aria-label="Hydration target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(waterGlasses * 250 / goals.waterMl * 100))} className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, waterGlasses * 250 / goals.waterMl * 100)}%` }} />
                </div>
                <div className="mt-2 flex gap-1">
                  <button type="button" onClick={() => adjustWater(-1)} disabled={waterGlasses <= 0} aria-label="Remove one glass of water" className="flex-1 rounded border border-slate-200 bg-white py-1 text-xs text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">-</button>
                  <button type="button" onClick={() => adjustWater(1)} disabled={waterGlasses >= 20} aria-label="Add one glass of water" className="flex-1 rounded border border-blue-200 bg-blue-50 py-1 text-xs font-semibold text-blue-600 disabled:opacity-40 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">+250</button>
                  <button type="button" onClick={() => adjustWater(2)} disabled={waterGlasses >= 20} aria-label="Add two glasses of water" className="flex-1 rounded border border-slate-200 bg-white py-1 text-xs text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">+500</button>
                </div>
              </div>
            </div>

            </div>
            <div className="min-w-0">
            {/* Gratitude & Journal notes */}
            <WellnessNotes key={selectedDate}
              accent="blue"
              fillHeight
              footerText="Take a moment for yourself."
              gratitude={dayWellness.gratitude ?? ''}
              journalNotes={dayWellness.journalNotes ?? ''}
              onSave={notes => onUpdateWellness(selectedDate, notes)}
            />
            </div>
            </div>
          </div>
        </div>
        {/* Left Column (Habits) */}
        <div className="lg:col-span-7 lg:h-full lg:min-w-0">
          {/* Card: Daily Habits Checklist */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs lg:flex lg:h-full lg:min-w-0 lg:flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Daily Habits Checklist
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Consistent actions that compound daily
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <input type="search" aria-label="Search habits" placeholder="Search habits..." value={habitSearch} onChange={e => setHabitSearch(e.target.value)} className="min-w-0 flex-1 basis-40 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100" />
              <select aria-label="Filter habits by status" value={habitStatusFilter} onChange={e => setHabitStatusFilter(e.target.value)} className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"><option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option></select>
              <select aria-label="Filter habits by category" value={habitCategoryFilter} onChange={e => setHabitCategoryFilter(e.target.value)} className="min-w-0 max-w-40 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"><option value="all">All categories</option>{habitCategories.map(category => <option key={category} value={category}>{category}</option>)}</select>
              <button type="button" onClick={onOpenAddHabit} className="inline-flex items-center justify-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white whitespace-nowrap cursor-pointer"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add Habit</button>
            </div>

            <div className="space-y-2.5 lg:flex lg:flex-1 lg:flex-col">
              {filteredHabits.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 lg:flex lg:flex-1 lg:items-center lg:justify-center">
                  {habits.length === 0
                    ? 'No habits added yet. Click "Add Habit" to establish your routine.'
                    : habitsForSelectedDay.length === 0 ? 'No habits are scheduled for this day.' : 'No habits match these filters.'}
                </div>
              ) : (
                <OverviewItemList count={filteredHabits.length} label="Habits list" sharedHeight={sharedListHeight} onMeasure={setHabitListHeight}>
                {filteredHabits.map(habit => {
                  const isChecked = habit.completedDates.includes(selectedDate);
                  const isSavingHabit = savingKeys?.has(`habit:${habit.id}:${selectedDate}`);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => onToggleHabit(habit.id, selectedDate)}
                      disabled={Boolean(isSavingHabit)}
                      aria-label={isSavingHabit ? `Saving ${habit.title}` : `${isChecked ? 'Mark incomplete' : 'Mark complete'}: ${habit.title}`}
                      aria-pressed={isChecked}
                      className={`w-full p-3 rounded-xl border transition-all cursor-pointer disabled:cursor-wait flex items-center justify-between text-left ${
                        isChecked
                          ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 text-slate-400 transition-colors">
                          {isSavingHabit ? (
                            <LoaderCircle className="w-5 h-5 animate-spin text-emerald-500" />
                          ) : isChecked ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <span
                            className={`text-xs font-medium block truncate ${
                              isChecked
                                ? 'line-through text-slate-500 dark:text-slate-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {habit.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden="true" />{habit.category}</span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Target {habit.targetDaysPerWeek}d/wk</span>
                            {habit.startTime && habit.endTime && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <Clock className="h-3 w-3 text-blue-500" aria-hidden="true" />
                                {formatHabitTime(habit.startTime, habit.endTime)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                        <span className="text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                          🔥 {habit.streak}d streak
                        </span>
                      </div>
                    </button>
                  );
                })}
                </OverviewItemList>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Priority Tasks) */}
        <div className="lg:col-span-5 lg:h-full lg:min-w-0">
          {/* Card: Daily Tasks & Priorities */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs lg:flex lg:h-full lg:min-w-0 lg:flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Priorities & Action Items
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Focus on high-leverage outcomes for {formattedHeaderDate}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <input type="search" aria-label="Search tasks" placeholder="Search tasks..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} className="min-w-0 w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100" />
              <select aria-label="Filter by priority" value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)} className="min-w-0 flex-1 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200">
                <option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
              <select aria-label="Filter by category" value={taskCategoryFilter} onChange={e => setTaskCategoryFilter(e.target.value)} className="min-w-0 flex-1 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200">
                <option value="all">All categories</option>{availableTaskCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button type="button" onClick={onOpenAddTask} className="inline-flex items-center justify-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white whitespace-nowrap cursor-pointer"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add Task</button>
            </div>

            {/* Task list */}
            <div className="space-y-2 lg:flex lg:flex-1 lg:flex-col">
              {filteredDayTasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl lg:flex lg:min-h-28 lg:flex-1 lg:items-center lg:justify-center lg:px-4">
                  No tasks match these filters for this date.
                </div>
              ) : (
                <OverviewItemList count={filteredDayTasks.length} label="Tasks list" sharedHeight={sharedListHeight} onMeasure={setTaskListHeight}>
                {filteredDayTasks.map(task => {
                  const isSavingTask = savingKeys?.has(`task:${task.id}`);
                  return (
                  <div
                    key={task.id}
                    className={`px-3 py-2 rounded-xl border grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 transition-colors ${
                      task.completed
                        ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        disabled={Boolean(isSavingTask)}
                        aria-label={isSavingTask ? 'Saving task status' : task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                        className="row-span-2 shrink-0 self-center text-slate-400 hover:scale-110 active:scale-95 transition-all cursor-pointer disabled:cursor-wait"
                      >
                        {isSavingTask ? <LoaderCircle className="h-4.5 w-4.5 animate-spin text-sky-500" /> : task.completed ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <Circle className="w-4.5 h-4.5 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                      <span
                        className={`min-w-0 break-words text-xs font-medium ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={task.category || 'General'}>
                        {task.category || 'General'}
                      </span>
                      <span
                        className={`shrink-0 text-[10px] capitalize px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md font-semibold flex items-center gap-1 ${
                          task.priority === 'high'
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40'
                            : task.priority === 'medium'
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          task.priority === 'high' ? 'bg-rose-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                        <span>{task.priority}</span>
                      </span>
                      {(task.startTime && task.endTime || task.timeEstimateMin) && (
                        <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md bg-slate-100/80 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                          <Clock className="h-3 w-3 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                          {task.startTime && task.endTime && <span className="font-medium">{formatHabitTime(task.startTime, task.endTime)}</span>}
                          {task.timeEstimateMin && <span className="text-slate-500 dark:text-slate-400"><span aria-hidden="true">{task.startTime && task.endTime ? '· ' : ''}</span><span className="sr-only">Duration: </span>{task.timeEstimateMin} min</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })}
                </OverviewItemList>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Main Section: Financial Ledger */}
      <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                Primary Financial Overview
              </span>
              <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                Day&apos;s Financial Log &amp; Accounts
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 mt-2 sm:mt-1">
              Expenses from Expense Account &amp; Incomes/Transfers from Savings Account for {formattedHeaderDate}
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:gap-3">
            <div className="shrink-0 text-left text-xs font-mono sm:text-right">
              <div className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                Outflow: <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(dayOutflow, budget.currency)}</span>
              </div>
              {dayInflow > 0 && (
                <div className="whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-bold">
                  Inflow: +{formatCurrency(dayInflow, budget.currency)}
                </div>
              )}
            </div>
            <button
              onClick={onQuickLogExpense}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 sm:px-3.5 sm:py-2 hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Transaction</span>
            </button>
          </div>
        </div>

        {/* Transactions list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dayExpenses.length === 0 ? (
            <div className="col-span-full text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No financial transactions logged for this date. Click &quot;Log Transaction&quot; above to add income or expense.
            </div>
          ) : (
            dayExpenses.map(item => {
              const isIncome = item.type === 'income';
              const isSavings = item.account === 'savings';
              const catColor = isIncome ? '#10B981' : (CATEGORIES[item.category]?.color || '#94A3B8');

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isIncome
                      ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="truncate">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.category} · <span className="font-mono">{isSavings ? '🏦 Savings' : '💳 Expense Acc'}</span>
                        {item.isTransfer && <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1">(Transfer)</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-bold tabular-nums text-sm ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(item.amount, budget.currency)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {item.paymentMethod || 'UPI'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
