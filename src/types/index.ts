export type ExpenseCategory =
  | 'Housing'
  | 'Food & Dining'
  | 'Groceries'
  | 'Transportation'
  | 'Utilities'
  | 'Entertainment'
  | 'Health & Fitness'
  | 'Shopping'
  | 'Personal Care'
  | 'Subscriptions'
  | 'Education'
  | 'Other'
  | string;

export type PaymentMethod =
  | 'UPI / QR'
  | 'Cash'
  | 'Debit Card'
  | 'Credit Card'
  | 'Net Banking'
  | 'Digital Wallet'
  | string;

export type SpendType = 'need' | 'want' | 'savings';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  type?: 'expense' | 'income'; // Outflow vs Inflow
  account?: 'expense' | 'savings' | 'cash'; // 💳 Expense Account vs 🏦 Savings Account vs 💵 Cash in Hand
  isTransfer?: boolean; // Transfer from Savings to Expense Account
  notes?: string;
  isRecurring?: boolean;
  spendType?: SpendType;
  createdAt: number;
}

export interface CategoryInfo {
  name: string;
  color: string;
  defaultSpendType: SpendType;
  description: string;
  isCustom?: boolean;
}

export interface BudgetConfig {
  monthlyBudget: number;
  dailyBudget: number;
  weeklyBudget: number;
  currency: string;
  categoryBudgets: Partial<Record<ExpenseCategory, number>>;
}

export type HabitCategory = 'Health' | 'Mindfulness' | 'Productivity' | 'Fitness' | 'Personal' | string;

export interface Habit {
  id: string;
  title: string;
  category: HabitCategory;
  targetDaysPerWeek: number;
  weekdays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  completedDates: string[]; // YYYY-MM-DD
  streak: number;
  bestStreak: number;
  color: string;
}

export type TaskPriority = 'high' | 'medium' | 'low';

export interface DailyTask {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  completed: boolean;
  priority: TaskPriority;
  timeEstimateMin?: number;
  category?: string;
  completedAt?: number;
}

export type MoodType = 'great' | 'good' | 'neutral' | 'low' | 'stressed';

export interface DailyWellness {
  date: string; // YYYY-MM-DD
  mood?: MoodType;
  waterGlasses: number; // Goal: 8
  sleepHours: number;
  energyScore: number; // 1 to 5
  journalNotes: string;
  gratitude: string;
}

export interface AppProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt?: number;
}

