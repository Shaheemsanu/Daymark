import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { OpeningBalances } from '../components/OpeningBalances';
import { getOpeningBalance, hasAccountTransactions } from '../utils/accounts';
import { Expense } from '../types';

afterEach(cleanup);
const transaction = (changes: Partial<Expense> = {}): Expense => ({
  id: 'one', title: 'Test', amount: 100, category: 'Other', date: '2026-11-15',
  paymentMethod: 'Cash', createdAt: 1, ...changes,
});

describe('Opening balances', () => {
  it('enables the setup button only for a valid positive amount', () => {
    const onSave = vi.fn();
    render(<OpeningBalances expenses={[]} currency="INR" disabled={false} onSave={onSave} />);
    const input = screen.getByLabelText('Cash in Hand opening balance');
    const button = input.closest('form')!.querySelector('button')!;
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '0' } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '100' } });
    expect(button.disabled).toBe(false);
    fireEvent.change(input, { target: { value: '' } });
    expect(button.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  const openingBalance = transaction({ id: 'opening', title: 'Opening balance', category: 'Opening Balance', account: 'expense', type: 'income', amount: 500 });

  it('recognizes an opening balance separately from ordinary transactions', () => {
    expect(getOpeningBalance([openingBalance], 'expense')).toBe(openingBalance);
    expect(getOpeningBalance([openingBalance], 'cash')).toBeUndefined();
    expect(getOpeningBalance([transaction({ type: 'income' })], 'expense')).toBeUndefined();
    expect(getOpeningBalance([{ ...openingBalance, isTransfer: true }], 'expense')).toBeUndefined();
  });

  it('requires OK on the warning before allowing an existing balance to be edited', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const view = render(<OpeningBalances expenses={[openingBalance, transaction()]} currency="INR" disabled={false} onSave={onSave} />);
    const input = screen.getByLabelText('Expense Account opening balance') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.valueAsNumber).toBe(400);
    fireEvent.submit(input.closest('form')!);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit balance' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('Balance adjustment');
    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(input.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Edit balance' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(input.disabled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '750.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save balance' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('expense', 750.5));
    await waitFor(() => expect(input.disabled).toBe(true));
    view.rerender(<OpeningBalances expenses={[openingBalance, transaction(), transaction({ id: 'adjustment', title: 'Balance adjustment', category: 'Balance Adjustment', type: 'income', amount: 350.5 })]} currency="INR" disabled={false} onSave={onSave} />);
    expect(input.valueAsNumber).toBe(750.5);
    expect(screen.getByRole('button', { name: 'Edit balance' })).toBeTruthy();
  });

  it('cancels edits without saving and requires confirmation again', () => {
    const onSave = vi.fn();
    render(<OpeningBalances expenses={[openingBalance]} currency="INR" disabled={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit balance' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    const input = screen.getByLabelText('Expense Account opening balance') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(input.valueAsNumber).toBe(500);
    expect(input.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit balance' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('keeps editing enabled with the entered amount when an update fails', async () => {
    render(<OpeningBalances expenses={[openingBalance]} currency="INR" disabled={false} onSave={vi.fn().mockResolvedValue('Connection failed')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit balance' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    const input = screen.getByLabelText('Expense Account opening balance') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save balance' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Connection failed');
    expect(input.valueAsNumber).toBe(800);
    expect(input.disabled).toBe(false);
  });

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

  it('saves the selected account and amount and locks entry for populated accounts', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<OpeningBalances expenses={[transaction({ account: 'savings' })]} currency="INR" disabled={false} onSave={onSave} />);
    expect((screen.getByLabelText('Savings Account opening balance') as HTMLInputElement).disabled).toBe(true);
    const input = screen.getByLabelText('Cash in Hand opening balance');
    fireEvent.change(input, { target: { value: '250.50' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('cash', 250.5));
    expect((await screen.findByRole('status')).textContent).toBe('Opening balance saved.');
  });

  it.each(['expense', 'cash', 'savings'] as const)('allows correcting the starting balance for an active %s account after confirmation', async account => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<OpeningBalances expenses={[transaction({ account })]} currency="INR" disabled={false} onSave={onSave} />);
    const input = screen.getAllByRole('spinbutton').find(element => (element as HTMLInputElement).disabled) as HTMLInputElement;
    expect(input.valueAsNumber).toBe(-100);
    fireEvent.submit(input.closest('form')!);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit balance' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('Balance adjustment');
    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save balance' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(account, 250));
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
