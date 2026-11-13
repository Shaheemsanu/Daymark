import React, { useState, useMemo, useEffect } from 'react';
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
  Legend,
  ReferenceLine
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
  Pencil,
  AlertCircle,
  Droplet,
  Moon,
  Zap,
  Smile,
  LoaderCircle,
  ArrowDown,
  ArrowUp,
  ListOrdered,
  ChevronDown
} from 'lucide-react';
import { Habit, HabitCategory, DailyWellness, MoodType } from '../types';
import { formatDate } from '../utils/constants';
import { SleepScene, getSleepSceneState } from './SleepScene';
import { WellnessNotes } from './WellnessNotes';
import {
  getPastNDays,
  getPastNWeeks,
  getPastNMonths,
  getPastNYears,
  getDaysInInterval,
  formatShortDate
} from '../lib/dateUtils';

interface HabitsViewProps {
  habits: Habit[];
  onAddHabit: (habit: Omit<Habit, 'id' | 'completedDates' | 'streak' | 'bestStreak'>) => void | Promise<boolean>;
  onUpdateHabit: (id: string, habit: Partial<Habit>) => void | Promise<boolean>;
  onDeleteHabit: (id: string) => void | Promise<boolean>;
  onToggleHabit: (habitId: string, date: string) => void;
  wellness?: Record<string, DailyWellness>;
  onUpdateWellness?: (date: string, data: Partial<DailyWellness>) => void;
  selectedDate?: string;
  customCategories: string[];
  savingKeys?: Set<string>;
  habitOrder?: string[];
  onSaveCustomCategories: (categories: string[]) => void | Promise<boolean>;
  onSaveHabitOrder: (habitOrder: string[]) => void | Promise<boolean>;
}

