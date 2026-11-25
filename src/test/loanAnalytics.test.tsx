import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import LoanAnalytics from '../components/LoanAnalytics';
import type { Receivable } from '../features/expenses/receivablesService';

afterEach(cleanup);
const base: Receivable = { id: '1', person: 'Asha', amount: 1000, repaid: 400, lent_date: '2026-11-01', due_date: '2026-11-20', end_date: null, payment_day: null, note: null, record_kind: 'lent', installment_amount: null };

describe('loan analytics', () => {
  it('shows filtered repayment totals, outstanding balances and past-due records', () => {
    render(<LoanAnalytics items={[base, { ...base, id: '2', person: 'Sam', amount: 500, repaid: 500, due_date: null }, { ...base, id: '3', person: 'Bank', record_kind: 'borrowed' }]} kind="lent" currency="INR" today="2026-11-24" />);
    const analytics = screen.getByRole('region', { name: 'Money lent analytics' });
    expect(within(analytics).getByRole('img', { name: /Received back: INR 900.00. To receive: INR 600.00/ })).toBeInTheDocument();
    expect(within(analytics).getByText('Active records with a due date').parentElement).toHaveTextContent('1');
    expect(within(analytics).getByText('Remaining').parentElement).toHaveTextContent('40%');
    expect(within(analytics).getByText('1 past due')).toBeInTheDocument();
    expect(within(analytics).getByText('Asha')).toBeInTheDocument();
    expect(within(analytics).getByRole('img', { name: 'Asha: Received back INR 400.00, To receive INR 600.00.' })).toBeInTheDocument();
    const bar = within(analytics).getByRole('img', { name: 'Asha: Received back INR 400.00, To receive INR 600.00.' });
    expect(bar.children[0]).toHaveStyle({ width: '40%' });
    expect(bar.children[1]).toHaveStyle({ width: '60%' });
    expect(within(analytics).getByRole('img', { name: 'Sam: Received back INR 500.00, To receive INR 0.00.' })).toBeInTheDocument();
    expect(within(analytics).queryByText('Bank')).toBeNull();
  });
  it('shows EMI dates as scheduled rather than overdue or paid', () => {
    render(<LoanAnalytics items={[{ ...base, record_kind: 'emi', due_date: null, payment_day: 30 }]} kind="emi" currency="INR" today="2026-11-24" />);
    expect(screen.getByText('Next scheduled dates')).toBeInTheDocument();
    expect(screen.getByText('30-11-2026')).toBeInTheDocument();
    expect(screen.getByText(/do not confirm whether an installment was paid/)).toBeInTheDocument();
    expect(screen.queryByText(/past due/)).toBeNull();
  });
  it('sums scheduled installments for each month and identifies missing schedule details', () => {
    const emi: Receivable = { ...base, record_kind: 'emi', due_date: null, payment_day: 15, installment_amount: 200 };
    render(<LoanAnalytics items={[emi, { ...emi, id: '2', installment_amount: 300 }, { ...emi, id: '3', installment_amount: null }, { ...emi, id: '4', repaid: 1000, installment_amount: 900 }]} kind="emi" currency="INR" today="2026-11-24" />);
    expect(screen.getByText('This month').parentElement).toHaveTextContent('INR 500.00');
    expect(screen.getByText('Next month').parentElement).toHaveTextContent('INR 500.00');
    expect(screen.getByText(/1 active loan is missing an installment amount or payment day/)).toBeInTheDocument();
  });
  it('respects start and end dates and caps installments at the remaining balance', () => {
    const emi: Receivable = { ...base, record_kind: 'emi', due_date: null, payment_day: 15, installment_amount: 200, end_date: '2026-11-30' };
    render(<LoanAnalytics items={[emi, { ...emi, id: '2', lent_date: '2026-12-01', end_date: null, repaid: 950 }]} kind="emi" currency="INR" today="2026-11-24" />);
    expect(screen.getByText('This month').parentElement).toHaveTextContent('INR 200.00');
    expect(screen.getByText('Next month').parentElement).toHaveTextContent('INR 50.00');
  });
  it('subtracts repayments recorded in each month, including linked payments', () => {
    const emi: Receivable = { ...base, record_kind: 'emi', due_date: null, payment_day: 15, installment_amount: 100, repaid: 75 };
    const common = { title: 'EMI payment', category: 'Loan: EMI / loan', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, createdAt: 1 };
    const expenses = [
      { ...common, id: 'payment1', amount: 50, date: '2026-11-10', notes: 'Loan record: 1' },
      { ...common, id: 'payment2', amount: 25, date: '2026-12-01' },
    ];
    render(<LoanAnalytics items={[emi]} kind="emi" currency="INR" today="2026-11-24" expenses={expenses} links={[{ loan_id: '1', expense_id: 'payment2' }]} />);
    expect(screen.getByText('This month').parentElement).toHaveTextContent('INR 50.00');
    expect(screen.getByText('Next month').parentElement).toHaveTextContent('INR 75.00');
  });
  it('compares recorded partial repayments with the EMI date in their payment month', () => {
    const emi: Receivable = { ...base, record_kind: 'emi', due_date: null, payment_day: 15, installment_amount: 100, repaid: 30 };
    const common = { title: 'Payment', category: 'Loan: EMI / loan', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, amount: 10, notes: 'Loan record: 1', createdAt: 1 };
    const expenses = [
      { ...common, id: 'early', date: '2026-11-10' },
      { ...common, id: 'on', date: '2026-11-15' },
      { ...common, id: 'late', date: '2026-11-20' },
    ];
    render(<LoanAnalytics items={[emi]} kind="emi" currency="INR" today="2026-11-24" expenses={expenses} />);
    expect(screen.getByRole('img', { name: 'Before: 1, On date: 1, After: 1, No date: 0' })).toBeInTheDocument();
    expect(screen.getByText(/Each payment is counted separately/)).toBeInTheDocument();
    expect(screen.getByText(/Unassigned payments are compared/)).toBeInTheDocument();
    expect(screen.getByText('On or before date').parentElement).toHaveTextContent('67%');
    expect(screen.getByText('Average days after').parentElement).toHaveTextContent('5 days');
    expect(screen.getByText('Payments compared').parentElement).toHaveTextContent('3 of 3');
    expect(screen.getByText('After', { selector: 'p' }).parentElement).toHaveTextContent('INR 10.00');
  });
  it('uses income transactions for lent records and identifies missing dates', () => {
    const payment = { id: 'p', title: 'Received', category: 'Loan: Money lent', paymentMethod: 'Cash', account: 'expense' as const, type: 'income' as const, amount: 10, notes: 'Loan record: 1', date: '2026-11-10', createdAt: 1 };
    render(<LoanAnalytics items={[{ ...base, due_date: null, repaid: 10 }]} kind="lent" currency="INR" today="2026-11-24" expenses={[payment]} />);
    expect(screen.getByRole('img', { name: 'Before: 0, On date: 0, After: 0, No date: 1' })).toBeInTheDocument();
    expect(screen.getByText('On or before date').parentElement).toHaveTextContent('0 of 0 comparable payments');
  });
  it('uses the assigned installment date for an early payment', () => {
    const emi: Receivable = { ...base, record_kind: 'emi', lent_date: '2026-11-25', due_date: null, payment_day: 24, installment_amount: 2, repaid: 2, amount: 20 };
    const payment = { id: 'p', title: 'Payment', category: 'Loan: EMI / loan', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, amount: 2, notes: 'Loan record: 1', date: '2026-11-25', createdAt: 1 };
    render(<LoanAnalytics items={[emi]} kind="emi" currency="INR" today="2026-11-25" expenses={[payment]} assignments={[{ loan_id: '1', expense_id: 'p', installment_date: '2026-12-24' }]} />);
    expect(screen.getByRole('img', { name: 'Before: 1, On date: 0, After: 0, No date: 0' })).toBeInTheDocument();
    expect(screen.getByText('Next month').parentElement).toHaveTextContent('INR 0.00');
  });
  it('adds partial payments assigned to each installment and compares their total', () => {
    const emi: Receivable = { ...base, record_kind: 'emi', due_date: null, payment_day: 15, installment_amount: 100, repaid: 250 };
    const common = { title: 'Payment', category: 'Loan: EMI / loan', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: 1', createdAt: 1 };
    const expenses = [
      { ...common, id: 'a', amount: 30, date: '2026-11-10' },
      { ...common, id: 'b', amount: 20, date: '2026-11-11' },
      { ...common, id: 'c', amount: 120, date: '2026-11-12' },
      { ...common, id: 'd', amount: 80, date: '2026-11-13' },
    ];
    const assignments = [
      { loan_id: '1', expense_id: 'a', installment_date: '2026-11-15' },
      { loan_id: '1', expense_id: 'b', installment_date: '2026-11-15' },
      { loan_id: '1', expense_id: 'c', installment_date: '2026-12-15' },
      { loan_id: '1', expense_id: 'd', installment_date: '2027-01-15' },
    ];
    render(<LoanAnalytics items={[emi]} kind="emi" currency="INR" today="2026-11-24" expenses={expenses} assignments={assignments} />);
    expect(screen.getByRole('img', { name: 'Below: 2, Matches: 0, Above: 1, Amount not set: 0' })).toBeInTheDocument();
    expect(screen.queryByText('INR 50.00 below')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Below/ }));
    expect(screen.getByText('INR 20.00 below')).toBeInTheDocument();
    expect(screen.getByText('INR 50.00 below')).toBeInTheDocument();
    expect(screen.getByText('Paid INR 50.00 of INR 100.00 · 2 payments')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Above/ }));
    expect(screen.getByText('INR 20.00 above')).toBeInTheDocument();
    expect(screen.queryByText('INR 50.00 below')).not.toBeInTheDocument();
  });
  it('explains the empty state', () => {
    render(<LoanAnalytics items={[]} kind="borrowed" currency="INR" today="2026-11-24" />);
    expect(screen.getByText(/Add a record to see repayment progress/)).toBeInTheDocument();
  });
});
