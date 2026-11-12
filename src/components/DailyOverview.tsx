import React, { useState, useEffect } from 'react';
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
  DollarSign,
  Calendar,
  Sparkles,
  Trash2,
  LoaderCircle
} from 'lucide-react';
import { Habit, DailyTask, DailyWellness, Expense, MoodType, BudgetConfig } from '../types';
import { formatCurrency, formatDate, CATEGORIES } from '../utils/constants';

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
  onAddTask: (task: Omit<DailyTask, 'id' | 'completed'>) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateWellness: (date: string, data: Partial<DailyWellness>) => void;
  onQuickLogExpense: () => void;
  onOpenAddHabit: () => void;
}

const MOODS: { type: MoodType; label: string; icon: string; color: string }[] = [
  { type: 'great', label: 'Great', icon: '😄', color: 'text-emerald-500' },
  { type: 'good', label: 'Good', icon: '🙂', color: 'text-blue-500' },
  { type: 'neutral', label: 'Neutral', icon: '😐', color: 'text-slate-400' },
  { type: 'low', label: 'Low', icon: '😔', color: 'text-amber-500' },
  { type: 'stressed', label: 'Stressed', icon: '😫', color: 'text-rose-500' }
];

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
  onDeleteTask,
  onUpdateWellness,
  onQuickLogExpense,
  onOpenAddHabit
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskTime, setNewTaskTime] = useState<string>('30');
  const [newTaskCategory, setNewTaskCategory] = useState<string>('General');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  const todayIso = formatDate(new Date());
  const isToday = selectedDate === todayIso;

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
  const dayOutflow = dayExpenses.filter(e => (e.type || 'expense') === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const dayInflow = dayExpenses.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const dayTotalSpent = dayOutflow; // for backwards compatibility calculations

  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const completedTasksCount = dayTasks.filter(t => t.completed).length;

  const completedHabitsCount = habits.filter(h => h.completedDates.includes(selectedDate)).length;

  const dayWellness: DailyWellness = wellness[selectedDate] || {
    date: selectedDate,
    mood: undefined,
    waterGlasses: 0,
    sleepHours: 7,
    energyScore: 3,
    journalNotes: '',
    gratitude: ''
  };
  const [waterGlassesDraft, setWaterGlassesDraft] = useState<number | null>(null);
  const waterGlasses = waterGlassesDraft ?? dayWellness.waterGlasses ?? 0;

  useEffect(() => {
    setWaterGlassesDraft(wellness[selectedDate]?.waterGlasses ?? 0);
  }, [selectedDate, wellness[selectedDate]?.waterGlasses]);

  // Submit new task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const finalCategory = isCustomCategory && customCategoryInput.trim()
      ? customCategoryInput.trim()
      : newTaskCategory;

    onAddTask({
      date: selectedDate,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      timeEstimateMin: parseInt(newTaskTime) || 30,
      category: finalCategory || 'General'
    });
    setNewTaskTitle('');
    setCustomCategoryInput('');
    setIsCustomCategory(false);
  };

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
            const habitsDoneForDay = habits.filter(h => h.completedDates.includes(item.iso)).length;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Finance & Accounts Snapshot (EXPENSE FIRST) */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
              💳 Daily Finances
            </span>
            <span className="font-mono text-[11px] text-slate-400">{dayExpenses.length} txns</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {formatCurrency(dayOutflow, budget.currency)}
            </div>
            {dayInflow > 0 && (
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(dayInflow, budget.currency)}
              </span>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                dayOutflow > (budget.dailyBudget || budget.monthlyBudget / 30) ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{
                width: `${Math.min(100, (dayOutflow / Math.max(1, budget.dailyBudget || budget.monthlyBudget / 30)) * 100)}%`
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Daily target: ~{formatCurrency(Math.round(budget.dailyBudget || budget.monthlyBudget / 30), budget.currency)}</span>
            <button
              onClick={onQuickLogExpense}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline text-[11px]"
            >
              + Log Finance
            </button>
          </div>
        </div>

        {/* 2. Habit Completion */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Habits Consistency</span>
            <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {habits.length > 0 ? Math.round((completedHabitsCount / habits.length) * 100) : 0}%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {completedHabitsCount} <span className="text-sm text-slate-400 font-normal">/ {habits.length}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${habits.length > 0 ? (completedHabitsCount / habits.length) * 100 : 0}%`
              }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>{habits.length - completedHabitsCount} remaining today</span>
            <span className="font-mono text-[10px]">14d window</span>
          </div>
        </div>

        {/* 3. Priority Tasks */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Tasks Throughput</span>
            <span className="font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              {dayTasks.length > 0 ? Math.round((completedTasksCount / dayTasks.length) * 100) : 0}%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {completedTasksCount} <span className="text-sm text-slate-400 font-normal">/ {dayTasks.length}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{
                width: `${dayTasks.length > 0 ? (completedTasksCount / dayTasks.length) * 100 : 0}%`
              }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>{dayTasks.length - completedTasksCount} pending outcomes</span>
            <span className="font-mono text-[10px]">{dayTasks.filter(t => t.priority === 'high' && !t.completed).length} high priority</span>
          </div>
        </div>

        {/* 4. Wellness & Water */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Hydration (250ml)</span>
            <span className="font-mono text-[11px] font-semibold text-blue-500">
              {Math.min(100, Math.round((waterGlasses / 8) * 100))}%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {(waterGlasses * 250).toLocaleString()} <span className="text-sm text-slate-400 font-normal">/ 2,000 ml target</span>
          </div>
          <div className="relative w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (waterGlasses / 8) * 100)}%`
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => adjustWater(-1)}
                disabled={waterGlasses <= 0}
                aria-label="Remove one glass of water"
                className="h-8 w-8 shrink-0 whitespace-nowrap rounded-md border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                title="Subtract 250ml"
              >
                -
              </button>
              <button
                onClick={() => adjustWater(1)}
                disabled={waterGlasses >= 20}
                aria-label="Add one glass of water"
                className="h-8 w-8 shrink-0 whitespace-nowrap rounded-md border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                title="Add 250ml (1 glass)"
              >
                +
              </button>
              <button
                onClick={() => adjustWater(2)}
                disabled={waterGlasses >= 20}
                aria-label="Add two glasses of water"
                className="h-8 min-w-[56px] shrink-0 whitespace-nowrap rounded-md border border-slate-200 dark:border-slate-700 px-2 text-[11px] font-mono hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                title="Add 500ml (2 glasses)"
              >
                +500
              </button>
            </div>
            <span className="ml-auto whitespace-nowrap text-[10px] text-slate-400 font-mono">
              {waterGlasses}/8 glasses to target
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Daily target: 2,000 ml</p>
        </div>
      </div>

      {/* Main Section: Financial Ledger Full-Width Bar at Top */}
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

      {/* Main Grid: Left Column (Habits & Tasks) + Right Column (Wellness Log) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Habits & Priority Tasks) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Daily Habits Checklist */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Daily Habits Checklist
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Consistent actions that compound daily
                </p>
              </div>
              <button
                onClick={onOpenAddHabit}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Habit</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {habits.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No habits added yet. Click &quot;Add Habit&quot; to establish your routine.
                </div>
              ) : (
                habits.map(habit => {
                  const isChecked = habit.completedDates.includes(selectedDate);
                  return (
                    <div
                      key={habit.id}
                      onClick={() => onToggleHabit(habit.id, selectedDate)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="shrink-0 text-slate-400 transition-colors"
                        >
                          {isChecked ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
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
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {habit.category} · Target {habit.targetDaysPerWeek}d/wk
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                        <span className="text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                          🔥 {habit.streak}d streak
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card: Daily Tasks & Priorities */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
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

            {/* Quick add task input */}
            <form onSubmit={handleCreateTask} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="What needs to get done today?..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
              />
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as any)}
                  className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>

                <select
                  value={newTaskTime}
                  onChange={e => setNewTaskTime(e.target.value)}
                  className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="15">15m</option>
                  <option value="30">30m</option>
                  <option value="45">45m</option>
                  <option value="60">60m</option>
                </select>

                {isCustomCategory ? (
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={e => setCustomCategoryInput(e.target.value)}
                    placeholder="Category"
                    className="w-24 px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-blue-400 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                ) : (
                  <select
                    value={newTaskCategory}
                    onChange={e => {
                      if (e.target.value === '__NEW__') {
                        setIsCustomCategory(true);
                      } else {
                        setNewTaskCategory(e.target.value);
                      }
                    }}
                    className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {availableTaskCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__NEW__">+ New...</option>
                  </select>
                )}

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs whitespace-nowrap cursor-pointer"
                >
                  Add Task
                </button>
              </div>
            </form>

            {/* Task list */}
            <div className="space-y-2">
              {dayTasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No priority tasks scheduled for this date.
                </div>
              ) : (
                dayTasks.map(task => {
                  const isSavingTask = savingKeys?.has(`task:${task.id}`);
                  return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      task.completed
                        ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        disabled={Boolean(isSavingTask)}
                        aria-label={isSavingTask ? 'Saving task status' : task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                        className="shrink-0 text-slate-400 hover:scale-110 active:scale-95 transition-all cursor-pointer disabled:cursor-wait"
                      >
                        {isSavingTask ? <LoaderCircle className="h-4.5 w-4.5 animate-spin text-sky-500" /> : task.completed ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <Circle className="w-4.5 h-4.5 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                      <span
                        className={`text-xs truncate font-medium ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {task.category || 'General'}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
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
                      {task.timeEstimateMin && (
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-0.5">
                          {task.timeEstimateMin}m
                        </span>
                      )}
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1 cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Wellness Log) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Daily Wellness & Mood */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Daily Wellness Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Physical and mental state check-in
              </p>
            </div>

            {/* Mood selector buttons */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Today&apos;s Mood
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {MOODS.map(m => (
                  <button
                    key={m.type}
                    onClick={() => onUpdateWellness(selectedDate, { mood: m.type })}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                      dayWellness.mood === m.type
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
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

            {/* Sleep & Energy Steppers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Sleep</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-bold tabular-nums">
                    {dayWellness.sleepHours || 7}h
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() =>
                      onUpdateWellness(selectedDate, {
                        sleepHours: Math.max(0, (dayWellness.sleepHours || 7) - 0.5)
                      })
                    }
                    className="flex-1 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    -0.5
                  </button>
                  <button
                    onClick={() =>
                      onUpdateWellness(selectedDate, {
                        sleepHours: Math.min(14, (dayWellness.sleepHours || 7) + 0.5)
                      })
                    }
                    className="flex-1 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    +0.5
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Energy</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-bold tabular-nums">
                    {dayWellness.energyScore || 3} / 5
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => onUpdateWellness(selectedDate, { energyScore: score })}
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
            </div>

            {/* Gratitude & Journal notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gratitude / Highlight
                </label>
                <input
                  type="text"
                  value={dayWellness.gratitude || ''}
                  onChange={e => onUpdateWellness(selectedDate, { gratitude: e.target.value })}
                  placeholder="One thing I'm grateful for today..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Daily Reflection / Journal
                </label>
                <textarea
                  rows={3}
                  value={dayWellness.journalNotes || ''}
                  onChange={e => onUpdateWellness(selectedDate, { journalNotes: e.target.value })}
                  placeholder="Key observations, accomplishments, thoughts..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
