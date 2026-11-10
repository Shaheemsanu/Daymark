import React, { useState } from 'react';
import {
  Task,
  TaskEntry,
  CustomTracker,
  TrackerEntry,
  DailyNote,
  Expense,
  TaskStatus,
  BudgetConfig
} from '../../lib/types';
import {
  formatHeaderDate,
  getSurroundingDays,
  isDateToday,
  getTodayIso,
  parseDateIso,
  formatDateIso
} from '../../lib/dateUtils';
import { taskService } from '../tasks/taskService';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  MinusCircle,
  Plus,
  Droplet,
  Moon,
  Sparkles,
  DollarSign,
  Calendar,
  Check,
  TrendingDown
} from 'lucide-react';
import { addDays } from 'date-fns';

interface DashboardPageProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  tasks: Task[];
  taskEntries: TaskEntry[];
  trackers: CustomTracker[];
  trackerEntries: TrackerEntry[];
  notes: DailyNote[];
  expenses: Expense[];
  budget: BudgetConfig;
  onSetTaskStatus: (taskId: string, date: string, status: TaskStatus) => void;
  onUpdateTrackerEntry: (trackerId: string, numericVal?: number | null, boolVal?: boolean | null) => void;
  onUpdateNote: (date: string, partial: Partial<DailyNote>) => void;
  onQuickLogExpense: () => void;
  onNavigateToView: (view: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  selectedDate,
  onSelectDate,
  tasks,
  taskEntries,
  trackers,
  trackerEntries,
  notes,
  expenses,
  budget,
  onSetTaskStatus,
  onUpdateTrackerEntry,
  onUpdateNote,
  onQuickLogExpense,
  onNavigateToView
}) => {
  const isToday = isDateToday(selectedDate);
  const todayIso = getTodayIso();

  // Surrounding 7-day strip
  const surroundingDays = getSurroundingDays(selectedDate, 7);

  // Navigate date
  const changeDate = (deltaDays: number) => {
    const current = parseDateIso(selectedDate);
    const nextDate = addDays(current, deltaDays);
    onSelectDate(formatDateIso(nextDate));
  };

  // Scheduled tasks for this date's weekday
  const scheduledTasks = taskService.getScheduledTasksForDate(tasks, selectedDate);

  // Task entries count
  const completedTasksCount = scheduledTasks.filter(
    t => taskService.getTaskStatusForDate(taskEntries, t.id, selectedDate) === 'complete'
  ).length;

  const taskCompletionRate =
    scheduledTasks.length > 0
      ? Math.round((completedTasksCount / scheduledTasks.length) * 100)
      : 0;

  // Day's expenses
  const dayExpenses = expenses.filter(e => e.entry_date === selectedDate);
  const daySpendTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Day's note
  const currentNote = notes.find(n => n.entry_date === selectedDate);

  // Water & Sleep trackers
  const waterTracker = trackers.find(t => t.id === 'trk-1' || t.name.toLowerCase().includes('water'));
  const waterEntry = waterTracker
    ? trackerEntries.find(e => e.tracker_id === waterTracker.id && e.entry_date === selectedDate)
    : null;
  const currentWaterMl = waterEntry?.numeric_value ?? currentNote?.water_ml ?? 0;
  const targetWaterMl = waterTracker?.target_value ?? 2000;

  const sleepTracker = trackers.find(t => t.id === 'trk-2' || t.name.toLowerCase().includes('sleep'));
  const sleepEntry = sleepTracker
    ? trackerEntries.find(e => e.tracker_id === sleepTracker.id && e.entry_date === selectedDate)
    : null;
  const currentSleepHours = sleepEntry?.numeric_value ?? currentNote?.sleep_hours ?? 7.5;

  const adjustWater = (deltaMl: number) => {
    const nextVal = Math.max(0, currentWaterMl + deltaMl);
    if (waterTracker) {
      onUpdateTrackerEntry(waterTracker.id, nextVal, null);
    }
    onUpdateNote(selectedDate, { water_ml: nextVal });
  };

  const adjustSleep = (deltaHours: number) => {
    const nextVal = Math.max(0, Math.min(16, Number((currentSleepHours + deltaHours).toFixed(1))));
    if (sleepTracker) {
      onUpdateTrackerEntry(sleepTracker.id, nextVal, null);
    }
    onUpdateNote(selectedDate, { sleep_hours: nextVal });
  };

  return (
    <div className="space-y-8">
      {/* Date Header Card with 7-Day Quick Strip */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeDate(-1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatHeaderDate(selectedDate)}
                </h2>
                {isToday && (
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                    Today
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily Command Hub · Tasks, Habit Compliance &amp; Expense Velocity
              </p>
            </div>

            <button
              onClick={() => changeDate(1)}
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
              className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {/* 7-Day Strip */}
        <div className="grid grid-cols-7 gap-2 pt-4">
          {surroundingDays.map(item => (
            <button
              key={item.iso}
              onClick={() => onSelectDate(item.iso)}
              className={`p-2.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                item.isCurrent
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-sm font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider">{item.dayName}</span>
              <span className="text-base font-mono tabular-nums mt-0.5">{item.dayNumber}</span>
              {item.isToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Task Execution */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Scheduled Tasks</span>
            <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {taskCompletionRate}% DONE
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {completedTasksCount}{' '}
            <span className="text-sm text-slate-400 font-normal">/ {scheduledTasks.length} tasks</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${taskCompletionRate}%` }}
            />
          </div>
        </div>

        {/* Card 2: Water Hydration */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Hydration Log</span>
            <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
              {Math.round((currentWaterMl / Math.max(targetWaterMl, 1)) * 100)}% TARGET
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {currentWaterMl}{' '}
            <span className="text-sm text-slate-400 font-normal">/ {targetWaterMl} ml</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <button
              onClick={() => adjustWater(-250)}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              -250ml
            </button>
            <button
              onClick={() => adjustWater(250)}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              +250ml
            </button>
          </div>
        </div>

        {/* Card 3: Sleep Duration */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Sleep Duration</span>
            <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">REST</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {currentSleepHours} <span className="text-sm text-slate-400 font-normal">hours</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <button
              onClick={() => adjustSleep(-0.5)}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              -0.5h
            </button>
            <button
              onClick={() => adjustSleep(0.5)}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              +0.5h
            </button>
          </div>
        </div>

        {/* Card 4: Day's Expense Total */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Day's Disbursements</span>
            <span className="font-mono text-[11px] text-slate-400">{dayExpenses.length} entries</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            ${daySpendTotal.toFixed(2)}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <button
              onClick={onQuickLogExpense}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Spend</span>
            </button>
            <button
              onClick={() => onNavigateToView('expenses')}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[11px]"
            >
              View Analytics →
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Tasks) + Right Column (Habits & Notes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scheduled Recurring Tasks (Independent per Date) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Daily Priority Actions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tasks scheduled for {formatHeaderDate(selectedDate)}
                </p>
              </div>

              <button
                onClick={() => onNavigateToView('tasks')}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
              >
                Configure Routines →
              </button>
            </div>

            {/* Task list with 3-state control: Complete, Pending, Skipped */}
            <div className="space-y-2.5">
              {scheduledTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No recurring tasks scheduled for this day of the week.
                </div>
              ) : (
                scheduledTasks.map(task => {
                  const status = taskService.getTaskStatusForDate(taskEntries, task.id, selectedDate);
                  const isDone = status === 'complete';
                  const isSkipped = status === 'skipped';

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isDone
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : isSkipped
                          ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Check toggle */}
                        <button
                          onClick={() =>
                            onSetTaskStatus(
                              task.id,
                              selectedDate,
                              isDone ? 'pending' : 'complete'
                            )
                          }
                          className="shrink-0 transition-colors"
                          title="Toggle complete"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : isSkipped ? (
                            <MinusCircle className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-emerald-500" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <span
                            className={`text-xs font-medium block truncate ${
                              isDone
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : isSkipped
                                ? 'italic text-amber-700 dark:text-amber-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {task.category || 'General'} · {task.time_estimate_min || 30}m
                          </span>
                        </div>
                      </div>

                      {/* 3-State Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            onSetTaskStatus(
                              task.id,
                              selectedDate,
                              isDone ? 'pending' : 'complete'
                            )
                          }
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isDone ? 'Done ✓' : 'Complete'}
                        </button>

                        <button
                          onClick={() =>
                            onSetTaskStatus(
                              task.id,
                              selectedDate,
                              isSkipped ? 'pending' : 'skipped'
                            )
                          }
                          className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                            isSkipped
                              ? 'bg-amber-600 text-white'
                              : 'border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-400'
                          }`}
                          title="Skip for today"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Today's Expense Quick Log preview */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Transactions Recorded for {selectedDate}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total logged: <strong className="font-mono text-slate-800 dark:text-slate-200">${daySpendTotal.toFixed(2)}</strong>
                </p>
              </div>

              <button
                onClick={onQuickLogExpense}
                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </button>
            </div>

            <div className="space-y-2">
              {dayExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No disbursements logged for this date.</p>
              ) : (
                dayExpenses.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{item.title}</span>
                      <span className="text-[11px] text-slate-400 ml-2">({item.category})</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Trackers & Daily Note */}
        <div className="lg:col-span-5 space-y-6">
          {/* Custom Trackers Quick List */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Habit Metrics
              </h3>
              <button
                onClick={() => onNavigateToView('trackers')}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
              >
                All Trackers →
              </button>
            </div>

            <div className="space-y-3">
              {trackers.map(tr => {
                const entry = trackerEntries.find(
                  e => e.tracker_id === tr.id && e.entry_date === selectedDate
                );

                return (
                  <div
                    key={tr.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tr.color }}
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {tr.name}
                      </span>
                    </div>

                    {tr.type === 'boolean' ? (
                      <button
                        onClick={() =>
                          onUpdateTrackerEntry(
                            tr.id,
                            null,
                            !entry?.boolean_value
                          )
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          entry?.boolean_value
                            ? 'bg-emerald-500 text-white'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}
                      >
                        {entry?.boolean_value ? 'Done ✓' : 'Mark Done'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {entry?.numeric_value || 0} / {tr.target_value} {tr.unit}
                        </span>
                        <button
                          onClick={() => {
                            const curr = entry?.numeric_value || 0;
                            onUpdateTrackerEntry(tr.id, curr + (tr.target_value > 10 ? 5 : 1), null);
                          }}
                          className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Highlight / Gratitude Prompt */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Daily Focus &amp; Gratitude
              </h3>
              <button
                onClick={() => onNavigateToView('notes')}
                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Open Full Journal →
              </button>
            </div>

            <input
              type="text"
              value={currentNote?.gratitude || ''}
              onChange={e => onUpdateNote(selectedDate, { gratitude: e.target.value })}
              placeholder="What went well today? (Daily highlight)"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
            />

            <textarea
              rows={3}
              value={currentNote?.content || ''}
              onChange={e => onUpdateNote(selectedDate, { content: e.target.value })}
              placeholder="Quick observation or reflection..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
