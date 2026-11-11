import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  SlidersHorizontal,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertCircle,
  LoaderCircle,
  CheckCircle2,
  IndianRupee,
  Calendar,
  CreditCard,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from 'lucide-react';
import { Expense, ExpenseCategory, BudgetConfig, PaymentMethod, SpendType, CategoryInfo } from '../types';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  formatCurrency,
  formatDate,
} from '../utils/constants';
import { CategoryDonutChart, DailySpendingTrendChart, FinancialHealth50_30_20, AccountIntelligenceReport } from './ExpenseCharts';

interface ExpenseDashboardProps {
  expenses: Expense[];
  budget: BudgetConfig;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<boolean | string>;
  onUpdateExpense: (id: string, expense: Partial<Expense>) => Promise<boolean | string>;
  onDeleteExpense: (id: string) => Promise<boolean | string>;
  onUpdateBudget: (budget: BudgetConfig) => void;
  onExportCSV: () => void;
  customCategories: Record<string, CategoryInfo>;
  onSaveCustomCategories: (categories: Record<string, CategoryInfo>) => void | Promise<boolean>;
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000];
const QUICK_TITLES = [
  'Chai & Snacks',
  'Auto / Cab Ride',
  'Supermarket Groceries',
  'Healthy Lunch',
  'Family Dinner',
  'Pharmacy / Medicine',
  'Fiber Broadband Bill',
  'Electricity / Water',
  'Online Shopping'
];

const COLOR_PALETTE = [
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#14B8A6', // Teal
  '#64748B'  // Slate
];

