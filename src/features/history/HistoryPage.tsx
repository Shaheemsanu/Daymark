import React, { useState, useMemo, useRef } from 'react';
import {
  Task,
  TaskEntry,
  CustomTracker,
  TrackerEntry,
  DailyNote,
  Expense,
  BudgetConfig
} from '../../lib/types';
import { formatHeaderDate, formatShortDate } from '../../lib/dateUtils';
import { exportTasksAsCSV, exportExpensesAsCSV, exportFullBackupJSON, downloadBlob } from '../../lib/exportUtils';
import {
  Calendar,
  Search,
  Download,
  Upload,
  Filter,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  FileText,
  RotateCcw
} from 'lucide-react';

interface HistoryPageProps {
  tasks: Task[];
  taskEntries: TaskEntry[];
  trackers: CustomTracker[];
  trackerEntries: TrackerEntry[];
  notes: DailyNote[];
  expenses: Expense[];
  budget: BudgetConfig;
  onRestoreBackup: (data: any) => void;
  onResetToDemo: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  tasks,
  taskEntries,
  trackers,
  trackerEntries,
  notes,
  expenses,
  budget,
  onRestoreBackup,
  onResetToDemo
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'tasks' | 'expenses' | 'notes'>('tasks');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // Filtered task entries
  const filteredTaskEntries = useMemo(() => {
    return taskEntries.filter(entry => {
      const task = taskMap.get(entry.task_id);
      const matchesSearch =
        !searchQuery ||
        (task?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.entry_date.includes(searchQuery);

      const matchesCategory =
        selectedCategoryFilter === 'all' || task?.category === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    }).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [taskEntries, taskMap, searchQuery, selectedCategoryFilter]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch =
        !searchQuery ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.entry_date.includes(searchQuery) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategoryFilter === 'all' || e.category === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    }).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [expenses, searchQuery, selectedCategoryFilter]);

  // Export handlers
  const handleExportTasksCSV = () => {
    const csv = exportTasksAsCSV(tasks, taskEntries);
    downloadBlob(csv, `daymark_tasks_history_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const handleExportExpensesCSV = () => {
    const csv = exportExpensesAsCSV(expenses);
    downloadBlob(csv, `daymark_expenses_history_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const handleExportBackupJSON = () => {
    const jsonStr = exportFullBackupJSON({
      tasks,
      taskEntries,
      trackers,
      trackerEntries,
      notes,
      expenses,
      budget
    });
    downloadBlob(jsonStr, `daymark_full_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        onRestoreBackup(parsed);
      } catch {
        alert('Invalid backup JSON format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Historical Archive &amp; Data Portability
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Query historical states</span>
            <span aria-hidden="true">·</span>
            <span>CSV and JSON backup export</span>
          </div>
        </div>

        {/* Export action triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportTasksCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
            <span>Tasks CSV</span>
          </button>

          <button
            onClick={handleExportExpensesCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Expenses CSV</span>
          </button>

          <button
            onClick={handleExportBackupJSON}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Full JSON Backup</span>
          </button>
        </div>
      </div>

      {/* Backup and Restore Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Restore from JSON Backup
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Import a previously downloaded Daymark snapshot
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            Choose File
          </button>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Reset Demo Sandbox
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Reset to 14 days of realistic sample data
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Reset tracker state to default demo dataset?')) {
                onResetToDemo();
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
          >
            Reset Data
          </button>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        {/* Switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Tasks History ({filteredTaskEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'expenses'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Expenses History ({filteredExpenses.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'notes'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Daily Notes ({notes.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search records by title, date..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Table content */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {activeTab === 'tasks' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Task Name</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTaskEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No task entries match the query.
                    </td>
                  </tr>
                ) : (
                  filteredTaskEntries.map(entry => {
                    const task = taskMap.get(entry.task_id);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {entry.entry_date}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                          {task?.title || 'Unknown Task'}
                        </td>
                        <td className="py-3 px-4 uppercase text-[10px] font-mono text-slate-400">
                          {task?.priority || 'medium'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              entry.status === 'complete'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : entry.status === 'skipped'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {entry.status === 'complete'
                              ? 'Completed ✓'
                              : entry.status === 'skipped'
                              ? 'Skipped'
                              : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Merchant / Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No expense records found.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {item.entry_date}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.category}</td>
                      <td className="py-3 px-4 text-slate-400">{item.payment_method}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        ${item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No notes recorded yet.</div>
            ) : (
              notes.map(note => (
                <div key={note.id} className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {note.entry_date}
                    </span>
                    <span className="text-slate-400 capitalize">{note.mood || 'neutral'}</span>
                  </div>
                  {note.gratitude && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Highlight: {note.gratitude}
                    </p>
                  )}
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {note.content || '(Empty notes)'}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
