import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { OpeningBalances } from '../components/OpeningBalances';
import { hasAccountTransactions } from '../utils/accounts';
import { Expense } from '../types';

afterEach(cleanup);
const transaction = (changes: Partial<Expense> = {}): Expense => ({
  id: 'one', title: 'Test', amount: 100, category: 'Other', date: '2026-11-15',
  paymentMethod: 'Cash', createdAt: 1, ...changes,
});

describe('Opening balances', () => {
  it('preserves cents when stepping up and down', () => {
    render(<OpeningBalances expenses={[]} currency="INR" disabled={false} onSave={vi.fn()} />);
    const input = screen.getByLabelText('Cash in Hand opening balance') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.12' } });
    input.stepUp();
    expect(input.valueAsNumber).toBe(2.12);
    fireEvent.change(input);
    input.stepDown();
    expect(input.valueAsNumber).toBe(1.12);
  });

  it('formats whole-unit spinner changes with two decimal places', () => {
    render(<OpeningBalances expenses={[]} currency="INR" disabled={false} onSave={vi.fn()} />);
    const input = screen.getByLabelText('Cash in Hand opening balance') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1.00');
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2.00');
  });

  it('blocks accounts with transactions even when their net balance is zero', () => {
    const expenses = [transaction({ account: 'cash', type: 'income' }), transaction({ account: 'cash' })];
    expect(hasAccountTransactions(expenses, 'cash')).toBe(true);
    expect(hasAccountTransactions(expenses, 'savings')).toBe(false);
    expect(hasAccountTransactions([transaction()], 'expense')).toBe(true);
  });

  it('blocks both ends of transfers, including older transfer records', () => {
    const expenses = [transaction({ account: 'savings', isTransfer: true, transferToAccount: 'cash' })];
    expect(hasAccountTransactions(expenses, 'cash')).toBe(true);
    expect(hasAccountTransactions(expenses, 'savings')).toBe(true);
    expect(hasAccountTransactions(expenses, 'expense')).toBe(false);
    expect(hasAccountTransactions([transaction({ account: 'savings', category: 'Transfer to Expense' })], 'expense')).toBe(true);
  });

  it('saves the selected account and amount and hides entry for populated accounts', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<OpeningBalances expenses={[transaction({ account: 'savings' })]} currency="INR" disabled={false} onSave={onSave} />);
    expect(screen.queryByLabelText('Savings Account opening balance')).toBeNull();
    const input = screen.getByLabelText('Cash in Hand opening balance');
    fireEvent.change(input, { target: { value: '250.50' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('cash', 250.5));
    expect((await screen.findByRole('status')).textContent).toBe('Opening balance saved.');
  });

  it('retains the amount when saving fails so the user can retry', async () => {
    render(<OpeningBalances expenses={[]} currency="INR" disabled={false} onSave={vi.fn().mockResolvedValue('Connection failed')} />);
    const input = screen.getByLabelText('Expense Account opening balance');
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.submit(input.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toBe('Connection failed');
    expect((input as HTMLInputElement).valueAsNumber).toBe(500);
  });
});
