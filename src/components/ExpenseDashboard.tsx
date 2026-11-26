import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useDialogBack } from '../hooks/useDialogBack';
import {
  Plus,
  Search,
  Filter,
  Download,
  SlidersHorizontal,
  Trash2,
  Edit2,
  Eye,
  Copy,
  Info,
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
  RotateCcw,
  HandCoins,
  ArrowLeft,
  X
} from 'lucide-react';
import { Expense, ExpenseCategory, BudgetConfig, PaymentMethod, SpendType, CategoryInfo } from '../types';
import { formatDisplayDate } from '../utils/dateFormatting';
import { getAccountBalance, getBalanceAdjustmentNote, isAccountTransactionVisible } from '../utils/accounts';
import { isLoanMovement, LOAN_MOVEMENT_CATEGORIES } from '../utils/loanMovement';
import { copyText } from '../utils/clipboard';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  formatCurrency,
  formatDate,
} from '../utils/constants';
import { CategoryDonutChart, DailySpendingTrendChart, FinancialHealth50_30_20 } from './ExpenseCharts';
import Receivables from './Receivables';
import { receivablesService, type InstallmentAssignment, type Receivable } from '../features/expenses/receivablesService';

const FinancialAnalyticsDashboard = lazy(() => import('./FinancialAnalyticsDashboard'));

interface ExpenseDashboardProps {
  dateNavigator?: React.ReactNode;
  expenses: Expense[];
  budget: BudgetConfig;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<boolean | string>;
  onUpdateExpense: (id: string, expense: Partial<Expense>) => Promise<boolean | string>;
  onDeleteExpense: (id: string) => Promise<boolean | string>;
  onLoanTransactionAdded?: (expense: Expense) => void;
  onLoanTransactionUpdated?: (expense: Expense) => void;
  onLoanTransactionDeleted?: (id: string) => void;
  onUpdateBudget: (budget: BudgetConfig) => void;
  onExportCSV: () => void;
  customCategories: Record<string, CategoryInfo>;
  onSaveCustomCategories: (categories: Record<string, CategoryInfo>) => void | Promise<boolean>;
  openAddModal?: boolean;
  analyticsEnabled?: boolean;
  accountIntelligenceEnabled?: boolean;
  accountVisibility?: { cash: boolean; savings: boolean };
  openTransactionHistory?: boolean;
  initialDate?: string;
  onAddModalOpened?: () => void;
  onQuickAddDismiss?: () => void;
  analyticsLoading?: boolean;
}

const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2000];
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

const getTransferTarget = (expense: Expense): 'expense' | 'savings' | 'cash' => {
  if (expense.transferToAccount) return expense.transferToAccount;
  const target = /transfer to (expense|cash|savings)/i.exec(expense.category)?.[1]?.toLowerCase();
  return (target as 'expense' | 'savings' | 'cash' | undefined) || 'expense';
};

type LedgerExpense = Expense & {
  ledgerKey?: string;
  transferDirection?: 'sent' | 'received';
  originalId?: string;
};

