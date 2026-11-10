

import React, { useState } from 'react';
import { IndianRupee, CheckCircle2, ListTodo, TrendingDown, TrendingUp, Grid } from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod, Task, TaskPriority } from '../lib/types';
import { getAllCategories } from '../utils/constants';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onAddTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  habits: Array<{ id: string; title: string; color: string; completedDates: string[] }>;
  onToggleHabit: (habitId: string) => void;
  selectedDate: string;
  currencySymbol: string;
  initialTab?: 'expense' | 'task' | 'habit';
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI / QR',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Net Banking',
  'Digital Wallet'
];

const INCOME_CATEGORIES = [
  'Salary / Wages',
  'Freelance & Business',
  'Investments & Returns',
  'Gifts & Allowance',
  'Other Inflow'
];

const REFUND_CATEGORIES = [
  'Refunds & Cashback',
  'Small Income',
  'Gifts & Allowance',
  'Other Inflow'
];

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  onAddTask,
  habits,
  onToggleHabit,
  selectedDate,
  currencySymbol,
  initialTab = 'expense'
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'task' | 'habit'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Expense / Income / Account form
  const [expAccount, setExpAccount] = useState<'expense' | 'savings' | 'cash'>('expense');
  const [expType, setExpType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>(''); // Unselected category first
  const [expPayment, setExpPayment] = useState<PaymentMethod>('UPI / QR');
  const [expDate, setExpDate] = useState<string>(selectedDate);
  const [expNote, setExpNote] = useState<string>('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setExpDate(selectedDate);
      setExpCategory(''); // Start with unselected category on open
      setShowAllCategories(false);
    }
  }, [isOpen, selectedDate]);

  // Handle Account change
  const handleAccountChange = (acc: 'expense' | 'savings' | 'cash') => {
    setExpAccount(acc);
    if (acc === 'savings') {
      setExpType('income');
      setExpCategory('');
    } else {
      setExpType('expense');
      setExpCategory('');
    }
  };

  // Switch default category when type changes
  const handleTypeChange = (type: 'expense' | 'income' | 'transfer') => {
    setExpType(type);
    if (type === 'transfer') {
      setExpCategory('Transfer to Expense Account');
    } else {
      setExpCategory('');
    }
  };

  // Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDuration, setTaskDuration] = useState('30');
  const [taskCategory, setTaskCategory] = useState('General');

  if (!isOpen) return null;

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const isTransfer = expType === 'transfer';
    const finalCategory = isTransfer ? 'Transfer to Expense Account' : expCategory;
    const finalType = isTransfer ? 'expense' : (expType as 'expense' | 'income');
    const defaultLabel = isTransfer
      ? 'Transfer to Expense Account'
      : (expType === 'income' ? 'Income' : 'Expense');
    const resolvedTitle = expNote.trim() || finalCategory || defaultLabel;

    onAddExpense({
      user_id: '',
      title: resolvedTitle,
      amount: amountNum,
      category: finalCategory,
      entry_date: expDate || selectedDate,
      type: finalType,
      account: expAccount,
      is_transfer: isTransfer,
      payment_method: expPayment || 'UPI / QR',
      notes: expNote.trim() || undefined
    });

    setExpNote('');
    setExpAmount('');
    onClose();
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    onAddTask({
      title: taskTitle.trim(),
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      priority: taskPriority,
      time_estimate_min: parseInt(taskDuration) || 30,
      category: taskCategory.trim() || 'General'
    });

    setTaskTitle('');
    onClose();
  };

  const allSystemCategories = Object.keys(getAllCategories());

  const getPrimaryCategories = () => {
    if (expAccount === 'savings') {
      return expType === 'transfer' ? ['Transfer to Expense Account'] : INCOME_CATEGORIES;
    }
    return expType === 'income' ? REFUND_CATEGORIES : allSystemCategories.slice(0, 8);
  };

  const displayedCategories = (showAllCategories || expAccount === 'expense' && expType === 'expense')
    ? allSystemCategories
    : Array.from(new Set([...getPrimaryCategories(), ...allSystemCategories]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Segmented Switcher */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('expense')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'expense'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Log Finance</span>
            </button>
            <button
              onClick={() => setActiveTab('task')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'task'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
            <button
              onClick={() => setActiveTab('habit')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'habit'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Habit Status</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab 1: Quick Expense / Income */}
        {activeTab === 'expense' && (
          <form onSubmit={handleExpenseSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto max-h-[75vh]">
            {/* 1. Account Selector (Expense vs Savings Account) */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                <span>Account</span>
                <span className="text-[10px] text-slate-400 font-mono">Select target account</span>
              </label>
               <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleAccountChange('expense')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    expAccount === 'expense'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span>💳 Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAccountChange('cash')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    expAccount === 'cash'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span>💵 Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAccountChange('savings')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    expAccount === 'savings'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span>🏦 Savings</span>
                </button>
              </div>
            </div>

            {/* 2. Transaction Type Switcher + Date Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {expAccount === 'savings' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('income')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        expType === 'income'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Income Inflow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('transfer')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        expType === 'transfer'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Transfer Cash</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('expense')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        expType === 'expense'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Expense (Out)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('income')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        expType === 'income'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Inflow / Refund</span>
                    </button>
                  </>
                )}
              </div>

              <div>
                <input
                  type="date"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
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
              <div className="flex items-center gap-1.5 flex-wrap">
                {PAYMENT_METHODS.map(pm => {
                  const isSelected = expPayment === pm;
                  return (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setExpPayment(pm)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 dark:bg-slate-100 dark:text-slate-950 text-white font-semibold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {pm}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Amount & Mandatory Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-base font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* 5. Seamless Category Pill Grid (No dropdowns) */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <span>Category</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  {expType !== 'transfer' && (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(!showAllCategories)}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Grid className="w-3 h-3" />
                      <span>{showAllCategories ? 'Show Main' : `Show All (${allSystemCategories.length})`}</span>
                    </button>
                  )}
                </div>

                {expType === 'transfer' ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Transfer to Expense Account</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 max-h-48 overflow-y-auto">
                    {displayedCategories.map(cat => {
                      const isSelected = expCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setExpCategory(cat)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm font-semibold scale-105'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: isSelected ? '#ffffff' : '#10B981' }}
                          />
                          <span className="truncate max-w-[140px]">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Single Note / Description Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Note / Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={expNote}
                onChange={e => setExpNote(e.target.value)}
                placeholder={
                  expAccount === 'savings'
                    ? (expType === 'transfer' ? 'e.g. Monthly transfer to Expense account' : 'e.g. Salary / Wages deposit')
                    : 'e.g. Chai, Groceries, Lunch'
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isNaN(parseFloat(expAmount)) ||
                  parseFloat(expAmount) <= 0 ||
                  (expType !== 'transfer' && (!expCategory || !expCategory.trim()))
                }
                className={`w-full sm:w-auto px-5 py-2 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all cursor-pointer ${
                  expType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : expType === 'transfer' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Save Transaction ({currencySymbol}
                {parseFloat(expAmount) > 0 ? parseFloat(expAmount).toFixed(2) : '0.00'})
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Quick Task */}
        {activeTab === 'task' && (
          <form onSubmit={handleTaskSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="What recurring or daily item needs doing?"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Duration (mins)
                </label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={taskDuration}
                  onChange={e => setTaskDuration(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category Tag
                </label>
                <input
                  type="text"
                  value={taskCategory}
                  onChange={e => setTaskCategory(e.target.value)}
                  placeholder="e.g. Work, Personal..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white"
              >
                Save Task
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Habit Status */}
        {activeTab === 'habit' && (
          <div className="p-5 space-y-3 overflow-y-auto max-h-[75vh]">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Toggle habit completion for {selectedDate}:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {habits.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No habits configured.</p>
              ) : (
                habits.map(habit => {
                  const isChecked = habit.completedDates.includes(selectedDate);
                  return (
                    <button
                      key={habit.id}
                      onClick={() => onToggleHabit(habit.id)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors text-left ${
                        isChecked
                          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: habit.color }}
                        />
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {habit.title}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {isChecked ? 'Completed ✓' : 'Tap to mark done'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

