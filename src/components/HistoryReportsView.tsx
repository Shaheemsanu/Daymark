import React, { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, LoaderCircle } from 'lucide-react';
import { Expense, Habit, DailyTask, DailyWellness, BudgetConfig } from '../types';
import { formatCurrency } from '../utils/constants';

interface HistoryReportsViewProps {
  expenses: Expense[];
  habits: Habit[];
  tasks: DailyTask[];
  wellness: Record<string, DailyWellness>;
  budget: BudgetConfig;
  onExportJSON: () => void;
  onImportJSON: (importedData: any) => void;
  onResetData: () => void;
  isCloudSyncing: boolean;
}

export const HistoryReportsView: React.FC<HistoryReportsViewProps> = ({
  expenses,
  habits,
  tasks,
  wellness,
  budget,
  onExportJSON,
  onImportJSON,
  onResetData,
  isCloudSyncing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const totalHistoricalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const totalTasksCompleted = tasks.filter(t => t.completed).length;

  // Wellness averages
  const wellnessEntries = Object.values(wellness);
  const avgSleep = wellnessEntries.length > 0
    ? (wellnessEntries.reduce((s, w) => s + (w.sleepHours || 0), 0) / wellnessEntries.length).toFixed(1)
    : '0';
  const avgWater = wellnessEntries.length > 0
    ? (wellnessEntries.reduce((s, w) => s + (w.waterGlasses || 0), 0) / wellnessEntries.length).toFixed(1)
    : '0';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImportJSON(json);
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Historical Audits & Data Management
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>Aggregate system telemetry</span>
          <span aria-hidden="true">·</span>
          <span>Supabase account data backup</span>
          <span aria-hidden="true">·</span>
          <span>Portable JSON data export</span>
        </div>
      </div>

      {/* Aggregate Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Total Tracked Disbursements
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
            {formatCurrency(totalHistoricalSpend, budget.currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{expenses.length} ledger transactions</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Priorities Accomplished
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
            {totalTasksCompleted}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">of {tasks.length} recorded items</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Average Sleep Duration
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
            {avgSleep}h
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Across recorded logs</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Average Water Intake
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {avgWater} <span className="text-sm font-normal text-slate-400">glasses</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">~{Math.round(parseFloat(avgWater) * 250)}ml daily average</p>
        </div>
      </div>

      {/* Data Import / Export / Backup Panel */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Data Portability & Backup
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your tracker and expense data is stored in your Supabase account. Export a backup or restore one to this account at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Export JSON */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-medium text-xs">
              <Download className="w-4 h-4 text-blue-500" />
              <span>Full Data Export (JSON)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Downloads complete snapshots of expenses, habits, tasks, and wellness journals.
            </p>
            <button
              onClick={onExportJSON}
              disabled={isCloudSyncing}
              className="w-full py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isCloudSyncing ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Syncing…</span> : 'Download Backup'}
            </button>
          </div>

          {/* Import JSON */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-medium text-xs">
              <Upload className="w-4 h-4 text-emerald-500" />
              <span>Restore from Backup (JSON)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Restore a JSON backup into your signed-in Supabase account.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isCloudSyncing}
              className="w-full py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isCloudSyncing ? 'Uploading to Supabase…' : 'Choose Backup File'}
            </button>
          </div>

          {/* Reset All Data */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium text-xs">
              <RotateCcw className="w-4 h-4" />
              <span>Reset All Data</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Erases all Daymark records in your Supabase account to start fresh.
            </p>
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="w-full py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
            >
              Reset All Data
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 mx-2 sm:mx-auto">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Reset All Data?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanent data erasure</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to reset all tracker data? All logged expenses, habits, tasks, and daily wellness records will be permanently erased.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  onResetData();
                }}
                disabled={isCloudSyncing}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
              >
                {isCloudSyncing ? 'Resetting…' : 'Reset All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

