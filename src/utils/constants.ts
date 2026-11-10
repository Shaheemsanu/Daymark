import { ExpenseCategory, CategoryInfo, SpendType } from '../types';

export const CATEGORIES: Record<ExpenseCategory, CategoryInfo> = {
  'Housing': {
    name: 'Housing',
    color: '#3B82F6', // Blue
    defaultSpendType: 'need',
    description: 'Rent, mortgage, HOA, home maintenance'
  },
  'Food & Dining': {
    name: 'Food & Dining',
    color: '#F59E0B', // Amber
    defaultSpendType: 'want',
    description: 'Restaurants, cafes, delivery, takeout'
  },
  'Groceries': {
    name: 'Groceries',
    color: '#10B981', // Emerald
    defaultSpendType: 'need',
    description: 'Supermarket, pantry essentials, fresh produce'
  },
  'Transportation': {
    name: 'Transportation',
    color: '#6366F1', // Indigo
    defaultSpendType: 'need',
    description: 'Fuel, transit pass, ride share, maintenance'
  },
  'Utilities': {
    name: 'Utilities',
    color: '#06B6D4', // Cyan
    defaultSpendType: 'need',
    description: 'Electricity, water, gas, internet, mobile phone'
  },
  'Entertainment': {
    name: 'Entertainment',
    color: '#EC4899', // Pink
    defaultSpendType: 'want',
    description: 'Movies, concerts, gaming, outings'
  },
  'Health & Fitness': {
    name: 'Health & Fitness',
    color: '#14B8A6', // Teal
    defaultSpendType: 'need',
    description: 'Gym, doctor visits, pharmacy, supplements'
  },
  'Shopping': {
    name: 'Shopping',
    color: '#8B5CF6', // Purple
    defaultSpendType: 'want',
    description: 'Apparel, electronics, personal accessories'
  },
  'Personal Care': {
    name: 'Personal Care',
    color: '#F43F5E', // Rose
    defaultSpendType: 'need',
    description: 'Haircut, skincare, grooming products'
  },
  'Subscriptions': {
    name: 'Subscriptions',
    color: '#64748B', // Slate
    defaultSpendType: 'want',
    description: 'Streaming, software, cloud storage, periodicals'
  },
  'Education': {
    name: 'Education',
    color: '#0284C7', // Sky
    defaultSpendType: 'need',
    description: 'Courses, textbooks, tools, certifications'
  },
  'Other': {
    name: 'Other',
    color: '#94A3B8', // Light slate
    defaultSpendType: 'want',
    description: 'Uncategorized or miscellaneous items'
  },
  // Income Categories
  'Salary / Wages': {
    name: 'Salary / Wages',
    color: '#10B981', // Emerald
    defaultSpendType: 'savings',
    description: 'Monthly salary, paycheck, wage earnings'
  },
  'Freelance & Business': {
    name: 'Freelance & Business',
    color: '#06B6D4', // Cyan
    defaultSpendType: 'savings',
    description: 'Client invoices, consulting, business profit'
  },
  'Investments & Returns': {
    name: 'Investments & Returns',
    color: '#8B5CF6', // Purple
    defaultSpendType: 'savings',
    description: 'Dividends, capital gains, interest returns'
  },
  'Gifts & Allowance': {
    name: 'Gifts & Allowance',
    color: '#EC4899', // Pink
    defaultSpendType: 'savings',
    description: 'Family gifts, allowance, cashback rewards'
  },
  'Other Inflow': {
    name: 'Other Inflow',
    color: '#3B82F6', // Blue
    defaultSpendType: 'savings',
    description: 'Miscellaneous income and refunds'
  }
};

export const PAYMENT_METHODS = [
  'UPI / QR',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Net Banking',
  'Digital Wallet'
] as const;

export const DEFAULT_BUDGET = 30000;

export const DEFAULT_CATEGORY_BUDGETS: Partial<Record<string, number>> = {
  'Housing': 10000,
  'Groceries': 5000,
  'Food & Dining': 3000,
  'Transportation': 2000,
  'Utilities': 2500,
  'Health & Fitness': 1500,
  'Entertainment': 1500,
  'Shopping': 2000,
  'Subscriptions': 800,
  'Personal Care': 800,
  'Education': 1000,
  'Other': 800
};

export const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatCurrency = (amount: number, symbol = '₹'): string => {
  // If undefined or NaN, fallback to 0.00
  const cleanAmt = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `${symbol} ${cleanAmt.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export function getAllCategories(): Record<string, CategoryInfo> {
  return CATEGORIES;
}