const accountDisplayName = (account: 'expense' | 'savings' | 'cash') =>
  account === 'expense' ? 'Expense' : account === 'savings' ? 'Savings' : 'Cash';

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
  dateNavigator,
  expenses,
  budget,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onLoanTransactionAdded,
  onLoanTransactionUpdated,
  onLoanTransactionDeleted,
  onUpdateBudget,
  onExportCSV,
  customCategories,
  onSaveCustomCategories,
  openAddModal = false,
  analyticsEnabled = true,
  accountIntelligenceEnabled = true,
  accountVisibility = { cash: true, savings: true },
  openTransactionHistory = false,
  initialDate,
  onAddModalOpened,
  onQuickAddDismiss,
  analyticsLoading = false
}) => {
  const currencySymbol = budget.currency || '₹';
  const monthlyBudget = Math.max(budget.monthlyBudget || 30000, 1);
  const referenceDateIso = initialDate || formatDate(new Date());
  const snapshotExpenses = useMemo(() => expenses.filter(expense => expense.date <= referenceDateIso), [expenses, referenceDateIso]);

  // Category State (includes default + custom categories)
  const [categoriesMap, setCategoriesMap] = useState<Record<string, CategoryInfo>>({ ...CATEGORIES, ...customCategories });
  useEffect(() => setCategoriesMap({ ...CATEGORIES, ...customCategories }), [customCategories]);

  // Tab switcher state for Analytics & Ledger (default to Transaction Ledger as first tab)
  const [activeTab, setActiveTab] = useState<'ledger' | 'classification' | 'category' | 'velocity' | 'account_report'>('ledger');
  const [showLoans, setShowLoans] = useState(false);
  const [ledgerInstallments, setLedgerInstallments] = useState<InstallmentAssignment[]>([]);
  const [ledgerLoans, setLedgerLoans] = useState<Receivable[]>([]);
  useEffect(() => {
    if (showLoans || !expenses.some(isLoanMovement)) return;
    let active = true;
    receivablesService.listInstallmentAssignments().then(rows => { if (active) setLedgerInstallments(rows); }).catch(() => { if (active) setLedgerInstallments([]); });
    receivablesService.list().then(rows => { if (active) setLedgerLoans(rows); }).catch(() => { if (active) setLedgerLoans([]); });
    return () => { active = false; };
  }, [expenses, showLoans]);
  const transactionNote = (item: Expense) => {
    const assigned = ledgerInstallments.find(entry => entry.expense_id === item.id);
    const internalNote = isLoanMovement(item) && /^Loan record: .+$/.test(item.notes || '');
    const loanId = assigned?.loan_id || (internalNote ? item.notes?.slice('Loan record: '.length) : undefined);
    const amount = ledgerLoans.find(loan => loan.id === loanId)?.installment_amount;
    const amountNote = amount != null && Number.isFinite(Number(amount)) ? ` · Current installment amount: ${formatCurrency(Number(amount), currencySymbol)}` : '';
    if (assigned && (internalNote || !item.notes)) return `Installment: ${formatDisplayDate(assigned.installment_date)}${amountNote}`;
    if (internalNote) return item.title.toLowerCase().startsWith('loan payment') ? `Loan payment${amountNote}` : 'Loan transaction';
    return getBalanceAdjustmentNote(item);
  };
  useDialogBack(showLoans, () => setShowLoans(false));
  useEffect(() => {
    if ((!analyticsEnabled && ['classification', 'category', 'velocity'].includes(activeTab)) ||
        (!accountIntelligenceEnabled && activeTab === 'account_report')) setActiveTab('ledger');
  }, [activeTab, analyticsEnabled, accountIntelligenceEnabled]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [transactionSaveError, setTransactionSaveError] = useState<string | null>(null);
  const [isUpdatingTransaction, setIsUpdatingTransaction] = useState(false);
  const [transactionUpdateError, setTransactionUpdateError] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loanEditBlocked, setLoanEditBlocked] = useState(false);
  useDialogBack(loanEditBlocked, () => setLoanEditBlocked(false));
  useDialogBack(isAddModalOpen || Boolean(editingExpense), () => { setIsAddModalOpen(false); setEditingExpense(null); });
  const [viewingExpense, setViewingExpense] = useState<LedgerExpense | null>(null);
  const viewingInflow = viewingExpense?.transferDirection === 'received' || (!viewingExpense?.isTransfer && viewingExpense?.type === 'income');
  const viewingNote = viewingExpense ? transactionNote(viewingExpense) : undefined;
  const viewingCopyText = viewingExpense ? [
    viewingExpense.title,
    `${viewingInflow ? '+' : '-'}${formatCurrency(viewingExpense.amount, currencySymbol)}`,
    `Date: ${formatDisplayDate(viewingExpense.date)}`,
    `Account: ${accountDisplayName(viewingExpense.account || 'expense')}`,
    `Category: ${viewingExpense.category}`,
    `Payment: ${viewingExpense.paymentMethod}`,
    viewingNote,
  ].filter(Boolean).join('\n') : '';
  const [detailCopyStatus, setDetailCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  useEffect(() => { setDetailCopyStatus('idle'); }, [viewingExpense]);
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
  const [isSelfTransfer, setIsSelfTransfer] = useState(false);
  const [transferToAccount, setTransferToAccount] = useState<'expense' | 'savings' | 'cash'>('savings');
  useEffect(() => {
    if ((formAccount === 'cash' && !accountVisibility.cash) || (formAccount === 'savings' && !accountVisibility.savings)) {
      setFormAccount('expense');
      setFormTransactionType('expense');
      setIsSelfTransfer(false);
    }
    if ((transferToAccount === 'cash' && !accountVisibility.cash) || (transferToAccount === 'savings' && !accountVisibility.savings)) {
      setTransferToAccount(formAccount !== 'expense' ? 'expense' : accountVisibility.savings ? 'savings' : 'cash');
    }
    if (!accountVisibility.cash && !accountVisibility.savings) setIsSelfTransfer(false);
  }, [accountVisibility.cash, accountVisibility.savings, formAccount, transferToAccount]);
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Food & Dining');
  const [formDate, setFormDate] = useState(referenceDateIso);
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
  const [historyTimeframe, setHistoryTimeframe] = useState<'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_30_days' | 'custom' | 'all'>('last_7_days');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [mobileHistoryPage, setMobileHistoryPage] = useState(1);
  const [desktopHistoryPage, setDesktopHistoryPage] = useState(1);

  useEffect(() => {
    if (openTransactionHistory) {
      setHistoryTimeframe('all');
      const frame = requestAnimationFrame(() => document.getElementById('transaction-ledger-section')?.scrollIntoView({ block: 'start' }));
      return () => cancelAnimationFrame(frame);
    }
    if (!initialDate) return;
    setHistoryTimeframe('custom');
    setHistoryStartDate(initialDate);
    setHistoryEndDate(initialDate);
  }, [initialDate, openTransactionHistory]);

  const resetHistoryFilters = () => {
    setHistorySearch('');
    setHistoryAccountFilter('all');
    setHistoryTypeFilter('all');
    setHistoryTimeframe('last_7_days');
    setHistoryStartDate('');
    setHistoryEndDate('');
    setHistoryCategory('all');
    setHistoryPayment('all');
  };
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
    return snapshotExpenses.filter(e => e.account === 'savings');
  }, [snapshotExpenses]);

  const expenseAccTransactions = useMemo(() => {
    return snapshotExpenses.filter(e => (e.account || 'expense') === 'expense');
  }, [snapshotExpenses]);

  const cashTransactions = useMemo(() => {
    return snapshotExpenses.filter(e => e.account === 'cash');
  }, [snapshotExpenses]);

  // Savings Account Stats
  const savingsIncomeTotal = useMemo(() => {
    return savingsTransactions.filter(e => e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [savingsTransactions]);

  const savingsTransferredOutTotal = useMemo(() => {
    return snapshotExpenses.filter(e => e.isTransfer
      ? (e.account || 'savings') === 'savings' && getTransferTarget(e) === 'expense'
      : e.category.includes('Transfer'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [snapshotExpenses]);

  const savingsCurrentBalance = getAccountBalance(snapshotExpenses, 'savings', referenceDateIso);

  // Cash in Hand Stats
  const cashIncomeTotal = useMemo(() => {
    return cashTransactions.filter(e => e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [cashTransactions]);

  const cashOutflowTotal = useMemo(() => {
    return cashTransactions.filter(e => e.type !== 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [cashTransactions]);

  const cashCurrentBalance = getAccountBalance(snapshotExpenses, 'cash', referenceDateIso);

  // Expense Account Stats
  const expenseDirectInflows = useMemo(() => {
    return expenseAccTransactions.filter(e => e.type === 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions]);

  const expenseOutflowsTotal = useMemo(() => {
    return expenseAccTransactions.filter(e => e.type !== 'income' && !e.isTransfer).reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions]);

  const expenseAccCurrentBalance = getAccountBalance(snapshotExpenses, 'expense', referenceDateIso);

  // Selected date helpers
  const now = new Date(`${referenceDateIso}T00:00:00`);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Daily, Weekly, Monthly Spends specifically for Expense Account
  const dailyExpenseSpend = useMemo(() => {
    return expenseAccTransactions
      .filter(e => e.date === referenceDateIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, referenceDateIso]);

  const weeklyExpenseSpend = useMemo(() => {
    const d = new Date(`${referenceDateIso}T00:00:00`);
    d.setDate(d.getDate() - 6);
    const sevenDaysAgoIso = formatDate(d);
    return expenseAccTransactions
      .filter(e => e.date >= sevenDaysAgoIso && e.date <= referenceDateIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, referenceDateIso]);

  const previousDayExpenseSpend = useMemo(() => {
    const previousDay = new Date(`${referenceDateIso}T00:00:00`);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayIso = formatDate(previousDay);
    return expenseAccTransactions
      .filter(e => e.date === previousDayIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, referenceDateIso]);

  const previousWeekExpenseSpend = useMemo(() => {
    const end = new Date(`${referenceDateIso}T00:00:00`);
    end.setDate(end.getDate() - 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startIso = formatDate(start);
    const endIso = formatDate(end);
    return expenseAccTransactions
      .filter(e => e.date >= startIso && e.date <= endIso && e.date <= referenceDateIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, referenceDateIso]);

  const monthlyExpenseSpend = useMemo(() => {
    return expenseAccTransactions
      .filter(e => {
        const eDate = new Date(e.date + 'T00:00:00');
        return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonth && e.date <= referenceDateIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e);
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, currentYear, currentMonth, referenceDateIso]);

  const previousMonthExpenseSpend = useMemo(() => {
    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth();
    return expenseAccTransactions
      .filter(e => {
        const eDate = new Date(`${e.date}T00:00:00`);
        return eDate.getFullYear() === previousYear && eDate.getMonth() === previousMonth && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e);
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenseAccTransactions, currentYear, currentMonth]);

  const weeklyDailyTargetBalance = useMemo(() => {
    const today = new Date(`${referenceDateIso}T00:00:00`);
    const dailyTarget = budget.dailyBudget || 1000;
    let total = 0;
    for (let daysAgo = 0; daysAgo < 7; daysAgo += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - daysAgo);
      const dayIso = formatDate(day);
      const transactions = expenseAccTransactions
        .filter(e => e.date === dayIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e));
      if (transactions.length === 0) continue;
      const spend = transactions.reduce((sum, e) => sum + e.amount, 0);
      total += spend - dailyTarget;
    }
    return total;
  }, [expenseAccTransactions, referenceDateIso, budget.dailyBudget]);

  const fourWeekTargetBalance = useMemo(() => {
    const currentWeekStart = new Date(`${referenceDateIso}T00:00:00`);
    currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
    const weeklyTarget = budget.weeklyBudget || 7000;
    let total = 0;
    for (let weekOffset = 0; weekOffset < 4; weekOffset += 1) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - weekOffset * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startIso = formatDate(start);
      const endIso = formatDate(end);
      const transactions = expenseAccTransactions
        .filter(e => e.date >= startIso && e.date <= endIso && e.date <= referenceDateIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e));
      if (transactions.length === 0) continue;
      const spend = transactions.reduce((sum, e) => sum + e.amount, 0);
      total += spend - weeklyTarget;
    }
    return total;
  }, [expenseAccTransactions, referenceDateIso, budget.weeklyBudget]);

  const twelveMonthTargetBalance = useMemo(() => {
    let total = 0;
    for (let monthOffset = 0; monthOffset < 12; monthOffset += 1) {
      const month = new Date(currentYear, currentMonth - monthOffset, 1);
      const transactions = expenseAccTransactions
        .filter(e => {
          const date = new Date(`${e.date}T00:00:00`);
          return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth() && e.date <= referenceDateIso && e.type !== 'income' && !e.isTransfer && !isLoanMovement(e);
        });
      if (transactions.length === 0) continue;
      const spend = transactions.reduce((sum, e) => sum + e.amount, 0);
      total += spend - monthlyBudget;
    }
    return total;
  }, [expenseAccTransactions, currentYear, currentMonth, monthlyBudget, referenceDateIso]);

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

  const renderPreviousTargetSummary = (label: string, target: number, spend: number) => {
    const remaining = target - spend;
    return (
      <div className="mt-1 inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[10px] leading-4 dark:border-slate-700/80 dark:bg-slate-900/50">
        {label}: {formatCurrency(spend, currencySymbol)} · {remaining < 0 ? `Over target ${formatCurrency(Math.abs(remaining), currencySymbol)}` : `Remaining ${formatCurrency(remaining, currencySymbol)}`}
      </div>
    );
  };

  const renderCumulativeTargetBalance = (label: string, total: number) => (
    <div className={`mt-2 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] leading-4 ${total > 0 ? 'border-rose-200/80 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/25' : 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20'}`}>
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <strong className={`font-mono font-bold tabular-nums ${total > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatCurrency(Math.abs(total), currencySymbol)} {total > 0 ? 'Over target' : total < 0 ? 'Saved' : 'On target'}</strong>
    </div>
  );

  const thisMonthTransactions = useMemo(() => {
    return expenses.filter(e => {
      const eDate = new Date(e.date + 'T00:00:00');
      return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonth && e.date <= referenceDateIso;
    });
  }, [expenses, currentYear, currentMonth, referenceDateIso]);

  const thisMonthSpendTotal = useMemo(() => {
    return thisMonthTransactions
      .filter(e => e.type !== 'income' && !e.isTransfer && !isLoanMovement(e))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [thisMonthTransactions]);

  // Combined Net Worth
  const combinedTotalBalance = savingsCurrentBalance + expenseAccCurrentBalance;

  // Filtered History for Table
  const filteredHistory = useMemo(() => {
    const ledgerEntries: LedgerExpense[] = expenses.filter(expense => isAccountTransactionVisible(expense, accountVisibility)).flatMap(expense => {
      const isTransfer = expense.isTransfer || expense.category.toLowerCase().includes('transfer');
      const source = expense.account || 'expense';
      const sent: LedgerExpense = { ...expense, isTransfer, ledgerKey: `${expense.id}-sent`, originalId: isTransfer ? expense.id : undefined, transferDirection: isTransfer ? 'sent' : undefined };
      if (!isTransfer) return [sent];

      const target = getTransferTarget(expense);
      if (source === target) return [sent];
      const received: LedgerExpense = {
        ...expense,
        id: `${expense.id}-received`,
        originalId: expense.id,
        ledgerKey: `${expense.id}-received`,
        title: `Transfer from ${accountDisplayName(source)}`,
        account: target,
        type: 'income',
        isTransfer: true,
        transferDirection: 'received'
      };
      return [sent, received];
    });

    return ledgerEntries.filter(e => {
      const eDate = new Date(e.date + 'T00:00:00');

      // Account filter
      if (historyAccountFilter !== 'all') {
        const itemAcc = e.account || 'expense';
        if (itemAcc !== historyAccountFilter) return false;
      }

      // Flow Type Filter (Inflow vs Outflow vs Transfer)
      if (historyTypeFilter !== 'all') {
        const isTransfer = e.isTransfer || e.category.toLowerCase().includes('transfer');
        if (historyTypeFilter === 'inflow') {
          if (isTransfer ? e.transferDirection !== 'received' : e.type !== 'income') return false;
        } else if (historyTypeFilter === 'outflow') {
          if (isTransfer ? e.transferDirection !== 'sent' : e.type === 'income') return false;
        } else if (historyTypeFilter === 'transfer') {
          if (!isTransfer) return false;
        }
      }

      // Timeframe & Custom Date Range
      if (historyTimeframe === 'today') {
        if (e.date !== referenceDateIso) return false;
      } else if (historyTimeframe === 'yesterday') {
        const yesterday = new Date(`${referenceDateIso}T00:00:00`);
        yesterday.setDate(yesterday.getDate() - 1);
        if (e.date !== formatDate(yesterday)) return false;
      } else if (historyTimeframe === 'last_7_days') {
        const start = new Date(`${referenceDateIso}T00:00:00`);
        start.setDate(start.getDate() - 6);
        if (e.date < formatDate(start) || e.date > referenceDateIso) return false;
      } else if (historyTimeframe === 'this_month') {
        if (e.date > referenceDateIso) return false;
        if (eDate.getFullYear() !== currentYear || eDate.getMonth() !== currentMonth) return false;
      } else if (historyTimeframe === 'last_30_days') {
        const thirtyDaysAgo = new Date(`${referenceDateIso}T00:00:00`);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (eDate < thirtyDaysAgo || e.date > referenceDateIso) return false;
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
      const pairedTransferOrder = a.originalId && a.originalId === b.originalId
        ? (a.transferDirection === 'received' ? -1 : 1)
        : 0;
      if (historySort === 'date_desc') {
        const dateOrder = new Date(b.date).getTime() - new Date(a.date).getTime();
        return dateOrder || (b.createdAt ?? 0) - (a.createdAt ?? 0) || pairedTransferOrder;
      }
      if (historySort === 'date_asc') {
        const dateOrder = new Date(a.date).getTime() - new Date(b.date).getTime();
        return dateOrder || (a.createdAt ?? 0) - (b.createdAt ?? 0) || pairedTransferOrder;
      }
      if (historySort === 'amount_desc') return b.amount - a.amount || pairedTransferOrder;
      if (historySort === 'amount_asc') return a.amount - b.amount || pairedTransferOrder;
      return 0;
    });
  }, [
    expenses,
    accountVisibility.cash,
    accountVisibility.savings,
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
    currentMonth,
    referenceDateIso
  ]);

  const MOBILE_HISTORY_PAGE_SIZE = 15;
  const DESKTOP_HISTORY_PAGE_SIZE = 25;
  const mobileHistoryPageCount = Math.max(1, Math.ceil(filteredHistory.length / MOBILE_HISTORY_PAGE_SIZE));
  const desktopHistoryPageCount = Math.max(1, Math.ceil(filteredHistory.length / DESKTOP_HISTORY_PAGE_SIZE));
  const mobileHistoryItems = filteredHistory.slice(
    (mobileHistoryPage - 1) * MOBILE_HISTORY_PAGE_SIZE,
    mobileHistoryPage * MOBILE_HISTORY_PAGE_SIZE
  );
  const desktopHistoryItems = filteredHistory.slice(
    (desktopHistoryPage - 1) * DESKTOP_HISTORY_PAGE_SIZE,
    desktopHistoryPage * DESKTOP_HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    setMobileHistoryPage(1);
    setDesktopHistoryPage(1);
  }, [
    expenses,
    historySearch,
    historyAccountFilter,
    historyTypeFilter,
    historyTimeframe,
    historyStartDate,
    historyEndDate,
    historyCategory,
    historyPayment,
    historySort
  ]);

  const classificationAnalyticsExpenses = useMemo(() => expenses.filter(expense => {
    if (!isAccountTransactionVisible(expense, accountVisibility) || isLoanMovement(expense)) return false;
    const date = new Date(`${expense.date}T00:00:00`);
    if (analyticsAccount !== 'all' && (expense.account || 'expense') !== analyticsAccount) return false;
    if (classificationPeriod !== 'custom' && expense.date > referenceDateIso) return false;
    if (classificationPeriod === 'this_month' && (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth)) return false;
    if (classificationPeriod === 'last_30_days') {
      const cutoff = new Date(`${referenceDateIso}T00:00:00`);
      cutoff.setDate(cutoff.getDate() - 30);
      if (date < cutoff) return false;
    }
    if (classificationPeriod === 'custom' && ((analyticsStartDate && expense.date < analyticsStartDate) || (analyticsEndDate && expense.date > analyticsEndDate))) return false;
    return true;
  }), [expenses, accountVisibility.cash, accountVisibility.savings, analyticsAccount, classificationPeriod, analyticsStartDate, analyticsEndDate, currentYear, currentMonth, referenceDateIso]);

  const categoryAnalyticsExpenses = useMemo(() => expenses.filter(expense => {
    if (!isAccountTransactionVisible(expense, accountVisibility) || isLoanMovement(expense)) return false;
    const date = new Date(`${expense.date}T00:00:00`);
    if (analyticsAccount !== 'all' && (expense.account || 'expense') !== analyticsAccount) return false;
    if (categoryPeriod !== 'custom' && categoryPeriod !== 'all' && expense.date > referenceDateIso) return false;
    if (categoryPeriod === 'this_month' && (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth)) return false;
    if (categoryPeriod === 'last_30_days') {
      const cutoff = new Date(`${referenceDateIso}T00:00:00`);
      cutoff.setDate(cutoff.getDate() - 30);
      if (date < cutoff) return false;
    }
    if (categoryPeriod === 'custom' && ((analyticsStartDate && expense.date < analyticsStartDate) || (analyticsEndDate && expense.date > analyticsEndDate))) return false;
    return expense.type !== 'income' && !expense.isTransfer &&
      (analyticsPayment === 'all' || expense.paymentMethod === analyticsPayment);
  }), [expenses, accountVisibility.cash, accountVisibility.savings, analyticsAccount, categoryPeriod, analyticsStartDate, analyticsEndDate, analyticsPayment, currentYear, currentMonth, referenceDateIso]);

  const velocityStartIso = velocityDays === 'custom' && analyticsStartDate ? analyticsStartDate : formatDate(new Date(new Date(`${referenceDateIso}T00:00:00`).getTime() - ((velocityDays === 'custom' ? 30 : velocityDays) - 1) * 86400000));
  const velocityEndIso = velocityDays === 'custom' && analyticsEndDate ? analyticsEndDate : referenceDateIso;
  const velocityChartDaysCount = velocityDays === 'custom'
    ? analyticsStartDate && analyticsEndDate
      ? Math.max(1, Math.floor((new Date(`${analyticsEndDate}T00:00:00`).getTime() - new Date(`${analyticsStartDate}T00:00:00`).getTime()) / 86400000) + 1)
      : 30
    : velocityDays;

  const velocityAnalyticsExpenses = useMemo(() => {
    return expenses.filter(expense =>
      isAccountTransactionVisible(expense, accountVisibility) && !isLoanMovement(expense) &&
      expense.date >= velocityStartIso && expense.date <= velocityEndIso && expense.type !== 'income' && !expense.isTransfer &&
      (analyticsAccount === 'all' || (expense.account || 'expense') === analyticsAccount) &&
      (velocityCategory === 'all' || expense.category === velocityCategory) &&
      (analyticsPayment === 'all' || expense.paymentMethod === analyticsPayment)
    );
  }, [expenses, accountVisibility.cash, accountVisibility.savings, velocityStartIso, velocityEndIso, analyticsAccount, velocityCategory, analyticsPayment]);

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
    if (isSelfTransfer) {
      if (acc === transferToAccount) setTransferToAccount(formAccount);
      setFormAccount(acc);
      return;
    }
    setIsSelfTransfer(false);
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

  const setHistoryToAllDates = () => {
    const sortedDates = expenses.map(expense => expense.date).sort();
    setHistoryTimeframe('custom');
    setHistoryStartDate(sortedDates[0] || referenceDateIso);
    setHistoryEndDate(sortedDates[sortedDates.length - 1] || referenceDateIso);
  };

  const handleFilterExpenseAccount = () => {
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('all');
    setHistoryToAllDates();
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterDailySpend = () => {
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('outflow');
    setHistoryTimeframe('custom');
    setHistoryStartDate(referenceDateIso);
    setHistoryEndDate(referenceDateIso);
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterWeeklySpend = () => {
    const d = new Date(`${referenceDateIso}T00:00:00`);
    d.setDate(d.getDate() - 6);
    const sevenDaysAgo = formatDate(d);
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('outflow');
    setHistoryTimeframe('custom');
    setHistoryStartDate(sevenDaysAgo);
    setHistoryEndDate(referenceDateIso);
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterMonthlySpend = () => {
    setHistoryAccountFilter('expense');
    setHistoryTypeFilter('outflow');
    setHistoryTimeframe('custom');
    setHistoryStartDate(formatDate(new Date(currentYear, currentMonth, 1)));
    setHistoryEndDate(referenceDateIso);
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterSavingsAccount = () => {
    setHistoryAccountFilter('savings');
    setHistoryTypeFilter('all');
    setHistoryToAllDates();
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  const handleFilterCashAccount = () => {
    setHistoryAccountFilter('cash');
    setHistoryTypeFilter('all');
    setHistoryToAllDates();
    setHistoryCategory('all');
    setHistoryPayment('all');
    setHistorySearch('');
    scrollToLedger();
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setIsSelfTransfer(false);
    setFormAccount('expense');
    setFormTransactionType('expense');
    setTransferToAccount(accountVisibility.savings ? 'savings' : 'cash');
    setFormTitle('');
    setFormAmount('');
    setFormCategory('');
    setFormCategoryError('');
    setFormDate(initialDate || referenceDateIso);
    setFormPaymentMethod('UPI / QR');
    setFormNotes('');
    setFormIsRecurring(false);
    setShowAllCategories(false);
    setShowExtraDetails(false);
    setIsAddModalOpen(true);
  };

  useEffect(() => {
    if (!openAddModal) return;
    handleOpenAdd();
    onAddModalOpened?.();
  }, [openAddModal]);

  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    setEditingExpense(null);
    onQuickAddDismiss?.();
  };

  // Quick Amount preset handler
  const handleSelectPresetAmount = (amt: number) => {
    const current = parseFloat(formAmount) || 0;
    setFormAmount((current + amt).toFixed(2));
  };

  // Submit Add Expense
  const handleSubmitAdd = async () => {
    if (isSavingTransaction) return;
    const isTransfer = isSelfTransfer || formTransactionType === 'transfer';
    if (isSelfTransfer && formAccount === transferToAccount) {
      setTransactionSaveError('Choose two different accounts for a transfer.');
      return;
    }
    if (!isTransfer && (!formCategory || !formCategory.trim())) {
      setFormCategoryError('Category is mandatory. Please select a category before submitting.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransactionSaveError('Enter an amount greater than zero.');
      return;
    }

    const finalCategory = isTransfer ? `Transfer to ${isSelfTransfer ? transferToAccount : 'Expense Account'}` : formCategory;
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
      transferToAccount: isTransfer ? (isSelfTransfer ? transferToAccount : 'expense') : undefined,
      date: formDate || referenceDateIso,
      paymentMethod: formPaymentMethod || 'UPI / QR',
      notes: formNotes.trim() || undefined,
      isRecurring: formIsRecurring
      });
      if (saved !== true) {
        setTransactionSaveError(typeof saved === 'string' ? saved : 'Could not save this transaction.');
        return;
      }
      setFormCategoryError('');
      handleCloseAdd();
    } catch (error) {
      setTransactionSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingTransaction(false);
    }
  };

  // Submit Edit Expense
  const handleOpenEdit = (exp: Expense) => {
    if (isLoanMovement(exp)) { setLoanEditBlocked(true); return; }
    setEditingExpense(exp);
    setTransactionUpdateError(null);
    setFormAccount(exp.account || 'expense');
    setIsSelfTransfer(!!exp.isTransfer && ((exp.transferToAccount || 'expense') !== 'expense' || (exp.account || 'savings') !== 'savings'));
    setTransferToAccount(exp.transferToAccount || 'expense');
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
    const isTransfer = isSelfTransfer || formTransactionType === 'transfer';
    if (isSelfTransfer && formAccount === transferToAccount) {
      setTransactionUpdateError('Choose two different accounts for a transfer.');
      return;
    }
    if (!isTransfer && (!formCategory || !formCategory.trim())) {
      setFormCategoryError('Category is mandatory. Please select a category before submitting.');
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransactionUpdateError('Enter an amount greater than zero.');
      return;
    }

    const finalCategory = isTransfer ? `Transfer to ${isSelfTransfer ? transferToAccount : 'Expense Account'}` : formCategory;
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
        transferToAccount: isTransfer ? (isSelfTransfer ? transferToAccount : 'expense') : undefined,
        date: formDate || referenceDateIso,
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

  if (showLoans) return <div className="space-y-4 pb-24"><button type="button" onClick={() => setShowLoans(false)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />Back to finance</button><Receivables currency={currencySymbol} today={formatDate(new Date())} expenses={expenses} accountVisibility={accountVisibility} onTransactionAdded={onLoanTransactionAdded} onTransactionUpdated={onLoanTransactionUpdated} onTransactionDeleted={onLoanTransactionDeleted} /></div>;

  return (<>
    {dateNavigator}
    <div className="space-y-6 pb-24 relative">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-emerald-950/20 p-6 sm:p-8 shadow-sm">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Finance Workspace</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage your accounts and transactions
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button type="button" title="Payables & Receivables" aria-label="Payables & Receivables" onClick={() => setShowLoans(true)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:w-auto sm:rounded-xl sm:px-3"><HandCoins className="h-4 w-4 text-indigo-500" /><span className="ml-1.5 hidden sm:inline">Payables &amp; Receivables</span></button>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-center">
                <div 
                  onClick={(e) => { e.stopPropagation(); handleFilterDailySpend(); }}
                  className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-rose-50/40 p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-sm dark:border-slate-800 dark:from-slate-800/80 dark:to-rose-950/10 dark:hover:border-rose-800 cursor-pointer"
                  title="Click to view selected date spend transactions"
                >
                  <span className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300 block mb-1.5">
                    Daily Spend
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tabular-nums tracking-tight">
                    {formatCurrency(dailyExpenseSpend, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{referenceDateIso === formatDate(new Date()) ? 'Today' : formatDisplayDate(referenceDateIso)}</span>
                  {renderPreviousTargetSummary('Previous day', budget.dailyBudget || 1000, previousDayExpenseSpend)}
                  {renderTargetSummary(budget.dailyBudget || 1000, dailyExpenseSpend, 'rose')}
                  {renderCumulativeTargetBalance('7-day balance', weeklyDailyTargetBalance)}
                </div>

                <div 
                  onClick={(e) => { e.stopPropagation(); handleFilterWeeklySpend(); }}
                  className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-amber-50/40 p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm dark:border-slate-800 dark:from-slate-800/80 dark:to-amber-950/10 dark:hover:border-amber-800 cursor-pointer"
                  title="Click to view weekly spend transactions"
                >
                  <span className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300 block mb-1.5">
                    Weekly Spend
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
                    {formatCurrency(weeklyExpenseSpend, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Last 7 Days</span>
                  {renderPreviousTargetSummary('Previous 7 days', budget.weeklyBudget || 7000, previousWeekExpenseSpend)}
                  {renderTargetSummary(budget.weeklyBudget || 7000, weeklyExpenseSpend, 'amber')}
                  {renderCumulativeTargetBalance('4-week balance', fourWeekTargetBalance)}
                </div>

                <div 
                  onClick={(e) => { e.stopPropagation(); handleFilterMonthlySpend(); }}
                  className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-indigo-50/40 p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:from-slate-800/80 dark:to-indigo-950/10 dark:hover:border-indigo-800 cursor-pointer"
                  title="Click to view monthly spend transactions"
                >
                  <span className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300 block mb-1.5">
                    Monthly Spend
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tight">
                    {formatCurrency(monthlyExpenseSpend, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{new Date(`${referenceDateIso}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                  {renderPreviousTargetSummary('Previous month', monthlyBudget, previousMonthExpenseSpend)}
                  {renderTargetSummary(monthlyBudget, monthlyExpenseSpend, 'indigo')}
                  {renderCumulativeTargetBalance('12-month balance', twelveMonthTargetBalance)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              {accountVisibility.savings && <span>Transfers Received from Savings: <strong className="font-mono text-slate-800 dark:text-slate-200">+{formatCurrency(savingsTransferredOutTotal, currencySymbol)}</strong></span>}
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenAdd(); }}
                className="hidden sm:inline-block text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
              >
                + Log Expense
              </button>
            </div>
          </div>

          {/* Cards 2 & 3: Savings Account & Cash in Hand */}
          {(accountVisibility.savings || accountVisibility.cash) && <div className={`grid grid-cols-1 ${accountVisibility.savings && accountVisibility.cash ? 'md:grid-cols-2' : ''} gap-6`}>
            {/* Card 2: Savings Account Focus */}
            {accountVisibility.savings && <div 
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
            </div>}

            {/* Card 3: Cash in Hand Focus */}
            {accountVisibility.cash && <div 
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
            </div>}
          </div>}
        </div>
      </div>

        {/* Analytics & Ledger Tab Switcher */}
        <div role="group" aria-label="Expense modules" className="report-module-tabs mt-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-700 dark:bg-slate-950/40 sm:mt-6 sm:flex-wrap sm:items-center sm:gap-2 sm:overflow-visible sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:p-0 sm:pb-px dark:sm:border-slate-800 dark:sm:bg-transparent">
          <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
            <button
              type="button"
              aria-pressed={activeTab === 'ledger'}
              onClick={() => setActiveTab('ledger')}
              className={`shrink-0 w-auto min-w-max min-h-11 justify-center rounded-xl border py-2 px-3 text-center text-[11px] leading-tight sm:col-span-1 sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap snap-start focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-white shadow-sm dark:bg-slate-800 sm:bg-transparent sm:shadow-none dark:sm:bg-transparent border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">📋 Ledger ({expenses.length})</span><span className="hidden sm:inline">📋 Transaction Ledger ({expenses.length})</span>
            </button>


            {analyticsEnabled && (<button
              type="button"
              aria-pressed={activeTab === 'classification'}
              onClick={() => setActiveTab('classification')}
              className={`shrink-0 w-auto min-w-max min-h-11 justify-center rounded-xl border py-2 px-3 text-center text-[11px] leading-tight sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap snap-start focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer ${
                activeTab === 'classification'
                  ? 'bg-white shadow-sm dark:bg-slate-800 sm:bg-transparent sm:shadow-none dark:sm:bg-transparent border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">🎯 50/30/20</span><span className="hidden sm:inline">🎯 Classification (50/30/20)</span>
            </button>)}

            {analyticsEnabled && (<button
              type="button"
              aria-pressed={activeTab === 'category'}
              onClick={() => setActiveTab('category')}
              className={`shrink-0 w-auto min-w-max min-h-11 justify-center rounded-xl border py-2 px-3 text-center text-[11px] leading-tight sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap snap-start focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer ${
                activeTab === 'category'
                  ? 'bg-white shadow-sm dark:bg-slate-800 sm:bg-transparent sm:shadow-none dark:sm:bg-transparent border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">🍩 Categories</span><span className="hidden sm:inline">🍩 Category Breakdown</span>
            </button>)}

            {analyticsEnabled && (<button
              type="button"
              aria-pressed={activeTab === 'velocity'}
              onClick={() => setActiveTab('velocity')}
              className={`shrink-0 w-auto min-w-max min-h-11 justify-center rounded-xl border py-2 px-3 text-center text-[11px] leading-tight sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap snap-start focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer ${
                activeTab === 'velocity'
                  ? 'bg-white shadow-sm dark:bg-slate-800 sm:bg-transparent sm:shadow-none dark:sm:bg-transparent border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">📈 Velocity</span><span className="hidden sm:inline">📈 Daily Velocity</span>
            </button>)}
            {accountIntelligenceEnabled && <button
              type="button"
              aria-pressed={activeTab === 'account_report'}
              onClick={() => setActiveTab('account_report')}
              className={`shrink-0 w-auto min-w-max min-h-11 justify-center rounded-xl border py-2 px-3 text-center text-[11px] leading-tight sm:min-h-0 sm:w-auto sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-5 sm:py-2.5 sm:text-left sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap snap-start focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer ${
                activeTab === 'account_report'
                  ? 'bg-white shadow-sm dark:bg-slate-800 sm:bg-transparent sm:shadow-none dark:sm:bg-transparent border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">💳 Accounts</span><span className="hidden sm:inline">💳 Account Spends &amp; Intelligence</span>
            </button>}
          </div>
        </div>

      {/* Tab Content Display */}
      <div className="mt-6">
        {analyticsEnabled && (activeTab === 'classification' || activeTab === 'category' || activeTab === 'velocity') && (
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
                  <option value="all">All Accounts</option><option value="expense">Expense Account</option>{accountVisibility.cash && <option value="cash">Cash in Hand</option>}{accountVisibility.savings && <option value="savings">Savings Account</option>}
                </select>
              )}
              {analyticsEnabled && activeTab === 'classification' && (
                <select aria-label="Classification period" value={classificationPeriod} onChange={e => setClassificationPeriod(e.target.value as typeof classificationPeriod)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="this_month">This Month</option><option value="last_30_days">Last 30 Days</option><option value="custom">Custom Dates</option>
                </select>
              )}
              {activeTab === 'category' && <>
                <select aria-label="Category period" value={categoryPeriod} onChange={e => setCategoryPeriod(e.target.value as typeof categoryPeriod)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="this_month">This Month</option><option value="last_30_days">Last 30 Days</option><option value="custom">Custom Dates</option><option value="all">All Records</option>
                </select>
              </>}
              {analyticsEnabled && activeTab === 'velocity' && (
                <select aria-label="Velocity range" value={velocityDays} onChange={e => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    if (!analyticsStartDate) setAnalyticsStartDate(formatDate(new Date(new Date(`${referenceDateIso}T00:00:00`).getTime() - 29 * 86400000)));
                    if (!analyticsEndDate) setAnalyticsEndDate(referenceDateIso);
                    setVelocityDays('custom');
                  } else {
                    setVelocityDays(Number(value) as 7 | 30 | 90);
                  }
                }} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option><option value="custom">Custom Dates</option>
                </select>
              )}
              {analyticsEnabled && activeTab === 'category' && (
                <select aria-label="Payment method" value={analyticsPayment} onChange={e => setAnalyticsPayment(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Payments</option>{PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                </select>
              )}
              {activeTab === 'velocity' && <>
                <select aria-label="Velocity account" value={analyticsAccount} onChange={e => setAnalyticsAccount(e.target.value as typeof analyticsAccount)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <option value="all">All Accounts</option><option value="expense">Expense Account</option>{accountVisibility.cash && <option value="cash">Cash in Hand</option>}{accountVisibility.savings && <option value="savings">Savings Account</option>}
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
        {analyticsEnabled && activeTab === 'classification' && (
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
        {analyticsEnabled && activeTab === 'category' && (
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
        {analyticsEnabled && activeTab === 'velocity' && (
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
              rangeStartDate={velocityStartIso}
              rangeEndDate={velocityEndIso}
              currencySymbol={currencySymbol}
            />
          </div>
        )}

        {/* Tab: Account Intelligence Report */}
        {accountIntelligenceEnabled && activeTab === 'account_report' && (
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
                  Explore spending and balances across your enabled accounts with custom filters
                </p>
              </div>
            </div>

            <Suspense fallback={<div role="status" className="h-64 animate-pulse rounded-2xl bg-slate-100 p-5 text-xs text-slate-500 dark:bg-slate-800">Loading financial analytics…</div>}>
              <FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate={referenceDateIso} loading={analyticsLoading} categoryNames={Object.keys(customCategories)} accountVisibility={accountVisibility} />
            </Suspense>
          </div>
        )}

        {/* Tab 4: Transaction Ledger Table */}
        {activeTab === 'ledger' && (
          <div id="transaction-ledger-section" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Transaction Ledger
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  ({filteredHistory.length} filtered)
                </span>
              </div>

              {/* Toolbar Controls */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-center xl:flex xl:flex-wrap xl:items-center">
                {/* Search */}
                <div className="relative col-span-2 min-w-0 sm:col-span-2 sm:min-w-0 xl:flex-1 xl:basis-56">
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
                  {accountVisibility.savings && <option value="savings">🏦 Savings Account</option>}
                  {accountVisibility.cash && <option value="cash">💵 Cash in Hand</option>}
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
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="custom">📅 Custom Date Range</option>
                </select>

                {/* Custom Date Pickers */}
                {historyTimeframe === 'custom' && (
                  <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 sm:col-span-2">
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
                  {[...new Set([...Object.keys(categoriesMap), ...LOAN_MOVEMENT_CATEGORIES])].map(cat => (
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

                <div className="col-span-2 flex w-full min-w-0 gap-2 sm:col-span-2 sm:w-auto xl:ml-auto">
                  <button
                    onClick={onExportCSV}
                    className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:min-h-9 sm:flex-none sm:py-1.5"
                    title="Export transactions to CSV"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetHistoryFilters}
                    className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/70 sm:min-h-9 sm:flex-none sm:py-1.5"
                    title="Reset transaction filters"
                  >
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    <span>Reset Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile transaction cards */}
            <div className="py-0.5 md:hidden">
              {filteredHistory.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No transactions match these filters.</p>
              ) : mobileHistoryItems.map(item => {
                const catColor = categoriesMap[item.category]?.color || '#94A3B8';
                const isIncome = item.type === 'income';
                const isTransfer = item.isTransfer;
                const originalItem = item.originalId ? expenses.find(expense => expense.id === item.originalId) || item : item;
                const accountLabel = item.account === 'savings' ? 'Savings account' : item.account === 'cash' ? 'Cash account' : 'Expense account';
                return (
                  <article key={item.ledgerKey || item.id} className={`mx-3 my-1.5 grid gap-y-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 ${isTransfer ? item.transferDirection === 'received' ? 'border-l-2 border-l-cyan-500' : 'border-l-2 border-l-amber-500' : isIncome ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-rose-500'}`}>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1.5">
                      <h4 className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-100">{item.title}</h4>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => setViewingExpense(item)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300" aria-label={`View ${item.title}`} title="View details">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleOpenEdit(originalItem)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300" aria-label={`Edit ${item.title}`} title="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setExpenseToDelete(originalItem)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition-all duration-150 hover:-translate-y-0.5 hover:bg-rose-100 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50" aria-label={`Delete ${item.title}`} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="col-span-full row-start-2 mt-0 flex flex-wrap items-center text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{formatDisplayDate(item.date)}</span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="inline-flex max-w-full items-center gap-1.5 break-words rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: catColor }} />{item.category}
                        </span>
                        <span className="inline-block w-fit max-w-full break-words rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{item.paymentMethod}</span>
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{accountLabel}</span>
                        <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold ${isTransfer ? item.transferDirection === 'received' ? 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/70 dark:bg-cyan-950/50 dark:text-cyan-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300' : isIncome ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300'}`}>
                          {isTransfer ? 'Transfer' : isIncome ? 'Inflow' : 'Outflow'}
                        </span>
                      </div>
                      <strong className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-base leading-none font-extrabold tracking-tight tabular-nums shadow-sm ${isTransfer ? item.transferDirection === 'received' ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300' : isIncome ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300'}`}>
                        {item.transferDirection === 'received' ? '+' : item.transferDirection === 'sent' ? '-' : isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySymbol)}
                      </strong>
                    </div>
                    {transactionNote(item) && <p className="line-clamp-2 break-words text-xs text-slate-500 dark:text-slate-400">{transactionNote(item)}</p>}
                  </article>
                );
              })}
              {filteredHistory.length > MOBILE_HISTORY_PAGE_SIZE && (
                <div className="mx-3 my-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    {(mobileHistoryPage - 1) * MOBILE_HISTORY_PAGE_SIZE + 1}–{Math.min(mobileHistoryPage * MOBILE_HISTORY_PAGE_SIZE, filteredHistory.length)} of {filteredHistory.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMobileHistoryPage(page => Math.max(1, page - 1))} disabled={mobileHistoryPage === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Previous</button>
                    <span className="whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">{mobileHistoryPage} / {mobileHistoryPageCount}</span>
                    <button type="button" onClick={() => setMobileHistoryPage(page => Math.min(mobileHistoryPageCount, page + 1))} disabled={mobileHistoryPage === mobileHistoryPageCount} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Next</button>
                  </div>
                </div>
              )}
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
                    <th className="py-3 px-4">Flow</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        No transactions match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    desktopHistoryItems.map(item => {
                      const catInfo = categoriesMap[item.category];
                      const catColor = catInfo?.color || '#94A3B8';
                      const isSavings = item.account === 'savings';
                      const isCash = item.account === 'cash';
                      const isIncome = item.type === 'income';
                      const isTransfer = item.isTransfer;
                      const originalItem = item.originalId ? expenses.find(expense => expense.id === item.originalId) || item : item;

                      return (
                        <tr
                          key={item.ledgerKey || item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {formatDisplayDate(item.date)}
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
                              <span className="line-clamp-2 max-w-sm break-words">{item.title}</span>
                            </div>
                            {transactionNote(item) && (
                              <div className="line-clamp-2 break-words text-[11px] text-slate-400 max-w-sm mt-0.5">
                                {transactionNote(item)}
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
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isTransfer
                                ? item.transferDirection === 'received'
                                  ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : isIncome
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              {isTransfer ? 'Transfer' : isIncome ? 'In' : 'Out'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {item.paymentMethod}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                            <span className={isTransfer ? item.transferDirection === 'received' ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                              {item.transferDirection === 'received' ? '+' : item.transferDirection === 'sent' ? '-' : isIncome ? '+' : '-'}{formatCurrency(item.amount, currencySymbol)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => setViewingExpense(item)} aria-label={`View ${item.title}`} title="View details" className="inline-flex items-center gap-1 p-1 text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(originalItem)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                title="Edit entry"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setExpenseToDelete(originalItem)}
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
              {filteredHistory.length > DESKTOP_HISTORY_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Showing {(desktopHistoryPage - 1) * DESKTOP_HISTORY_PAGE_SIZE + 1}–{Math.min(desktopHistoryPage * DESKTOP_HISTORY_PAGE_SIZE, filteredHistory.length)} of {filteredHistory.length} transactions
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setDesktopHistoryPage(page => Math.max(1, page - 1))} disabled={desktopHistoryPage === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Previous</button>
                    <span className="whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">Page {desktopHistoryPage} of {desktopHistoryPageCount}</span>
                    <button type="button" onClick={() => setDesktopHistoryPage(page => Math.min(desktopHistoryPageCount, page + 1))} disabled={desktopHistoryPage === desktopHistoryPageCount} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Next</button>
                  </div>
                </div>
              )}
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
      {viewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5" onClick={() => setViewingExpense(null)} onKeyDown={event => {
          if (event.key === 'Escape') setViewingExpense(null);
          if (event.key === 'Tab') {
            const buttons = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea');
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="transaction-details-title" onClick={event => event.stopPropagation()} className="relative flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-slate-700/70 dark:bg-slate-900 dark:ring-white/5 sm:max-h-[90dvh] sm:rounded-3xl">
            <div className={`h-1 w-full shrink-0 ${viewingInflow ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-2 sm:px-5">
              <div className="flex items-center gap-2.5">
                <h3 id="transaction-details-title" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Transaction details</h3>
              </div>
              <button type="button" autoFocus onClick={() => setViewingExpense(null)} aria-label="Close transaction details" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-3 [overflow-wrap:anywhere] sm:px-5">
              <div className={`mb-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border p-3 ${viewingInflow ? 'border-emerald-100 bg-linear-to-b from-emerald-50/80 to-white dark:border-emerald-500/10 dark:from-emerald-500/10 dark:to-slate-900' : 'border-rose-100 bg-linear-to-b from-rose-50/80 to-white dark:border-rose-500/10 dark:from-rose-500/10 dark:to-slate-900'}`}>
                <div className={`row-span-2 flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm ${viewingInflow ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                  {viewingExpense.category === 'Balance Adjustment' ? <RotateCcw className="h-4 w-4" /> : viewingExpense.isTransfer ? <ArrowUpRight className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                </div>
                <h4 className="min-w-0 break-words text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-sm">{viewingExpense.title}</h4>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className={`min-w-0 break-words text-[clamp(1.25rem,5vw,1.75rem)] font-bold leading-tight tracking-tight tabular-nums ${viewingInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{viewingInflow ? '+' : '-'}{formatCurrency(viewingExpense.amount, currencySymbol)}</p>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${viewingInflow ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'}`}>
                    {viewingInflow ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {viewingExpense.isTransfer ? `Transfer ${viewingInflow ? 'in' : 'out'}` : viewingInflow ? 'Inflow' : 'Outflow'}
                  </span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-1 pb-4 pt-1">
                {([
                  ['Date', formatDisplayDate(viewingExpense.date), Calendar],
                  ['Account', `${accountDisplayName(viewingExpense.account || 'expense')} account`, Wallet],
                  ['Category', viewingExpense.category, Tag],
                  ['Payment', viewingExpense.paymentMethod, CreditCard],
                ] as const).map(([label, value, Icon]) => <div key={label} className="min-w-0"><dt className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><Icon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />{label}</dt><dd className="mt-1 min-w-0 break-words text-xs font-semibold leading-snug text-slate-800 dark:text-slate-200">{value}</dd></div>)}
              </dl>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"><Info className="h-3.5 w-3.5 text-slate-400" />Description</h4>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-500 dark:text-slate-400">{viewingNote || 'No description added.'}</p>
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20 sm:px-5">
              <div className="grid grid-cols-3 gap-2">
                <button type="button" disabled={detailCopyStatus === 'copying'} onClick={async () => {
                  setDetailCopyStatus('copying');
                  try {
                    setDetailCopyStatus(await copyText(viewingCopyText) ? 'copied' : 'error');
                  } catch { setDetailCopyStatus('error'); }
                }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">
                  {detailCopyStatus === 'copied' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{detailCopyStatus === 'copied' ? 'Copied' : detailCopyStatus === 'copying' ? 'Copying' : 'Copy'}
                </button>
                <button type="button" onClick={() => {
                  const original = viewingExpense.originalId ? expenses.find(expense => expense.id === viewingExpense.originalId) : viewingExpense;
                  if (original) { setViewingExpense(null); handleOpenEdit(original); }
                }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"><Edit2 className="h-3.5 w-3.5" />Edit</button>
                <button type="button" onClick={() => setViewingExpense(null)} className="min-h-11 rounded-xl bg-slate-900 px-2 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">Done</button>
              </div>
              {detailCopyStatus === 'copied' && <p role="status" className="mt-2 text-center text-[11px] text-emerald-600 dark:text-emerald-400">Transaction details copied.</p>}
              {detailCopyStatus === 'error' && <div className="mt-3">
                <p role="alert" className="mb-2 text-xs text-slate-500 dark:text-slate-400">Automatic copy is blocked. Copy the selected text below.</p>
                <textarea aria-label="Transaction details to copy" readOnly autoFocus onFocus={event => event.currentTarget.select()} value={viewingCopyText} rows={3} className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" />
              </div>}
            </div>
          </div>
        </div>
      )}

      {loanEditBlocked && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="loan-edit-blocked-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"><h3 id="loan-edit-blocked-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Edit loan transaction</h3><p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">Loan transactions cannot be edited separately from their loan record. Go to Payables &amp; Receivables, find the loan record, and edit it or use Payment history to edit a repayment.</p><div className="mt-5 flex justify-end"><button type="button" autoFocus onClick={() => setLoanEditBlocked(false)} className="min-h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Close</button></div></div></div>}
      {(isAddModalOpen || editingExpense) && (
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
                  {editingExpense ? 'Edit ' : ''}{isSelfTransfer ? 'Self Transfer' : formAccount === 'savings' ? 'Savings Account Transaction' : formAccount === 'cash' ? 'Cash in Hand Transaction' : 'Expense Account Transaction'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseAdd}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Form Body */}
            <form
              noValidate
              onSubmit={event => {
                if (editingExpense) {
                  void handleSubmitEdit(event);
                } else {
                  event.preventDefault();
                  void handleSubmitAdd();
                }
              }}
              className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto pr-1"
            >
              {/* 1. Account Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                  <span>{isSelfTransfer ? 'From Account' : 'Target Account'}</span>
                  <span className="text-[10px] text-slate-400 font-mono">Select account</span>
                </label>
                <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl [&>button]:flex-1">
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
                  {accountVisibility.cash && <button
                    type="button"
                    onClick={() => handleFormAccountChange('cash')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formAccount === 'cash'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    💵 Cash
                  </button>}
                  {accountVisibility.savings && <button
                    type="button"
                    onClick={() => handleFormAccountChange('savings')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formAccount === 'savings'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    🏦 Savings
                  </button>}
                  {(accountVisibility.cash || accountVisibility.savings) && <button type="button" onClick={() => { const next = !isSelfTransfer; setIsSelfTransfer(next); setFormTransactionType(next ? 'transfer' : (formAccount === 'savings' ? 'income' : 'expense')); setFormCategoryError(''); setTransactionSaveError(null); setTransactionUpdateError(null); }} className={`py-1.5 px-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${isSelfTransfer ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}>
                    ↔ Transfer
                  </button>}
                </div>
                {isSelfTransfer && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200">To Account</label>
                    <select value={transferToAccount} onChange={event => setTransferToAccount(event.target.value as 'expense' | 'savings' | 'cash')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {(['expense', 'cash', 'savings'] as const).filter(account => account !== formAccount && (account === 'expense' || accountVisibility[account])).map(account => <option key={account} value={account}>{account === 'expense' ? '💳 Expense' : account === 'cash' ? '💵 Cash' : '🏦 Savings'}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* 2. Transaction Type Switcher + Date Picker */}
              <div className={`${isSelfTransfer ? 'hidden ' : ''}grid grid-cols-1 sm:grid-cols-3 gap-2`}>
                <div className="sm:col-span-2 grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {formAccount === 'savings' ? (
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
                        Outflow
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
                        Income Inflow
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
                    inputMode="decimal"
                    step="1"
                    min={Number.isFinite(Number(formAmount)) && Number(formAmount) > 0
                      ? ((Math.round(Number(formAmount) * 100) % 100) / 100).toFixed(2)
                      : '0'}
                    required
                    autoFocus
                    value={formAmount}
                    onChange={event => {
                      const input = event.target;
                      const nativeEvent = event.nativeEvent as InputEvent;
                      setFormAmount(!nativeEvent.inputType && input.value !== '' && Number.isFinite(input.valueAsNumber)
                        ? input.valueAsNumber.toFixed(2)
                        : input.value);
                    }}
                    onBlur={event => {
                      if (Number.isFinite(event.target.valueAsNumber)) setFormAmount(event.target.valueAsNumber.toFixed(2));
                    }}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-1.5 text-xl font-mono font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Preset Fast Increments */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 mt-1.5">
                  {PRESET_AMOUNTS.map(amt => (
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
                    <span>Transfer to {isSelfTransfer ? transferToAccount === 'expense' ? 'Expense Account' : transferToAccount === 'cash' ? 'Cash' : 'Savings' : 'Expense Account'}</span>
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
              {(editingExpense ? transactionUpdateError : transactionSaveError) && (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {editingExpense ? transactionUpdateError : transactionSaveError}
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCloseAdd}
                  disabled={isSavingTransaction || isUpdatingTransaction}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type={editingExpense ? 'submit' : 'button'}
                  onClick={editingExpense ? undefined : handleSubmitAdd}
                  disabled={isSavingTransaction || isUpdatingTransaction ||
                    isNaN(parseFloat(formAmount)) ||
                    parseFloat(formAmount) <= 0 ||
                    (formTransactionType !== 'transfer' && (!formCategory || !formCategory.trim()))
                  }
                  className={`px-5 py-2 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${
                    formTransactionType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : formTransactionType === 'transfer' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  }`}
                >
                  {editingExpense
                    ? isUpdatingTransaction ? 'Updating...' : `Update Transaction (${currencySymbol}${parseFloat(formAmount) > 0 ? parseFloat(formAmount).toFixed(2) : '0.00'})`
                    : isSavingTransaction ? 'Saving...' : `Save Transaction (${currencySymbol}${parseFloat(formAmount) > 0 ? parseFloat(formAmount).toFixed(2) : '0.00'})`}
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
    </>
  );
};
