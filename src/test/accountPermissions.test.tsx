import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HistoryReportsView } from '../components/HistoryReportsView';
import { isAccountTransactionVisible } from '../utils/accounts';
import { Expense } from '../types';

afterEach(cleanup);

const transaction = (changes: Partial<Expense>): Expense => ({
  id: 'one', title: 'Test', amount: 100, category: 'Other', date: '2026-11-19',
  paymentMethod: 'Cash', createdAt: 1, ...changes,
});

describe('account settings', () => {
  it('hides disabled accounts and transfers involving them', () => {
    const visibility = { cash: false, savings: true };
    expect(isAccountTransactionVisible(transaction({ account: 'expense' }), visibility)).toBe(true);
    expect(isAccountTransactionVisible(transaction({ account: 'cash' }), visibility)).toBe(false);
    expect(isAccountTransactionVisible(transaction({ account: 'savings', isTransfer: true, transferToAccount: 'cash' }), visibility)).toBe(false);
  });

  it('only offers switches when account selection is permitted', () => {
    const save = vi.fn().mockResolvedValue(true);
    const props = { expenses: [], habits: [], tasks: [], wellness: {}, budget: { monthlyBudget: 100, dailyBudget: 10, weeklyBudget: 25, currency: 'INR', categoryBudgets: {} }, onExportJSON: vi.fn(), onImportJSON: vi.fn(), onResetData: vi.fn(), isCloudSyncing: false, onSaveOpeningBalance: vi.fn(), accountVisibility: { cash: false, savings: true }, onSaveAccountVisibility: save };
    const view = render(<HistoryReportsView {...props} canSelectAccounts={false} />);
    expect(screen.queryByRole('switch', { name: 'Cash in Hand' })).toBeNull();
    expect(screen.queryByLabelText('Cash in Hand opening balance')).toBeNull();
    view.rerender(<HistoryReportsView {...props} canSelectAccounts />);
    fireEvent.click(screen.getByRole('switch', { name: 'Cash in Hand' }));
    expect(save).toHaveBeenCalledWith({ cash: true, savings: true });
  });
});