export const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({
  expenses,
  budget,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onUpdateBudget,
  onExportCSV,
  customCategories,
  onSaveCustomCategories
}) => {
  const currencySymbol = budget.currency || '₹';
  const todayIso = formatDate(new Date());

  // Category State (includes default + custom categories)
  const [categoriesMap, setCategoriesMap] = useState<Record<string, CategoryInfo>>({ ...CATEGORIES, ...customCategories });
  useEffect(() => setCategoriesMap({ ...CATEGORIES, ...customCategories }), [customCategories]);

  // Tab switcher state for Analytics & Ledger (default to Transaction Ledger as first tab)
  const [activeTab, setActiveTab] = useState<'ledger' | 'classification' | 'category' | 'velocity' | 'account_report'>('ledger');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [transactionSaveError, setTransactionSaveError] = useState<string | null>(null);
  const [isUpdatingTransaction, setIsUpdatingTransaction] = useState(false);
  const [transactionUpdateError, setTransactionUpdateError] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [monthlyBudgetDraft, setMonthlyBudgetDraft] = useState('30000');
  const [dailyBudgetDraft, setDailyBudgetDraft] = useState('');
  const [weeklyBudgetDraft, setWeeklyBudgetDraft] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [deleteExpenseError, setDeleteExpenseError] = useState<string | null>(null);

  const resolvedMonthlyTarget = Number(monthlyBudgetDraft) > 0 ? Number(monthlyBudgetDraft) : 30000;
  const resolvedDailyTarget = Number(dailyBudgetDraft) > 0 ? Number(dailyBudgetDraft) : 1000;
  const resolvedWeeklyTarget = Number(weeklyBudgetDraft) > 0 ? Number(weeklyBudgetDraft) : 7000;
  const budgetTargetOrderError = resolvedMonthlyTarget > resolvedWeeklyTarget && resolvedWeeklyTarget > resolvedDailyTarget
    ? ''
    : 'Targets must follow this order: Monthly > Weekly > Daily.';

  const openBudgetModal = () => {
    setMonthlyBudgetDraft(String(budget.monthlyBudget || 30000));
    setDailyBudgetDraft(String(budget.dailyBudget || 1000));
    setWeeklyBudgetDraft(String(budget.weeklyBudget || 7000));
    setIsBudgetModalOpen(true);
  };

  const applyBudget = () => {
    if (budgetTargetOrderError) return;
    onUpdateBudget({
      ...budget,
      monthlyBudget: resolvedMonthlyTarget,
      dailyBudget: resolvedDailyTarget,
      weeklyBudget: resolvedWeeklyTarget,
      currency: '₹'
    });
    setIsBudgetModalOpen(false);
  };

  // New Category Form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [newCatSpendType, setNewCatSpendType] = useState<SpendType>('want');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Add/Edit Form states
  const [formAccount, setFormAccount] = useState<'expense' | 'savings' | 'cash'>('expense');
  const [formTransactionType, setFormTransactionType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Food & Dining');
  const [formDate, setFormDate] = useState(todayIso);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('UPI / QR');
  const availablePaymentMethods: readonly PaymentMethod[] = formAccount === 'cash' && formTransactionType === 'expense'
    ? ['Cash']
    : PAYMENT_METHODS;

  useEffect(() => {
    if (formAccount === 'cash' && formTransactionType === 'expense' && formPaymentMethod !== 'Cash') {
      setFormPaymentMethod('Cash');
    }
  }, [formAccount, formTransactionType, formPaymentMethod]);
  const [formNotes, setFormNotes] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formCategoryError, setFormCategoryError] = useState('');

  // History filtering & sorting state
  const [historySearch, setHistorySearch] = useState('');
  const [historyAccountFilter, setHistoryAccountFilter] = useState<'all' | 'expense' | 'savings' | 'cash'>('all');
  const [historyCategory, setHistoryCategory] = useState<string>('all');
  const [historyPayment, setHistoryPayment] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'inflow' | 'outflow' | 'transfer'>('all');
  const [historySort, setHistorySort] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [historyTimeframe, setHistoryTimeframe] = useState<'this_month' | 'last_30_days' | 'custom' | 'all'>('this_month');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [analyticsAccount, setAnalyticsAccount] = useState<'all' | 'expense' | 'savings' | 'cash'>('all');
  const [classificationPeriod, setClassificationPeriod] = useState<'this_month' | 'last_30_days' | 'custom'>('this_month');
  const [categoryPeriod, setCategoryPeriod] = useState<'this_month' | 'last_30_days' | 'all' | 'custom'>('this_month');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [analyticsPayment, setAnalyticsPayment] = useState<string>('all');
  const [velocityCategory, setVelocityCategory] = useState<string>('all');
  const [velocityDays, setVelocityDays] = useState<7 | 30 | 90 | 'custom'>(30);

  // Account specific transactions
  const savingsTransactions = useMemo(() => {
    return expenses.filter(e => e.account === 'savings');
  }, [expenses]);

  const expenseAccTransactions = useMemo(() => {
    return expenses.filter(e => (e.account || 'expense') === 'expense');
  }, [expenses]);

  const cashTransactions = useMemo(() => {
    return expenses.filter(e => e.account === 'cash');
  }, [expenses]);

  // Savings Account Stats
  const savingsIncomeTotal = useMemo(() => {
    return savingsTransactions.filter(e => e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [savingsTransactions]);

  const savingsTransferredOutTotal = useMemo(() => {
    return expenses.filter(e => e.isTransfer || e.category.includes('Transfer') || (e.account === 'savings' && e.type === 'expense')).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const savingsCurrentBalance = savingsIncomeTotal - savingsTransferredOutTotal;

  // Cash in Hand Stats
  const cashIncomeTotal = useMemo(() => {
    return cashTransactions.filter(e => e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [cashTransactions]);

  const cashOutflowTotal = useMemo(() => {
    return cashTransactions.filter(e => e.type !== 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [cashTransactions]);

  const cashCurrentBalance = cashIncomeTotal - cashOutflowTotal;

  // Expense Account Stats
  const expenseDirectInflows = useMemo(() => {
    return expenseAccTransactions.filter(e => e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions]);

  const expenseOutflowsTotal = useMemo(() => {
    return expenseAccTransactions.filter(e => e.type !== 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions]);

  const expenseAccCurrentBalance = savingsTransferredOutTotal + expenseDirectInflows - expenseOutflowsTotal;

  // Today's Date helpers
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Daily, Weekly, Monthly Spends specifically for Expense Account
  const dailyExpenseSpend = useMemo(() => {
    return expenseAccTransactions
      .filter(e => e.date === todayIso && e.type !== 'income' && !e.isTransfer)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, todayIso]);

  const weeklyExpenseSpend = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const sevenDaysAgoIso = formatDate(d);
    return expenseAccTransactions
      .filter(e => e.date >= sevenDaysAgoIso && e.type !== 'income' && !e.isTransfer)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions]);

  const monthlyExpenseSpend = useMemo(() => {
    return expenseAccTransactions
      .filter(e => {
        const eDate = new Date(e.date + 'T00:00:00');
        return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonth && e.type !== 'income' && !e.isTransfer;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, currentYear, currentMonth]);

  const renderTargetSummary = (target: number, spend: number, tone: 'rose' | 'amber' | 'indigo') => {
    const remaining = target - spend;
    const progress = Math.min(100, target > 0 ? (spend / target) * 100 : 0);
    const toneClass = remaining < 0
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'rose' ? 'text-rose-600 dark:text-rose-400'
        : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
          : 'text-indigo-600 dark:text-indigo-400';
    const barClass = remaining < 0
      ? 'bg-rose-500'
      : tone === 'rose' ? 'bg-rose-500'
        : tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-500';

    return (
      <div className="mt-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 px-2.5 py-2 text-left" aria-label={`Target ${formatCurrency(target, currencySymbol)}, ${remaining >= 0 ? 'remaining' : 'over target'} ${formatCurrency(Math.abs(remaining), currencySymbol)}`}>
        <div className="flex items-center justify-between gap-2 text-[10px] leading-4">
          <span className="text-slate-500 dark:text-slate-400">Target <strong className="font-mono font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(target, currencySymbol)}</strong></span>
          <span className="text-slate-500 dark:text-slate-400">{remaining >= 0 ? 'Remaining' : 'Over target'} <strong className={`font-mono font-bold tabular-nums ${toneClass}`}>{formatCurrency(Math.abs(remaining), currencySymbol)}</strong></span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={Math.min(100, Math.round(progress))} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  };

  const thisMonthTransactions = useMemo(() => {
    return expenses.filter(e => {
      const eDate = new Date(e.date + 'T00:00:00');
      return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonth;
    });
  }, [expenses, currentYear, currentMonth]);

  const thisMonthSpendTotal = useMemo(() => {
    return thisMonthTransactions
      .filter(e => e.type !== 'income' && !e.isTransfer)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [thisMonthTransactions]);

  // Combined Net Worth
  const combinedTotalBalance = savingsCurrentBalance + expenseAccCurrentBalance;
  const monthlyBudget = Math.max(budget.monthlyBudget || 30000, 1);

  // Filtered History for Table
  const filteredHistory = useMemo(() => {
    return expenses.filter(e => {
      const eDate = new Date(e.date + 'T00:00:00');

      // Account filter
      if (historyAccountFilter !== 'all') {
        const itemAcc = e.account || 'expense';
        if (itemAcc !== historyAccountFilter) return false;
      }

      // Flow Type Filter (Inflow vs Outflow vs Transfer)
      if (historyTypeFilter !== 'all') {
        const isTransfer = e.isTransfer || e.category.includes('Transfer');
        if (historyTypeFilter === 'inflow') {
          if (e.type !== 'income' || isTransfer) return false;
        } else if (historyTypeFilter === 'outflow') {
          if (e.type === 'income' || isTransfer) return false;
        } else if (historyTypeFilter === 'transfer') {
          if (!isTransfer) return false;
        }
      }

      // Timeframe & Custom Date Range
      if (historyTimeframe === 'this_month') {
        if (eDate.getFullYear() !== currentYear || eDate.getMonth() !== currentMonth) return false;
      } else if (historyTimeframe === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (eDate < thirtyDaysAgo) return false;
      } else if (historyTimeframe === 'custom') {
        if (historyStartDate && e.date < historyStartDate) return false;
        if (historyEndDate && e.date > historyEndDate) return false;
      }

      // Category
      if (historyCategory !== 'all' && e.category !== historyCategory) return false;

      // Payment
      if (historyPayment !== 'all' && e.paymentMethod !== historyPayment) return false;

      // Search
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesNotes = e.notes?.toLowerCase().includes(q);
        const matchesCat = e.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesCat) return false;
      }

      return true;
    }).sort((a, b) => {
      if (historySort === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (historySort === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (historySort === 'amount_desc') return b.amount - a.amount;
      if (historySort === 'amount_asc') return a.amount - b.amount;
      return 0;
    });
  }, [
    expenses,
    historyAccountFilter,
    historyTypeFilter,
    historyTimeframe,
    historyStartDate,
    historyEndDate,
    historyCategory,
    historyPayment,
    historySearch,
    historySort,
    currentYear,
    currentMonth
  ]);

  const classificationAnalyticsExpenses = useMemo(() => expenses.filter(expense => {
    const date = new Date(`${expense.date}T00:00:00`);
    if (analyticsAccount !== 'all' && (expense.account || 'expense') !== analyticsAccount) return false;
    if (classificationPeriod === 'this_month' && (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth)) return false;
    if (classificationPeriod === 'last_30_days') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      if (date < cutoff) return false;
    }
    if (classificationPeriod === 'custom' && ((analyticsStartDate && expense.date < analyticsStartDate) || (analyticsEndDate && expense.date > analyticsEndDate))) return false;
    return true;
  }), [expenses, analyticsAccount, classificationPeriod, analyticsStartDate, analyticsEndDate, currentYear, currentMonth]);

  const categoryAnalyticsExpenses = useMemo(() => expenses.filter(expense => {
    const date = new Date(`${expense.date}T00:00:00`);
    if (analyticsAccount !== 'all' && (expense.account || 'expense') !== analyticsAccount) return false;
    if (categoryPeriod === 'this_month' && (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth)) return false;
    if (categoryPeriod === 'last_30_days') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      if (date < cutoff) return false;
    }
    if (categoryPeriod === 'custom' && ((analyticsStartDate && expense.date < analyticsStartDate) || (analyticsEndDate && expense.date > analyticsEndDate))) return false;
    return expense.type !== 'income' && !expense.isTransfer &&
      (analyticsPayment === 'all' || expense.paymentMethod === analyticsPayment);
  }), [expenses, analyticsAccount, categoryPeriod, analyticsStartDate, analyticsEndDate, analyticsPayment, currentYear, currentMonth]);

  const velocityStartIso = velocityDays === 'custom' && analyticsStartDate ? analyticsStartDate : formatDate(new Date(Date.now() - ((velocityDays === 'custom' ? 30 : velocityDays) - 1) * 86400000));
  const velocityEndIso = velocityDays === 'custom' && analyticsEndDate ? analyticsEndDate : todayIso;
  const velocityChartDaysCount = velocityDays === 'custom'
    ? analyticsStartDate && analyticsEndDate
      ? Math.max(1, Math.floor((new Date(`${analyticsEndDate}T00:00:00`).getTime() - new Date(`${analyticsStartDate}T00:00:00`).getTime()) / 86400000) + 1)
      : 30
    : velocityDays;

  const velocityAnalyticsExpenses = useMemo(() => {
    return expenses.filter(expense =>
      expense.date >= velocityStartIso && expense.date <= velocityEndIso && expense.type !== 'income' && !expense.isTransfer &&
      (analyticsAccount === 'all' || (expense.account || 'expense') === analyticsAccount) &&
      (velocityCategory === 'all' || expense.category === velocityCategory) &&
      (analyticsPayment === 'all' || expense.paymentMethod === analyticsPayment)
    );
  }, [expenses, velocityStartIso, velocityEndIso, analyticsAccount, velocityCategory, analyticsPayment]);

  // Compact modal view toggles
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showExtraDetails, setShowExtraDetails] = useState(false);

  // Top / Short category list for compact modal display
  const displayedModalCategories = useMemo(() => {
    const all = Object.entries(categoriesMap);
    if (showAllCategories) return all;

    if (formTransactionType === 'income') {
      const incomeCatNames = ['Salary / Wages', 'Freelance & Business', 'Investments & Returns', 'Gifts & Allowance', 'Refunds & Cashback', 'Other Inflow'];
      const customNames = Object.keys(categoriesMap).filter(name => !incomeCatNames.includes(name) && !['Housing', 'Food & Dining', 'Groceries', 'Transportation', 'Utilities', 'Entertainment', 'Health & Fitness', 'Shopping', 'Personal Care', 'Subscriptions', 'Education', 'Other'].includes(name));
      const combined = [...incomeCatNames, ...customNames];
      return combined.map(name => [
        name,
        categoriesMap[name] || { name, color: '#10B981', defaultSpendType: 'savings', description: '' }
      ] as [string, CategoryInfo]);
    }

    const top6 = all.slice(0, 6);
    if (formCategory && !top6.some(([name]) => name === formCategory)) {
      const found = all.find(([name]) => name === formCategory);
      if (found) {
        return [...top6.slice(0, 5), found];
      }
    }
    return top6;
  }, [categoriesMap, showAllCategories, formCategory, formAccount, formTransactionType]);

  // Handle Account change in Modal
  const handleFormAccountChange = (acc: 'expense' | 'savings' | 'cash') => {
    setFormAccount(acc);
    setFormCategoryError('');
    if (acc === 'savings') {
      setFormTransactionType('income');
      setFormCategory('');
    } else {
      setFormTransactionType('expense');
      setFormCategory('');
    }
  };

  const scrollToLedger = () => {
    setActiveTab('ledger');
    setTimeout(() => {
      const el = document.getElementById('transaction-ledger-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const handleFilterExpenseAccount = () => {
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('all');
    setHistoryTimeframe('all');
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterDailySpend = () => {
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('outflow');
    setHistoryTimeframe('custom');
    setHistoryStartDate(todayIso);
    setHistoryEndDate(todayIso);
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterWeeklySpend = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const sevenDaysAgo = formatDate(d);
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('outflow');
    setHistoryTimeframe('custom');
    setHistoryStartDate(sevenDaysAgo);
    setHistoryEndDate(todayIso);
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterMonthlySpend = () => {
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('outflow');
    setHistoryTimeframe('this_month');
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterSavingsAccount = () => {
    setHistoryAccountFilter('savings');
    setHistoryTypeFilter('all');
    setHistoryTimeframe('all');
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterCashAccount = () => {
    setHistoryAccountFilter('cash');
    setHistoryTypeFilter('all');
    setHistoryTimeframe('all');
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormAccount('expense');
    setFormTransactionType('expense');
    setFormTitle('');
    setFormAmount('');
    setFormCategory('');
    setFormCategoryError('');
    setFormDate(todayIso);
    setFormPaymentMethod('UPI / QR');
    setFormNotes('');
    setFormIsRecurring(false);
    setShowAllCategories(false);
    setShowExtraDetails(false);
    setIsAddModalOpen(true);
  };

  // Quick Amount preset handler
  const handleSelectPresetAmount = (amt: number) => {
    const current = parseFloat(formAmount) || 0;
    setFormAmount((current + amt).toString());
  };

  // Submit Add Expense
  const handleSubmitAdd = async () => {
    if (isSavingTransaction) return;
    const isTransfer = formTransactionType === 'transfer';
    if (!isTransfer && (!formCategory || !formCategory.trim())) {
      setFormCategoryError('Category is mandatory. Please select a category before submitting.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransactionSaveError('Enter an amount greater than zero.');
      return;
    }

    const finalCategory = isTransfer ? 'Transfer to Expense Account' : formCategory;
    const finalType = isTransfer ? 'expense' : (formTransactionType as 'expense' | 'income');
    const fallbackDefault = isTransfer
      ? 'Transfer to Expense Account'
      : (formTransactionType === 'income' ? 'Income' : 'Expense');
    const finalTitle = formTitle.trim() || finalCategory || fallbackDefault;

    setIsSavingTransaction(true);
    setTransactionSaveError(null);
    try {
      const saved = await onAddExpense({
      title: finalTitle,
      amount: parsedAmount,
      category: finalCategory,
      type: finalType,
      account: formAccount,
      isTransfer: isTransfer,
      date: formDate || todayIso,
      paymentMethod: formPaymentMethod || 'UPI / QR',
      notes: formNotes.trim() || undefined,
      isRecurring: formIsRecurring
      });
      if (saved !== true) {
        setTransactionSaveError(typeof saved === 'string' ? saved : 'Could not save this transaction.');
        return;
      }
      setFormCategoryError('');
      setIsAddModalOpen(false);
    } catch (error) {
      setTransactionSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingTransaction(false);
    }
  };

  // Submit Edit Expense
  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormAccount(exp.account || 'expense');
    setFormTransactionType(exp.isTransfer ? 'transfer' : (exp.type || 'expense'));
    setFormTitle(exp.title);
    setFormAmount(exp.amount.toString());
    setFormCategory(exp.category);
    setFormCategoryError('');
    setFormDate(exp.date);
    setFormPaymentMethod(exp.paymentMethod);
    setFormNotes(exp.notes || '');
    setFormIsRecurring(!!exp.isRecurring);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || isUpdatingTransaction) return;
    const isTransfer = formTransactionType === 'transfer';
    if (!isTransfer && (!formCategory || !formCategory.trim())) {
      setFormCategoryError('Category is mandatory. Please select a category before submitting.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransactionUpdateError('Enter an amount greater than zero.');
      return;
    }

    const finalCategory = isTransfer ? 'Transfer to Expense Account' : formCategory;
    const finalType = isTransfer ? 'expense' : (formTransactionType as 'expense' | 'income');
    const fallbackDefault = isTransfer
      ? 'Transfer to Expense Account'
      : (formTransactionType === 'income' ? 'Income' : 'Expense');
    const finalTitle = formTitle.trim() || finalCategory || fallbackDefault;

    setIsUpdatingTransaction(true);
    setTransactionUpdateError(null);
    try {
      const result = await onUpdateExpense(editingExpense.id, {
        title: finalTitle,
        amount: parsedAmount,
        category: finalCategory,
        type: finalType,
        account: formAccount,
        isTransfer,
        date: formDate || todayIso,
        paymentMethod: formPaymentMethod || 'UPI / QR',
        notes: formNotes.trim() || undefined,
        isRecurring: formIsRecurring
      });
      if (result !== true) {
        setTransactionUpdateError(typeof result === 'string' ? result : 'Could not update this transaction.');
        return;
      }
      setFormCategoryError('');
      setEditingExpense(null);
    } catch (error) {
      setTransactionUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdatingTransaction(false);
    }
  };

  // Create Category Handler
  const resetCategoryForm = () => {
    setNewCatName('');
    setNewCatColor(COLOR_PALETTE[0]);
    setNewCatSpendType('want');
    setNewCatDescription('');
    setEditingCategoryName(null);
    setCategoryError('');
  };

  const handleEditCategory = (catName: string) => {
    const info = customCategories[catName];
    if (!info) return;
    setEditingCategoryName(catName);
    setNewCatName(catName);
    setNewCatColor(info.color);
    setNewCatSpendType(info.defaultSpendType);
    setNewCatDescription(info.description || '');
    setCategoryError('');
    document.getElementById('category-manager-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setCategoryError('Category name is required');
      return;
    }
    if (categoriesMap[trimmed] && trimmed !== editingCategoryName) {
      setCategoryError('A category with this name already exists');
      return;
    }

    setIsSavingCategory(true);
    try {
      const updatedCategories = { ...customCategories };
      const previousName = editingCategoryName;
      const existingInfo = previousName ? customCategories[previousName] : undefined;
      if (previousName && previousName !== trimmed) {
        const affectedExpenses = expenses.filter(expense => expense.category === previousName);
        const results = await Promise.all(affectedExpenses.map(expense => onUpdateExpense(expense.id, { category: trimmed })));
        const failure = results.find(result => result !== true);
        if (failure) {
          setCategoryError(typeof failure === 'string' ? failure : 'Could not update transactions for this category.');
          return;
        }
        delete updatedCategories[previousName];
        if (formCategory === previousName) setFormCategory(trimmed);
      }
      updatedCategories[trimmed] = {
        ...existingInfo,
        name: trimmed,
        color: newCatColor,
        defaultSpendType: newCatSpendType,
        description: newCatDescription.trim() || 'Custom user category',
        isCustom: true
      };
      if (previousName && previousName !== trimmed && budget.categoryBudgets[previousName]) {
        const categoryBudgets = { ...budget.categoryBudgets, [trimmed]: budget.categoryBudgets[previousName] };
        delete categoryBudgets[previousName];
        onUpdateBudget({ ...budget, categoryBudgets });
      }
      const saved = await onSaveCustomCategories(updatedCategories);
      if (saved === false) {
        setCategoryError('Could not save category changes. Please try again.');
        return;
      }
      setCategoriesMap({ ...CATEGORIES, ...updatedCategories });
      resetCategoryForm();
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!pendingDeleteCategory) return;
    const catName = pendingDeleteCategory;
    setIsDeletingCategory(true);
    try {
      const affectedExpenses = expenses.filter(expense => expense.category === catName);
      const results = await Promise.all(affectedExpenses.map(expense => onUpdateExpense(expense.id, { category: 'Other' })));
      const failure = results.find(result => result !== true);
      if (failure) {
        setCategoryError(typeof failure === 'string' ? failure : 'Could not move transactions to Other.');
        setPendingDeleteCategory(null);
        return;
      }
      const updatedCategories = { ...customCategories };
      delete updatedCategories[catName];
      const saved = await onSaveCustomCategories(updatedCategories);
      if (saved === false) {
        setCategoryError('Could not save category changes. Please try again.');
        return;
      }
      setCategoriesMap({ ...CATEGORIES, ...updatedCategories });
      if (formCategory === catName) setFormCategory('Other');
      if (editingCategoryName === catName) resetCategoryForm();
      setPendingDeleteCategory(null);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 relative">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-emerald-950/20 p-6 sm:p-8 shadow-sm">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-600/20">
              ₹
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Dual Account Workspace</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-medium">
                  INR ({currencySymbol})
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Savings Reserve &amp; Expense Spending Account Architecture
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center sm:justify-start w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full sm:rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="Categories"
            >
              <Tag className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline ml-1.5">Categories ({Object.keys(categoriesMap).length})</span>
            </button>

            <button
              onClick={openBudgetModal}
              className="flex items-center justify-center sm:justify-start w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full sm:rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="Budget"
            >
              <SlidersHorizontal className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="hidden sm:inline ml-1.5">Budget: {formatCurrency(monthlyBudget, currencySymbol)}</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center sm:justify-start w-9 h-9 sm:w-auto sm:px-4 sm:py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full sm:rounded-xl transition-all shadow-sm shadow-emerald-600/30 active:scale-95 cursor-pointer"
              title="Add Transaction"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline ml-1.5">Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Overview Cards matching exact User specifications */}
        <div className="space-y-6 pt-6">
          {/* Card 1: Expense Account Focus (Hero Card showing Daily, Weekly, Monthly Spends) */}
          <div 
            onClick={handleFilterExpenseAccount}
            className="p-5 sm:p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
            title="Click to view all Expense Account transactions"
          >
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold text-xs shrink-0">
                    💳
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Expense Account
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Daily execution &amp; personal spends
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Available Balance</span>
                  <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatCurrency(expenseAccCurrentBalance, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Daily, Weekly, Monthly Spend Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4 text-center">
                <div 
                  onClick={(e) => { e.stopPropagation(); handleFilterDailySpend(); }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 transition-colors cursor-pointer"
                  title="Click to view today's spend transactions"
                >
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Daily Spend
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCurrency(dailyExpenseSpend, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Today</span>
                  {renderTargetSummary(budget.dailyBudget || 1000, dailyExpenseSpend, 'rose')}
                </div>

                <div 
                  onClick={(e) => { e.stopPropagation(); handleFilterWeeklySpend(); }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 transition-colors cursor-pointer"
                  title="Click to view weekly spend transactions"
                >
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Weekly Spend
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatCurrency(weeklyExpenseSpend, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Last 7 Days</span>
                  {renderTargetSummary(budget.weeklyBudget || 7000, weeklyExpenseSpend, 'amber')}
                </div>

                <div 
                  onClick={(e) => { e.stopPropagation(); handleFilterMonthlySpend(); }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer"
                  title="Click to view monthly spend transactions"
                >
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Monthly Spend
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {formatCurrency(monthlyExpenseSpend, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">This Month</span>
                  {renderTargetSummary(monthlyBudget, monthlyExpenseSpend, 'indigo')}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Transfers Received from Savings: <strong className="font-mono text-slate-800 dark:text-slate-200">+{formatCurrency(savingsTransferredOutTotal, currencySymbol)}</strong></span>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenAdd(); }}
                className="hidden sm:inline-block text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
              >
                + Log Expense
              </button>
            </div>
          </div>

          {/* Cards 2 & 3: Savings Account & Cash in Hand */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 2: Savings Account Focus */}
            <div 
              onClick={handleFilterSavingsAccount}
              className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-all"
              title="Click to view Savings Account transactions"
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      🏦
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Savings Account
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Income &amp; main reserve</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Current Savings Balance</span>
                  <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums mt-0.5">
                    {formatCurrency(savingsCurrentBalance, currencySymbol)}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Cash Gone / Transferred:</span>
                  <strong className="font-mono text-amber-600 dark:text-amber-400">
                    {formatCurrency(savingsTransferredOutTotal, currencySymbol)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Total Income Inflows:</span>
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(savingsIncomeTotal, currencySymbol)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Card 3: Cash in Hand Focus */}
            <div 
              onClick={handleFilterCashAccount}
              className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-500 dark:hover:border-amber-500 transition-all"
              title="Click to view Cash in Hand transactions"
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      💵
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Cash in Hand
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Physical cash &amp; wallet</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Current Cash Balance</span>
                  <div className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight tabular-nums mt-0.5">
                    {formatCurrency(cashCurrentBalance, currencySymbol)}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Cash Spent / Gone:</span>
                  <strong className="font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(cashOutflowTotal, currencySymbol)}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Total Cash Added:</span>
                  <strong className="font-mono text-amber-600 dark:text-amber-400">
                    +{formatCurrency(cashIncomeTotal, currencySymbol)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Analytics & Ledger Tab Switcher */}
        <div className="mt-6 grid grid-cols-2 gap-1.5 border-b border-slate-200 pb-1.5 dark:border-slate-800 sm:flex sm:items-center sm:gap-2 sm:pb-px">
          <div className="contents sm:flex sm:items-center sm:gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`col-span-2 w-full min-w-0 min-h-12 justify-center rounded-xl border bg-slate-50 py-2 px-1.5 text-center text-[11px] leading-tight dark:bg-slate-900/70 sm:col-span-1 sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-normal sm:whitespace-nowrap cursor-pointer ${
                activeTab === 'ledger'
                  ? 'border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">📋 Transaction Ledger ({expenses.length})</span><span className="hidden sm:inline">📋 Transaction Ledger ({expenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('classification')}
              className={`w-full min-w-0 min-h-12 justify-center rounded-xl border bg-slate-50 py-2 px-1.5 text-center text-[11px] leading-tight dark:bg-slate-900/70 sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-normal sm:whitespace-nowrap cursor-pointer ${
                activeTab === 'classification'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">50/30/20</span><span className="hidden sm:inline">🎯 Classification (50/30/20)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('category')}
              className={`w-full min-w-0 min-h-12 justify-center rounded-xl border bg-slate-50 py-2 px-1.5 text-center text-[11px] leading-tight dark:bg-slate-900/70 sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-normal sm:whitespace-nowrap cursor-pointer ${
                activeTab === 'category'
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">Categories</span><span className="hidden sm:inline">🍩 Category Breakdown</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('velocity')}
              className={`w-full min-w-0 min-h-12 justify-center rounded-xl border bg-slate-50 py-2 px-1.5 text-center text-[11px] leading-tight dark:bg-slate-900/70 sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-normal sm:whitespace-nowrap cursor-pointer ${
                activeTab === 'velocity'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">Velocity</span><span className="hidden sm:inline">📈 Daily Velocity</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('account_report')}
              className={`w-full min-w-0 min-h-12 justify-center rounded-xl border bg-slate-50 py-2 px-1.5 text-center text-[11px] leading-tight dark:bg-slate-900/70 sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-normal sm:whitespace-nowrap cursor-pointer ${
                activeTab === 'account_report'
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">Accounts</span><span className="hidden sm:inline">💳 Account Spends &amp; Intelligence</span>
            </button>
          </div>
        </div>

      {/* Tab Content Display */}
      <div className="mt-6">
        {(activeTab === 'classification' || activeTab === 'category' || activeTab === 'velocity') && (
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900" aria-label={`${activeTab} filters`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {activeTab === 'classification' ? 'Classification filters' : activeTab === 'category' ? 'Category filters' : 'Velocity filters'}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {activeTab === 'classification' ? 'Choose period and account' : activeTab === 'category' ? 'Narrow category spending' : 'Choose a trend window and spending type'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnalyticsAccount('all');
                  setClassificationPeriod('this_month');
                  setCategoryPeriod('this_month');
                  setAnalyticsStartDate('');
                  setAnalyticsEndDate('');
                  setAnalyticsPayment('all');
                  setVelocityCategory('all');
                  setVelocityDays(30);
                }}
                className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
              >Reset</button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activeTab !== 'velocity' && (
                <select aria-label="Analytics account" value={analyticsAccount} onChange={e => setAnalyticsAccount(e.target.value as typeof analyticsAccount)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Accounts</option><option value="expense">Expense Account</option><option value="cash">Cash in Hand</option><option value="savings">Savings Account</option>
                </select>
              )}
              {activeTab === 'classification' && (
                <select aria-label="Classification period" value={classificationPeriod} onChange={e => setClassificationPeriod(e.target.value as typeof classificationPeriod)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="this_month">This Month</option><option value="last_30_days">Last 30 Days</option><option value="custom">Custom Dates</option>
                </select>
              )}
              {activeTab === 'category' && <>
                <select aria-label="Category period" value={categoryPeriod} onChange={e => setCategoryPeriod(e.target.value as typeof categoryPeriod)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="this_month">This Month</option><option value="last_30_days">Last 30 Days</option><option value="custom">Custom Dates</option><option value="all">All Records</option>
                </select>
              </>}
              {activeTab === 'velocity' && (
                <select aria-label="Velocity range" value={velocityDays} onChange={e => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    if (!analyticsStartDate) setAnalyticsStartDate(formatDate(new Date(Date.now() - 29 * 86400000)));
                    if (!analyticsEndDate) setAnalyticsEndDate(todayIso);
                    setVelocityDays('custom');
                  } else {
                    setVelocityDays(Number(value) as 7 | 30 | 90);
                  }
                }} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option><option value="custom">Custom Dates</option>
                </select>
              )}
              {activeTab === 'category' && (
                <select aria-label="Payment method" value={analyticsPayment} onChange={e => setAnalyticsPayment(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Payments</option>{PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                </select>
              )}
              {activeTab === 'velocity' && <>
                <select aria-label="Velocity account" value={analyticsAccount} onChange={e => setAnalyticsAccount(e.target.value as typeof analyticsAccount)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Accounts</option><option value="expense">Expense Account</option><option value="cash">Cash in Hand</option><option value="savings">Savings Account</option>
                </select>
                <select aria-label="Velocity category" value={velocityCategory} onChange={e => setVelocityCategory(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Categories</option>{Object.keys(categoriesMap).map(category => <option key={category} value={category}>{category}</option>)}
                </select>
                <select aria-label="Velocity payment method" value={analyticsPayment} onChange={e => setAnalyticsPayment(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Payments</option>{PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                </select>
              </>}
              {((activeTab === 'classification' && classificationPeriod === 'custom') || (activeTab === 'category' && categoryPeriod === 'custom') || (activeTab === 'velocity' && velocityDays === 'custom')) && (
                <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-span-3">
                  <label className="min-w-0 text-[11px] text-slate-500">From<input type="date" max={analyticsEndDate || undefined} value={analyticsStartDate} onChange={e => setAnalyticsStartDate(e.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /></label>
                  <label className="min-w-0 text-[11px] text-slate-500">To<input type="date" min={analyticsStartDate || undefined} value={analyticsEndDate} onChange={e => setAnalyticsEndDate(e.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /></label>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab 1: Classification (50/30/20) */}
        {activeTab === 'classification' && (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-xs">
                🎯
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Classification Analytics (Needs vs. Wants vs. Savings)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Evaluates monthly spending against Essential Needs (50%), Discretionary Wants (30%), and Savings/Buffer (20%)
                </p>
              </div>
            </div>

            <FinancialHealth50_30_20
              expenses={classificationAnalyticsExpenses}
              monthlyIncomeOrBudget={monthlyBudget}
              currencySymbol={currencySymbol}
            />
          </div>
        )}

        {/* Tab 2: Category Breakdown */}
        {activeTab === 'category' && (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs">
                  🍩
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Category Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Distribution across default &amp; custom categories
                  </p>
                </div>
              </div>
              {historyCategory !== 'all' && (
                <button
                  onClick={() => setHistoryCategory('all')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <CategoryDonutChart
              expenses={categoryAnalyticsExpenses}
              selectedCategory={historyCategory as any}
              onSelectCategory={cat => setHistoryCategory(cat)}
              currencySymbol={currencySymbol}
            />
          </div>
        )}

        {/* Tab 3: Daily Velocity */}
        {activeTab === 'velocity' && (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold text-xs">
                📈
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Daily Spending Velocity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Spending trajectory across recent days
                </p>
              </div>
            </div>

            <DailySpendingTrendChart
              expenses={velocityAnalyticsExpenses}
              daysCount={velocityChartDaysCount}
              rangeStartDate={velocityDays === 'custom' ? velocityStartIso : undefined}
              rangeEndDate={velocityDays === 'custom' ? velocityEndIso : undefined}
              currencySymbol={currencySymbol}
            />
          </div>
        )}

        {/* Tab: Account Intelligence Report */}
        {activeTab === 'account_report' && (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs">
                💳
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Account Spends &amp; Financial Intelligence Report
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Detailed breakdown of spending and balances across Expense Account, Cash in Hand, and Savings Account with custom filters
                </p>
              </div>
            </div>

            <AccountIntelligenceReport
              expenses={expenses}
              currencySymbol={currencySymbol}
              savingsCurrentBalance={savingsCurrentBalance}
              expenseAccCurrentBalance={expenseAccCurrentBalance}
              cashCurrentBalance={cashCurrentBalance}
            />
          </div>
        )}

        {/* Tab 4: Transaction Ledger Table */}
        {activeTab === 'ledger' && (
          <div id="transaction-ledger-section" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Transaction Ledger
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  ({filteredHistory.length} filtered)
                </span>
              </div>

              {/* Toolbar Controls */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                {/* Search */}
                <div className="relative col-span-2 min-w-0 sm:col-span-1 sm:min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Search transactions..."
                    className="w-full min-w-0 pl-8 pr-3 py-2.5 sm:py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                {/* Account Filter */}
                <select
                  value={historyAccountFilter}
                  onChange={e => setHistoryAccountFilter(e.target.value as any)}
                  className="w-full min-w-0 text-xs py-2.5 sm:w-auto sm:py-1.5 px-2.5 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Accounts</option>
                  <option value="expense">💳 Expense Account</option>
                  <option value="savings">🏦 Savings Account</option>
                  <option value="cash">💵 Cash in Hand</option>
                </select>

                {/* Inflow / Outflow Flow Type Filter */}
                <select
                  value={historyTypeFilter}
                  onChange={e => setHistoryTypeFilter(e.target.value as any)}
                  className="w-full min-w-0 text-xs py-2.5 sm:w-auto sm:py-1.5 px-2.5 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Flow Types</option>
                  <option value="inflow">📥 Inflow (Income)</option>
                  <option value="outflow">📤 Outflow (Expense)</option>
                  <option value="transfer">🔀 Transfer</option>
                </select>

                {/* Timeframe */}
                <select
                  value={historyTimeframe}
                  onChange={e => setHistoryTimeframe(e.target.value as any)}
                  className="w-full min-w-0 text-xs py-2.5 sm:w-auto sm:py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="this_month">This Month</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="custom">📅 Custom Date Range</option>
                  <option value="all">All Records</option>
                </select>

                {/* Custom Date Pickers */}
                {historyTimeframe === 'custom' && (
                  <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 sm:col-span-1">
                    <span className="text-slate-500 font-medium text-[11px] pl-1">From:</span>
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={e => setHistoryStartDate(e.target.value)}
                      className="min-w-0 flex-1 px-2 py-2 sm:flex-none sm:py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    <span className="text-slate-500 font-medium text-[11px]">To:</span>
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={e => setHistoryEndDate(e.target.value)}
                      className="min-w-0 flex-1 px-2 py-2 sm:flex-none sm:py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                )}

                {/* Category Filter */}
                <select
                  value={historyCategory}
                  onChange={e => setHistoryCategory(e.target.value)}
                  className="w-full min-w-0 text-xs py-2.5 sm:w-auto sm:py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {Object.keys(categoriesMap).map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Payment Filter */}
                <select
                  value={historyPayment}
                  onChange={e => setHistoryPayment(e.target.value)}
                  className="w-full min-w-0 text-xs py-2.5 sm:w-auto sm:py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Payments</option>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>

                {/* Export CSV */}
                <button
                  onClick={onExportCSV}
                  className="col-span-2 flex w-full items-center justify-center gap-1.5 px-3 py-2.5 sm:col-span-1 sm:w-auto sm:py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Export to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Mobile transaction cards */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
              {filteredHistory.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No transactions match these filters.</p>
              ) : filteredHistory.map(item => {
                const catColor = categoriesMap[item.category]?.color || '#94A3B8';
                const isIncome = item.type === 'income';
                const isTransfer = item.isTransfer;
                const accountLabel = item.account === 'savings' ? 'Savings' : item.account === 'cash' ? 'Cash' : 'Expense';
                return (
                  <article key={item.id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{item.date}</span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{accountLabel}</span>
                          {isTransfer && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Transfer</span>}
                        </div>
                      </div>
                      <strong className={`shrink-0 text-sm font-mono font-bold tabular-nums ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : isTransfer ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySymbol)}
                      </strong>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex max-w-full items-center gap-1.5 break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: catColor }} />{item.category}
                      </span>
                      <span className="inline-block max-w-full break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.paymentMethod}</span>
                    </div>
                    {item.notes && <p className="break-words text-xs text-slate-500 dark:text-slate-400">{item.notes}</p>}
                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <button type="button" onClick={() => handleOpenEdit(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={`Edit ${item.title}`}>
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" onClick={() => setExpenseToDelete(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" aria-label={`Delete ${item.title}`}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop transaction table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-medium">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        No transactions match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(item => {
                      const catInfo = categoriesMap[item.category];
                      const catColor = catInfo?.color || '#94A3B8';
                      const isSavings = item.account === 'savings';
                      const isCash = item.account === 'cash';
                      const isIncome = item.type === 'income';
                      const isTransfer = item.isTransfer;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isSavings
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : isCash
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              {isSavings ? '🏦 Savings' : isCash ? '💵 Cash' : '💳 Expense'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{item.title}</span>
                              {isTransfer && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                                  Transfer
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: catColor }}
                              />
                              <span>{item.category}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {item.paymentMethod}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                            <span className={isIncome ? 'text-emerald-600 dark:text-emerald-400' : isTransfer ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}>
                              {isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySymbol)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                title="Edit entry"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setExpenseToDelete(item)}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>



      {/* Small Round Icon-Only Floating Action Button (FAB) above mobile nav bar */}
      <button
        onClick={handleOpenAdd}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xl shadow-emerald-600/35 hover:scale-105 active:scale-95 transition-all border border-emerald-400/30 cursor-pointer"
        title="Add Transaction"
        aria-label="Add transaction"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* 4. MODAL: Scrollable Add/Edit Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-xs ${
                  formAccount === 'savings' ? 'bg-emerald-600' : formAccount === 'cash' ? 'bg-amber-600' : 'bg-rose-600'
                }`}>
                  ₹
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {formAccount === 'savings' ? 'Savings Account Transaction' : formAccount === 'cash' ? 'Cash in Hand Transaction' : 'Expense Account Transaction'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Form Body */}
            <form
              noValidate
              onSubmit={event => {
                event.preventDefault();
                void handleSubmitAdd();
              }}
              className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto pr-1"
            >
              {/* 1. Account Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                  <span>Target Account</span>
                  <span className="text-[10px] text-slate-400 font-mono">Select account</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleFormAccountChange('expense')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formAccount === 'expense'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    💳 Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormAccountChange('cash')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formAccount === 'cash'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormAccountChange('savings')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formAccount === 'savings'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    🏦 Savings
                  </button>
                </div>
              </div>

              {/* 2. Transaction Type Switcher + Date Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {formAccount === 'savings' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFormTransactionType('income');
                          setFormCategory('');
                          setFormCategoryError('');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formTransactionType === 'income'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Income Inflow
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormTransactionType('transfer');
                          setFormCategory('Transfer to Expense Account');
                          setFormCategoryError('');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formTransactionType === 'transfer'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Transfer Cash
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFormTransactionType('expense');
                          setFormCategory('');
                          setFormCategoryError('');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formTransactionType === 'expense'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Expense (Out)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormTransactionType('income');
                          setFormCategory('');
                          setFormCategoryError('');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formTransactionType === 'income'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Inflow / Refund
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                  <span>Payment Method</span>
                  <span className="text-[10px] text-slate-400 font-mono">Mode</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {availablePaymentMethods.map(pm => {
                    const isSelected = formPaymentMethod === pm;
                    return (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setFormPaymentMethod(pm)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer text-center truncate ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 dark:bg-slate-100 dark:text-slate-950 text-white font-semibold shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {pm}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Amount Input & Quick Increments */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <div className="relative">
                  <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-lg ${
                    formTransactionType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : formTransactionType === 'transfer' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-1.5 text-xl font-mono font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Preset Fast Increments */}
                <div className="grid grid-cols-6 gap-1 mt-1.5">
                  {[100, 500, 1000, 2000, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPresetAmount(amt)}
                      className="py-1 px-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer text-center truncate"
                    >
                      +{currencySymbol}{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Category Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <span>Category</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {formTransactionType !== 'transfer' && (
                      <button
                        type="button"
                        onClick={() => setShowAllCategories(!showAllCategories)}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Tag className="w-3 h-3" />
                        <span>{showAllCategories ? 'Show Main' : `Show All (${Object.keys(categoriesMap).length})`}</span>
                      </button>
                    )}
                    {formTransactionType !== 'transfer' && (
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-0.5 font-medium cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New</span>
                      </button>
                    )}
                  </div>
                </div>

                {formCategoryError && (
                  <div className="mb-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{formCategoryError}</span>
                  </div>
                )}

                {/* Seamless Category Pill Grid (No dropdowns needed) */}
                {formTransactionType === 'transfer' ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Transfer to Expense Account</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 max-h-44 overflow-y-auto transition-colors ${
                      formCategoryError ? 'bg-rose-50/50 dark:bg-rose-950/20 ring-1 ring-rose-400' : ''
                    }`}>
                      {displayedModalCategories.map(([catName, info]) => {
                        const isSelected = formCategory === catName;
                        return (
                          <button
                            key={catName}
                            type="button"
                            onClick={() => {
                              setFormCategory(catName);
                              setFormCategoryError('');
                            }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer w-full ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm font-semibold'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: isSelected ? '#ffffff' : info.color }}
                            />
                            <span className="truncate">{catName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. SINGLE Note / Title Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Note / Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder={
                    formAccount === 'savings'
                      ? (formTransactionType === 'transfer' ? 'e.g. Weekly transfer for daily expenses' : 'e.g. October Salary deposit')
                      : 'e.g. Chai, Groceries, Lunch'
                  }
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
                />
              </div>

              {/* Submit Buttons */}
              {transactionSaveError && (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {transactionSaveError}
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSavingTransaction}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmitAdd}
                  disabled={isSavingTransaction ||
                    isNaN(parseFloat(formAmount)) ||
                    parseFloat(formAmount) <= 0 ||
                    (formTransactionType !== 'transfer' && (!formCategory || !formCategory.trim()))
                  }
                  className={`px-5 py-2 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${
                    formTransactionType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : formTransactionType === 'transfer' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  }`}
                >
                  {isSavingTransaction ? 'Saving…' : `Save Transaction (${currencySymbol}${parseFloat(formAmount) > 0 ? parseFloat(formAmount).toFixed(2) : '0.00'})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Category Management (Add New Category & Delete Category) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Manage Categories
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Add, edit, or remove your custom categories
                </p>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Form to Add New Category */}
              <form id="category-manager-form" onSubmit={handleCreateCategory} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  {editingCategoryName ? <Edit2 className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{editingCategoryName ? `Edit ${editingCategoryName}` : 'Add New Category'}</span>
                </h4>

                {categoryError && (
                  <p className="text-xs text-rose-600 font-medium">{categoryError}</p>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="e.g. Fuel, Pet Care, Investments, Gym..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                {/* Color Swatches */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Badge Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          newCatColor === c ? 'scale-125 ring-2 ring-emerald-500 ring-offset-2' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Spend classification */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Classification
                  </label>
                  <select
                    value={newCatSpendType}
                    onChange={e => setNewCatSpendType(e.target.value as SpendType)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="need">Need (Essential)</option>
                    <option value="want">Want (Discretionary)</option>
                    <option value="savings">Savings / Investment</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:cursor-wait disabled:opacity-70"
                  >
                    {isSavingCategory && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    {isSavingCategory ? 'Saving…' : editingCategoryName ? 'Save Changes' : 'Create Category'}
                  </button>
                  {editingCategoryName && (
                    <button type="button" disabled={isSavingCategory} onClick={resetCategoryForm} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* List of Existing Categories with Delete Option */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3">
                  All Active Categories ({Object.keys(categoriesMap).length})
                </h4>

                <div className="space-y-2">
                  {Object.entries(categoriesMap).map(([name, info]) => {
                    const isCustom = !!info.isCustom || !CATEGORIES[name];
                    return (
                      <div
                        key={name}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: info.color }}
                          />
                          <div className="truncate">
                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                              {name}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-2 capitalize">
                              ({info.defaultSpendType})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCustom ? (
                            <>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium">
                                Custom
                              </span>
                              <button
                                type="button"
                                onClick={() => handleEditCategory(name)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                title={`Edit ${name}`}
                                aria-label={`Edit ${name}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteCategory(name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                title={`Delete ${name}`}
                                aria-label={`Delete ${name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteCategory && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="alertdialog" aria-modal="true" aria-labelledby="delete-category-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 id="delete-category-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Delete &quot;{pendingDeleteCategory}&quot;?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {expenses.filter(expense => expense.category === pendingDeleteCategory).length > 0
                ? `Transactions using this category will be moved to Other.`
                : 'This custom category will be removed.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isDeletingCategory} onClick={() => setPendingDeleteCategory(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" disabled={isDeletingCategory} onClick={handleDeleteCategory} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70">
                {isDeletingCategory && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {isDeletingCategory ? 'Deleting…' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Edit Expense */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Transaction
              </h3>
              <button
                onClick={() => setEditingExpense(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 text-lg font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    {Object.keys(categoriesMap).map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    {availablePaymentMethods.map(pm => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {budgetTargetOrderError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300" role="alert">
                  {budgetTargetOrderError}
                </p>
              )}

              {transactionUpdateError && (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {transactionUpdateError}
                </div>
              )}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  disabled={isUpdatingTransaction}
                  className="px-4 py-2 text-xs font-medium text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTransaction}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl"
                >
                  {isUpdatingTransaction ? 'Updating…' : 'Update Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Budget Targets */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Monthly Budget Target
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Set overall monthly spending cap in Indian Rupees ({currencySymbol})
                </p>
              </div>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Monthly Target ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    value={monthlyBudgetDraft}
                    onChange={e => setMonthlyBudgetDraft(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 text-lg font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Daily Target ({currencySymbol})</label>
                  <input type="number" min="1" step="100" value={dailyBudgetDraft} onChange={e => setDailyBudgetDraft(e.target.value)} className="w-full px-3 py-2.5 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Weekly Target ({currencySymbol})</label>
                  <input type="number" min="1" step="100" value={weeklyBudgetDraft} onChange={e => setWeeklyBudgetDraft(e.target.value)} className="w-full px-3 py-2.5 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Current Month Spend:</span>
                  <strong className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(thisMonthSpendTotal, currencySymbol)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Calculated Balance:</span>
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency((Number(monthlyBudgetDraft) || 0) - thisMonthSpendTotal, currencySymbol)}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={applyBudget}
                disabled={Boolean(budgetTargetOrderError)}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700 rounded-xl"
              >
                Apply Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="alertdialog" aria-modal="true" aria-labelledby="delete-expense-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-expense-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete this transaction?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  “{expenseToDelete.title}” ({formatCurrency(expenseToDelete.amount, currencySymbol)}) will be permanently deleted.
                </p>
              </div>
            </div>
            {deleteExpenseError && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{deleteExpenseError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setExpenseToDelete(null); setDeleteExpenseError(null); }}
                disabled={isDeletingExpense}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingExpense}
                onClick={async () => {
                  if (isDeletingExpense) return;
                  setIsDeletingExpense(true);
                  setDeleteExpenseError(null);
                  try {
                    const result = await onDeleteExpense(expenseToDelete.id);
                    if (result === true) setExpenseToDelete(null);
                    else setDeleteExpenseError(typeof result === 'string' ? result : 'Could not delete this transaction.');
                  } catch (error) {
                    setDeleteExpenseError(error instanceof Error ? error.message : String(error));
                  } finally {
                    setIsDeletingExpense(false);
                  }
                }}
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70"
              >
                {isDeletingExpense && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {isDeletingExpense ? 'Deleting…' : 'Delete transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
