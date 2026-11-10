export type TaskStatus = 'pending' | 'complete' | 'skipped';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  is_active: boolean;
  weekdays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  priority: TaskPriority;
  time_estimate_min?: number;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskEntry {
  id: string;
  user_id: string;
  task_id: string;
  entry_date: string; // YYYY-MM-DD
  status: TaskStatus;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type TrackerType = 'numeric' | 'boolean';

export interface CustomTracker {
  id: string;
  user_id: string;
  name: string;
  type: TrackerType;
  unit?: string;
  target_value: number;
  color: string;
  icon?: string;
  created_at?: string;
}

export interface TrackerEntry {
  id: string;
  user_id: string;
  tracker_id: string;
  entry_date: string; // YYYY-MM-DD
  numeric_value?: number | null;
  boolean_value?: boolean | null;
  created_at?: string;
}

export type MoodType = 'great' | 'good' | 'neutral' | 'low' | 'stressed';

export interface DailyNote {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  content: string;
  mood?: MoodType | null;
  gratitude?: string | null;
  sleep_hours?: number | null;
  water_ml?: number | null;
  energy_score?: number | null;
  created_at?: string;
  updated_at?: string;
}

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

export type SpendType = 'need' | 'want' | 'savings';
export type PaymentMethod =
  | 'UPI / QR'
  | 'Cash'
  | 'Debit Card'
  | 'Credit Card'
  | 'Net Banking'
  | 'Bank Transfer'
  | 'Digital Wallet'
  | string;

export interface Expense {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  title: string;
  amount: number;
  category: ExpenseCategory;
  type?: 'expense' | 'income'; // Outflow vs Inflow
  account?: 'expense' | 'savings' | 'cash';
  is_transfer?: boolean;
  spend_type?: SpendType;
  payment_method: PaymentMethod;
  notes?: string;
  is_recurring?: boolean;
  created_at?: string;
}

export interface BudgetConfig {
  id?: string;
  user_id: string;
  monthly_budget: number;
  currency: string;
  category_budgets: Partial<Record<ExpenseCategory, number>>;
  updated_at?: string;
}

export interface AppProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}
