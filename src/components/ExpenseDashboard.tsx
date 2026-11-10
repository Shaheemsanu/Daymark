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
  getAllCategories,
  saveCustomCategory,
  removeCustomCategory
} from '../utils/constants';
import { CategoryDonutChart, DailySpendingTrendChart, FinancialHealth50_30_20, AccountIntelligenceReport } from './ExpenseCharts';

interface ExpenseDashboardProps {
  expenses: Expense[];
  budget: BudgetConfig;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onUpdateExpense: (id: string, expense: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateBudget: (budget: BudgetConfig) => void;
  onExportCSV: () => void;
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
  onExportCSV
}) => {
  const currencySymbol = budget.currency || '₹';
  const todayIso = formatDate(new Date());

  // Category State (includes default + custom categories)
  const [categoriesMap, setCategoriesMap] = useState<Record<string, CategoryInfo>>(() => getAllCategories());

  const refreshCategories = () => {
    setCategoriesMap(getAllCategories());
  };

  // Tab switcher state for Analytics & Ledger (default to Transaction Ledger as first tab)
  const [activeTab, setActiveTab] = useState<'ledger' | 'classification' | 'category' | 'velocity' | 'account_report'>('ledger');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // New Category Form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [newCatSpendType, setNewCatSpendType] = useState<SpendType>('want');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Add/Edit Form states
  const [formAccount, setFormAccount] = useState<'expense' | 'savings' | 'cash'>('expense');
  const [formTransactionType, setFormTransactionType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Food & Dining');
  const [formDate, setFormDate] = useState(todayIso);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('UPI / QR');
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
  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const isTransfer = formTransactionType === 'transfer';
    if (!isTransfer && (!formCategory || !formCategory.trim())) {
      setFormCategoryError('Category is mandatory. Please select a category before submitting.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const finalCategory = isTransfer ? 'Transfer to Expense Account' : formCategory;
    const finalType = isTransfer ? 'expense' : (formTransactionType as 'expense' | 'income');
    const fallbackDefault = isTransfer
      ? 'Transfer to Expense Account'
      : (formTransactionType === 'income' ? 'Income' : 'Expense');
    const finalTitle = formTitle.trim() || finalCategory || fallbackDefault;

    onAddExpense({
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
    setFormCategoryError('');
    setIsAddModalOpen(false);
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

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const isTransfer = formTransactionType === 'transfer';
    if (!isTransfer && (!formCategory || !formCategory.trim())) {
      setFormCategoryError('Category is mandatory. Please select a category before submitting.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const finalCategory = isTransfer ? 'Transfer to Expense Account' : formCategory;
    const finalType = isTransfer ? 'expense' : (formTransactionType as 'expense' | 'income');
    const fallbackDefault = isTransfer
      ? 'Transfer to Expense Account'
      : (formTransactionType === 'income' ? 'Income' : 'Expense');
    const finalTitle = formTitle.trim() || finalCategory || fallbackDefault;

    onUpdateExpense(editingExpense.id, {
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
    setFormCategoryError('');
    setEditingExpense(null);
  };

  // Create Category Handler
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setCategoryError('Category name is required');
      return;
    }
    if (categoriesMap[trimmed]) {
      setCategoryError('A category with this name already exists');
      return;
    }

    saveCustomCategory({
      name: trimmed,
      color: newCatColor,
      defaultSpendType: newCatSpendType,
      description: newCatDescription.trim() || 'Custom user category'
    });

    refreshCategories();
    setNewCatName('');
    setNewCatDescription('');
    setCategoryError('');
  };

  // Delete Category Handler
  const handleDeleteCategory = (catName: string) => {
    if (window.confirm(`Delete category "${catName}"? Existing transactions will be moved to "Other".`)) {
      removeCustomCategory(catName);
      expenses.forEach(e => {
        if (e.category === catName) {
          onUpdateExpense(e.id, { category: 'Other' });
        }
      });
      refreshCategories();
      if (formCategory === catName) {
        setFormCategory('Other');
      }
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
              onClick={() => setIsBudgetModalOpen(true)}
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
        <div className="mt-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-px gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`py-2.5 px-3.5 sm:px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'ledger'
                  ? 'border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>📋 Transaction Ledger ({expenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('classification')}
              className={`py-2.5 px-3.5 sm:px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'classification'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>🎯 Classification (50/30/20)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('category')}
              className={`py-2.5 px-3.5 sm:px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'category'
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>🍩 Category Breakdown</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('velocity')}
              className={`py-2.5 px-3.5 sm:px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'velocity'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>📈 Daily Velocity</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('account_report')}
              className={`py-2.5 px-3.5 sm:px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'account_report'
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>💳 Account Spends &amp; Intelligence</span>
            </button>
          </div>
        </div>

      {/* Tab Content Display */}
      <div className="mt-6">
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
              expenses={thisMonthTransactions}
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
              expenses={thisMonthTransactions}
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
              expenses={thisMonthTransactions}
              daysCount={30}
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
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative min-w-[140px] sm:min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Search transactions..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                {/* Account Filter */}
                <select
                  value={historyAccountFilter}
                  onChange={e => setHistoryAccountFilter(e.target.value as any)}
                  className="text-xs py-1.5 px-2.5 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
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
                  className="text-xs py-1.5 px-2.5 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
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
                  className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="this_month">This Month</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="custom">📅 Custom Date Range</option>
                  <option value="all">All Records</option>
                </select>

                {/* Custom Date Pickers */}
                {historyTimeframe === 'custom' && (
                  <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-medium text-[11px] pl-1">From:</span>
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={e => setHistoryStartDate(e.target.value)}
                      className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    <span className="text-slate-500 font-medium text-[11px]">To:</span>
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={e => setHistoryEndDate(e.target.value)}
                      className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                )}

                {/* Category Filter */}
                <select
                  value={historyCategory}
                  onChange={e => setHistoryCategory(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
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
                  className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Export to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="overflow-x-auto">
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
                                onClick={() => onDeleteExpense(item.id)}
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
            <form onSubmit={handleSubmitAdd} className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
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
                  {PAYMENT_METHODS.map(pm => {
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
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isNaN(parseFloat(formAmount)) ||
                    parseFloat(formAmount) <= 0 ||
                    (formTransactionType !== 'transfer' && (!formCategory || !formCategory.trim()))
                  }
                  className={`px-5 py-2 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${
                    formTransactionType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : formTransactionType === 'transfer' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  }`}
                >
                  Save Transaction ({currencySymbol}{parseFloat(formAmount) > 0 ? parseFloat(formAmount).toFixed(2) : '0.00'})
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
                  Create custom categories or delete unwanted custom ones
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
              <form onSubmit={handleCreateCategory} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Add New Category</span>
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
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                  >
                    Create Category
                  </button>
                </div>
              </form>

              {/* List of Existing Categories with Delete Option */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3">
                  All Active Categories ({Object.keys(categoriesMap).length})
                </h4>

                <div className="space-y-2">
                  {Object.entries(categoriesMap).map(([name, info]) => {
                    const isCustom = !!info.isCustom;
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
                                onClick={() => handleDeleteCategory(name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                title="Delete custom category"
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
                    {PAYMENT_METHODS.map(pm => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  Update Transaction
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
                    value={budget.monthlyBudget}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateBudget({
                        ...budget,
                        monthlyBudget: val,
                        currency: '₹'
                      });
                    }}
                    className="w-full pl-8 pr-4 py-2.5 text-lg font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Current Month Spend:</span>
                  <strong className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(thisMonthSpendTotal, currencySymbol)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Calculated Balance:</span>
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(budget.monthlyBudget - thisMonthSpendTotal, currencySymbol)}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Apply Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
