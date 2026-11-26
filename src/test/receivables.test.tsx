import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Receivables from '../components/Receivables';
import { ExpenseDashboard } from '../components/ExpenseDashboard';
import { receivablesService } from '../features/expenses/receivablesService';

vi.mock('../features/expenses/receivablesService', () => ({ receivablesService: { list: vi.fn(), listMovementLinks: vi.fn(), listInstallmentAssignments: vi.fn(), assignInstallment: vi.fn(), create: vi.fn(), repay: vi.fn(), update: vi.fn(), editPayment: vi.fn(), deletePayment: vi.fn(), delete: vi.fn() } }));
const loan = { id: '1', person: 'Asha', amount: 500, repaid: 100, lent_date: '2026-11-01', due_date: null, end_date: null, payment_day: null, note: null, record_kind: 'lent' as const, installment_amount: null };
beforeEach(() => { vi.mocked(receivablesService.list).mockResolvedValue([loan]); vi.mocked(receivablesService.listMovementLinks).mockResolvedValue([]); vi.mocked(receivablesService.listInstallmentAssignments).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('money to receive', () => {
  it('prefills the remaining amount for the selected installment', async () => {
    const emi = { ...loan, person: 'Bank', amount: 1000, repaid: 50, lent_date: '2026-11-01', record_kind: 'emi' as const, payment_cycle: 'weekly' as const, first_payment_date: '2026-11-03', installment_amount: 100 };
    const payment = { title: 'Payment', category: 'Loan: EMI / loan', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: 1', createdAt: 1 };
    const expenses = [{ ...payment, id: 'a', amount: 30, date: '2026-11-23' }, { ...payment, id: 'b', amount: 20, date: '2026-11-17' }];
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    vi.mocked(receivablesService.listInstallmentAssignments).mockResolvedValue([{ loan_id: '1', expense_id: 'a', installment_date: '2026-11-24' }, { loan_id: '1', expense_id: 'b', installment_date: '2026-11-17' }]);
    render(<Receivables currency="INR" today="2026-11-24" expenses={expenses} />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    await screen.findByText('Bank');
    fireEvent.click(screen.getByRole('button', { name: 'Mark payment' }));
    const amount = screen.getByLabelText('Amount paid to Bank');
    expect(amount).toHaveValue(70);
    fireEvent.click(screen.getByRole('button', { name: 'Installment date for payment' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Choose scheduled installment' })).getByRole('button', { name: '17-11-2026' }));
    expect(amount).toHaveValue(80);
    fireEvent.change(amount, { target: { value: '40' } });
    expect(amount).toHaveValue(40);
    fireEvent.click(screen.getByRole('button', { name: 'Installment date for payment' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Choose scheduled installment' })).getByRole('button', { name: '03-11-2026' }));
    expect(amount).toHaveValue(100);
  });

  it('offers only scheduled dates and lets the user navigate to another month', async () => {
    const emi = { ...loan, person: 'Weekly loan', amount: 1000, repaid: 0, lent_date: '2026-11-01', end_date: '2026-12-15', record_kind: 'emi' as const, payment_cycle: 'weekly' as const, first_payment_date: '2026-11-06', installment_amount: 100 };
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    await screen.findByText('Weekly loan');
    fireEvent.click(screen.getByRole('button', { name: 'Mark payment' }));
    const picker = screen.getByRole('button', { name: 'Installment date for payment' });
    expect(picker).toHaveTextContent('27-11-2026');
    fireEvent.click(picker);
    let dialog = screen.getByRole('dialog', { name: 'Choose scheduled installment' });
    expect(within(dialog).getAllByRole('button').map(button => button.textContent)).toEqual(['06-11-2026', '13-11-2026', '20-11-2026', '27-11-2026']);
    fireEvent.change(screen.getByLabelText('Installment date for payment month'), { target: { value: '2026-12' } });
    expect(within(dialog).getAllByRole('button').map(button => button.textContent)).toEqual(['04-12-2026', '11-12-2026']);
    fireEvent.click(within(dialog).getByRole('button', { name: '11-12-2026' }));
    expect(picker).toHaveTextContent('11-12-2026');
    fireEvent.click(picker);
    dialog = screen.getByRole('dialog', { name: 'Choose scheduled installment' });
    fireEvent.change(screen.getByLabelText('Installment date for payment month'), { target: { value: '2027-01' } });
    expect(within(dialog).getByText('No installments this month')).toBeInTheDocument();
  });

  it('advances past a paid installment and counts partially paid past installments', async () => {
    const emi = { ...loan, person: 'Scheduled loan', amount: 1000, repaid: 150, lent_date: '2026-11-01', record_kind: 'emi' as const, payment_cycle: 'weekly' as const, first_payment_date: '2026-11-03', installment_amount: 100 };
    const payment = { title: 'Payment', category: 'Loan: EMI / loan', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: 1', createdAt: 1 };
    const expenses = [{ ...payment, id: 'a', amount: 50, date: '2026-11-10' }, { ...payment, id: 'b', amount: 100, date: '2026-11-23' }];
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    vi.mocked(receivablesService.listInstallmentAssignments).mockResolvedValue([{ loan_id: '1', expense_id: 'a', installment_date: '2026-11-10' }, { loan_id: '1', expense_id: 'b', installment_date: '2026-11-24' }]);
    render(<Receivables currency="INR" today="2026-11-24" expenses={expenses} />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    expect(await screen.findByText('Next scheduled: 01-12-2026')).toBeInTheDocument();
    expect(screen.getByText('3 past installments to check')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark payment' }));
    expect(screen.getByLabelText('Installment date for payment')).toHaveTextContent('01-12-2026');
  });
  it('flags an estimated missed count when payment details are incomplete', async () => {
    const emi = { ...loan, person: 'Incomplete loan', amount: 1000, repaid: 100, lent_date: '2026-11-01', record_kind: 'emi' as const, payment_cycle: 'weekly' as const, first_payment_date: '2026-11-03', installment_amount: 100 };
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    expect(await screen.findByText('3 past installments to check (payment details may be incomplete)')).toBeInTheDocument();
  });

  it.each([[1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3], [16, 4], [20, 4], [21, 5], [31, 5], [32, 5]])('shows a custom %i-day cycle warning %i days ahead', async (interval, warningDays) => {
    const dateAfter = (days: number) => new Date(Date.UTC(2026, 10, 24 + days)).toISOString().slice(0, 10);
    const custom = { ...loan, person: 'Custom loan', record_kind: 'emi' as const, lent_date: '2026-11-01', payment_cycle: 'custom' as const, payment_interval_days: interval, first_payment_date: dateAfter(warningDays + 1), installment_amount: 20 };
    vi.mocked(receivablesService.list).mockResolvedValue([custom]);
    const view = render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    await screen.findByText('Custom loan');
    expect(screen.queryByText(/Installment in/)).not.toBeInTheDocument();
    view.rerender(<Receivables currency="INR" today="2026-11-25" />);
    expect(screen.getByText(`Installment in ${warningDays} ${warningDays === 1 ? 'day' : 'days'}`)).toBeInTheDocument();
  });

  it('selects a weekly payment day and saves its first occurrence', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, record_kind: 'emi', person: 'Bank' }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Lender or provider'), { target: { value: 'Bank' } });
    fireEvent.change(screen.getByLabelText('Total remaining to pay'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('Installment cycle'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('Weekly payment day'), { target: { value: '1' } });
    expect(screen.getByText(/Next scheduled payment: 30-11-2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.objectContaining({ payment_cycle: 'weekly', first_payment_date: '2026-11-30' }), null));
  });
  it('saves a custom installment cycle and estimates its payments', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, record_kind: 'emi', person: 'Bank' }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Lender or provider'), { target: { value: 'Bank' } });
    fireEvent.change(screen.getByLabelText('Total remaining to pay'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('Installment cycle'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Every number of days'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('First payment date'), { target: { value: '2026-11-25' } });
    fireEvent.change(screen.getByLabelText('End date (optional)'), { target: { value: '2026-12-04' } });
    expect(screen.getByLabelText('Installment amount (optional)')).toHaveValue(100);
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.objectContaining({ payment_cycle: 'custom', payment_interval_days: 3, first_payment_date: '2026-11-25', payment_day: null, installment_amount: 100 }), null));
  });

  it('keeps add-record drafts separate for each loan type', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Lent draft' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    fireEvent.click(screen.getByRole('tab', { name: /Money borrowed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(screen.getByLabelText('Person')).toHaveValue('');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Borrowed draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(screen.getByLabelText('Lender or provider')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    fireEvent.click(screen.getByRole('tab', { name: /Money lent/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(screen.getByLabelText('Person')).toHaveValue('Lent draft');
    expect(screen.getByLabelText('Amount')).toHaveValue(250);
  });
  it('keeps the records and analytics view independent for each loan type', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(screen.getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Money borrowed/ }));
    expect(screen.getByRole('tab', { name: 'Records' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    expect(screen.getByRole('tab', { name: 'Records' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Money lent/ }));
    expect(screen.getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true');
  });
  it('separates completed records and searches and filters each kind', async () => {
    vi.mocked(receivablesService.list).mockResolvedValue([
      { ...loan, id: 'active', person: 'Asha', due_date: '2026-11-23' },
      { ...loan, id: 'done', person: 'Bina', repaid: 500, note: 'Travel' },
      { ...loan, id: 'borrowed', person: 'Chen', record_kind: 'borrowed' },
    ]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    expect(screen.getByText('Active records')).toBeInTheDocument();
    expect(screen.getByText('Completed records')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter loan records'), { target: { value: 'completed' } });
    expect(screen.queryByText('Asha', { selector: 'h5' })).toBeNull();
    expect(screen.getByText('Bina', { selector: 'h5' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search loan records'), { target: { value: 'travel' } });
    expect(screen.getByText('Bina', { selector: 'h5' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search loan records'), { target: { value: 'missing' } });
    expect(screen.getByText('No records match your search and filter.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search loan records'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter loan records'), { target: { value: 'late' } });
    expect(screen.getByText('Asha', { selector: 'h5' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter loan records'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('tab', { name: /Money borrowed/ }));
    expect(screen.getByText('Chen', { selector: 'h5' })).toBeInTheDocument();
  });
  it('keeps search and status filters independent between loan types', async () => {
    vi.mocked(receivablesService.list).mockResolvedValue([loan, { ...loan, id: '2', person: 'Bina', record_kind: 'borrowed' }, { ...loan, id: '3', person: 'Chen', record_kind: 'emi' }]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.change(screen.getByLabelText('Search loan records'), { target: { value: 'Asha' } });
    fireEvent.change(screen.getByLabelText('Filter loan records'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('tab', { name: /Money borrowed/ }));
    expect(screen.getByLabelText('Search loan records')).toHaveValue('');
    expect(screen.getByLabelText('Filter loan records')).toHaveValue('all');
    expect(screen.getByText('Bina', { selector: 'h5' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    expect(screen.getByLabelText('Filter loan records')).toHaveValue('all');
    expect(screen.getByText('Chen', { selector: 'h5' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Money lent/ }));
    expect(screen.getByLabelText('Search loan records')).toHaveValue('Asha');
    expect(screen.getByLabelText('Filter loan records')).toHaveValue('completed');
  });
  it('assigns an existing EMI payment to a future installment', async () => {
    const emi = { ...loan, record_kind: 'emi' as const, lent_date: '2026-11-25', payment_day: 24, installment_amount: 100 };
    const payment = { id: 'p', title: 'Payment', amount: 100, category: 'Loan: EMI / loan', date: '2026-11-25', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: 1', createdAt: 1 };
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    vi.mocked(receivablesService.assignInstallment).mockResolvedValue();
    render(<Receivables currency="INR" today="2026-11-25" expenses={[payment]} />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByText(/Payment history/));
    fireEvent.click(screen.getByRole('button', { name: 'Choose installment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Installment date' }));
    fireEvent.change(screen.getByLabelText('Installment date month'), { target: { value: '2026-12' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Choose scheduled installment' })).getByRole('button', { name: '24-12-2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save installment' }));
    await waitFor(() => expect(receivablesService.assignInstallment).toHaveBeenCalledWith('1', 'p', '2026-12-24'));
    expect(await screen.findByText('Installment: 24-12-2026')).toBeInTheDocument();
  });
  it.each([['lent', 'Money lent'], ['borrowed', 'Money borrowed']] as const)('marks past and approaching dates for %s records', async (kind, tabName) => {
    const record = { ...loan, record_kind: kind };
    vi.mocked(receivablesService.list).mockResolvedValue([
      { ...record, id: 'past', person: 'Past', due_date: '2026-11-23' },
      { ...record, id: 'today', person: 'Today', due_date: '2026-11-24' },
      { ...record, id: 'soon', person: 'Soon', due_date: '2026-11-29' },
      { ...record, id: 'later', person: 'Later', due_date: '2026-11-30' },
      { ...record, id: 'settled', person: 'Settled', due_date: '2026-11-23', repaid: 500 },
    ]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(tabName) }));
    const card = async (name: string) => (await screen.findByText(name, { selector: 'h5' })).closest('article')!;
    expect(within(await card('Past')).getByText('Past due')).toBeInTheDocument();
    expect(within(await card('Today')).getByText('Due today')).toBeInTheDocument();
    expect(within(await card('Soon')).getByText('Due in 5 days')).toBeInTheDocument();
    expect(within(await card('Later')).queryByText(/Due in|Past due/)).toBeNull();
    expect(within(await card('Settled')).queryByText('Past due')).toBeNull();
  });
  it('checks EMI dates against recorded monthly payments', async () => {
    const emi = { ...loan, record_kind: 'emi' as const, repaid: 0, installment_amount: 100 };
    vi.mocked(receivablesService.list).mockResolvedValue([
      { ...emi, id: 'late', person: 'Late EMI', payment_day: 20 },
      { ...emi, id: 'paid', person: 'Paid EMI', payment_day: 20, repaid: 100 },
      { ...emi, id: 'soon', person: 'Soon EMI', lent_date: '2026-11-24', payment_day: 29 },
    ]);
    const payment = { id: 'p', title: 'Payment', amount: 100, category: 'Loan: EMI / loan', date: '2026-11-20', paymentMethod: 'Cash', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: paid', createdAt: 1 };
    render(<Receivables currency="INR" today="2026-11-24" expenses={[payment]} />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    const card = async (name: string) => (await screen.findByText(name, { selector: 'h5' })).closest('article')!;
    expect(within(await card('Late EMI')).getByText(/passed - check payment/)).toBeInTheDocument();
    expect(within(await card('Paid EMI')).queryByText(/passed - check payment/)).toBeNull();
    expect(within(await card('Soon EMI')).getByText('Installment in 5 days')).toBeInTheDocument();
  });
  it.each([['lent', 'Money lent'], ['borrowed', 'Money borrowed']] as const)('sorts %s records with due dates first, then by start date', async (kind, tabName) => {
    const record = { ...loan, record_kind: kind };
    vi.mocked(receivablesService.list).mockResolvedValue([
      { ...record, id: 'late', person: 'Later', lent_date: '2026-11-01', due_date: '2026-12-15' },
      { ...record, id: 'fallback', person: 'No due date', lent_date: '2026-11-10', due_date: null },
      { ...record, id: 'fallback-later', person: 'Later start', lent_date: '2026-11-20', due_date: null },
      { ...record, id: 'early', person: 'Sooner', lent_date: '2026-11-01', due_date: '2026-12-01' },
    ]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(tabName) }));
    await screen.findByText('Sooner', { selector: 'h5' });
    expect(screen.getAllByRole('article').map(article => within(article).getByRole('heading').textContent)).toEqual(['Sooner', 'Later', 'No due date', 'Later start']);
  });
  it('sorts EMI records by next scheduled date and puts unscheduled records last', async () => {
    const emi = { ...loan, record_kind: 'emi' as const };
    vi.mocked(receivablesService.list).mockResolvedValue([
      { ...emi, id: 'late', person: 'Later', payment_day: 12 },
      { ...emi, id: 'none', person: 'No schedule', payment_day: null },
      { ...emi, id: 'early', person: 'Sooner', payment_day: 10 },
      { ...emi, id: 'settled', person: 'Settled', payment_day: 1, repaid: 500 },
    ]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    await screen.findByText('Sooner', { selector: 'h5' });
    expect(screen.getAllByRole('article').map(article => within(article).getByRole('heading').textContent)).toEqual(['Sooner', 'Later', 'No schedule', 'Settled']);
  });
  it('switches between records and analytics for the selected loan type', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(screen.getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Money lent analytics' })).toBeInTheDocument();
    expect(screen.queryByText('Asha', { selector: 'h5' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Money borrowed/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(screen.getByRole('region', { name: 'Money borrowed analytics' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Records' }));
    expect(screen.getByText(/No money borrowed records yet/)).toBeInTheDocument();
  });
  it.each(['Money lent', 'Money borrowed', 'EMI / loan'])('shows the relevant message and account fields for %s', async tabName => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(tabName.replace('/', '\\/')) }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    const dialog = screen.getByRole('dialog');
    const checkbox = within(dialog).getByRole('checkbox');
    if (checkbox instanceof HTMLInputElement && checkbox.checked) fireEvent.click(checkbox);
    expect(within(dialog).getByText(/initial transaction won’t be recorded/)).toBeInTheDocument();
    expect(within(dialog).getByText(/initial transaction won’t be recorded/).parentElement).toHaveClass('border-amber-300');
    expect(within(dialog).queryByLabelText(/Paid from account|Received into account/)).toBeNull();
    fireEvent.click(checkbox);
    expect(within(dialog).getByText(/adds it to your transaction ledger/)).toBeInTheDocument();
    expect(within(dialog).getByText(/adds it to your transaction ledger/).parentElement).not.toHaveClass('border-amber-300');
    expect(within(dialog).getByLabelText(/Paid from account|Received into account/)).toBeInTheDocument();
  });
  it.each([
    ['Money lent', 'Add money lent'],
    ['Money borrowed', 'Add money borrowed'],
    ['EMI / loan', 'Add emi / loan'],
  ])('opens and closes an add dialog for %s', async (tabName, dialogName) => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(tabName.replace('/', '\\/')) }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(screen.getByRole('dialog', { name: dialogName })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    expect(screen.queryByRole('dialog', { name: dialogName })).toBeNull();
  });
  it('confirms loan deletion and shows progress until it completes', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const onTransactionDeleted = vi.fn();
    let finish!: (ids: string[]) => void;
    vi.mocked(receivablesService.delete).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<Receivables currency="INR" today="2026-11-24" onTransactionDeleted={onTransactionDeleted} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    const button = within(record).getByRole('button', { name: 'Delete Asha' });
    fireEvent.click(button);
    expect(receivablesService.delete).not.toHaveBeenCalled();
    expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('delete its original expense transaction and all linked payment transactions'));
    fireEvent.click(button);
    expect(receivablesService.delete).toHaveBeenCalledWith(loan);
    expect(within(record).getByRole('status')).toHaveTextContent('Deleting record');
    expect(within(record).getByRole('button', { name: 'Deleting Asha' })).toBeDisabled();
    finish(['original', 'repayment']);
    await waitFor(() => expect(screen.queryByText('Asha', { selector: 'h5' })).toBeNull());
    expect(onTransactionDeleted).toHaveBeenCalledWith('original');
    expect(onTransactionDeleted).toHaveBeenCalledWith('repayment');
    confirmation.mockRestore();
  });
  it('shows deletion progress for the selected payment until it finishes', async () => {
    const row = { id: 'payment', title: 'Repayment', amount: 100, category: 'Loan: Money lent', date: '2026-11-10', paymentMethod: 'Cash', account: 'expense' as const, type: 'income' as const, notes: 'Loan record: 1', createdAt: 1 };
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let finish!: (value: typeof loan) => void;
    vi.mocked(receivablesService.deletePayment).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<Receivables currency="INR" today="2026-11-24" expenses={[row]} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByText('Payment history · 1 payment'));
    fireEvent.click(within(record).getByRole('button', { name: /Delete payment 10-11-2026/ }));
    expect(within(record).getByRole('status')).toHaveTextContent('Deleting payment');
    expect(within(record).getByRole('button', { name: /Deleting payment 10-11-2026/ })).toBeDisabled();
    finish({ ...loan, repaid: 0 });
    await waitFor(() => expect(within(record).queryByText('Deleting payment…')).toBeNull());
    confirmation.mockRestore();
  });
  it('asks before deleting a payment and updates the loan and ledger only after confirmation', async () => {
    const row = { id: 'payment', title: 'Repayment', amount: 100, category: 'Loan: Money lent', date: '2026-11-10', paymentMethod: 'Cash', account: 'expense' as const, type: 'income' as const, notes: 'Loan record: 1', createdAt: 1 };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const onTransactionDeleted = vi.fn();
    vi.mocked(receivablesService.deletePayment).mockResolvedValue({ ...loan, repaid: 0 });
    render(<Receivables currency="INR" today="2026-11-24" expenses={[row]} onTransactionDeleted={onTransactionDeleted} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByText('Payment history · 1 payment'));
    const button = within(record).getByRole('button', { name: /Delete payment 10-11-2026/ });
    fireEvent.click(button);
    expect(receivablesService.deletePayment).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(receivablesService.deletePayment).toHaveBeenCalledWith(loan, row));
    expect(onTransactionDeleted).toHaveBeenCalledWith('payment');
    expect(await within(record).findByText('INR 500.00')).toBeInTheDocument();
    confirm.mockRestore();
  });
  it('edits a history payment and updates the loan and ledger together', async () => {
    const row = { id: 'payment', title: 'Repayment', amount: 100, category: 'Loan: Money lent', date: '2026-11-10', paymentMethod: 'Cash', account: 'expense' as const, type: 'income' as const, notes: 'Loan record: 1', createdAt: 1 };
    const onTransactionUpdated = vi.fn();
    vi.mocked(receivablesService.editPayment).mockResolvedValue({ loan: { ...loan, repaid: 150 }, transaction: { ...row, amount: 150 } });
    render(<Receivables currency="INR" today="2026-11-24" expenses={[row]} onTransactionUpdated={onTransactionUpdated} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByText('Payment history · 1 payment'));
    fireEvent.click(within(record).getByRole('button', { name: /Edit payment 10-11-2026/ }));
    fireEvent.change(within(record).getByLabelText('Edit payment amount'), { target: { value: '150' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(receivablesService.editPayment).toHaveBeenCalledWith(loan, row, 150, '2026-11-10', 'expense', 'Cash'));
    expect(onTransactionUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'payment', amount: 150 }));
    expect(await within(record).findByText('INR 350.00')).toBeInTheDocument();
  });
  it('edits a loan without changing its recorded movement', async () => {
    vi.mocked(receivablesService.update).mockResolvedValue({ loan: { ...loan, person: 'Anu', due_date: '2026-12-05' }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Edit Asha' }));
    fireEvent.change(within(record).getByLabelText('Edit name'), { target: { value: 'Anu' } });
    fireEvent.change(within(record).getByLabelText('Edit due date'), { target: { value: '2026-12-05' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(receivablesService.update).toHaveBeenCalledWith(loan, expect.objectContaining({ person: 'Anu', amount: 500, due_date: '2026-12-05' }), null));
    expect(await screen.findByText('Anu', { selector: 'h5' })).toBeInTheDocument();
  });
  it('updates the original ledger movement with the edited amount and date', async () => {
    const transaction = { id: 'original', title: 'Money lent to Asha', amount: 500, category: 'Loan: Money lent', date: '2026-11-01', paymentMethod: 'UPI / QR', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: 1', createdAt: 1 };
    const onTransactionUpdated = vi.fn();
    vi.mocked(receivablesService.update).mockResolvedValue({ loan: { ...loan, amount: 600, lent_date: '2026-11-02' }, transaction: { ...transaction, amount: 600, date: '2026-11-02' } });
    render(<Receivables currency="INR" today="2026-11-24" expenses={[transaction]} onTransactionUpdated={onTransactionUpdated} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Edit Asha' }));
    fireEvent.change(within(record).getByLabelText('Edit amount'), { target: { value: '600' } });
    fireEvent.change(within(record).getByLabelText('Edit start date'), { target: { value: '2026-11-02' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(receivablesService.update).toHaveBeenCalledWith(loan, expect.objectContaining({ amount: 600, lent_date: '2026-11-02' }), expect.objectContaining({ transaction, amount: 600 })));
    expect(onTransactionUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'original', amount: 600 }));
  });
  it('prevents an EMI total below payments already recorded', async () => {
    const emi = { ...loan, record_kind: 'emi' as const, installment_amount: 100 };
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByRole('tab', { name: /EMI \/ loan/ });
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Edit Asha' }));
    fireEvent.change(within(record).getByLabelText('Edit total payable'), { target: { value: '50' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Save changes' }));
    expect(within(record).getByRole('alert')).toHaveTextContent('at least as large');
    expect(receivablesService.update).not.toHaveBeenCalled();
  });
  it('sends the selected payment method for a new loan transaction', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', amount: 125, repaid: 0 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125' } });
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'Debit Card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.objectContaining({ payment_method: 'Debit Card' }), 'expense'));
  });
  it('sends the selected payment method when recording a repayment', async () => {
    vi.mocked(receivablesService.repay).mockResolvedValue({ loan: { ...loan, repaid: 250 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.change(within(record).getByLabelText('Payment method'), { target: { value: 'Net Banking' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 150, '2026-11-24', 'expense', undefined, 'Net Banking'));
  });
  it('increments loan amount fields by one rupee and accepts paise', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    const amount = screen.getByLabelText('Amount') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '500.50' } });
    expect(amount.validity.valid).toBe(true);
    amount.stepUp();
    fireEvent.input(amount);
    expect(amount.value).toBe('501.5');
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    const installment = screen.getByLabelText('Installment amount (optional)') as HTMLInputElement;
    fireEvent.change(installment, { target: { value: '500.25' } });
    installment.stepUp();
    expect(installment.value).toBe('501.25');
  });
  it('estimates installments from the schedule and preserves manual edits', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Total remaining to pay'), { target: { value: '12000' } });
    fireEvent.change(screen.getByLabelText('End date (optional)'), { target: { value: '2027-11-24' } });
    expect(screen.getByLabelText('Installment amount (optional)')).toHaveValue(923.08);
    fireEvent.change(screen.getByLabelText('Monthly payment day'), { target: { value: '15' } });
    expect(screen.getByLabelText('Installment amount (optional)')).toHaveValue(1000);
    fireEvent.change(screen.getByLabelText('Installment amount (optional)'), { target: { value: '1100' } });
    fireEvent.change(screen.getByLabelText('Total remaining to pay'), { target: { value: '24000' } });
    expect(screen.getByLabelText('Installment amount (optional)')).toHaveValue(1100);
    fireEvent.click(screen.getByRole('button', { name: 'Use calculated amount' }));
    expect(screen.getByLabelText('Installment amount (optional)')).toHaveValue(2000);
  });
  it('shows each recorded and linked partial repayment, without counting the original loan', async () => {
    vi.mocked(receivablesService.list).mockResolvedValue([{ ...loan, repaid: 250 }]);
    vi.mocked(receivablesService.listMovementLinks).mockResolvedValue([{ loan_id: '1', expense_id: 'linked' }]);
    const common = { category: 'Other', paymentMethod: 'Cash', account: 'expense' as const, createdAt: 0 };
    const entries = [
      { ...common, id: 'original', title: 'Loan sent', amount: 500, date: '2026-11-01', type: 'expense' as const, notes: 'Loan record: 1' },
      { ...common, id: 'first', title: 'First payment', amount: 100, date: '2026-11-10', type: 'income' as const, notes: 'Loan record: 1' },
      { ...common, id: 'linked', title: 'Second payment', amount: 150, date: '2026-11-20', type: 'income' as const },
    ];
    render(<Receivables currency="INR" today="2026-11-24" expenses={entries} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    await waitFor(() => expect(within(record).getByText('Payment history · 2 payments')).toBeInTheDocument());
    fireEvent.click(within(record).getByText('Payment history · 2 payments'));
    expect(within(record).getByText('Received · 10-11-2026')).toBeInTheDocument();
    expect(within(record).getByText('Received · 20-11-2026')).toBeInTheDocument();
    expect(within(record).queryByText('Received · 01-11-2026')).toBeNull();
  });
  it('lets the user link a matching original payment instead of creating another', async () => {
    const entry = { id: 'existing', title: 'Sent to Sam', amount: 125, category: 'Other', date: '2026-11-24', paymentMethod: 'Cash', type: 'expense' as const, account: 'expense' as const, createdAt: 0 };
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', amount: 125, repaid: 0 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" expenses={[entry]} />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('radio', { name: /Sent to Sam/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.objectContaining({ existing_expense_id: 'existing' }), 'expense'));
  });
  it('links an existing repayment only after the user selects it', async () => {
    const entry = { id: 'received', title: 'Asha repayment', amount: 150, category: 'Other', date: '2026-11-24', paymentMethod: 'Cash', type: 'income' as const, account: 'expense' as const, createdAt: 0 };
    vi.mocked(receivablesService.repay).mockResolvedValue({ loan: { ...loan, repaid: 250 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" expenses={[entry]} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.click(within(record).getByRole('radio', { name: /Asha repayment/ }));
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 150, '2026-11-24', 'expense', 'received'));
  });
  it('opens from the finance action and returns without adding a module tab', async () => {
    render(<ExpenseDashboard dateNavigator={<div>Date navigator</div>} expenses={[]} budget={{ monthlyBudget: 3000, weeklyBudget: 700, dailyBudget: 100, currency: 'INR', categoryBudgets: {} }} initialDate="2026-11-24" onAddExpense={vi.fn()} onUpdateExpense={vi.fn()} onDeleteExpense={vi.fn()} onUpdateBudget={vi.fn()} onExportCSV={vi.fn()} customCategories={{}} onSaveCustomCategories={vi.fn()} />);
    expect(screen.getByText('Date navigator')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Expense modules' })).queryByRole('button', { name: /Loans/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Payables & Receivables' }));
    expect(screen.queryByText('Date navigator')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Payables & Receivables' })).toBeInTheDocument();
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to finance' }));
    expect(screen.getByText('Date navigator')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Expense modules' })).toBeInTheDocument();
  });
  it('shows the remaining amount and records a partial repayment', async () => {
    vi.mocked(receivablesService.repay).mockResolvedValue({ loan: { ...loan, repaid: 250 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    expect(within(record).getByText('INR 400.00')).toBeInTheDocument();
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 150, '2026-11-24', 'expense', undefined, 'UPI / QR'));
    expect(await within(record).findByText('INR 250.00')).toBeInTheDocument();
  });

  it('saves a loan with its optional details', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', amount: 125, repaid: 0 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith({ person: 'Sam', amount: 125, lent_date: '2026-11-24', due_date: null, end_date: null, payment_day: null, note: null, record_kind: 'lent', installment_amount: null, payment_method: 'UPI / QR' }, 'expense'));
    expect(await screen.findByText('Sam', { selector: 'h5' })).toBeInTheDocument();
  });

  it('records an EMI with its installment and shows it as money to pay', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Bank', amount: 12000, repaid: 0, record_kind: 'emi', installment_amount: 1000, end_date: '2027-11-24', payment_day: 15 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Lender or provider'), { target: { value: 'Bank' } });
    fireEvent.change(screen.getByLabelText('Total remaining to pay'), { target: { value: '12000' } });
    fireEvent.change(screen.getByLabelText('Installment amount (optional)'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('End date (optional)'), { target: { value: '2027-11-24' } });
    fireEvent.change(screen.getByLabelText('Monthly payment day'), { target: { value: '15' } });
    expect(screen.getByText(/Next scheduled payment: 15-12-2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.objectContaining({ record_kind: 'emi', amount: 12000, installment_amount: 1000, end_date: '2027-11-24', payment_day: 15 }), null));
    const record = (await screen.findByText('Bank', { selector: 'h5' })).closest('article')!;
    expect(within(record).getByText('To pay')).toBeInTheDocument();
    expect(within(record).getByText('End date: 24-11-2027')).toBeInTheDocument();
    expect(within(record).getByText('Monthly payment day: 15')).toBeInTheDocument();
    expect(within(record).getByRole('button', { name: 'Mark payment' })).toBeInTheDocument();
  });

  it('supports keyboard navigation between record type tabs', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha', { selector: 'h5' });
    const lent = screen.getByRole('tab', { name: /Money lent/ });
    lent.focus();
    fireEvent.keyDown(lent, { key: 'ArrowRight' });
    const borrowed = screen.getByRole('tab', { name: /Money borrowed/ });
    expect(borrowed).toHaveAttribute('aria-selected', 'true');
    expect(borrowed).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(screen.getByLabelText('Due date (optional)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    expect(screen.queryByText('Asha', { selector: 'h5' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Money lent/ }));
    expect(screen.getByText('Asha', { selector: 'h5' })).toBeInTheDocument();
  });

  it('offers only enabled accounts and adds the saved movement to the ledger state', async () => {
    const transaction = { id: 'tx', title: 'Money lent to Sam', amount: 125, category: 'Loan funds movement', date: '2026-11-24', paymentMethod: 'Cash', account: 'cash' as const, type: 'expense' as const, createdAt: 1 };
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', amount: 125, repaid: 0 }, transaction });
    const onTransactionAdded = vi.fn();
    render(<Receivables currency="INR" today="2026-11-24" accountVisibility={{ cash: true, savings: false }} onTransactionAdded={onTransactionAdded} />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    const account = screen.getByLabelText('Paid from account');
    expect(within(account).getByRole('option', { name: 'Cash in Hand' })).toBeInTheDocument();
    expect(within(account).queryByRole('option', { name: 'Savings Account' })).toBeNull();
    fireEvent.change(account, { target: { value: 'cash' } });
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.anything(), 'cash'));
    expect(onTransactionAdded).toHaveBeenCalledWith(transaction);
  });

  it('records a repayment using its selected account and date', async () => {
    const transaction = { id: 'pay', title: 'Loan repayment from Asha', amount: 150, category: 'Loan funds movement', date: '2026-11-20', paymentMethod: 'Cash', account: 'cash' as const, type: 'income' as const, createdAt: 1 };
    vi.mocked(receivablesService.repay).mockResolvedValue({ loan: { ...loan, repaid: 250 }, transaction });
    const onTransactionAdded = vi.fn();
    render(<Receivables currency="INR" today="2026-11-24" accountVisibility={{ cash: true, savings: false }} onTransactionAdded={onTransactionAdded} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.change(within(record).getByLabelText('Payment date'), { target: { value: '2026-11-20' } });
    const account = within(record).getByLabelText('Received into account');
    expect(within(account).queryByRole('option', { name: 'Savings Account' })).toBeNull();
    fireEvent.change(account, { target: { value: 'cash' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 150, '2026-11-20', 'cash', undefined, 'Cash'));
    expect(onTransactionAdded).toHaveBeenCalledWith(transaction);
  });

  it('can record the actual EMI loan receipt separately from the amount repayable', async () => {
    const transaction = { id: 'emi-tx', title: 'Loan received from Bank', amount: 10000, category: 'Loan: EMI / loan', date: '2026-11-24', paymentMethod: 'Cash', account: 'cash' as const, type: 'income' as const, createdAt: 1 };
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Bank', amount: 12000, repaid: 0, record_kind: 'emi', payment_day: 15 }, transaction });
    const onTransactionAdded = vi.fn();
    render(<Receivables currency="INR" today="2026-11-24" accountVisibility={{ cash: true, savings: false }} onTransactionAdded={onTransactionAdded} />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Lender or provider'), { target: { value: 'Bank' } });
    fireEvent.change(screen.getByLabelText('Total remaining to pay'), { target: { value: '12000' } });
    fireEvent.change(screen.getByLabelText('Monthly payment day'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Record money received from the lender/ }));
    fireEvent.change(screen.getByLabelText('Amount received from lender'), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText('Received into account'), { target: { value: 'cash' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.objectContaining({ record_kind: 'emi', amount: 12000, initial_received: 10000 }), 'cash'));
    expect(onTransactionAdded).toHaveBeenCalledWith(transaction);
  });

  it('can track a previously recorded loan without adding a second transaction', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', repaid: 0 }, transaction: null });
    const onTransactionAdded = vi.fn();
    render(<Receivables currency="INR" today="2026-11-24" onTransactionAdded={onTransactionAdded} />);
    await screen.findByText('Asha', { selector: 'h5' });
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Record the original money you lent/ }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith(expect.anything(), null));
    expect(onTransactionAdded).not.toHaveBeenCalled();
  });

  it('keeps the existing balance and ledger unchanged if a payment fails', async () => {
    vi.mocked(receivablesService.repay).mockRejectedValue(new Error('Payment could not be saved'));
    const onTransactionAdded = vi.fn();
    render(<Receivables currency="INR" today="2026-11-24" onTransactionAdded={onTransactionAdded} />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment could not be saved');
    expect(within(record).getByText('INR 400.00')).toBeInTheDocument();
    expect(onTransactionAdded).not.toHaveBeenCalled();
  });

  it('prefills the remaining amount and marks the loan settled only after saving', async () => {
    vi.mocked(receivablesService.repay).mockResolvedValue({ loan: { ...loan, repaid: 500 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    expect(within(record).getByLabelText('Amount received from Asha')).toHaveValue(400);
    expect(within(record).queryByText('Settled')).toBeNull();
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 400, '2026-11-24', 'expense', undefined, 'UPI / QR'));
    expect(await within(record).findByText('Settled')).toBeInTheDocument();
  });

  it('prefills an EMI payment without marking the entire loan settled', async () => {
    const emi = { ...loan, record_kind: 'emi' as const, installment_amount: 150 };
    vi.mocked(receivablesService.list).mockResolvedValue([emi]);
    render(<Receivables currency="INR" today="2026-11-24" />);
    fireEvent.click(screen.getByRole('tab', { name: /EMI \/ loan/ }));
    const record = (await screen.findByText('Asha', { selector: 'h5' })).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark payment' }));
    expect(within(record).getByLabelText('Amount paid to Asha')).toHaveValue(150);
    expect(within(record).queryByText('Settled')).toBeNull();
  });
});
