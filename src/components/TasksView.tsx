import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Pencil,
  LoaderCircle,
  AlertCircle,
  Calendar,
  Clock,
  Filter,
  BarChart3,
  ListTodo,
  Tag,
  Check,
  TrendingUp,
  Flame,
  Layers
} from 'lucide-react';
import { DailyTask, TaskPriority } from '../types';
import { formatDate } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import {
  getPastNDays,
  getPastNWeeks,
  getPastNMonths,
  getPastNYears,
  getDaysInInterval,
  formatShortDate
} from '../lib/dateUtils';

interface TasksViewProps {
  tasks: DailyTask[];
  onAddTask: (task: Omit<DailyTask, 'id' | 'completed'>) => void | Promise<boolean>;
  onToggleTask: (taskId: string) => void | boolean | Promise<boolean>;
  onDeleteTask: (taskId: string) => void | Promise<boolean>;
  onUpdateTask: (taskId: string, task: Partial<DailyTask>) => void | Promise<boolean>;
  savingKeys?: Set<string>;
  customCategories: string[];
  onSaveCustomCategories: (categories: string[]) => void | Promise<boolean>;
}

export type TaskTimeGrain = 'day' | 'week' | 'month' | 'year' | 'custom';

const DEFAULT_TASK_CATEGORIES = [
  'General',
  'Work',
  'Personal',
  'Health',
  'Finance',
  'Errands',
  'Learning'
];

const TASK_CATEGORY_COLORS: Record<string, string> = {
  General: '#64748B',
  Work: '#3B82F6',
  Personal: '#EC4899',
  Health: '#06B6D4',
  Finance: '#10B981',
  Errands: '#F59E0B',
  Learning: '#8B5CF6'
};

