import { Expense } from '../types';
import { WorkspaceData } from '../features/data/dataService';

export const exportAllDataAsJSON = (data: WorkspaceData): string => JSON.stringify({
  expenses: data.expenses,
  budget: data.budget,
  habits: data.habits,
  tasks: data.tasks,
  wellness: data.wellness,
  notes: data.notes,
  categories: data.categories,
  exportedAt: new Date().toISOString(),
  version: '2.0'
}, null, 2);

export const exportExpensesAsCSV = (expenses: Expense[]): string => {
  const headers = ['Date', 'Title', 'Amount', 'Category', 'Payment Method', 'Spend Type', 'Recurring', 'Notes'];
  const rows = expenses.map(e => [
    `"${e.date}"`,
    `"${e.title.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    `"${e.category}"`,
    `"${e.paymentMethod}"`,
    `"${e.spendType || 'need'}"`,
    e.isRecurring ? 'Yes' : 'No',
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};
