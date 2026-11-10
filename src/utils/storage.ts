import { Expense, BudgetConfig, Habit, DailyTask, DailyWellness, ExpenseCategory } from '../types';
import { DEFAULT_BUDGET, DEFAULT_CATEGORY_BUDGETS, formatDate } from './constants';

const STORAGE_KEYS = {
  EXPENSES: 'dailytrack_expenses_v1',
  BUDGET: 'dailytrack_budget_v1',
  HABITS: 'dailytrack_habits_v1',
  TASKS: 'dailytrack_tasks_v1',
  WELLNESS: 'dailytrack_wellness_v1',
  THEME: 'dailytrack_theme_v1'
};

// Generates clean initial data relative to current user
export function getInitialSeedData() {
  return {
    expenses: [] as Expense[],
    budget: {
      monthlyBudget: DEFAULT_BUDGET,
      currency: '₹',
      categoryBudgets: { ...DEFAULT_CATEGORY_BUDGETS }
    } as BudgetConfig,
    habits: [] as Habit[],
    tasks: [] as DailyTask[],
    wellness: {} as Record<string, DailyWellness>
  };
}

export const loadExpenses = (): Expense[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load expenses', e);
    return [];
  }
};

export const saveExpenses = (expenses: Expense[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  } catch (e) {
    console.error('Failed to save expenses', e);
  }
};

export const loadBudgetConfig = (): BudgetConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      const seed = getInitialSeedData();
      saveBudgetConfig(seed.budget);
      return seed.budget;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.currency || parsed.currency === '$') {
      parsed.currency = '₹';
      if (parsed.monthlyBudget === 3200) {
        parsed.monthlyBudget = DEFAULT_BUDGET;
      }
      saveBudgetConfig(parsed);
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load budget', e);
    return getInitialSeedData().budget;
  }
};

export const saveBudgetConfig = (config: BudgetConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save budget', e);
  }
};

export const loadHabits = (): Habit[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HABITS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load habits', e);
    return [];
  }
};

export const saveHabits = (habits: Habit[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
  } catch (e) {
    console.error('Failed to save habits', e);
  }
};

export const loadTasks = (): DailyTask[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load tasks', e);
    return [];
  }
};

export const saveTasks = (tasks: DailyTask[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks', e);
  }
};

export const loadWellness = (): Record<string, DailyWellness> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WELLNESS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load wellness', e);
    return {};
  }
};

export const saveWellness = (wellness: Record<string, DailyWellness>): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.WELLNESS, JSON.stringify(wellness));
  } catch (e) {
    console.error('Failed to save wellness', e);
  }
};

export const resetAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.BUDGET);
  localStorage.removeItem(STORAGE_KEYS.HABITS);
  localStorage.removeItem(STORAGE_KEYS.TASKS);
  localStorage.removeItem(STORAGE_KEYS.WELLNESS);
  const seed = getInitialSeedData();
  saveExpenses(seed.expenses);
  saveBudgetConfig(seed.budget);
  saveHabits(seed.habits);
  saveTasks(seed.tasks);
  saveWellness(seed.wellness);
};

export const exportAllDataAsJSON = (): string => {
  const data = {
    expenses: loadExpenses(),
    budget: loadBudgetConfig(),
    habits: loadHabits(),
    tasks: loadTasks(),
    wellness: loadWellness(),
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  return JSON.stringify(data, null, 2);
};

export const exportExpensesAsCSV = (expenses: Expense[]): string => {
  const headers = ['Date', 'Title', 'Amount', 'Category', 'Payment Method', 'Spend Type', 'Recurring', 'Notes'];
  const rows = expenses.map(e => [
    `"${e.date}"`,
    `"${e.title.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    `"${e.category}"`,
    `"${e.paymentMethod}"`,
    `"${e.spendType}"`,
    e.isRecurring ? 'Yes' : 'No',
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};
