import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import {
  Plus,
  Flame,
  CheckCircle2,
  Circle,
  Trash2,
  Trophy,
  BarChart3,
  LayoutGrid,
  Calendar,
  Sparkles,
  Tag,
  Check,
  Droplet,
  Moon,
  Zap,
  Smile
} from 'lucide-react';
import { Habit, HabitCategory, DailyWellness, MoodType } from '../types';
import { formatDate } from '../utils/constants';
import {
  getPastNDays,
  getPastNWeeks,
  getPastNMonths,
  getPastNYears,
  formatShortDate
} from '../lib/dateUtils';

interface HabitsViewProps {
  habits: Habit[];
  onAddHabit: (habit: Omit<Habit, 'id' | 'completedDates' | 'streak' | 'bestStreak'>) => void;
  onUpdateHabit: (id: string, habit: Partial<Habit>) => void;
  onDeleteHabit: (id: string) => void;
  onToggleHabit: (habitId: string, date: string) => void;
  wellness?: Record<string, DailyWellness>;
  onUpdateWellness?: (date: string, data: Partial<DailyWellness>) => void;
  selectedDate?: string;
  customCategories: string[];
  onSaveCustomCategories: (categories: string[]) => void;
}

export type AnalyticsTimeGrain = 'day' | 'week' | 'month' | 'year';

const DEFAULT_HABIT_CATEGORIES: string[] = [
  'Health',
  'Mindfulness',
  'Productivity',
  'Fitness',
  'Personal'
];

const MOODS: { type: MoodType; label: string; icon: string }[] = [
  { type: 'great', label: 'Great', icon: '😄' },
  { type: 'good', label: 'Good', icon: '🙂' },
  { type: 'neutral', label: 'Neutral', icon: '😐' },
  { type: 'low', label: 'Low', icon: '😔' },
  { type: 'stressed', label: 'Stressed', icon: '😫' }
];

const CATEGORY_COLORS: Record<string, string> = {
  Health: '#06B6D4',
  Fitness: '#10B981',
  Productivity: '#6366F1',
  Mindfulness: '#F59E0B',
  Personal: '#EC4899',
  Learning: '#8B5CF6',
  Finance: '#14B8A6',
  Work: '#3B82F6',
  Creative: '#F43F5E',
  Wellness: '#10B981'
};

