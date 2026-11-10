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
import {
  getPastNDays,
  getPastNWeeks,
  getPastNMonths,
  getPastNYears,
  formatShortDate
} from '../lib/dateUtils';

interface TasksViewProps {
  tasks: DailyTask[];
  onAddTask: (task: Omit<DailyTask, 'id' | 'completed'>) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  customCategories: string[];
  onSaveCustomCategories: (categories: string[]) => void;
}

export type TaskTimeGrain = 'day' | 'week' | 'month' | 'year';

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
  customCategories,
  onSaveCustomCategories
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Time grain for analytics: Day, Week, Month, Year
  const [timeGrain, setTimeGrain] = useState<TaskTimeGrain>('day');

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
    if (timeGrain === 'day') {
      const past14Days = getPastNDays(14);
      const chartPoints: TaskChartPoint[] = past14Days.map(dateStr => {
        const dayTasks = tasks.filter(t => t.date === dateStr);
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
        const weekTasks = tasks.filter(t => w.days.includes(t.date));
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
        const monthTasks = tasks.filter(t => m.days.includes(t.date));
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
      const yearTasks = tasks.filter(t => y.days.includes(t.date));
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
  }, [timeGrain, tasks]);

  // Tasks by Category within selected grain
  const taskCategoryData = useMemo(() => {
    const activeDaysSet = new Set(grainAnalyticsData.activeDays);
    const counts: Record<string, number> = {};

    allCategories.forEach(cat => {
      counts[cat] = 0;
    });

    tasks.forEach(t => {
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
  }, [grainAnalyticsData, allCategories, tasks]);

  // Priority breakdown in window
  const priorityBreakdownData = useMemo(() => {
    const activeDaysSet = new Set(grainAnalyticsData.activeDays);
    const scopedTasks = tasks.filter(t => activeDaysSet.has(t.date));

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
  }, [grainAnalyticsData, tasks]);

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

    onAddTask({
      title: title.trim(),
      date,
      priority,
      timeEstimateMin: parseInt(timeEstimate) || 30,
      category: finalCategory || 'General'
    });

    setTitle('');
    setIsCreatingNewCat(false);
    setNewCatInput('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daily Tasks &amp; Priorities
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Module 2 · Daily Tasks</span>
            <span aria-hidden="true">·</span>
            <span>{activeCount} pending</span>
            <span aria-hidden="true">·</span>
            <span>{completedCount} completed</span>
            <span aria-hidden="true">·</span>
            <span>{allCategories.length} categories</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher: List vs Analytics */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
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
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs whitespace-nowrap cursor-pointer"
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

                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-4 transition-colors ${
                      task.completed
                        ? 'bg-slate-50/50 dark:bg-slate-900/40 text-slate-400'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                          task.completed
                            ? 'bg-emerald-500 text-white'
                            : 'border border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-transparent'
                        }`}
                      >
                        ✓
                      </button>

                      <div className="min-w-0">
                        <div
                          className={`text-sm font-medium truncate ${
                            task.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {task.date}
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
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete task"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Task Analytics Timeframe
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                Showing {grainAnalyticsData.periodName}
              </div>
            </div>

            {/* Day / Week / Month / Year Pills */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
              {(['day', 'week', 'month', 'year'] as TaskTimeGrain[]).map(g => (
                <button
                  key={g}
                  onClick={() => setTimeGrain(g)}
                  className={`px-3 py-1.5 rounded-md uppercase tracking-wider transition-colors cursor-pointer ${
                    timeGrain === g
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {g}
                </button>
              ))}
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
                  Task Throughput by {timeGrain.toUpperCase()}
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
                  Create New Task
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set priority, time estimate, and category
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddOpen(false);
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
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
