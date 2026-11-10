import React, { useState, useEffect } from 'react';
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
  loadExpenses,
  saveExpenses,
  loadBudgetConfig,
  saveBudgetConfig,
  loadHabits,
  saveHabits,
  loadTasks,
  saveTasks,
  loadWellness,
  saveWellness,
  resetAllData,
  exportAllDataAsJSON,
  exportExpensesAsCSV
} from '../utils/storage';
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

export default function App() {
  const [user, setUser] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation - Daily Overview 1st, Expense 2nd after overview
  const [currentView, setCurrentView] = useState<NavView>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('daymark_theme_pref') === 'dark' ||
      (!('daymark_theme_pref' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  // Core Data States
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<BudgetConfig>({
    monthlyBudget: 30000,
    currency: '₹',
    categoryBudgets: {}
  });
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [wellness, setWellness] = useState<Record<string, DailyWellness>>({});

  // Quick Log Drawer
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogTab, setQuickLogTab] = useState<'expense' | 'task' | 'habit'>('expense');

  // Sync theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('daymark_theme_pref', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('daymark_theme_pref', 'light');
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
    if (!user) return;
    setExpenses(loadExpenses());
    setBudget(loadBudgetConfig());
    setHabits(loadHabits());
    setTasks(loadTasks());
    setWellness(loadWellness());
  }, [user]);

  // Habit Handlers (Module 1 - same as previous first code)
  const handleToggleHabit = (habitId: string, dateIso: string) => {
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
    saveHabits(updated);
  };

  const handleAddHabit = (newHabit: Omit<Habit, 'id' | 'completedDates' | 'streak' | 'bestStreak'>) => {
    const created: Habit = {
      ...newHabit,
      id: `hab-${Date.now()}`,
      completedDates: [],
      streak: 0,
      bestStreak: 0
    };
    const updated = [...habits, created];
    setHabits(updated);
    saveHabits(updated);
  };

  const handleUpdateHabit = (id: string, partial: Partial<Habit>) => {
    const updated = habits.map(h => (h.id === id ? { ...h, ...partial } : h));
    setHabits(updated);
    saveHabits(updated);
  };

  const handleDeleteHabit = (id: string) => {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    saveHabits(updated);
  };

  // Task Handlers (Module 2 - same as previous first code)
  const handleAddTask = (newTask: Omit<DailyTask, 'id' | 'completed'>) => {
    const created: DailyTask = {
      ...newTask,
      id: `tsk-${Date.now()}`,
      completed: false
    };
    const updated = [created, ...tasks];
    setTasks(updated);
    saveTasks(updated);
  };

  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map(t =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
        : t
    );
    setTasks(updated);
    saveTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveTasks(updated);
  };

  // Expense Handlers (New Dedicated Expense Model)
  const handleAddExpense = (newExp: Omit<Expense, 'id' | 'createdAt'>) => {
    const created: Expense = {
      ...newExp,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };
    const updated = [created, ...expenses];
    setExpenses(updated);
    saveExpenses(updated);
  };

  const handleUpdateExpense = (id: string, partial: Partial<Expense>) => {
    const updated = expenses.map(e => (e.id === id ? { ...e, ...partial } : e));
    setExpenses(updated);
    saveExpenses(updated);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    saveExpenses(updated);
  };

  const handleUpdateBudget = (newBudget: BudgetConfig) => {
    setBudget(newBudget);
    saveBudgetConfig(newBudget);
  };

  // Wellness Handler
  const handleUpdateWellness = (date: string, partial: Partial<DailyWellness>) => {
    const existing = wellness[date] || {
      date,
      waterGlasses: 0,
      sleepHours: 7.5,
      energyScore: 3,
      journalNotes: '',
      gratitude: ''
    };
    const updated = {
      ...wellness,
      [date]: { ...existing, ...partial }
    };
    setWellness(updated);
    saveWellness(updated);
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

  const handleExportJSON = () => {
    const jsonStr = exportAllDataAsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daymark_backup_${formatDate(new Date())}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (data: any) => {
    if (data.expenses && Array.isArray(data.expenses)) {
      setExpenses(data.expenses);
      saveExpenses(data.expenses);
    }
    if (data.budget) {
      setBudget(data.budget);
      saveBudgetConfig(data.budget);
    }
    if (data.habits && Array.isArray(data.habits)) {
      setHabits(data.habits);
      saveHabits(data.habits);
    }
    if (data.tasks && Array.isArray(data.tasks)) {
      setTasks(data.tasks);
      saveTasks(data.tasks);
    }
    if (data.wellness) {
      setWellness(data.wellness);
      saveWellness(data.wellness);
    }
    alert('Backup data restored successfully!');
  };

  const handleResetData = () => {
    resetAllData();
    setExpenses(loadExpenses());
    setBudget(loadBudgetConfig());
    setHabits(loadHabits());
    setTasks(loadTasks());
    setWellness(loadWellness());
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
      onOpenQuickLog={tab => openQuickLog(tab || 'expense')}
    >
      {/* 1. Daily Overview Dashboard */}
      {currentView === 'daily' && (
        <DailyOverview
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          habits={habits}
          tasks={tasks}
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
        />
      )}

      {/* 3. Daily Tasks & Priorities (Module 2 - same as previous first code) */}
      {currentView === 'tasks' && (
        <TasksView
          tasks={tasks}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
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
      />
    </Layout>
  );
}
