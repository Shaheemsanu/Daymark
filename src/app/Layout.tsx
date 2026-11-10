import React, { useState } from 'react';
import { AppProfile } from '../lib/types';
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  IndianRupee,
  BarChart3,
  Archive,
  Plus,
  Sun,
  Moon,
  LogOut,
  FileText
} from 'lucide-react';

export type NavView = 'expenses' | 'daily' | 'habits' | 'tasks' | 'notes' | 'reports' | 'history';

interface LayoutProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  user: AppProfile | null;
  onSignOut: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenQuickLog: (tab?: 'expense' | 'task' | 'habit') => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentView,
  onSelectView,
  user,
  onSignOut,
  isDarkMode,
  onToggleDarkMode,
  onOpenQuickLog,
  children
}) => {
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col selection:bg-slate-200 dark:selection:bg-slate-800">
      {/* Top Header conforming to 3-zone contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-3">
          {/* Zone 1: Wordmark */}
          <button
            onClick={() => onSelectView('expenses')}
            className="flex items-center gap-2 text-left group shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 flex items-center justify-center font-bold text-sm shadow-xs">
              ₹
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap leading-none">
                Daymark
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                Tracker &amp; Expenses
              </span>
            </div>
          </button>

          {/* Zone 2: Navigation Links (Overview 1st, Expenses 2nd) */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => onSelectView('daily')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Overview</span>
            </button>
            <button
              onClick={() => onSelectView('expenses')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'expenses'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Expense Tracker</span>
            </button>
            <button
              onClick={() => onSelectView('habits')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'habits'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Habit Tracker</span>
            </button>
            <button
              onClick={() => onSelectView('tasks')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'tasks'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Daily Tasks</span>
            </button>
            <button
              onClick={() => onSelectView('notes')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'notes'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes &amp; Journal</span>
            </button>
            <button
              onClick={() => onSelectView('reports')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'reports'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics &amp; Trends</span>
            </button>
            <button
              onClick={() => onSelectView('history')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentView === 'history'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-semibold shadow-xs'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Data &amp; Backup</span>
            </button>
          </nav>

          {/* Zone 3: 3 Separated Quick Log Buttons & User Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* 3 Separated Quick Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onOpenQuickLog('expense')}
                className="flex w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/50 rounded-full sm:rounded-xl transition-all shadow-2xs items-center justify-center sm:justify-start gap-1 whitespace-nowrap"
                title="Add Expense"
              >
                <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">+ Expense</span>
              </button>
              <button
                onClick={() => onOpenQuickLog('task')}
                className="flex w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/50 border border-blue-200/60 dark:border-blue-800/50 rounded-full sm:rounded-xl transition-all shadow-2xs flex items-center justify-center sm:justify-start gap-1 whitespace-nowrap"
                title="Add Task"
              >
                <ListTodo className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="hidden sm:inline">+ Task</span>
              </button>
              <button
                onClick={() => onOpenQuickLog('habit')}
                className="flex w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:hover:bg-purple-900/50 border border-purple-200/60 dark:border-purple-800/50 rounded-full sm:rounded-xl transition-all shadow-2xs flex items-center justify-center sm:justify-start gap-1 whitespace-nowrap"
                title="Add Habit"
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="hidden sm:inline">+ Habit</span>
              </button>
            </div>

            {/* Dark Mode toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Sign Out with Confirmation Modal trigger */}
            {user && (
              <div className="flex items-center pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setIsSignOutConfirmOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Thumb-friendly touch targets) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden flex items-center justify-around h-16 px-2 shadow-xl">
        <button
          onClick={() => onSelectView('daily')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            currentView === 'daily'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Overview</span>
        </button>
        <button
          onClick={() => onSelectView('expenses')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            currentView === 'expenses'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IndianRupee className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Expenses</span>
        </button>
        <button
          onClick={() => onSelectView('habits')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            currentView === 'habits'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Habits</span>
        </button>
        <button
          onClick={() => onSelectView('tasks')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            currentView === 'tasks'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Tasks</span>
        </button>
        <button
          onClick={() => onSelectView('notes')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            currentView === 'notes'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Notes</span>
        </button>
        <button
          onClick={() => onSelectView('reports')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            currentView === 'reports'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Analytics</span>
        </button>
      </nav>



      {/* Sign Out Confirmation Modal */}
      {isSignOutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 mx-2 sm:mx-auto">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm Sign Out</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sign out of current session</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to sign out of your account? Your local tracker data will remain stored in this browser.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsSignOutConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsSignOutConfirmOpen(false);
                  onSignOut();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Desktop only, hidden on mobile to avoid overlapping with bottom navigation bar) */}
      <footer className="hidden lg:block border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Daymark — Daily Todo &amp; Habit Tracker with Expense Intelligence</span>
          <span>Independent Daily Tracking · Real-time Analytics</span>
        </div>
      </footer>
    </div>
  );
};