const DYNAMIC_PALETTE = [
  '#06B6D4',
  '#10B981',
  '#6366F1',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
  '#3B82F6',
  '#F43F5E',
  '#EAB308'
];

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabit,
  wellness,
  onUpdateWellness,
  selectedDate,
  customCategories,
  onSaveCustomCategories
}) => {
  const [viewMode, setViewMode] = useState<'matrix' | 'analytics'>('matrix');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Time grain for analytics: Day, Week, Month, Year
  const [timeGrain, setTimeGrain] = useState<AnalyticsTimeGrain>('day');

  // Custom categories state
  // All available categories: defaults + custom + categories found in existing habits
  const allCategories = useMemo(() => {
    const set = new Set([...DEFAULT_HABIT_CATEGORIES, ...customCategories, ...habits.map(h => h.category)]);
    return Array.from(set);
  }, [customCategories, habits]);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Health');
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [color, setColor] = useState('#10B981');

  const today = new Date();
  const todayIso = formatDate(today);
  const targetDate = selectedDate || todayIso;

  const dayWellness: DailyWellness = wellness?.[targetDate] || {
    date: targetDate,
    waterGlasses: 0,
    sleepHours: 7,
    energyScore: 3,
    journalNotes: '',
    gratitude: ''
  };

  const handleAdjustWater = (delta: number) => {
    if (!onUpdateWellness) return;
    const next = Math.max(0, Math.min(16, (dayWellness.waterGlasses || 0) + delta));
    onUpdateWellness(targetDate, { waterGlasses: next });
  };

  const handleAdjustSleep = (delta: number) => {
    if (!onUpdateWellness) return;
    const next = Math.max(0, Math.min(16, Math.round(((dayWellness.sleepHours || 7) + delta) * 2) / 2));
    onUpdateWellness(targetDate, { sleepHours: next });
  };

  const handleSetMood = (mood: MoodType) => {
    if (!onUpdateWellness) return;
    onUpdateWellness(targetDate, { mood });
  };

  const handleSetEnergy = (energyScore: number) => {
    if (!onUpdateWellness) return;
    onUpdateWellness(targetDate, { energyScore });
  };

  // Generate 14-day date column headers for matrix
  const past14Days = useMemo(() => {
    return Array.from({ length: 14 }).map((_, idx) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - idx));
      const iso = formatDate(d);
      return {
        iso,
        dayLetter: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayDisplay: `${d.getMonth() + 1}/${d.getDate()}`,
        dateNum: d.getDate(),
        isToday: iso === todayIso
      };
    });
  }, [todayIso]);

  const filteredHabits = habits.filter(
    h => selectedCategory === 'all' || h.category === selectedCategory
  );

  // -------------------------------------------------------------
  // TIME GRAIN ANALYTICS CALCULATIONS (Day, Week, Month, Year)
  // -------------------------------------------------------------
  const grainAnalyticsData = useMemo(() => {
    if (timeGrain === 'day') {
      // Past 14 days
      const days = past14Days.map(d => d.iso);
      const chartPoints = past14Days.map(day => {
        const completedCount = habits.filter(h => h.completedDates.includes(day.iso)).length;
        const rate = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;
        return {
          label: day.dayDisplay,
          subLabel: day.iso,
          Completed: completedCount,
          Rate: rate,
          Total: habits.length
        };
      });

      const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
      const avgRate = chartPoints.length > 0 ? Math.round(chartPoints.reduce((acc, p) => acc + p.Rate, 0) / chartPoints.length) : 0;
      const bestPoint = [...chartPoints].sort((a, b) => b.Completed - a.Completed)[0];

      return {
        chartPoints,
        periodName: 'Past 14 Days',
        unitLabel: 'Daily Completions',
        totalCompleted,
        avgRate,
        bestPeriod: bestPoint ? `${bestPoint.label} (${bestPoint.Completed} habits)` : '—',
        activeDays: days
      };
    }

    if (timeGrain === 'week') {
      // Past 8 weeks
      const intervals = getPastNWeeks(8);
      const chartPoints = intervals.map(w => {
        let completedCount = 0;
        w.days.forEach(d => {
          completedCount += habits.filter(h => h.completedDates.includes(d)).length;
        });
        const maxPossible = habits.length * w.days.length;
        const rate = maxPossible > 0 ? Math.round((completedCount / maxPossible) * 100) : 0;
        return {
          label: w.label,
          subLabel: w.subLabel,
          Completed: completedCount,
          Rate: rate,
          Total: maxPossible
        };
      });

      const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
      const avgRate = chartPoints.length > 0 ? Math.round(chartPoints.reduce((acc, p) => acc + p.Rate, 0) / chartPoints.length) : 0;
      const bestPoint = [...chartPoints].sort((a, b) => b.Completed - a.Completed)[0];
      const allDays = intervals.flatMap(i => i.days);

      return {
        chartPoints,
        periodName: 'Past 8 Weeks',
        unitLabel: 'Weekly Completions',
        totalCompleted,
        avgRate,
        bestPeriod: bestPoint ? `${bestPoint.label} (${bestPoint.Completed} check-offs)` : '—',
        activeDays: allDays
      };
    }

    if (timeGrain === 'month') {
      // Past 6 months
      const intervals = getPastNMonths(6);
      const chartPoints = intervals.map(m => {
        let completedCount = 0;
        m.days.forEach(d => {
          completedCount += habits.filter(h => h.completedDates.includes(d)).length;
        });
        const maxPossible = habits.length * m.days.length;
        const rate = maxPossible > 0 ? Math.round((completedCount / maxPossible) * 100) : 0;
        return {
          label: m.label,
          subLabel: m.subLabel,
          Completed: completedCount,
          Rate: rate,
          Total: maxPossible
        };
      });

      const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
      const avgRate = chartPoints.length > 0 ? Math.round(chartPoints.reduce((acc, p) => acc + p.Rate, 0) / chartPoints.length) : 0;
      const bestPoint = [...chartPoints].sort((a, b) => b.Completed - a.Completed)[0];
      const allDays = intervals.flatMap(i => i.days);

      return {
        chartPoints,
        periodName: 'Past 6 Months',
        unitLabel: 'Monthly Completions',
        totalCompleted,
        avgRate,
        bestPeriod: bestPoint ? `${bestPoint.subLabel || bestPoint.label} (${bestPoint.Completed} check-offs)` : '—',
        activeDays: allDays
      };
    }

    // Year: Past 3 years
    const intervals = getPastNYears(3);
    const chartPoints = intervals.map(y => {
      let completedCount = 0;
      y.days.forEach(d => {
        completedCount += habits.filter(h => h.completedDates.includes(d)).length;
      });
      const maxPossible = habits.length * y.days.length;
      const rate = maxPossible > 0 ? Math.round((completedCount / maxPossible) * 100) : 0;
      return {
        label: y.label,
        subLabel: y.subLabel,
        Completed: completedCount,
        Rate: rate,
        Total: maxPossible
      };
    });

    const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
    const avgRate = chartPoints.length > 0 ? Math.round(chartPoints.reduce((acc, p) => acc + p.Rate, 0) / chartPoints.length) : 0;
    const bestPoint = [...chartPoints].sort((a, b) => b.Completed - a.Completed)[0];
    const allDays = intervals.flatMap(i => i.days);

    return {
      chartPoints,
      periodName: 'Multi-Year History',
      unitLabel: 'Yearly Completions',
      totalCompleted,
      avgRate,
      bestPeriod: bestPoint ? `${bestPoint.label} (${bestPoint.Completed} check-offs)` : '—',
      activeDays: allDays
    };
  }, [timeGrain, past14Days, habits]);

  // Dynamic category completion share within selected grain
  const habitCategoryChartData = useMemo(() => {
    const activeDaysSet = new Set(grainAnalyticsData.activeDays);
    const categoryCompletions: Record<string, number> = {};

    allCategories.forEach(cat => {
      categoryCompletions[cat] = 0;
    });

    habits.forEach(h => {
      const inWindow = h.completedDates.filter(d => activeDaysSet.has(d)).length;
      categoryCompletions[h.category] = (categoryCompletions[h.category] || 0) + inWindow;
    });

    return Object.entries(categoryCompletions)
      .filter(([_, count]) => count > 0)
      .map(([name, value], idx) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || DYNAMIC_PALETTE[idx % DYNAMIC_PALETTE.length]
      }));
  }, [grainAnalyticsData, allCategories, habits]);

  // Streak comparison data
  const streakComparisonData = useMemo(() => {
    return habits.map(h => ({
      name: h.title.length > 15 ? h.title.substring(0, 14) + '…' : h.title,
      Current: h.streak,
      Best: h.bestStreak
    }));
  }, [habits]);

  // Handle adding custom category
  const handleAddNewCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!allCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      onSaveCustomCategories(updated);
    }
    setCategory(trimmed);
    setNewCatInput('');
    setIsCreatingNewCat(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalCategory = category;
    if (isCreatingNewCat && newCatInput.trim()) {
      finalCategory = newCatInput.trim();
      if (!allCategories.includes(finalCategory)) {
        const updated = [...customCategories, finalCategory];
        onSaveCustomCategories(updated);
      }
    }

    onAddHabit({
      title: title.trim(),
      category: finalCategory,
      targetDaysPerWeek: selectedWeekdays.length || 1,
      color
    });

    setTitle('');
    setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0]);
    setIsCreatingNewCat(false);
    setNewCatInput('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Habit Tracker &amp; Consistency
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Module 1 · Habits &amp; Routines</span>
            <span aria-hidden="true">·</span>
            <span>{habits.length} tracked habits</span>
            <span aria-hidden="true">·</span>
            <span>{allCategories.length} categories</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher: Matrix vs Analytics */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>14-Day Matrix</span>
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Habit Analytics</span>
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* Quick Daily Wellness Tracker Bar (Water, Sleep, Mood & Energy) */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Daily Wellness Quick Log
            </h3>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              ({targetDate})
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Quickly track water, sleep &amp; mood alongside your habits
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 💧 Water Intake Tracker */}
          <div className="p-3 rounded-xl border border-blue-100 dark:border-blue-950/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <Droplet className="w-4 h-4 text-blue-500 fill-blue-500" />
                <span>Water Intake</span>
              </div>
              <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                {(dayWellness.waterGlasses || 0) * 250} / 2,000 ml
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-blue-200 dark:bg-blue-900/50 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, ((dayWellness.waterGlasses || 0) / 8) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {dayWellness.waterGlasses || 0}/8 glasses
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustWater(-1)}
                  className="w-7 h-7 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer flex items-center justify-center"
                  title="Subtract 1 glass (-250ml)"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWater(1)}
                  className="px-2.5 h-7 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Add 1 glass (+250ml)"
                >
                  <Plus className="w-3 h-3" />
                  <span>1 Glass</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWater(2)}
                  className="px-2 h-7 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer flex items-center justify-center"
                  title="Add 2 glasses (+500ml)"
                >
                  +500ml
                </button>
              </div>
            </div>
          </div>

          {/* 😴 Sleep Hours Tracker */}
          <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Moon className="w-4 h-4 text-indigo-500 fill-indigo-500" />
                <span>Sleep Duration</span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                {dayWellness.sleepHours || 7} hrs
              </span>
            </div>

            {/* Visual sleep meter */}
            <div className="w-full h-2 rounded-full bg-indigo-200 dark:bg-indigo-900/50 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, ((dayWellness.sleepHours || 7) / 10) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Target: 7-9 hrs
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustSleep(-0.5)}
                  className="px-2 h-7 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                  title="Subtract 0.5 hours"
                >
                  -0.5h
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustSleep(0.5)}
                  className="px-2.5 h-7 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Add 0.5 hours"
                >
                  <Plus className="w-3 h-3" />
                  <span>0.5h</span>
                </button>
              </div>
            </div>
          </div>

          {/* 😄 Mood & Energy Quick Status */}
          <div className="p-3 rounded-xl border border-amber-100 dark:border-amber-950/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Smile className="w-4 h-4 text-amber-500" />
                <span>Mood &amp; Energy</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono text-amber-700 dark:text-amber-300">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{dayWellness.energyScore || 3}/5</span>
              </div>
            </div>

            {/* Quick Mood Selector Buttons */}
            <div className="grid grid-cols-5 gap-1">
              {MOODS.map(m => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => handleSetMood(m.type)}
                  className={`py-1 rounded-lg border text-center transition-all cursor-pointer ${
                    dayWellness.mood === m.type
                      ? 'border-amber-500 bg-amber-500 text-white shadow-xs font-bold'
                      : 'border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300'
                  }`}
                  title={m.label}
                >
                  <span className="text-sm leading-none">{m.icon}</span>
                </button>
              ))}
            </div>

            {/* Energy score buttons */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Energy Level
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => handleSetEnergy(score)}
                    className={`w-6 h-6 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      dayWellness.energyScore === score
                        ? 'bg-amber-500 text-white'
                        : 'bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 text-slate-600 dark:text-slate-400 hover:border-amber-400'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Toolbar with custom categories */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium overflow-x-auto gap-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          All Categories ({habits.length})
        </button>
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {cat} ({habits.filter(h => h.category === cat).length})
          </button>
        ))}
      </div>

      {/* VIEW 1: 14-DAY CONSISTENCY MATRIX */}
      {viewMode === 'matrix' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                14-Day Consistency Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any day cell to toggle past completion state
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing {filteredHabits.length} of {habits.length} habits
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Habit</th>
                  <th className="py-3 px-3 text-center">Streak</th>
                  <th className="py-3 px-3 text-center">Best</th>
                  <th className="py-3 px-3 text-center">Target</th>
                  <th className="py-3 px-3 text-center">14d Rate</th>
                  {past14Days.map((day, idx) => (
                    <th
                      key={day.iso}
                      className={`py-3 px-2 text-center font-mono ${
                        day.isToday ? 'bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold' : ''
                      } ${idx === 7 ? 'border-l border-slate-200 dark:border-slate-800' : ''}`}
                    >
                      <div className="text-[10px] leading-none uppercase">{day.dayLetter}</div>
                      <div className="text-[11px] mt-0.5">{day.dateNum}</div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHabits.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="py-12 text-center text-slate-400">
                      No habits found in this category. Click &quot;New Habit&quot; above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredHabits.map(habit => {
                    const doneCount14d = past14Days.filter(day => habit.completedDates.includes(day.iso)).length;
                    const rate14d = Math.round((doneCount14d / 14) * 100);

                    return (
                      <tr
                        key={habit.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: habit.color }}
                            />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {habit.title}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                {habit.category}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                          🔥 {habit.streak}d
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          🏆 {habit.bestStreak}d
                        </td>

                        <td className="py-3.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">
                          {habit.targetDaysPerWeek}d/wk
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                            <span className="tabular-nums font-semibold">{rate14d}%</span>
                            <div className="w-10 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${rate14d}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {past14Days.map((day, idx) => {
                          const isDone = habit.completedDates.includes(day.iso);
                          return (
                            <td
                              key={day.iso}
                              className={`py-3.5 px-1 text-center ${
                                day.isToday ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                              } ${idx === 7 ? 'border-l border-slate-200 dark:border-slate-800' : ''}`}
                            >
                              <button
                                onClick={() => onToggleHabit(habit.id, day.iso)}
                                className={`w-6 h-6 rounded-md mx-auto flex items-center justify-center transition-all cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-500 text-white shadow-xs hover:scale-105 active:scale-95'
                                    : 'border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                                title={`${habit.title} on ${day.iso}: ${isDone ? 'Completed' : 'Not completed'}`}
                              >
                                ✓
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => onDeleteHabit(habit.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="Delete habit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: DEDICATED HABIT ANALYTICS BY DAY, WEEK, MONTH, YEAR */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Grain Switcher & Overview Cards */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Analytics Timeframe
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                Showing {grainAnalyticsData.periodName}
              </div>
            </div>

            {/* Day / Week / Month / Year Pills */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
              {(['day', 'week', 'month', 'year'] as AnalyticsTimeGrain[]).map(g => (
                <button
                  key={g}
                  onClick={() => setTimeGrain(g)}
                  className={`px-3 py-1.5 rounded-md uppercase tracking-wider transition-colors cursor-pointer ${
                    timeGrain === g
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Granular KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Total Check-offs</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                {grainAnalyticsData.totalCompleted}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Across {habits.length} habits in {grainAnalyticsData.periodName}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Average Consistency</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {grainAnalyticsData.avgRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Average adherence score for {timeGrain} grain
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Top Performing Period</div>
              <div className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 mt-1.5 truncate">
                {grainAnalyticsData.bestPeriod}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Highest completed count</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Active Streaks</div>
              <div className="text-2xl font-bold font-mono text-amber-500 mt-1">
                {habits.filter(h => h.streak > 0).length} / {habits.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Habits currently on active streaks</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Habit Completion Volume & Rate by Selected Grain */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Habit Consistency by {timeGrain.toUpperCase()}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {grainAnalyticsData.unitLabel} and adherence percentage ({grainAnalyticsData.periodName})
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {timeGrain === 'day' ? (
                    <AreaChart data={grainAnalyticsData.chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="habitRateGradGrain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip
                        formatter={(val: any, name?: any) => [
                          name === 'Rate' ? `${val}%` : val,
                          name === 'Rate' ? 'Completion Rate' : 'Completed Habits'
                        ]}
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
                        fill="url(#habitRateGradGrain)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={grainAnalyticsData.chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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

            {/* Chart 2: Category Breakdown (including custom categories!) */}
            <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Completions by Category
                </h4>
                <p className="text-xs text-slate-400">Distribution in {grainAnalyticsData.periodName}</p>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {habitCategoryChartData.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-10">
                    No habit completions logged in this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={habitCategoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {habitCategoryChartData.map(entry => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`${val} check-offs`, 'Completions']}
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

            {/* Chart 3: Current vs Best Streak Comparison */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Current Streak vs. Best Recorded Streak (Days)
                </h4>
                <p className="text-xs text-slate-400">
                  Track ongoing consistency across your habit portfolio
                </p>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={streakComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Current" fill="#F59E0B" name="Current Streak (Days)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Best" fill="#10B981" name="Best Streak (Days)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW HABIT MODAL WITH OPTION TO CREATE NEW CATEGORY */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Create New Habit
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define frequency, category, and visual cue
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsCreatingNewCat(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Habit Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. 20-min Meditation, Reading, 10k Steps..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Category Selection + Option to Create New Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCat(!isCreatingNewCat)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isCreatingNewCat ? 'Choose existing' : 'Create new category'}</span>
                  </button>
                </div>

                {isCreatingNewCat ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCatInput}
                        onChange={e => setNewCatInput(e.target.value)}
                        placeholder="Enter new category (e.g. Music, Career, Deep Work)"
                        className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-blue-400 dark:border-blue-500 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      New categories are saved and available for future habits and analytics.
                    </p>
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={e => {
                      if (e.target.value === '__CREATE_NEW__') {
                        setIsCreatingNewCat(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__CREATE_NEW__">+ Create new category...</option>
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Target Cadence <span className="font-mono text-[11px] text-slate-400">({selectedWeekdays.length} days / wk)</span>
                  </label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0])}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        selectedWeekdays.length === 7 ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Everyday
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5])}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        selectedWeekdays.length === 5 && !selectedWeekdays.includes(6) && !selectedWeekdays.includes(0) ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([6, 0])}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        selectedWeekdays.length === 2 && selectedWeekdays.includes(6) && selectedWeekdays.includes(0) ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Weekends
                    </button>
                  </div>
                </div>

                {/* Day-of-week interactive buttons */}
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { id: 1, label: 'M' },
                    { id: 2, label: 'T' },
                    { id: 3, label: 'W' },
                    { id: 4, label: 'T' },
                    { id: 5, label: 'F' },
                    { id: 6, label: 'S' },
                    { id: 0, label: 'S' }
                  ].map(day => {
                    const isSelected = selectedWeekdays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedWeekdays.length > 1) {
                              setSelectedWeekdays(selectedWeekdays.filter(d => d !== day.id));
                            }
                          } else {
                            setSelectedWeekdays([...selectedWeekdays, day.id]);
                          }
                        }}
                        className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#14B8A6'].map(
                    c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          color === c ? 'scale-115 ring-2 ring-slate-900 dark:ring-white ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsCreatingNewCat(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
