import { describe, it, expect } from 'vitest';
import { calculateStreak, getWeekdayIndex, formatShortDate, isDateToday, getTodayIso, getPastNWeeks, getPastNMonths, getPastNYears } from '../lib/dateUtils';
import { exportTasksAsCSV, exportExpensesAsCSV, exportFullBackupJSON } from '../lib/exportUtils';
import { Task, TaskEntry, Expense, BudgetConfig } from '../lib/types';
import { subDays, format } from 'date-fns';

describe('Date & Tracker Logic', () => {
  it('correctly calculates weekday index', () => {
    // 2026-11-01 is Sunday = 0
    expect(getWeekdayIndex('2026-11-01')).toBe(0);
    // 2026-11-02 is Monday = 1
    expect(getWeekdayIndex('2026-11-02')).toBe(1);
    // 2026-11-07 is Saturday = 6
    expect(getWeekdayIndex('2026-11-07')).toBe(6);
  });

  it('calculates streaks correctly across continuous days', () => {
    const today = new Date();
    const d0 = format(today, 'yyyy-MM-dd');
    const d1 = format(subDays(today, 1), 'yyyy-MM-dd');
    const d2 = format(subDays(today, 2), 'yyyy-MM-dd');

    expect(calculateStreak([d0, d1, d2])).toBe(3);
    // Broken streak (gap yesterday)
    const d4 = format(subDays(today, 4), 'yyyy-MM-dd');
    expect(calculateStreak([d0, d4])).toBe(1);
    // Empty
    expect(calculateStreak([])).toBe(0);
  });

  it('formats short dates accurately', () => {
    expect(formatShortDate('2026-11-01')).toBe('Nov 1');
  });

  it('generates valid CSV content for tasks and expenses', () => {
    const mockTasks: Task[] = [
      { id: 't1', user_id: 'u1', title: 'Test Task', is_active: true, weekdays: [0, 1], priority: 'high', category: 'Dev' }
    ];
    const mockEntries: TaskEntry[] = [
      { id: 'e1', user_id: 'u1', task_id: 't1', entry_date: '2026-11-01', status: 'complete' }
    ];

    const taskCsv = exportTasksAsCSV(mockTasks, mockEntries);
    expect(taskCsv).toContain('Task Title');
    expect(taskCsv).toContain('Test Task');
    expect(taskCsv).toContain('complete');

    const mockExpenses: Expense[] = [
      {
        id: 'exp1',
        user_id: 'u1',
        entry_date: '2026-11-01',
        title: 'Groceries',
        amount: 85.50,
        category: 'Groceries',
        spend_type: 'need',
        payment_method: 'Credit Card'
      }
    ];

    const expCsv = exportExpensesAsCSV(mockExpenses);
    expect(expCsv).toContain('Groceries');
    expect(expCsv).toContain('85.50');
    expect(expCsv).toContain('need');
  });

  it('exports valid JSON structure for full system backup', () => {
    const backupJson = exportFullBackupJSON({
      tasks: [],
      taskEntries: [],
      trackers: [],
      trackerEntries: [],
      notes: [],
      expenses: [],
      budget: { user_id: 'u1', monthly_budget: 3200, currency: '$', category_budgets: {} }
    });

    const parsed = JSON.parse(backupJson);
    expect(parsed.app).toBe('Daymark');
    expect(parsed.version).toBe('1.0.0');
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(parsed.budget.monthly_budget).toBe(3200);
  });

  it('generates consistent intervals for Day, Week, Month, and Year analytics', () => {
    const weeks = getPastNWeeks(8);
    expect(weeks.length).toBe(8);
    expect(weeks[0].days.length).toBe(7);

    const months = getPastNMonths(6);
    expect(months.length).toBe(6);
    expect(months[0].days.length).toBeGreaterThanOrEqual(28);

    const years = getPastNYears(3);
    expect(years.length).toBe(3);
    expect(years[0].days.length).toBeGreaterThanOrEqual(365);
  });
});