export type AnalyticsTimeGrain = 'day' | 'week' | 'month' | 'year' | 'custom';
type HabitsViewMode = 'matrix' | 'analytics' | 'wellnessAnalytics';

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
  savingKeys,
  habitOrder,
  onSaveCustomCategories,
  onSaveHabitOrder
}) => {
  const [viewMode, setViewMode] = useState<HabitsViewMode>('matrix');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAnalyticsHabitId, setSelectedAnalyticsHabitId] = useState('all');
  const [isMobileCategoryMenuOpen, setIsMobileCategoryMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newHabitCategory, setNewHabitCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [categoryActionError, setCategoryActionError] = useState('');
  const [isEditingOrder, setIsEditingOrder] = useState(false);

  // Analytics timeframe and optional custom date range.
  const [timeGrain, setTimeGrain] = useState<AnalyticsTimeGrain>('day');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    return formatDate(date);
  });
  const [customEndDate, setCustomEndDate] = useState(() => formatDate(new Date()));

  // Older Supabase category JSON can omit the habits list or store it in an unexpected shape.
  const safeCustomCategories = Array.isArray(customCategories) ? customCategories : [];

  // Custom categories state
  // All available categories: defaults + custom + categories found in existing habits
  const allCategories = useMemo(() => {
    const set = new Set([...DEFAULT_HABIT_CATEGORIES, ...safeCustomCategories, ...habits.map(h => h.category)]);
    return Array.from(set);
  }, [safeCustomCategories, habits]);

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
  const [waterGlassesDraft, setWaterGlassesDraft] = useState<number | null>(null);
  const waterGlasses = waterGlassesDraft ?? dayWellness.waterGlasses ?? 0;
  const waterTargetProgress = Math.min(100, (waterGlasses / 8) * 100);
  const sleepHours = dayWellness.sleepHours ?? 7;
  const sleepTargetProgress = Math.min(100, (sleepHours / 8) * 100);

  useEffect(() => {
    setWaterGlassesDraft(wellness?.[targetDate]?.waterGlasses ?? 0);
  }, [targetDate, wellness?.[targetDate]?.waterGlasses]);

  const handleAdjustWater = (delta: number) => {
    if (!onUpdateWellness) return;
    const next = Math.max(0, Math.min(20, waterGlasses + delta));
    setWaterGlassesDraft(next);
    onUpdateWellness(targetDate, { waterGlasses: next });
  };

  const handleAdjustSleep = (delta: number) => {
    if (!onUpdateWellness) return;
    const next = Math.max(0, Math.min(16, Math.round((sleepHours + delta) * 2) / 2));
    onUpdateWellness(targetDate, { sleepHours: next });
  };

  const handleSetMood = (mood: MoodType) => {
    if (!onUpdateWellness) return;
    onUpdateWellness(targetDate, { mood: dayWellness.mood === mood ? undefined : mood });
  };

  const handleSetEnergy = (energyScore: number) => {
    if (!onUpdateWellness) return;
    onUpdateWellness(targetDate, { energyScore: dayWellness.energyScore === energyScore ? 0 : energyScore });
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

  const orderedHabits = useMemo(() => {
    const ranks = new Map((habitOrder || []).map((id, index) => [id, index]));
    return habits.map((habit, index) => ({ habit, index })).sort((a, b) => {
      const aRank = ranks.get(a.habit.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = ranks.get(b.habit.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank === bRank ? a.index - b.index : aRank - bRank;
    }).map(({ habit }) => habit);
  }, [habits, habitOrder]);

  const filteredHabits = orderedHabits.filter(
    h => selectedCategory === 'all' || h.category === selectedCategory
  );
  const selectedAnalyticsHabit = habits.find(habit => habit.id === selectedAnalyticsHabitId);
  const analyticsHabits = selectedAnalyticsHabit ? [selectedAnalyticsHabit] : habits;

  const moveHabit = (habitId: string, direction: -1 | 1) => {
    const visibleIndex = filteredHabits.findIndex(habit => habit.id === habitId);
    const neighbor = filteredHabits[visibleIndex + direction];
    if (!neighbor) return;
    const nextOrder = orderedHabits.map(habit => habit.id);
    const currentIndex = nextOrder.indexOf(habitId);
    const neighborIndex = nextOrder.indexOf(neighbor.id);
    [nextOrder[currentIndex], nextOrder[neighborIndex]] = [nextOrder[neighborIndex], nextOrder[currentIndex]];
    void onSaveHabitOrder(nextOrder);
  };

  // -------------------------------------------------------------
  // TIME GRAIN ANALYTICS CALCULATIONS (Day, Week, Month, Year)
  // -------------------------------------------------------------
  const grainAnalyticsData = useMemo(() => {
    if (timeGrain === 'custom') {
      const isValidCustomRange = Boolean(customStartDate && customEndDate && customStartDate <= customEndDate);
      const days = isValidCustomRange
        ? getDaysInInterval(customStartDate, customEndDate)
        : [];
      const chartPoints = days.map(day => {
        const completedCount = analyticsHabits.filter(habit => habit.completedDates.includes(day)).length;
        const total = analyticsHabits.length;
        return {
          label: formatShortDate(day),
          subLabel: day,
          Completed: completedCount,
          Rate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
          Total: total
        };
      });
      const totalCompleted = chartPoints.reduce((sum, point) => sum + point.Completed, 0);
      const avgRate = chartPoints.length
        ? Math.round(chartPoints.reduce((sum, point) => sum + point.Rate, 0) / chartPoints.length)
        : 0;
      const bestPoint = [...chartPoints].sort((a, b) => b.Completed - a.Completed)[0];
      const periodName = isValidCustomRange && days.length
        ? `${formatShortDate(customStartDate)} – ${formatShortDate(customEndDate)}`
        : 'Choose a valid date range';

      return {
        chartPoints,
        periodName,
        unitLabel: 'Daily Completions',
        totalCompleted,
        avgRate,
        bestPeriod: bestPoint ? `${bestPoint.label} (${bestPoint.Completed} habits)` : '—',
        activeDays: days
      };
    }

    if (timeGrain === 'day') {
      // Past 14 days
      const days = past14Days.map(d => d.iso);
      const chartPoints = past14Days.map(day => {
        const completedCount = analyticsHabits.filter(h => h.completedDates.includes(day.iso)).length;
        const rate = analyticsHabits.length > 0 ? Math.round((completedCount / analyticsHabits.length) * 100) : 0;
        return {
          label: day.dayDisplay,
          subLabel: day.iso,
          Completed: completedCount,
          Rate: rate,
          Total: analyticsHabits.length
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
          completedCount += analyticsHabits.filter(h => h.completedDates.includes(d)).length;
        });
        const maxPossible = analyticsHabits.length * w.days.length;
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
          completedCount += analyticsHabits.filter(h => h.completedDates.includes(d)).length;
        });
        const maxPossible = analyticsHabits.length * m.days.length;
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
        completedCount += analyticsHabits.filter(h => h.completedDates.includes(d)).length;
      });
      const maxPossible = analyticsHabits.length * y.days.length;
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
  }, [timeGrain, past14Days, analyticsHabits, customStartDate, customEndDate]);

  const wellnessAnalyticsData = useMemo(() => {
    let intervals: Array<{ label: string; days: string[] }> = [];
    if (timeGrain === 'day') {
      intervals = past14Days.map(day => ({ label: day.dayDisplay, days: [day.iso] }));
    } else if (timeGrain === 'week') {
      intervals = getPastNWeeks(8).map(({ label, days }) => ({ label, days }));
    } else if (timeGrain === 'month') {
      intervals = getPastNMonths(6).map(({ label, days }) => ({ label, days }));
    } else if (timeGrain === 'year') {
      intervals = getPastNYears(3).map(({ label, days }) => ({ label, days }));
    } else if (customStartDate && customEndDate && customStartDate <= customEndDate) {
      intervals = getDaysInInterval(customStartDate, customEndDate).map(day => ({
        label: formatShortDate(day),
        days: [day]
      }));
    }

    const activeDays = intervals.flatMap(interval => interval.days);
    const records = [...new Set(activeDays)]
      .map(day => wellness?.[day])
      .filter((record): record is DailyWellness => Boolean(record));
    const average = (values: number[]) => values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    const chartPoints = intervals.map(interval => {
      const periodRecords = interval.days
        .map(day => wellness?.[day])
        .filter((record): record is DailyWellness => Boolean(record));
      return {
        label: interval.label,
        Water: average(periodRecords.map(record => record.waterGlasses * 250)),
        Sleep: average(periodRecords.map(record => record.sleepHours)),
        Energy: average(periodRecords.map(record => record.energyScore).filter(score => score > 0)),
        LoggedDays: periodRecords.length
      };
    });
    const moodDistribution = MOODS.map((mood, index) => ({
      name: mood.label,
      value: records.filter(record => record.mood === mood.type).length,
      color: DYNAMIC_PALETTE[index % DYNAMIC_PALETTE.length]
    })).filter(item => item.value > 0);
    const moodCounts = MOODS.map(mood => ({
      type: mood.type,
      label: mood.label,
      count: records.filter(record => record.mood === mood.type).length
    }));
    const mostCommonMood = [...moodCounts].sort((a, b) => b.count - a.count)[0];
    const avgWater = average(records.map(record => record.waterGlasses * 250));
    const avgSleep = average(records.map(record => record.sleepHours));
    const avgEnergy = average(records.map(record => record.energyScore).filter(score => score > 0));

    return {
      chartPoints,
      periodName: grainAnalyticsData.periodName,
      loggedDays: records.length,
      avgWater,
      avgSleep,
      avgEnergy,
      waterGoalDays: records.filter(record => record.waterGlasses * 250 >= 2000).length,
      sleepGoalDays: records.filter(record => record.sleepHours >= 7 && record.sleepHours <= 9).length,
      moodDistribution,
      mostCommonMood: mostCommonMood?.count ? mostCommonMood.label : '—'
    };
  }, [timeGrain, past14Days, customStartDate, customEndDate, wellness, grainAnalyticsData.periodName]);

  // Dynamic category completion share within selected grain
  const habitCategoryChartData = useMemo(() => {
    const activeDaysSet = new Set(grainAnalyticsData.activeDays);
    const categoryCompletions: Record<string, number> = {};

    allCategories.forEach(cat => {
      categoryCompletions[cat] = 0;
    });

    analyticsHabits.forEach(h => {
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
  }, [grainAnalyticsData, allCategories, analyticsHabits]);

  // Streak comparison data
  const streakComparisonData = useMemo(() => {
    return analyticsHabits.map(h => ({
      name: h.title.length > 15 ? h.title.substring(0, 14) + '…' : h.title,
      Current: h.streak,
      Best: h.bestStreak
    }));
  }, [analyticsHabits]);

  // Handle adding custom category
  const handleAddNewCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!allCategories.includes(trimmed)) {
      const updated = [...safeCustomCategories, trimmed];
      onSaveCustomCategories(updated);
    }
    setCategory(trimmed);
    setNewCatInput('');
    setIsCreatingNewCat(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalCategory = category;
    if (isCreatingNewCat && newCatInput.trim()) {
      finalCategory = newCatInput.trim();
      if (!allCategories.includes(finalCategory)) {
        const updated = [...safeCustomCategories, finalCategory];
        onSaveCustomCategories(updated);
      }
    }

    const changes = {
      title: title.trim(),
      category: finalCategory,
      targetDaysPerWeek: selectedWeekdays.length || 1,
      weekdays: [...selectedWeekdays].sort((a, b) => a - b),
      color
    };
    const saved = editingHabit
      ? onUpdateHabit(editingHabit.id, changes)
      : onAddHabit(changes);
    if (saved && !(await saved)) return;

    setTitle('');
    setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0]);
    setIsCreatingNewCat(false);
    setNewCatInput('');
    setEditingHabit(null);
    setIsAddModalOpen(false);
  };

  const openCreateHabit = () => {
    setEditingHabit(null);
    setTitle('');
    setCategory('Health');
    setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0]);
    setColor('#10B981');
    setIsCreatingNewCat(false);
    setIsAddModalOpen(true);
  };

  const openEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setCategory(habit.category);
    setSelectedWeekdays(Array.isArray(habit.weekdays) && habit.weekdays.length
      ? [...habit.weekdays]
      : [1, 2, 3, 4, 5, 6, 0].slice(0, Math.max(1, Math.min(7, habit.targetDaysPerWeek))));
    setColor(habit.color);
    setIsCreatingNewCat(false);
    setIsAddModalOpen(true);
  };

  const confirmDeleteHabit = async () => {
    if (!habitToDelete) return;
    const deleted = onDeleteHabit(habitToDelete.id);
    if (deleted && !(await deleted)) return;
    setHabitToDelete(null);
  };

  const addHabitCategory = async () => {
    const name = newHabitCategory.trim();
    if (!name || allCategories.some(item => item.toLowerCase() === name.toLowerCase())) {
      setCategoryActionError(name ? 'That category already exists.' : 'Enter a category name.');
      return;
    }
    setCategoryActionError('');
    const saved = await onSaveCustomCategories([...safeCustomCategories, name]);
    if (saved === false) return;
    setNewHabitCategory('');
  };

  const saveHabitCategoryEdit = async () => {
    if (!editingCategory) return;
    const oldName = editingCategory;
    const newName = editingCategoryName.trim();
    if (!newName) {
      setCategoryActionError('Enter a category name.');
      return;
    }
    if (allCategories.some(item => item.toLowerCase() === newName.toLowerCase() && item !== oldName)) {
      setCategoryActionError('That category already exists.');
      return;
    }
    setCategoryActionError('');
    const affected = habits.filter(habit => habit.category === oldName);
    for (const habit of affected) {
      const saved = await onUpdateHabit(habit.id, { category: newName });
      if (saved === false) return;
    }
    const updatedCategories = safeCustomCategories.includes(oldName)
      ? safeCustomCategories.map(item => item === oldName ? newName : item)
      : [...safeCustomCategories, newName];
    const saved = await onSaveCustomCategories(updatedCategories);
    if (saved === false) return;
    if (selectedCategory === oldName) setSelectedCategory(newName);
    if (category === oldName) setCategory(newName);
    setEditingCategory(null);
    setEditingCategoryName('');
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setCategoryActionError('');
    const affected = habits.filter(habit => habit.category === categoryToDelete);
    for (const habit of affected) {
      const saved = await onUpdateHabit(habit.id, { category: 'Personal' });
      if (saved === false) return;
    }
    const saved = await onSaveCustomCategories(safeCustomCategories.filter(item => item !== categoryToDelete));
    if (saved === false) return;
    if (selectedCategory === categoryToDelete) setSelectedCategory('all');
    if (category === categoryToDelete) setCategory('Personal');
    setCategoryToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Habit Tracker &amp; Consistency
          </h2>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:flex sm:items-center sm:gap-2">
            <span className="col-span-2 min-w-0 sm:col-span-1">Module 1 · Habits &amp; Routines</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="min-w-0">{habits.length} tracked habits</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="min-w-0">{allCategories.length} categories</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Matrix and analytics views */}
          <div className="grid w-full grid-cols-2 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-950/70 lg:flex lg:h-9 lg:w-auto lg:gap-0.5 lg:rounded-lg lg:border-0 lg:bg-slate-100 lg:p-1 lg:dark:bg-slate-800">
            <button
              type="button"
              aria-pressed={viewMode === 'matrix'}
              onClick={() => setViewMode('matrix')}
              className={`col-span-2 flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:col-span-1 lg:h-7 lg:min-h-0 lg:rounded-md lg:gap-1.5 lg:px-3 lg:py-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500 lg:bg-white lg:text-blue-600 lg:dark:bg-slate-900 lg:dark:text-blue-400'
                  : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="lg:hidden">14-Day Matrix</span>
              <span className="hidden lg:inline">14-Day Matrix</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'analytics'}
              onClick={() => setViewMode('analytics')}
              className={`flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:h-7 lg:min-h-0 lg:rounded-md lg:gap-1.5 lg:px-3 lg:py-1.5 ${
                viewMode === 'analytics'
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500 lg:bg-white lg:text-blue-600 lg:dark:bg-slate-900 lg:dark:text-blue-400'
                  : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="lg:hidden">Habit Analytics</span>
              <span className="hidden lg:inline">Habit Analytics</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'wellnessAnalytics'}
              onClick={() => setViewMode('wellnessAnalytics')}
              className={`flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:h-7 lg:min-h-0 lg:rounded-md lg:gap-1.5 lg:px-3 lg:py-1.5 ${
                viewMode === 'wellnessAnalytics'
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500 lg:bg-white lg:text-blue-600 lg:dark:bg-slate-900 lg:dark:text-blue-400'
                  : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <Droplet className="h-3.5 w-3.5" />
              <span className="lg:hidden">Wellness Analytics</span>
              <span className="hidden lg:inline">Wellness Analytics</span>
            </button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => { setCategoryActionError(''); setIsCategoryManagerOpen(true); }}
              className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto sm:px-3 sm:text-xs lg:h-9 lg:min-h-9"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Manage Categories</span>
            </button>
            <button
              type="button"
              onClick={openCreateHabit}
              className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-2 text-[11px] font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white sm:w-auto sm:px-4 sm:text-xs lg:h-9 lg:min-h-9"
            >
              <Plus className="w-4 h-4" />
              <span>New Habit</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'matrix' && <>
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
            {savingKeys?.has(`wellness:${targetDate}`) && <span role="status" className="hidden items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 sm:inline-flex"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving</span>}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Quickly track water, sleep &amp; mood alongside your habits
          </div>
        </div>
        <div className="-mt-1 mb-2 flex h-4 items-center justify-end sm:hidden">
          <span role="status" aria-hidden={!savingKeys?.has(`wellness:${targetDate}`)} className={`flex items-center gap-1 text-right text-[11px] font-medium text-sky-600 transition-opacity dark:text-sky-400 ${savingKeys?.has(`wellness:${targetDate}`) ? 'visible opacity-100' : 'invisible opacity-0'}`}>
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving to Supabase
          </span>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          {/* 💧 Water Intake Tracker */}
          <div className="p-3 rounded-xl border border-blue-100 dark:border-blue-950/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <Droplet className="w-4 h-4 text-blue-500 fill-blue-500" />
                <span>Water Intake</span>
              </div>
              <span key={waterGlasses} className="wellness-counter-pop text-xs font-mono font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                {(waterGlasses * 250).toLocaleString()} / 2,000 ml
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative w-full h-2 rounded-full bg-blue-200 dark:bg-blue-900/50 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (waterGlasses / 8) * 100)}%` }}
              />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
              <div role="img" aria-label={`Water glass ${Math.round(waterTargetProgress)} percent full`} className="wellness-water-glass relative h-[82px] w-[62px] overflow-hidden rounded-b-[15px] rounded-t-[5px] border-[3px] border-blue-500/70 bg-blue-50/70 shadow-[0_8px_18px_-12px_rgba(37,99,235,0.8)] dark:border-blue-400/70 dark:bg-slate-950/50">
                <div className="wellness-water-fill absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-400/90 dark:from-blue-700 dark:via-blue-500 dark:to-cyan-400" style={{ height: `${waterTargetProgress}%` }} />
                <div className="wellness-water-shine pointer-events-none absolute inset-y-2 left-2 w-1 rounded-full bg-white/70 dark:bg-white/40" />
                <span key={waterGlasses} className="wellness-water-bubble absolute bottom-4 left-4 h-1.5 w-1.5 rounded-full bg-cyan-100/90" />
                <span key={`second-${waterGlasses}`} className="wellness-water-bubble wellness-water-bubble-late absolute bottom-2 right-3 h-1 w-1 rounded-full bg-white/80" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{waterTargetProgress >= 100 ? 'Hydration goal reached!' : 'Keep your day flowing'}</p>
                <p className="text-xs italic leading-relaxed text-blue-700/80 dark:text-blue-300/80">Your glass is {Math.round(waterTargetProgress)}% full. Keep sipping.</p>
              </div>
            </div>
            <div className="mt-auto space-y-2">
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Daily target: 2,000 ml</p>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-1">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {waterGlasses}/8 glasses to target
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAdjustWater(-1)}
                  disabled={waterGlasses <= 0}
                  className="h-8 w-8 shrink-0 whitespace-nowrap rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  title="Remove 1 glass (−250 ml)"
                  aria-label="Remove one glass of water"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWater(1)}
                  disabled={waterGlasses >= 20}
                  className="h-8 w-8 shrink-0 whitespace-nowrap rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  title="Add 1 glass (+250ml)"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWater(2)}
                  disabled={waterGlasses >= 20}
                  className="h-8 min-w-[70px] shrink-0 whitespace-nowrap rounded-lg border border-slate-300 dark:border-slate-700 bg-white px-2 dark:bg-slate-900 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  title="Add 2 glasses (+500ml)"
                >
                  +500
                </button>
              </div>
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
              <span key={sleepHours} className="wellness-counter-pop text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                {sleepHours} hrs
              </span>
            </div>

            <div role="progressbar" aria-label="Sleep toward an 8 hour goal" aria-valuemin={0} aria-valuemax={8} aria-valuenow={Math.min(8, sleepHours)} aria-valuetext={`${sleepHours} hours of sleep`} className="h-2 w-full overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-900/50">
              <div className="sleep-duration-progress h-full rounded-full bg-indigo-500" style={{ width: `${sleepTargetProgress}%` }} />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
              <SleepScene hours={sleepHours} />
              <div className="space-y-1" aria-live="polite" aria-atomic="true">
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">{getSleepSceneState(sleepHours).message}</p>
                <p className="text-xs italic leading-relaxed text-indigo-700/80 dark:text-indigo-300/80">{Math.round(sleepTargetProgress)}% toward 8 hours. Rest well; tomorrow is a fresh start.</p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-1 pt-1">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Target: 7-9 hrs
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustSleep(-0.5)}
                  disabled={!onUpdateWellness || sleepHours <= 0}
                  aria-label="Decrease sleep by 30 minutes"
                  className="px-2 h-8 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95 transition-all cursor-pointer"
                  title="Subtract 0.5 hours"
                >
                  -0.5h
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustSleep(0.5)}
                  disabled={!onUpdateWellness || sleepHours >= 16}
                  aria-label="Increase sleep by 30 minutes"
                  className="px-2.5 h-8 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
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
                <span>{dayWellness.energyScore || '—'}/5</span>
              </div>
            </div>

            {/* Quick Mood Selector Buttons */}
            <div className="grid grid-cols-5 gap-1">
              {MOODS.map(m => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => handleSetMood(m.type)}
                  aria-label={m.label}
                  aria-pressed={dayWellness.mood === m.type}
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
                    aria-label={`Energy level ${score}`}
                    aria-pressed={dayWellness.energyScore === score}
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
          <div className="mt-4">
            <WellnessNotes key={targetDate}
              footerText="Take a moment for yourself."
              gratitude={dayWellness.gratitude ?? ''}
              journalNotes={dayWellness.journalNotes ?? ''}
              onSave={onUpdateWellness ? notes => onUpdateWellness(targetDate, notes) : undefined}
            />
          </div>
          </div>
        </div>

      </div>

      {/* Category Filter Toolbar with custom categories */}
      <div className="hidden items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800 sm:flex">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`w-full rounded-lg px-2 py-2 text-center leading-tight transition-colors cursor-pointer sm:w-auto sm:whitespace-nowrap sm:px-3 sm:py-1.5 sm:rounded-md ${
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
            className={`w-full rounded-lg px-2 py-2 text-center leading-tight transition-colors cursor-pointer sm:w-auto sm:whitespace-nowrap sm:px-3 sm:py-1.5 sm:rounded-md ${
              selectedCategory === cat
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {cat} ({habits.filter(h => h.category === cat).length})
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`shrink-0 rounded-xl px-3.5 py-3 text-xs font-semibold transition-colors ${selectedCategory === 'all' ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950' : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
        >
          All Categories <span className="ml-1 opacity-75">({habits.length})</span>
        </button>
        <div className="relative min-w-0 flex-1">
          <button type="button" aria-label="Filter by habit category" aria-haspopup="listbox" aria-expanded={isMobileCategoryMenuOpen} onClick={() => setIsMobileCategoryMenuOpen(open => !open)} className={`flex w-full items-center justify-between gap-2 rounded-xl border py-3 pl-3 pr-3 text-left text-xs font-semibold outline-none ${selectedCategory === 'all' ? 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' : 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'}`}>
            <span className="truncate">{selectedCategory === 'all' ? 'Choose a category' : `${selectedCategory} (${habits.filter(habit => habit.category === selectedCategory).length})`}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isMobileCategoryMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isMobileCategoryMenuOpen && <>
            <button type="button" aria-label="Close category menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setIsMobileCategoryMenuOpen(false)} />
            <div role="listbox" aria-label="Habit categories" className="absolute right-0 top-full z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {allCategories.map(cat => <button key={cat} type="button" role="option" aria-selected={selectedCategory === cat} onClick={() => { setSelectedCategory(cat); setIsMobileCategoryMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${selectedCategory === cat ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                <span>{cat}</span><span className="ml-2 text-[11px] opacity-70">{habits.filter(habit => habit.category === cat).length}</span>
              </button>)}
            </div>
          </>}
        </div>
      </div>
      </>}

      {/* VIEW 1: 14-DAY CONSISTENCY MATRIX */}
      {viewMode === 'matrix' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                14-Day Consistency Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Scheduled days are available to check off; other days are disabled
              </p>
            </div>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <span className="text-[11px] font-mono text-slate-400 sm:text-xs">
                Showing {filteredHabits.length} of {habits.length} habits
              </span>
              {savingKeys?.has('habit:order') && <span role="status" className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving order</span>}
              <button type="button" onClick={() => setIsEditingOrder(value => !value)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${isEditingOrder ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
                <ListOrdered className="h-3.5 w-3.5" />{isEditingOrder ? 'Done' : 'Edit Order'}
              </button>
            </div>
          </div>

          <div className="hidden overflow-x-auto sm:block">
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
                  filteredHabits.map((habit, habitIndex) => {
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
                          const scheduledDay = (habit.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(new Date(`${day.iso}T00:00:00`).getDay());
                          const isSavingDay = savingKeys?.has(`habit:${habit.id}:${day.iso}`);
                          return (
                            <td
                              key={day.iso}
                              className={`py-3.5 px-1 text-center ${
                                day.isToday ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                              } ${idx === 7 ? 'border-l border-slate-200 dark:border-slate-800' : ''}`}
                            >
                              <button
                                disabled={!scheduledDay || isSavingDay}
                                onClick={() => onToggleHabit(habit.id, day.iso)}
                                className={`w-6 h-6 rounded-md mx-auto flex items-center justify-center transition-all ${
                                  isDone
                                    ? 'bg-emerald-500 text-white shadow-xs hover:scale-105 active:scale-95'
                                    : scheduledDay
                                      ? 'border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                      : 'border border-transparent bg-slate-100/70 dark:bg-slate-800/50 text-transparent opacity-40 cursor-not-allowed'
                                } ${scheduledDay ? 'cursor-pointer' : 'cursor-not-allowed'} disabled:cursor-wait disabled:opacity-50`}
                                title={`${habit.title} on ${day.iso}: ${scheduledDay ? (isDone ? 'Completed' : 'Not completed') : 'Not scheduled'}`}
                              >
                                {isSavingDay && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                                ✓
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-3.5 px-3 text-right">
                          {isEditingOrder ? <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => moveHabit(habit.id, -1)} disabled={habitIndex === 0 || savingKeys?.has('habit:order')} aria-label={`Move ${habit.title} up`} title="Move up" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" onClick={() => moveHabit(habit.id, 1)} disabled={habitIndex === filteredHabits.length - 1 || savingKeys?.has('habit:order')} aria-label={`Move ${habit.title} down`} title="Move down" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"><ArrowDown className="h-4 w-4" /></button>
                          </div> : <>
                          <button
                            type="button"
                            onClick={() => openEditHabit(habit)}
                            className="mr-1.5 p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                            title={`Edit ${habit.title}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={savingKeys?.has(`habit:delete:${habit.id}`)}
                            onClick={() => setHabitToDelete(habit)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                            title="Delete habit"
                          >
                            {savingKeys?.has(`habit:delete:${habit.id}`) ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                          </>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 sm:hidden">
            {filteredHabits.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-400">No habits in this category yet.</div> : filteredHabits.map((habit, habitIndex) => {
              const doneCount = past14Days.filter(day => habit.completedDates.includes(day.iso)).length;
              const rate = Math.round((doneCount / 14) * 100);
              const isSavingHabit = savingKeys?.has(`habit:update:${habit.id}`) || savingKeys?.has(`habit:delete:${habit.id}`);
              return <article key={habit.id} className="space-y-3.5 p-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{habit.title}</h4>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{habit.category}</p>
                  </div>
                  {isEditingOrder ? <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => moveHabit(habit.id, -1)} disabled={habitIndex === 0 || savingKeys?.has('habit:order')} aria-label={`Move ${habit.title} up`} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30 dark:border-slate-700"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveHabit(habit.id, 1)} disabled={habitIndex === filteredHabits.length - 1 || savingKeys?.has('habit:order')} aria-label={`Move ${habit.title} down`} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30 dark:border-slate-700"><ArrowDown className="h-4 w-4" /></button>
                  </div> : <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEditHabit(habit)} aria-label={`Edit ${habit.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 dark:border-slate-700"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setHabitToDelete(habit)} disabled={savingKeys?.has(`habit:delete:${habit.id}`)} aria-label={`Delete ${habit.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-50 dark:border-slate-700"><Trash2 className="h-4 w-4" /></button>
                  </div>}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70"><span className="block text-[9px] uppercase tracking-wide text-slate-500">Streak</span><span className="text-xs font-bold tabular-nums text-amber-500">🔥 {habit.streak}d</span></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70"><span className="block text-[9px] uppercase tracking-wide text-slate-500">Best</span><span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">🏆 {habit.bestStreak}d</span></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70"><span className="block text-[9px] uppercase tracking-wide text-slate-500">Target</span><span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{habit.targetDaysPerWeek}d/wk</span></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70"><span className="block text-[9px] uppercase tracking-wide text-slate-500">14d Rate</span><span className="text-xs font-bold tabular-nums text-blue-600 dark:text-blue-400">{rate}%</span></div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {past14Days.map(day => {
                    const isDone = habit.completedDates.includes(day.iso);
                    const scheduled = (habit.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(new Date(`${day.iso}T00:00:00`).getDay());
                    const isSaving = savingKeys?.has(`habit:${habit.id}:${day.iso}`);
                    return <div key={day.iso} className={`rounded-lg py-1 text-center ${day.isToday ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-900' : ''}`}>
                      <span className={`block text-[9px] leading-3 ${day.isToday ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>{day.dayLetter}</span>
                      <button type="button" disabled={!scheduled || isSaving} onClick={() => onToggleHabit(habit.id, day.iso)} aria-label={`${habit.title}, ${day.iso}: ${scheduled ? (isDone ? 'completed' : 'not completed') : 'not scheduled'}`} title={scheduled ? day.iso : `${day.iso}: not scheduled`} className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed ${isDone ? 'bg-emerald-500 text-white' : scheduled ? 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' : 'bg-slate-100 text-slate-300 opacity-50 dark:bg-slate-800 dark:text-slate-600'}`}>
                        {isSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : isDone ? <Check className="h-3.5 w-3.5" /> : day.dateNum}
                      </button>
                    </div>;
                  })}
                </div>
              </article>;
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: DEDICATED HABIT ANALYTICS BY DAY, WEEK, MONTH, YEAR */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Grain Switcher & Overview Cards */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Analytics Timeframe
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                Showing {grainAnalyticsData.periodName}
              </div>
            </div>

            {/* Timeframe controls */}
            <div className="grid w-full grid-cols-1 gap-3 lg:w-auto lg:grid-cols-[220px_auto] lg:items-end">
              <label className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Habit
                <select
                  aria-label="Filter analytics by habit"
                  value={selectedAnalyticsHabit?.id ?? 'all'}
                  onChange={event => setSelectedAnalyticsHabitId(event.target.value)}
                  className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium normal-case tracking-normal text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Habits ({habits.length})</option>
                  {habits.map(habit => (
                    <option key={habit.id} value={habit.id}>{habit.title} · {habit.category}</option>
                  ))}
                </select>
              </label>
              <div className="grid w-full grid-cols-5 items-center gap-0.5 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800 lg:flex lg:w-auto lg:gap-0">
              {(['day', 'week', 'month', 'year', 'custom'] as AnalyticsTimeGrain[]).map(g => (
                <button
                  key={g}
                  onClick={() => setTimeGrain(g)}
                  className={`min-w-0 flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-[10px] uppercase tracking-wide transition-colors cursor-pointer lg:min-w-fit lg:px-3 lg:text-xs lg:tracking-wider ${
                    timeGrain === g
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {g}
                </button>
              ))}
              </div>
              {timeGrain === 'custom' && (
                <div className="grid grid-cols-2 gap-2 lg:col-start-2 lg:min-w-[300px]">
                  <label className="min-w-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    From
                    <input
                      aria-label="Analytics start date"
                      type="date"
                      value={customStartDate}
                      max={customEndDate < todayIso ? customEndDate : todayIso}
                      onChange={event => setCustomStartDate(event.target.value)}
                      className="mt-1 block h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                  <label className="min-w-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    To
                    <input
                      aria-label="Analytics end date"
                      type="date"
                      value={customEndDate}
                      min={customStartDate}
                      max={todayIso}
                      onChange={event => setCustomEndDate(event.target.value)}
                      className="mt-1 block h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                </div>
              )}
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
                Across {analyticsHabits.length} {analyticsHabits.length === 1 ? 'habit' : 'habits'} in {grainAnalyticsData.periodName}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Average Consistency</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {grainAnalyticsData.avgRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Average adherence score for {timeGrain === 'custom' ? 'selected date range' : `${timeGrain} grain`}
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
                {analyticsHabits.filter(h => h.streak > 0).length} / {analyticsHabits.length}
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
                    Habit Consistency by {timeGrain === 'custom' ? 'DATE' : timeGrain.toUpperCase()}
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

      {viewMode === 'wellnessAnalytics' && (
        <section className="space-y-5" aria-label="Wellness analytics">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Wellness Analytics</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Showing {wellnessAnalyticsData.periodName}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Trends use days with a saved wellness entry.</p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto">
              <div className="grid w-full grid-cols-5 items-center gap-0.5 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800 lg:flex lg:w-auto">
                {(['day', 'week', 'month', 'year', 'custom'] as AnalyticsTimeGrain[]).map(grain => (
                  <button
                    key={grain}
                    type="button"
                    onClick={() => setTimeGrain(grain)}
                    className={`min-w-0 flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-[10px] uppercase tracking-wide transition-colors lg:min-w-fit lg:px-3 lg:text-xs lg:tracking-wider ${timeGrain === grain ? 'bg-white font-bold text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    {grain}
                  </button>
                ))}
              </div>
              {timeGrain === 'custom' && (
                <div className="grid grid-cols-2 gap-2 lg:min-w-[300px]">
                  <label className="min-w-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    From
                    <input type="date" aria-label="Wellness analytics start date" value={customStartDate} max={customEndDate < todayIso ? customEndDate : todayIso} onChange={event => setCustomStartDate(event.target.value)} className="mt-1 block h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                  </label>
                  <label className="min-w-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    To
                    <input type="date" aria-label="Wellness analytics end date" value={customEndDate} min={customStartDate} max={todayIso} onChange={event => setCustomEndDate(event.target.value)} className="mt-1 block h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-950 dark:bg-blue-950/30">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Average Water</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-200">{wellnessAnalyticsData.avgWater === null ? '—' : `${Math.round(wellnessAnalyticsData.avgWater).toLocaleString()} ml`}</p>
              <p className="mt-1 text-[11px] text-slate-500">{wellnessAnalyticsData.loggedDays ? `${wellnessAnalyticsData.waterGoalDays} of ${wellnessAnalyticsData.loggedDays} logged days met 2,000 ml` : 'No saved entries in this range'}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-950 dark:bg-indigo-950/30">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Average Sleep</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-200">{wellnessAnalyticsData.avgSleep === null ? '—' : `${wellnessAnalyticsData.avgSleep.toFixed(1)} hrs`}</p>
              <p className="mt-1 text-[11px] text-slate-500">{wellnessAnalyticsData.sleepGoalDays} logged {wellnessAnalyticsData.sleepGoalDays === 1 ? 'night' : 'nights'} within 7–9 hrs</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-950 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Average Energy</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-700 dark:text-amber-200">{wellnessAnalyticsData.avgEnergy === null ? '—' : `${wellnessAnalyticsData.avgEnergy.toFixed(1)} / 5`}</p>
              <p className="mt-1 text-[11px] text-slate-500">Across {wellnessAnalyticsData.loggedDays} saved {wellnessAnalyticsData.loggedDays === 1 ? 'day' : 'days'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-950 dark:bg-emerald-950/30">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Most Common Mood</p>
              <p className="mt-1 truncate text-xl font-bold text-emerald-700 dark:text-emerald-200">{wellnessAnalyticsData.mostCommonMood}</p>
              <p className="mt-1 text-[11px] text-slate-500">{wellnessAnalyticsData.moodDistribution.reduce((sum, mood) => sum + mood.value, 0)} mood ratings recorded</p>
            </div>
          </div>

          {wellnessAnalyticsData.loggedDays === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <Droplet className="mx-auto h-8 w-8 text-blue-400" />
              <h4 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">No wellness entries for this timeframe</h4>
              <p className="mt-1 text-xs text-slate-500">Log water, sleep, mood, or energy from the 14-Day Matrix to see trends here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hydration Trend</h4>
                <p className="text-xs text-slate-500">Average daily intake · target 2,000 ml</p>
                <div className="mt-3 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={wellnessAnalyticsData.chartPoints} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="wellnessWaterGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: unknown) => [typeof value !== 'number' ? 'No entry' : `${Math.round(value).toLocaleString()} ml`, 'Average water']} />
                      <ReferenceLine y={2000} stroke="#10B981" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="Water" connectNulls={false} stroke="#3B82F6" fill="url(#wellnessWaterGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sleep Trend</h4>
                <p className="text-xs text-slate-500">Average hours per logged day · target range 7–9 hrs</p>
                <div className="mt-3 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wellnessAnalyticsData.chartPoints} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 12]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: unknown) => [typeof value !== 'number' ? 'No entry' : `${value.toFixed(1)} hrs`, 'Average sleep']} />
                      <ReferenceLine y={7} stroke="#6366F1" strokeDasharray="4 4" />
                      <ReferenceLine y={9} stroke="#6366F1" strokeDasharray="4 4" />
                      <Bar dataKey="Sleep" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mood Distribution</h4>
                <p className="text-xs text-slate-500">Mood ratings saved in this timeframe</p>
                <div className="mt-3 h-56 w-full">
                  {wellnessAnalyticsData.moodDistribution.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">No mood ratings recorded.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={wellnessAnalyticsData.moodDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
                          {wellnessAnalyticsData.moodDistribution.map(item => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Energy Trend</h4>
                <p className="text-xs text-slate-500">Average self-reported energy · scale of 1 to 5</p>
                <div className="mt-3 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={wellnessAnalyticsData.chartPoints} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="wellnessEnergyGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: unknown) => [typeof value !== 'number' ? 'No entry' : value.toFixed(1), 'Average energy']} />
                      <Area type="monotone" dataKey="Energy" connectNulls={false} stroke="#F59E0B" fill="url(#wellnessEnergyGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* CREATE OR EDIT HABIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editingHabit ? 'Edit Habit' : 'Create New Habit'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define frequency, category, and visual cue
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                    setEditingHabit(null);
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
                  disabled={savingKeys?.has(editingHabit ? `habit:update:${editingHabit.id}` : 'habit:add')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white cursor-pointer disabled:cursor-wait disabled:opacity-70"
                >
                  {savingKeys?.has(editingHabit ? `habit:update:${editingHabit.id}` : 'habit:add') && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {savingKeys?.has(editingHabit ? `habit:update:${editingHabit.id}` : 'habit:add') ? 'Saving…' : editingHabit ? 'Save Changes' : 'Save Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="habit-categories-title">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h3 id="habit-categories-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Manage Habit Categories</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add, rename, or remove categories used by your habits.</p>
              </div>
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Close category manager"><Circle className="h-4 w-4" /></button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5">
              <form className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60" onSubmit={event => { event.preventDefault(); void addHabitCategory(); }}>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Plus className="h-4 w-4 text-emerald-500" /> Add New Category</h4>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="new-habit-category">Category name</label>
                <div className="flex gap-2">
                  <input id="new-habit-category" value={newHabitCategory} onChange={event => setNewHabitCategory(event.target.value)} maxLength={40} placeholder="e.g. Learning, Reading, Fitness" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  <button type="submit" disabled={savingKeys?.has('habit:categories')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {savingKeys?.has('habit:categories') ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </div>
              </form>

              {categoryActionError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{categoryActionError}</p>}

              <div>
                <h4 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">All Categories ({allCategories.length})</h4>
                <div className="space-y-2">
                  {allCategories.map(item => {
                    const isDefaultCategory = DEFAULT_HABIT_CATEGORIES.includes(item);
                    const usage = habits.filter(habit => habit.category === item).length;
                    const isEditing = editingCategory === item;
                    return <div key={item} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item] || DYNAMIC_PALETTE[allCategories.indexOf(item) % DYNAMIC_PALETTE.length] }} />
                      {isEditing ? <input autoFocus value={editingCategoryName} onChange={event => setEditingCategoryName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveHabitCategoryEdit(); } }} maxLength={40} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" /> : <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item}</span>}
                      <span className="shrink-0 text-[11px] text-slate-400">{usage} {usage === 1 ? 'habit' : 'habits'}</span>
                      {isDefaultCategory ? <span className="shrink-0 text-[10px] font-medium text-slate-400">Default</span> : isEditing ? <>
                        <button type="button" onClick={() => void saveHabitCategoryEdit()} disabled={savingKeys?.has('habit:categories')} className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/30">Save</button>
                        <button type="button" onClick={() => { setEditingCategory(null); setEditingCategoryName(''); }} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                      </> : <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => { setCategoryActionError(''); setEditingCategory(item); setEditingCategoryName(item); }} className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400" aria-label={`Edit ${item}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { setCategoryActionError(''); setCategoryToDelete(item); }} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400" aria-label={`Delete ${item}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>}
                    </div>;
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800">
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">Done</button>
            </div>
          </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs" role="alertdialog" aria-modal="true" aria-labelledby="delete-habit-category-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <h3 id="delete-habit-category-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete “{categoryToDelete}”?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{habits.filter(habit => habit.category === categoryToDelete).length ? `Habits in this category will be moved to Personal.` : 'This category will be removed from your list.'}</p>
              </div>
            </div>
            {categoryActionError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{categoryActionError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCategoryToDelete(null)} disabled={savingKeys?.has('habit:categories')} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void confirmDeleteCategory()} disabled={savingKeys?.has('habit:categories') || habits.some(habit => habit.category === categoryToDelete && savingKeys?.has(`habit:update:${habit.id}`))} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70">
                {(savingKeys?.has('habit:categories') || habits.some(habit => habit.category === categoryToDelete && savingKeys?.has(`habit:update:${habit.id}`))) && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {habitToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs" role="alertdialog" aria-modal="true" aria-labelledby="delete-habit-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-habit-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete this habit?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  “{habitToDelete.title}” and its completion history will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setHabitToDelete(null)} disabled={savingKeys?.has(`habit:delete:${habitToDelete.id}`)} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteHabit} disabled={savingKeys?.has(`habit:delete:${habitToDelete.id}`)} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70">
                {savingKeys?.has(`habit:delete:${habitToDelete.id}`) && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {savingKeys?.has(`habit:delete:${habitToDelete.id}`) ? 'Deleting…' : 'Delete Habit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
