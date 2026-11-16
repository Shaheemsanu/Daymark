import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { ExpenseDashboard } from '../components/ExpenseDashboard';
import { BudgetConfig, Expense } from '../types';

vi.mock('../components/ExpenseCharts', () => ({
  CategoryDonutChart: () => null,
  DailySpendingTrendChart: () => null,
  FinancialHealth50_30_20: () => null,
  AccountIntelligenceReport: () => null,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const budget: BudgetConfig = {
  dailyBudget: 1000, weeklyBudget: 7000, monthlyBudget: 30000,
  currency: '₹', categoryBudgets: {},
};

const props = {
  budget,
  onAddExpense: vi.fn(), onUpdateExpense: vi.fn(), onDeleteExpense: vi.fn(),
  onUpdateBudget: vi.fn(), onExportCSV: vi.fn(),
  customCategories: {}, onSaveCustomCategories: vi.fn(),
};

describe('Cumulative expense target balances', () => {
  it('copies transaction details, reports clipboard failures and opens the entry for editing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.create(window.navigator, { clipboard: { value: { writeText } } }));
    const expense: Expense = { id: 'entry', title: 'Lunch receipt', category: 'Food & Dining', date: '2026-11-16', amount: 120, type: 'expense', account: 'expense', paymentMethod: 'Cash', notes: 'Lunch with colleagues.', createdAt: 1 };
    render(<ExpenseDashboard {...props} expenses={[expense]} initialDate="2026-11-16" />);
    const open = () => fireEvent.click(screen.getAllByRole('button', { name: 'View Lunch receipt' })[0]);
    open();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toBe('Transaction details copied.'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('-₹ 120.00'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Lunch with colleagues.'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    open();
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain('Automatic copy is blocked'));
    expect((screen.getByRole('textbox', { name: 'Transaction details to copy' }) as HTMLTextAreaElement).value).toContain('Lunch with colleagues.');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('dialog', { name: 'Transaction details' })).toBeNull();
    expect(screen.getByDisplayValue('Lunch receipt')).toBeTruthy();
    expect(screen.getByDisplayValue('120')).toBeTruthy();
  });

  it('shows two-line note previews and opens full transaction details on mobile and desktop', () => {
    const notes = 'Balance adjusted to match the entered amount. -220.00 + 320.00 = 100.00.';
    const expense: Expense = { id: 'adjustment', title: 'Balance adjustment', category: 'Balance Adjustment', date: '2026-11-16', amount: 320, type: 'income', account: 'expense', paymentMethod: 'Bank Transfer', notes, createdAt: 1 };
    render(<ExpenseDashboard {...props} expenses={[expense]} initialDate="2026-11-16" />);
    for (const preview of screen.getAllByText(notes)) {
      expect(preview.classList.contains('line-clamp-2')).toBe(true);
    }
    const viewButtons = screen.getAllByRole('button', { name: 'View Balance adjustment' });
    expect(viewButtons).toHaveLength(2);
    for (const button of viewButtons) {
      fireEvent.click(button);
      const details = within(screen.getByRole('dialog', { name: 'Transaction details' }));
      expect(details.getByText(notes).classList.contains('line-clamp-2')).toBe(false);
      expect(details.getByText('+₹ 320.00')).toBeTruthy();
      expect(details.getByText('16-11-2026')).toBeTruthy();
      expect(details.getByText('Bank Transfer')).toBeTruthy();
      fireEvent.click(details.getByRole('button', { name: 'Close transaction details' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    }
    fireEvent.click(viewButtons[0]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('updates spending, balances and history when the top date changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00'));
    const transaction = (id: string, date: string, amount: number, type: 'income' | 'expense' = 'expense'): Expense => ({
      id, title: id, date, amount, type, account: 'expense', category: 'Other', paymentMethod: 'Cash', createdAt: 1,
    });
    const expenses = [
      transaction('Opening income', '2025-12-01', 5000, 'income'),
      transaction('December expense', '2025-12-31', 100),
      transaction('January expense', '2026-01-01', 200),
      transaction('November expense', '2026-11-16', 300),
      transaction('Future expense', '2026-11-17', 900),
    ];
    const view = render(<ExpenseDashboard {...props} expenses={expenses} initialDate="2026-11-16" />);
    const spend = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
    const balance = () => screen.getByText('Available Balance').nextElementSibling?.textContent?.trim();
    expect(spend('Daily Spend')).toBe('₹ 300.00');
    expect(balance()).toBe('₹ 4,400.00');

    view.rerender(<ExpenseDashboard {...props} expenses={expenses} initialDate="2026-01-01" />);
    expect(spend('Daily Spend')).toBe('₹ 200.00');
    expect(spend('Weekly Spend')).toBe('₹ 300.00');
    expect(spend('Monthly Spend')).toBe('₹ 200.00');
    expect(balance()).toBe('₹ 4,700.00');
    expect(screen.getByText('7-day balance').parentElement?.textContent).toContain('₹ 1,700.00 Saved');
    expect(screen.queryAllByText('November expense')).toHaveLength(0);
    expect(screen.getAllByText('January expense').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Daily Spend'));
    expect(screen.getAllByText('January expense').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('December expense')).toHaveLength(0);

    view.rerender(<ExpenseDashboard {...props} expenses={expenses} initialDate="2025-12-31" />);
    expect(spend('Daily Spend')).toBe('₹ 100.00');
    expect(spend('Weekly Spend')).toBe('₹ 100.00');
    expect(spend('Monthly Spend')).toBe('₹ 100.00');
    expect(balance()).toBe('₹ 4,900.00');

    view.rerender(<ExpenseDashboard {...props} expenses={expenses} initialDate="2025-11-01" />);
    expect(spend('Daily Spend')).toBe('₹ 0.00');
    expect(spend('Weekly Spend')).toBe('₹ 0.00');
    expect(spend('Monthly Spend')).toBe('₹ 0.00');
    expect(balance()).toBe('₹ 0.00');
  });

  it.each([
    { label: '7-day balance', target: 1000, dates: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'] },
    { label: '4-week balance', target: 7000, dates: ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'] },
    { label: '12-month balance', target: 30000, dates: ['2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'] },
  ])('offsets overspending with savings in the $label', ({ label, target, dates }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00'));
    const expenses: Expense[] = dates.map((date, index) => ({
      id: String(index), title: 'Daily expenses', amount: target,
      category: 'Other', date, paymentMethod: 'Cash', createdAt: 1,
      account: 'expense', type: 'expense',
    }));
    // These entries must not affect spending against the target.
    const excluded: Expense[] = [
      { ...expenses[0], id: 'income', amount: 999, type: 'income' },
      { ...expenses[0], id: 'transfer', amount: 999, isTransfer: true },
      { ...expenses[0], id: 'cash', amount: 999, account: 'cash' },
      { ...expenses[0], id: 'savings', amount: 999, account: 'savings' },
    ];
    expenses[0].amount += 100;
    const view = render(<ExpenseDashboard {...props} expenses={[...expenses, ...excluded]} />);
    const expectBalance = (text: string) => {
      expect(screen.getByText(label).parentElement?.querySelector('strong')?.textContent).toBe(text);
    };
    expectBalance('₹ 100.00 Over target');

    expenses[1] = { ...expenses[1], amount: target - 50 };
    view.rerender(<ExpenseDashboard {...props} expenses={[...expenses, ...excluded]} />);
    expectBalance('₹ 50.00 Over target');

    expenses[2] = { ...expenses[2], amount: target - 120 };
    view.rerender(<ExpenseDashboard {...props} expenses={[...expenses, ...excluded]} />);
    expectBalance('₹ 70.00 Saved');

    expenses[2] = { ...expenses[2], amount: target - 50 };
    view.rerender(<ExpenseDashboard {...props} expenses={[...expenses, ...excluded]} />);
    expectBalance('₹ 0.00 On target');

    // Missing periods contribute zero rather than an unused target as savings.
    view.rerender(<ExpenseDashboard {...props} expenses={[expenses[0]]} />);
    expectBalance('₹ 100.00 Over target');

    view.rerender(<ExpenseDashboard {...props} expenses={[expenses[1]]} />);
    expectBalance('₹ 50.00 Saved');

    view.rerender(<ExpenseDashboard {...props} expenses={excluded} />);
    expectBalance('₹ 0.00 On target');

    view.rerender(<ExpenseDashboard {...props} expenses={[]} />);
    expectBalance('₹ 0.00 On target');
  });
});