const DYNAMIC_TASK_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#14B8A6',
  '#6366F1',
  '#F43F5E',
  '#64748B'
];

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  savingKeys,
  customCategories,
  onSaveCustomCategories
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('active');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [analyticsCategory, setAnalyticsCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<DailyTask | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newManagedCategory, setNewManagedCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isSavingCategoryAction, setIsSavingCategoryAction] = useState(false);

  // Time grain for analytics: Day, Week, Month, Year
  const [timeGrain, setTimeGrain] = useState<TaskTimeGrain>('day');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    return formatDate(date);
  });
  const [customEndDate, setCustomEndDate] = useState(() => formatDate(new Date()));
  const todayIso = formatDate(new Date());

  // Custom task categories
  // All task categories
  const allCategories = useMemo(() => {
    const existing = tasks.map(t => t.category).filter(Boolean) as string[];
    return Array.from(new Set([...DEFAULT_TASK_CATEGORIES, ...customCategories, ...existing]));
  }, [customCategories, tasks]);

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [timeEstimate, setTimeEstimate] = useState('30');
  const [category, setCategory] = useState('General');
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  const filteredTasks = tasks.filter(t => {
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && !t.completed) ||
      (filterStatus === 'completed' && t.completed);
    const matchesCategory =
      filterCategory === 'all' || (t.category || 'General') === filterCategory;
    return matchesPriority && matchesStatus && matchesCategory;
  }).sort((a, b) => {
    // Sort active first, then by date descending
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const activeCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;
  const analyticsTasks = useMemo(
    () => analyticsCategory === 'all' ? tasks : tasks.filter(task => (task.category || 'General') === analyticsCategory),
    [analyticsCategory, tasks]
  );

interface TaskChartPoint {
  label: string;
  subLabel?: string;
  Completed: number;
  Pending: number;
  Total: number;
  FocusMinutes: number;
  FocusHours?: number;
  Rate: number;
}

  // -------------------------------------------------------------
  // TIME GRAIN ANALYTICS CALCULATIONS (Day, Week, Month, Year)
  // -------------------------------------------------------------
  const grainAnalyticsData = useMemo(() => {
    if (timeGrain === 'custom') {
      const isValidRange = Boolean(customStartDate && customEndDate && customStartDate <= customEndDate);
      const days = isValidRange ? getDaysInInterval(customStartDate, customEndDate) : [];
      const chartPoints: TaskChartPoint[] = days.map(dateStr => {
        const dayTasks = analyticsTasks.filter(task => task.date === dateStr);
        const done = dayTasks.filter(task => task.completed).length;
        const pending = dayTasks.length - done;
        const focusMins = dayTasks.filter(task => task.completed).reduce((sum, task) => sum + (task.timeEstimateMin || 30), 0);
        return {
          label: formatShortDate(dateStr),
          subLabel: dateStr,
          Completed: done,
          Pending: pending,
          Total: dayTasks.length,
          FocusMinutes: focusMins,
          Rate: dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0
        };
      });
      const totalCompleted = chartPoints.reduce((sum, point) => sum + point.Completed, 0);
      const totalPending = chartPoints.reduce((sum, point) => sum + point.Pending, 0);
      const totalFocusMins = chartPoints.reduce((sum, point) => sum + point.FocusMinutes, 0);
      const periodName = days.length ? `${formatShortDate(customStartDate)} – ${formatShortDate(customEndDate)}` : 'Choose a valid date range';
      const averagePerDay = days.length ? (totalCompleted / days.length).toFixed(1) : '0.0';

      return {
        chartPoints,
        periodName,
        totalCompleted,
        totalPending,
        totalFocusMins,
        throughputMetric: `${averagePerDay} tasks/day`,
        activeDays: days
      };
    }

    if (timeGrain === 'day') {
      const past14Days = getPastNDays(14);
      const chartPoints: TaskChartPoint[] = past14Days.map(dateStr => {
        const dayTasks = analyticsTasks.filter(t => t.date === dateStr);
        const done = dayTasks.filter(t => t.completed).length;
        const pending = dayTasks.filter(t => !t.completed).length;
        const focusMins = dayTasks
          .filter(t => t.completed)
          .reduce((sum, t) => sum + (t.timeEstimateMin || 30), 0);
        return {
          label: formatShortDate(dateStr),
          subLabel: dateStr,
          Completed: done,
          Pending: pending,
          Total: dayTasks.length,
          FocusMinutes: focusMins,
          Rate: dayTasks.length > 0 ? Math.round((done / dayTasks.length) * 100) : 0
        };
      });

      const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
      const totalPending = chartPoints.reduce((acc, p) => acc + p.Pending, 0);
      const totalFocusMins = chartPoints.reduce((acc, p) => acc + p.FocusMinutes, 0);
      const avgDonePerDay = (totalCompleted / 14).toFixed(1);

      return {
        chartPoints,
        periodName: 'Past 14 Days',
        totalCompleted,
        totalPending,
        totalFocusMins,
        throughputMetric: `${avgDonePerDay} tasks/day`,
        activeDays: past14Days
      };
    }

    if (timeGrain === 'week') {
      const intervals = getPastNWeeks(8);
      const chartPoints: TaskChartPoint[] = intervals.map(w => {
        const weekTasks = analyticsTasks.filter(t => w.days.includes(t.date));
        const done = weekTasks.filter(t => t.completed).length;
        const pending = weekTasks.filter(t => !t.completed).length;
        const focusMins = weekTasks
          .filter(t => t.completed)
          .reduce((sum, t) => sum + (t.timeEstimateMin || 30), 0);
        return {
          label: w.label,
          subLabel: w.subLabel,
          Completed: done,
          Pending: pending,
          Total: weekTasks.length,
          FocusMinutes: focusMins,
          FocusHours: +(focusMins / 60).toFixed(1),
          Rate: weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : 0
        };
      });

      const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
      const totalPending = chartPoints.reduce((acc, p) => acc + p.Pending, 0);
      const totalFocusMins = chartPoints.reduce((acc, p) => acc + p.FocusMinutes, 0);
      const avgWeekly = (totalCompleted / 8).toFixed(1);

      return {
        chartPoints,
        periodName: 'Past 8 Weeks',
        totalCompleted,
        totalPending,
        totalFocusMins,
        throughputMetric: `${avgWeekly} tasks/week`,
        activeDays: intervals.flatMap(i => i.days)
      };
    }

    if (timeGrain === 'month') {
      const intervals = getPastNMonths(6);
      const chartPoints: TaskChartPoint[] = intervals.map(m => {
        const monthTasks = analyticsTasks.filter(t => m.days.includes(t.date));
        const done = monthTasks.filter(t => t.completed).length;
        const pending = monthTasks.filter(t => !t.completed).length;
        const focusMins = monthTasks
          .filter(t => t.completed)
          .reduce((sum, t) => sum + (t.timeEstimateMin || 30), 0);
        return {
          label: m.label,
          subLabel: m.subLabel,
          Completed: done,
          Pending: pending,
          Total: monthTasks.length,
          FocusMinutes: focusMins,
          FocusHours: +(focusMins / 60).toFixed(1),
          Rate: monthTasks.length > 0 ? Math.round((done / monthTasks.length) * 100) : 0
        };
      });

      const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
      const totalPending = chartPoints.reduce((acc, p) => acc + p.Pending, 0);
      const totalFocusMins = chartPoints.reduce((acc, p) => acc + p.FocusMinutes, 0);
      const avgMonthly = (totalCompleted / 6).toFixed(1);

      return {
        chartPoints,
        periodName: 'Past 6 Months',
        totalCompleted,
        totalPending,
        totalFocusMins,
        throughputMetric: `${avgMonthly} tasks/month`,
        activeDays: intervals.flatMap(i => i.days)
      };
    }

    // Year: Past 3 years
    const intervals = getPastNYears(3);
    const chartPoints: TaskChartPoint[] = intervals.map(y => {
      const yearTasks = analyticsTasks.filter(t => y.days.includes(t.date));
      const done = yearTasks.filter(t => t.completed).length;
      const pending = yearTasks.filter(t => !t.completed).length;
      const focusMins = yearTasks
        .filter(t => t.completed)
        .reduce((sum, t) => sum + (t.timeEstimateMin || 30), 0);
      return {
        label: y.label,
        subLabel: y.subLabel,
        Completed: done,
        Pending: pending,
        Total: yearTasks.length,
        FocusMinutes: focusMins,
        FocusHours: +(focusMins / 60).toFixed(1),
        Rate: yearTasks.length > 0 ? Math.round((done / yearTasks.length) * 100) : 0
      };
    });

    const totalCompleted = chartPoints.reduce((acc, p) => acc + p.Completed, 0);
    const totalPending = chartPoints.reduce((acc, p) => acc + p.Pending, 0);
    const totalFocusMins = chartPoints.reduce((acc, p) => acc + p.FocusMinutes, 0);

    return {
      chartPoints,
      periodName: 'Multi-Year History',
      totalCompleted,
      totalPending,
      totalFocusMins,
      throughputMetric: `${totalCompleted} tasks completed`,
      activeDays: intervals.flatMap(i => i.days)
    };
  }, [timeGrain, analyticsTasks, customStartDate, customEndDate]);

  // Tasks by Category within selected grain
  const taskCategoryData = useMemo(() => {
    const activeDaysSet = new Set(grainAnalyticsData.activeDays);
    const counts: Record<string, number> = {};

    allCategories.forEach(cat => {
      counts[cat] = 0;
    });

    analyticsTasks.forEach(t => {
      if (activeDaysSet.has(t.date)) {
        const cat = t.category || 'General';
        counts[cat] = (counts[cat] || 0) + (t.completed ? 1 : 0);
      }
    });

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value], idx) => ({
        name,
        value,
        color: TASK_CATEGORY_COLORS[name] || DYNAMIC_TASK_PALETTE[idx % DYNAMIC_TASK_PALETTE.length]
      }));
  }, [grainAnalyticsData, allCategories, analyticsTasks]);

  // Priority breakdown in window
  const priorityBreakdownData = useMemo(() => {
    const activeDaysSet = new Set(grainAnalyticsData.activeDays);
    const scopedTasks = analyticsTasks.filter(t => activeDaysSet.has(t.date));

    const high = scopedTasks.filter(t => t.priority === 'high');
    const med = scopedTasks.filter(t => t.priority === 'medium');
    const low = scopedTasks.filter(t => t.priority === 'low');

    return [
      {
        priority: 'High Priority',
        Total: high.length,
        Completed: high.filter(t => t.completed).length
      },
      {
        priority: 'Medium Priority',
        Total: med.length,
        Completed: med.filter(t => t.completed).length
      },
      {
        priority: 'Low Priority',
        Total: low.length,
        Completed: low.filter(t => t.completed).length
      }
    ];
  }, [grainAnalyticsData, analyticsTasks]);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    const taskFields = {
      title: title.trim(),
      date,
      priority,
      timeEstimateMin: parseInt(timeEstimate) || 30,
      category: finalCategory || 'General'
    };

    if (editingTask) {
      const saved = await onUpdateTask(editingTask.id, taskFields);
      if (saved === false) return;
    } else {
      const saved = await onAddTask(taskFields);
      if (saved === false) return;
    }

    setTitle('');
    setIsCreatingNewCat(false);
    setNewCatInput('');
    setIsAddOpen(false);
    setEditingTask(null);
  };

  const openEditTask = (task: DailyTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDate(task.date);
    setPriority(task.priority);
    setTimeEstimate(String(task.timeEstimateMin || 30));
    setCategory(task.category || 'General');
    setIsCreatingNewCat(false);
    setNewCatInput('');
    setIsAddOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    await onDeleteTask(taskToDelete.id);
    setIsDeletingTask(false);
    setTaskToDelete(null);
  };

  const saveTaskCategoryEdit = async () => {
    if (!editingCategory) return;
    const nextName = editingCategoryName.trim();
    if (!nextName || nextName === editingCategory) return;
    if (allCategories.some(item => item.toLowerCase() === nextName.toLowerCase())) return;

    setIsSavingCategoryAction(true);
    const affectedTasks = tasks.filter(task => task.category === editingCategory);
    const results = await Promise.all(affectedTasks.map(task => onUpdateTask(task.id, { category: nextName })));
    if (results.some(result => result === false)) {
      setIsSavingCategoryAction(false);
      return;
    }
    const saved = await onSaveCustomCategories(customCategories.map(item => item === editingCategory ? nextName : item));
    if (saved === false) {
      setIsSavingCategoryAction(false);
      return;
    }
    if (category === editingCategory) setCategory(nextName);
    if (filterCategory === editingCategory) setFilterCategory(nextName);
    setEditingCategory(null);
    setEditingCategoryName('');
    setIsSavingCategoryAction(false);
  };

  const confirmDeleteTaskCategory = async () => {
    if (!categoryToDelete) return;
    setIsSavingCategoryAction(true);
    const affectedTasks = tasks.filter(task => task.category === categoryToDelete);
    const results = await Promise.all(affectedTasks.map(task => onUpdateTask(task.id, { category: 'General' })));
    if (results.some(result => result === false)) {
      setIsSavingCategoryAction(false);
      return;
    }
    const saved = await onSaveCustomCategories(customCategories.filter(item => item !== categoryToDelete));
    if (saved === false) {
      setIsSavingCategoryAction(false);
      return;
    }
    if (category === categoryToDelete) setCategory('General');
    if (filterCategory === categoryToDelete) setFilterCategory('all');
    setCategoryToDelete(null);
    setIsSavingCategoryAction(false);
  };

  const addManagedTaskCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newManagedCategory.trim();
    if (!name || allCategories.some(item => item.toLowerCase() === name.toLowerCase())) return;
    setIsSavingCategoryAction(true);
    const saved = await onSaveCustomCategories([...customCategories, name]);
    if (saved !== false) setNewManagedCategory('');
    setIsSavingCategoryAction(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daily Tasks &amp; Priorities
          </h2>
          <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:flex sm:items-center sm:gap-2">
            <span className="col-span-3 min-w-0 sm:col-span-1">Module 2 · Daily Tasks</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="min-w-0">{activeCount} pending</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="min-w-0">{completedCount} completed</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="min-w-0">{allCategories.length} categories</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 items-center gap-2.5 sm:flex sm:w-auto sm:flex-wrap">
          {/* Mode Switcher: List vs Analytics */}
          <div className="col-span-2 flex min-h-11 w-full items-center rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800 sm:col-span-1 sm:h-9 sm:min-h-0 sm:w-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors cursor-pointer sm:h-7 sm:min-h-0 sm:flex-none ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Task List</span>
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors cursor-pointer sm:h-7 sm:min-h-0 sm:flex-none ${
                viewMode === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Task Analytics</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCategoryManagerOpen(true)}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:h-9 sm:min-h-9 sm:flex-none sm:px-3 sm:text-xs"
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Manage Categories</span>
          </button>

          <button
            onClick={() => { setEditingTask(null); setIsAddOpen(true); }}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white sm:h-9 sm:min-h-9 sm:flex-none sm:px-4"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: TASK LIST & FILTERS */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar with Category Support */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
            {/* Status filters */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 mr-1 text-[11px] uppercase tracking-wider font-semibold">
                Status:
              </span>
              {(['all', 'active', 'completed'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                    filterStatus === st
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Priority filters */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 mr-1 text-[11px] uppercase tracking-wider font-semibold">
                Priority:
              </span>
              {(['all', 'high', 'medium', 'low'] as const).map(pr => (
                <button
                  key={pr}
                  onClick={() => setFilterPriority(pr)}
                  className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                    filterPriority === pr
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pr}
                </button>
              ))}
            </div>

            {/* Category dropdown filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                Category:
              </span>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories ({tasks.length})</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat} ({tasks.filter(t => (t.category || 'General') === cat).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasks List Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No tasks match your selected criteria. Create one using the &quot;New Task&quot; button above.
              </div>
            ) : (
              filteredTasks.map(task => {
                const isHigh = task.priority === 'high';
                const isLow = task.priority === 'low';
                const taskCat = task.category || 'General';
                const isSavingTask = savingKeys?.has(`task:${task.id}`) || savingKeys?.has(`task:update:${task.id}`);

                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between border-l-4 p-4 transition-colors ${
                      task.completed
                        ? 'border-l-emerald-500 bg-emerald-50/70 text-slate-600 dark:bg-emerald-950/25 dark:text-slate-300'
                        : 'border-l-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        disabled={Boolean(isSavingTask)}
                        aria-label={isSavingTask ? 'Saving task status' : task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer disabled:cursor-wait"
                      >
                        {isSavingTask ? <LoaderCircle className="h-5 w-5 animate-spin text-sky-500" /> : task.completed ? <CheckCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-400" /> : <Circle className="h-5 w-5 text-slate-300 transition-colors hover:text-slate-400 dark:text-slate-600" />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                          className={`min-w-0 truncate text-sm font-medium ${
                            task.completed
                              ? 'line-through text-emerald-800 dark:text-emerald-200'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                          </span>
                          {task.completed && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200"><Check className="h-3 w-3" />Completed</span>}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {formatDisplayDate(task.date)}
                          </span>
                          <span aria-hidden="true">·</span>

                          {/* Category Tag Badge */}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[10px]">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            {taskCat}
                          </span>
                          <span aria-hidden="true">·</span>

                          {/* Priority Indicator */}
                          <span
                            className={`font-semibold capitalize ${
                              isHigh
                                ? 'text-rose-500'
                                : isLow
                                ? 'text-slate-400'
                                : 'text-amber-500'
                            }`}
                          >
                            {task.priority} priority
                          </span>

                          {task.timeEstimateMin && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {task.timeEstimateMin}m
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditTask(task)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                        title="Edit task"
                        aria-label={`Edit ${task.title}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskToDelete(task)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete task"
                        aria-label={`Delete ${task.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: TASK ANALYTICS BY DAY, WEEK, MONTH, YEAR */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Grain Switcher & Overview Header */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Task Analytics Timeframe
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                Showing {grainAnalyticsData.periodName}
              </div>
            </div>

            {/* Category and timeframe controls, matching Habit Analytics */}
            <div className="grid w-full grid-cols-1 gap-3 lg:w-auto lg:grid-cols-[220px_auto] lg:items-end">
              <label className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Category
                <select
                  aria-label="Filter task analytics by category"
                  value={analyticsCategory}
                  onChange={event => setAnalyticsCategory(event.target.value)}
                  className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium normal-case tracking-normal text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Categories ({tasks.length})</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({tasks.filter(task => (task.category || 'General') === cat).length})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid w-full grid-cols-5 items-center gap-0.5 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800 lg:flex lg:w-auto lg:gap-0">
              {(['day', 'week', 'month', 'year', 'custom'] as TaskTimeGrain[]).map(g => (
                <button
                  key={g}
                  onClick={() => setTimeGrain(g)}
                  className={`min-w-0 flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-[10px] uppercase tracking-wide transition-colors cursor-pointer lg:min-w-fit lg:px-3 lg:text-xs lg:tracking-wider ${
                    timeGrain === g
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
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
                      aria-label="Task analytics start date"
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
                      aria-label="Task analytics end date"
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

          {/* Granular Task KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Tasks Completed</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {grainAnalyticsData.totalCompleted}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                In {grainAnalyticsData.periodName}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Task Throughput</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                {grainAnalyticsData.throughputMetric}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Average execution velocity</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Focus Time Completed</div>
              <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                {Math.round(grainAnalyticsData.totalFocusMins / 60)}h {grainAnalyticsData.totalFocusMins % 60}m
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Estimated focus minutes invested
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="text-xs text-slate-400">Pending in Period</div>
              <div className="text-2xl font-bold font-mono text-slate-500 mt-1">
                {grainAnalyticsData.totalPending}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Awaiting completion</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Task Throughput (Completed vs Pending) */}
            <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Task Throughput by {timeGrain === 'custom' ? 'DATE' : timeGrain.toUpperCase()}
                </h4>
                <p className="text-xs text-slate-400">
                  Completed vs Pending tasks across {grainAnalyticsData.periodName}
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grainAnalyticsData.chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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
                    <Bar dataKey="Completed" fill="#10B981" name="Completed Tasks" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Pending" fill="#94A3B8" name="Pending Tasks" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Completed Tasks by Category (including custom categories!) */}
            <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tasks by Category
                </h4>
                <p className="text-xs text-slate-400">Completed distribution in {grainAnalyticsData.periodName}</p>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {taskCategoryData.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-10">
                    No completed tasks recorded in this timeframe.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {taskCategoryData.map(entry => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`${val} tasks`, 'Completed']}
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

            {/* Chart 3: Priority Performance Breakdown */}
            <div className="lg:col-span-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Task Completion by Priority ({grainAnalyticsData.periodName})
                </h4>
                <p className="text-xs text-slate-400">
                  High vs Medium vs Low priority completion execution
                </p>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityBreakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Completed" fill="#10B981" name="Completed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Total" fill="#CBD5E1" name="Total Scheduled" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW TASK MODAL WITH OPTION TO CREATE NEW CATEGORY */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set priority, time estimate, and category
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setIsCreatingNewCat(false);
                  setEditingTask(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Prepare client deck, review budget, debug build..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              {/* Category Selection + Option to Create New Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Category Tag
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
                        placeholder="e.g. Engineering, Sales, Admin..."
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
                      New categories are saved and available across tasks and analytics.
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Est. Duration (minutes)
                </label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={timeEstimate}
                  onChange={e => setTimeEstimate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsCreatingNewCat(false);
                    setEditingTask(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(editingTask ? savingKeys?.has(`task:update:${editingTask.id}`) : savingKeys?.has('task:add'))}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white cursor-pointer disabled:cursor-wait disabled:opacity-70"
                >
                  {(editingTask ? savingKeys?.has(`task:update:${editingTask.id}`) : savingKeys?.has('task:add')) && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {editingTask ? 'Save Changes' : savingKeys?.has('task:add') ? 'Adding…' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"><AlertCircle className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h3 id="delete-task-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete this task?</h3>
                <p className="mt-1 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-400">“{taskToDelete.title}” will be permanently deleted.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setTaskToDelete(null)} disabled={isDeletingTask} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={() => void confirmDeleteTask()} disabled={isDeletingTask} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70">
                {isDeletingTask && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="task-category-manager-title">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h3 id="task-category-manager-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Manage Task Categories</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add or remove custom categories used by your tasks.</p>
              </div>
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
            </div>

            <form className="border-b border-slate-200 p-5 dark:border-slate-800" onSubmit={event => void addManagedTaskCategory(event)}>
              <label htmlFor="new-task-category" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">New category</label>
              <div className="flex gap-2">
                <input id="new-task-category" value={newManagedCategory} onChange={event => setNewManagedCategory(event.target.value)} maxLength={40} placeholder="e.g. Projects, Home" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <button type="submit" disabled={!newManagedCategory.trim() || isSavingCategoryAction} className="inline-flex min-w-16 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">{isSavingCategoryAction ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Saving</> : <><Plus className="h-3.5 w-3.5" />Add</>}</button>
              </div>
            </form>

            <div className="space-y-2 overflow-y-auto p-5">
              <h4 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">All Categories ({allCategories.length})</h4>
              {allCategories.map(item => {
                const isDefault = DEFAULT_TASK_CATEGORIES.includes(item);
                const usage = tasks.filter(task => task.category === item).length;
                const isEditing = editingCategory === item;
                return <div key={item} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TASK_CATEGORY_COLORS[item] || DYNAMIC_TASK_PALETTE[allCategories.indexOf(item) % DYNAMIC_TASK_PALETTE.length] }} />
                  {isEditing ? <input autoFocus value={editingCategoryName} onChange={event => setEditingCategoryName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveTaskCategoryEdit(); } }} maxLength={40} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" /> : <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item}</span>}
                  <span className="shrink-0 text-[11px] text-slate-400">{usage} {usage === 1 ? 'task' : 'tasks'}</span>
                  {isDefault ? <span className="shrink-0 text-[10px] font-medium text-slate-400">Default</span> : isEditing ? <>
                    <button type="button" onClick={() => void saveTaskCategoryEdit()} disabled={isSavingCategoryAction || !editingCategoryName.trim()} className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/30">{isSavingCategoryAction ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : 'Save'}</button>
                    <button type="button" onClick={() => { setEditingCategory(null); setEditingCategoryName(''); }} disabled={isSavingCategoryAction} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">Cancel</button>
                  </> : <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => { setEditingCategory(item); setEditingCategoryName(item); }} className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400" aria-label={`Edit ${item}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setCategoryToDelete(item)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400" aria-label={`Delete ${item}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>}
                </div>;
              })}
            </div>

            <div className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800">
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950">Done</button>
            </div>
          </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-task-category-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <h3 id="delete-task-category-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete “{categoryToDelete}”?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{tasks.some(task => task.category === categoryToDelete) ? 'Tasks in this category will be moved to General.' : 'This category will be removed from your list.'}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCategoryToDelete(null)} disabled={isSavingCategoryAction} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={() => void confirmDeleteTaskCategory()} disabled={isSavingCategoryAction} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70">
                {isSavingCategoryAction && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
