import { Task, TaskEntry, CustomTracker, TrackerEntry, DailyNote, Expense, BudgetConfig } from './types';

export function exportTasksAsCSV(tasks: Task[], entries: TaskEntry[]): string {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const headers = ['Date', 'Task Title', 'Status', 'Priority', 'Category', 'Time Est (mins)', 'Completed At'];
  const rows = entries.map(e => {
    const t = taskMap.get(e.task_id);
    return [
      `"${e.entry_date}"`,
      `"${(t?.title || 'Unknown Task').replace(/"/g, '""')}"`,
      `"${e.status}"`,
      `"${t?.priority || 'medium'}"`,
      `"${t?.category || 'General'}"`,
      t?.time_estimate_min || 30,
      `"${e.completed_at || ''}"`
    ];
  });
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportExpensesAsCSV(expenses: Expense[]): string {
  const headers = ['Date', 'Title', 'Amount', 'Category', 'Classification', 'Payment Method', 'Recurring', 'Notes'];
  const rows = expenses.map(e => [
    `"${e.entry_date}"`,
    `"${e.title.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    `"${e.category}"`,
    `"${e.spend_type}"`,
    `"${e.payment_method}"`,
    e.is_recurring ? 'Yes' : 'No',
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportFullBackupJSON(data: {
  tasks: Task[];
  taskEntries: TaskEntry[];
  trackers: CustomTracker[];
  trackerEntries: TrackerEntry[];
  notes: DailyNote[];
  expenses: Expense[];
  budget: BudgetConfig;
}): string {
  const payload = {
    ...data,
    exported_at: new Date().toISOString(),
    version: '1.0.0',
    app: 'Daymark'
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
