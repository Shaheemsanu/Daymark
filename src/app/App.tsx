import React, { useState, useEffect, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  Expense,
  BudgetConfig,
  Habit,
  DailyTask,
  DailyWellness,
  ExpenseCategory,
  AppProfile
} from '../types';
import {
  exportAllDataAsJSON,
  exportExpensesAsCSV
} from '../utils/export';
import { formatDate } from '../utils/constants';
import { authService } from '../features/auth/authService';
import { AuthPage } from '../features/auth/AuthPage';
import { Layout, NavView } from './Layout';
import { DailyOverview } from '../components/DailyOverview';
import { HabitsView } from '../components/HabitsView';
import { TasksView } from '../components/TasksView';
import { ExpenseDashboard } from '../components/ExpenseDashboard';
import { ReportsPage } from '../features/reports/ReportsPage';
import { HistoryReportsView } from '../components/HistoryReportsView';
import { QuickLogModal } from '../components/QuickLogModal';
import { NotesView } from '../components/NotesView';
import { CategorySettings, WorkspaceData, dataService } from '../features/data/dataService';
import { notesService } from '../features/notes/notesService';
import { createUuid } from '../utils/uuid';

export default function App() {
  const [user, setUser] = useState<AppProfile | null>(null);
  const userId = user?.id;
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation - Daily Overview 1st, Expense 2nd after overview
  const [currentView, setCurrentView] = useState<NavView>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Core Data States
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<BudgetConfig>({
    monthlyBudget: 30000,
    dailyBudget: 1000,
    weeklyBudget: 7000,
    currency: '₹',
    categoryBudgets: {}
  });
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [wellness, setWellness] = useState<Record<string, DailyWellness>>({});
  const wellnessRef = useRef(wellness);
  const wellnessSaveQueue = useRef(new Map<string, Promise<void>>());
  const [categories, setCategories] = useState<CategorySettings>({ expenses: {}, habits: [], tasks: [] });
  const [dataLoading, setDataLoading] = useState(false);
  const [workspaceRefreshing, setWorkspaceRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [cloudPendingCount, setCloudPendingCount] = useState(0);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());

  // Quick Log Drawer
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogTab, setQuickLogTab] = useState<'expense' | 'task' | 'habit'>('expense');

  // Sync theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Check auth session
  useEffect(() => {
    const initAuth = async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setAuthLoading(false);
    };

    initAuth();

    const { unsubscribe } = authService.onAuthStateChange(newUser => {
      setUser(newUser);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load data
  useEffect(() => {
    if (!userId) {
      setExpenses([]);
      setBudget({ monthlyBudget: 30000, dailyBudget: 1000, weeklyBudget: 7000, currency: '₹', categoryBudgets: {} });
      setHabits([]);
      setTasks([]);
      setWellness({});
      setCategories({ expenses: {}, habits: [], tasks: [] });
      setDataError(null);
      setDataLoading(false);
      return;
    }
    let cancelled = false;
    setExpenses([]);
    setBudget({ monthlyBudget: 30000, dailyBudget: 1000, weeklyBudget: 7000, currency: '₹', categoryBudgets: {} });
    setHabits([]);
    setTasks([]);
    setWellness({});
    setCategories({ expenses: {}, habits: [], tasks: [] });
    setDataLoading(true);
    setDataError(null);
    dataService.loadWorkspace(userId).then((data: WorkspaceData) => {
      if (cancelled) return;
      applyWorkspace(data);
    }).catch(error => {
      if (!cancelled) setDataError(`Could not load your Supabase data: ${error.message || error}`);
    }).finally(() => {
      if (!cancelled) setDataLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Refresh from Supabase when returning to the browser tab.
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshInProgress = false;

    const refreshLiveWorkspace = async () => {
      if (disposed || refreshInProgress) return;
      refreshInProgress = true;
      setWorkspaceRefreshing(true);
      try {
        const data = await dataService.loadWorkspace(userId);
        if (!disposed) {
          applyWorkspace(data);
          setDataError(null);
        }
      } catch (error) {
        if (!disposed) reportSaveError(error);
      } finally {
        refreshInProgress = false;
        if (!disposed) setWorkspaceRefreshing(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void refreshLiveWorkspace(); }, 300);
    };

    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);

  const reportSaveError = (error: unknown) => {
    if (error && typeof error === 'object') {
      const detail = error as { message?: string; code?: string; details?: string; hint?: string };
      const parts = [detail.code, detail.message, detail.details, detail.hint].filter(Boolean);
      setDataError(`Supabase request failed: ${parts.join(' — ') || String(error)}`);
      return;
    }
    setDataError(`Supabase request failed: ${String(error)}`);
  };

  const describeSaveError = (error: unknown): string => {
    if (error && typeof error === 'object') {
      const detail = error as { message?: string; code?: string; details?: string; hint?: string };
      return [detail.code, detail.message, detail.details, detail.hint].filter(Boolean).join(' — ') || String(error);
    }
    return String(error);
  };

  const applyWorkspace = (data: WorkspaceData) => {
    setExpenses(data.expenses);
    setBudget(data.budget);
    setHabits(data.habits);
    setTasks(data.tasks);
    wellnessRef.current = data.wellness;
    setWellness(data.wellness);
    setCategories(data.categories);
  };

  const refreshWorkspace = async () => {
    if (!user || workspaceRefreshing) return;
    setWorkspaceRefreshing(true);
    try {
      applyWorkspace(await dataService.loadWorkspace(user.id));
      setDataError(null);
    } catch (error) {
      reportSaveError(error);
    } finally {
      setWorkspaceRefreshing(false);
    }
  };

  const trackCloudRequest = async (request: Promise<unknown>): Promise<boolean> => {
    setCloudPendingCount(count => count + 1);
    try {
      await request;
      setDataError(null);
      return true;
    } catch (error) {
      reportSaveError(error);
      if (user) {
        try {
          applyWorkspace(await dataService.loadWorkspace(user.id));
        } catch (refreshError) {
          reportSaveError(refreshError);
        }
      }
      return false;
    } finally {
      setCloudPendingCount(count => Math.max(0, count - 1));
    }
  };

  const trackKeyedCloudRequest = async (key: string, request: Promise<unknown>): Promise<boolean> => {
    setSavingKeys(current => new Set(current).add(key));
    try {
      return await trackCloudRequest(request);
    } finally {
      setSavingKeys(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const updateCategories = (next: CategorySettings) => {
    setCategories(next);
    if (user) trackCloudRequest(dataService.saveCategories(user.id, next));
  };

  const saveHabitCategories = async (habitCategories: string[]): Promise<boolean> => {
    const next = { ...categories, habits: habitCategories };
    setCategories(next);
    if (!user) return false;
    return trackKeyedCloudRequest('habit:categories', dataService.saveCategories(user.id, next));
  };

  const saveTaskCategories = async (taskCategories: string[]): Promise<boolean> => {
    const next = { ...categories, tasks: taskCategories };
    setCategories(next);
    if (!user) return true;
    return trackKeyedCloudRequest('task:categories', dataService.saveCategories(user.id, next));
  };

  const saveExpenseCategories = async (expenseCategories: CategorySettings['expenses']): Promise<boolean> => {
    const next = { ...categories, expenses: expenseCategories };
    setCategories(next);
    if (!user) return true;
    return trackKeyedCloudRequest('expense:categories', dataService.saveCategories(user.id, next));
  };

  const saveHabitOrder = async (habitOrder: string[]): Promise<boolean> => {
    const next = { ...categories, habitOrder };
    setCategories(next);
    if (!user) return false;
    return trackKeyedCloudRequest('habit:order', dataService.saveCategories(user.id, next));
  };

  // Habit Handlers (Module 1 - same as previous first code)
  const handleToggleHabit = (habitId: string, dateIso: string) => {
    const targetWeekday = new Date(`${dateIso}T00:00:00`).getDay();
    const targetHabit = habits.find(habit => habit.id === habitId);
    if (!targetHabit || !(targetHabit.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(targetWeekday)) return;
    const updated = habits.map(h => {
      if (h.id !== habitId) return h;
      const isCompleted = h.completedDates.includes(dateIso);
      const newDates = isCompleted
        ? h.completedDates.filter(d => d !== dateIso)
        : [...h.completedDates, dateIso];

      // Recompute streak
      let currentStreak = 0;
      const checkDate = new Date();
      const todayString = formatDate(checkDate);
      let inspect = new Date();

      if (!newDates.includes(todayString)) {
        inspect.setDate(inspect.getDate() - 1);
      }

      while (newDates.includes(formatDate(inspect))) {
        currentStreak++;
        inspect.setDate(inspect.getDate() - 1);
      }

      const bestStreak = Math.max(h.bestStreak, currentStreak);

      return {
        ...h,
        completedDates: newDates,
        streak: currentStreak,
        bestStreak
      };
    });

    setHabits(updated);
    const changed = updated.find(h => h.id === habitId);
    if (user && changed) void trackKeyedCloudRequest(`habit:${habitId}:${dateIso}`, dataService.saveHabit(user.id, changed));
  };

  const handleAddHabit = async (newHabit: Omit<Habit, 'id' | 'completedDates' | 'streak' | 'bestStreak'>): Promise<boolean> => {
    const created: Habit = {
      ...newHabit,
      id: createUuid(),
      completedDates: [],
      streak: 0,
      bestStreak: 0
    };
    const updated = [...habits, created];
    setHabits(updated);
    if (!user) return false;
    return trackKeyedCloudRequest('habit:add', dataService.saveHabit(user.id, created));
  };

  const handleUpdateHabit = async (id: string, partial: Partial<Habit>): Promise<boolean> => {
    const updated = habits.map(h => (h.id === id ? { ...h, ...partial } : h));
    setHabits(updated);
    const changed = updated.find(h => h.id === id);
    if (!user || !changed) return false;
    return trackKeyedCloudRequest(`habit:update:${id}`, dataService.saveHabit(user.id, changed));
  };

  const handleDeleteHabit = async (id: string): Promise<boolean> => {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    if (!user) return false;
    return trackKeyedCloudRequest(`habit:delete:${id}`, dataService.deleteHabit(user.id, id));
  };

  // Task Handlers (Module 2 - same as previous first code)
  const handleAddTask = (newTask: Omit<DailyTask, 'id' | 'completed'>) => {
    const created: DailyTask = {
      ...newTask,
      id: createUuid(),
      completed: false
    };
    const updated = [created, ...tasks];
    setTasks(updated);
    if (user) return trackKeyedCloudRequest('task:add', dataService.saveTask(user.id, created));
  };

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return false;

    const changed: DailyTask = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? Date.now() : undefined
    };

    const applyChange = () => {
      setTasks(current => current.map(item => item.id === taskId ? changed : item));
      return true;
    };

    if (!user) return applyChange();
    return trackKeyedCloudRequest(`task:${taskId}`, dataService.saveTask(user.id, changed)).then(saved => {
      if (!saved) return false;
      return applyChange();
    });
  };

  const handleUpdateTask = (taskId: string, changes: Partial<DailyTask>) => {
    const changed = tasks.find(task => task.id === taskId);
    if (!changed) return;
    const nextTask = { ...changed, ...changes };
    setTasks(current => current.map(task => task.id === taskId ? nextTask : task));
    if (user) return trackKeyedCloudRequest(`task:update:${taskId}`, dataService.saveTask(user.id, nextTask));
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    if (user) return trackKeyedCloudRequest(`task:delete:${taskId}`, dataService.deleteTask(user.id, taskId));
  };

  // Expense Handlers (New Dedicated Expense Model)
  const handleAddExpense = async (newExp: Omit<Expense, 'id' | 'createdAt'>): Promise<boolean | string> => {
    const created: Expense = {
      ...newExp,
      id: createUuid(),
      createdAt: Date.now()
    };
    if (!user) return 'You must be signed in to save a transaction.';
    setCloudPendingCount(count => count + 1);
    try {
      await dataService.createExpense(user.id, created);
      setDataError(null);
      setExpenses(current => [created, ...current]);
      return true;
    } catch (error) {
      const message = `Supabase request failed: ${describeSaveError(error)}`;
      setDataError(message);
      return message;
    } finally {
      setCloudPendingCount(count => Math.max(0, count - 1));
    }
  };

  const handleUpdateExpense = async (id: string, partial: Partial<Expense>): Promise<boolean | string> => {
    const existing = expenses.find(expense => expense.id === id);
    if (!existing) return 'Transaction could not be found.';
    if (!user) return 'You must be signed in to update a transaction.';
    const updated = { ...existing, ...partial };
    setCloudPendingCount(count => count + 1);
    try {
      await dataService.saveExpense(user.id, updated);
      setExpenses(current => current.map(expense => expense.id === id ? updated : expense));
      setDataError(null);
      return true;
    } catch (error) {
      const message = `Supabase request failed: ${describeSaveError(error)}`;
      setDataError(message);
      return message;
    } finally {
      setCloudPendingCount(count => Math.max(0, count - 1));
    }
  };

  const handleDeleteExpense = async (id: string): Promise<boolean | string> => {
    if (!user) return 'You must be signed in to delete a transaction.';
    setCloudPendingCount(count => count + 1);
    try {
      await dataService.deleteExpense(user.id, id);
      setExpenses(current => current.filter(expense => expense.id !== id));
      setDataError(null);
      return true;
    } catch (error) {
      const message = `Supabase request failed: ${describeSaveError(error)}`;
      setDataError(message);
      return message;
    } finally {
      setCloudPendingCount(count => Math.max(0, count - 1));
    }
  };

  const handleUpdateBudget = (newBudget: BudgetConfig) => {
    setBudget(newBudget);
    if (user) trackCloudRequest(dataService.saveBudget(user.id, newBudget));
  };

  // Wellness Handler
  const handleUpdateWellness = (date: string, partial: Partial<DailyWellness>) => {
    const existing = wellnessRef.current[date] || {
      date,
      waterGlasses: 0,
      sleepHours: 7.5,
      energyScore: 3,
      journalNotes: '',
      gratitude: ''
    };
    const updatedItem = { ...existing, ...partial };
    const updated = { ...wellnessRef.current, [date]: updatedItem };
    wellnessRef.current = updated;
    setWellness(updated);
    if (user) {
      const previousSave = wellnessSaveQueue.current.get(date) || Promise.resolve();
      const saveRequest = previousSave.catch(() => undefined).then(() => dataService.saveWellness(user.id, updatedItem));
      wellnessSaveQueue.current.set(date, saveRequest);
      void trackKeyedCloudRequest(`wellness:${date}`, saveRequest).finally(() => {
        if (wellnessSaveQueue.current.get(date) === saveRequest) wellnessSaveQueue.current.delete(date);
      });
    }
  };

  // Export & Backup
  const handleExportCSV = () => {
    const csvContent = exportExpensesAsCSV(expenses);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daymark_expenses_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = async () => {
    await trackCloudRequest((async () => {
      const notes = await notesService.getNotes();
      const jsonStr = exportAllDataAsJSON({ expenses, budget, habits, tasks, wellness, notes, categories });
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `daymark_backup_${formatDate(new Date())}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    })());
  };

  const handleImportJSON = async (data: Partial<WorkspaceData>) => {
    if (!user) return;
    await trackCloudRequest((async () => {
      await dataService.importWorkspace(user.id, data);
      const refreshed = await dataService.loadWorkspace(user.id);
      applyWorkspace(refreshed);
      alert('Backup data restored to Supabase successfully!');
    })());
  };

  const handleResetData = async () => {
    if (!user) return;
    await trackCloudRequest((async () => {
      await dataService.resetWorkspace(user.id);
      setExpenses([]);
      setBudget({ monthlyBudget: 30000, dailyBudget: 1000, weeklyBudget: 7000, currency: '₹', categoryBudgets: {} });
      setHabits([]);
      setTasks([]);
      setWellness({});
      setCategories({ expenses: {}, habits: [], tasks: [] });
      setDataError(null);
    })());
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const openQuickLog = (tab: 'expense' | 'task' | 'habit' = 'expense') => {
    setQuickLogTab(tab);
    setIsQuickLogOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 font-mono text-xs">
        Loading Daymark workspace...
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={newUser => setUser(newUser)} />;
  }

  return (
    <Layout
      currentView={currentView}
      onSelectView={setCurrentView}
      user={user}
      onSignOut={handleSignOut}
      isDarkMode={isDarkMode}
      onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      onRefreshData={refreshWorkspace}
      isRefreshingData={workspaceRefreshing}
      isSyncing={false}
    >
      {dataLoading && <div role="status" aria-live="polite" className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading your Supabase workspace…</div>}
      {dataError && <div role="alert" className="mx-4 mt-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{dataError}</div>}
      {/* 1. Daily Overview Dashboard */}
      {currentView === 'daily' && (
        <DailyOverview
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          habits={habits}
          tasks={tasks}
          savingKeys={savingKeys}
          wellness={wellness}
          expenses={expenses}
          budget={budget}
          onToggleHabit={handleToggleHabit}
          onToggleTask={handleToggleTask}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          onUpdateWellness={handleUpdateWellness}
          onQuickLogExpense={() => openQuickLog('expense')}
          onOpenAddHabit={() => setCurrentView('habits')}
        />
      )}

      {/* 2. Habit Tracker (Module 1 - same as previous first code) */}
      {currentView === 'habits' && (
        <HabitsView
          habits={habits}
          onAddHabit={handleAddHabit}
          onUpdateHabit={handleUpdateHabit}
          onDeleteHabit={handleDeleteHabit}
          onToggleHabit={handleToggleHabit}
          wellness={wellness}
          onUpdateWellness={handleUpdateWellness}
          selectedDate={selectedDate}
          customCategories={categories.habits}
          savingKeys={savingKeys}
          habitOrder={categories.habitOrder}
          onSaveCustomCategories={saveHabitCategories}
          onSaveHabitOrder={saveHabitOrder}
        />
      )}

      {/* 3. Daily Tasks & Priorities (Module 2 - same as previous first code) */}
      {currentView === 'tasks' && (
        <TasksView
          tasks={tasks}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
          savingKeys={savingKeys}
          customCategories={categories.tasks}
          onSaveCustomCategories={saveTaskCategories}
        />
      )}

      {/* 3b. Notes & Journal Module with Image & Supabase Support */}
      {currentView === 'notes' && (
        <NotesView
          currencySymbol={budget.currency}
        />
      )}

      {/* 4. Dedicated Expense Dashboard (New Model) */}
      {currentView === 'expenses' && (
        <ExpenseDashboard
          expenses={expenses}
          budget={budget}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          onUpdateBudget={handleUpdateBudget}
          onExportCSV={handleExportCSV}
          customCategories={categories.expenses}
          onSaveCustomCategories={saveExpenseCategories}
        />
      )}

      {/* 5. Performance Analytics & Recharts Trends */}
      {currentView === 'reports' && (
        <ReportsPage
          habits={habits}
          tasks={tasks}
          expenses={expenses}
          wellness={wellness}
          budget={budget}
        />
      )}

      {/* 6. History & Data Management */}
      {currentView === 'history' && (
        <HistoryReportsView
          expenses={expenses}
          habits={habits}
          tasks={tasks}
          wellness={wellness}
          budget={budget}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onResetData={handleResetData}
          isCloudSyncing={cloudPendingCount > 0}
        />
      )}

      {/* Global Quick Log Modal */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onAddExpense={exp => {
          handleAddExpense({
            title: exp.title,
            amount: exp.amount,
            category: exp.category,
            date: exp.entry_date,
            paymentMethod: exp.payment_method,
            type: exp.type,
            account: exp.account || 'expense',
            isTransfer: exp.is_transfer,
            notes: exp.notes
          });
        }}
        onAddTask={t => {
          handleAddTask({
            date: selectedDate,
            title: t.title,
            priority: t.priority,
            timeEstimateMin: t.time_estimate_min,
            category: t.category
          });
        }}
        habits={habits.map(h => ({
          id: h.id,
          title: h.title,
          color: h.color,
          completedDates: h.completedDates
        }))}
        onToggleHabit={habitId => handleToggleHabit(habitId, selectedDate)}
        selectedDate={selectedDate}
        currencySymbol={budget.currency || '₹'}
        initialTab={quickLogTab}
        customCategories={categories.expenses}
      />
    </Layout>
  );
}
