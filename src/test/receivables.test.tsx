import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Receivables from '../components/Receivables';
import { ExpenseDashboard } from '../components/ExpenseDashboard';
import { receivablesService } from '../features/expenses/receivablesService';

vi.mock('../features/expenses/receivablesService', () => ({ receivablesService: { list: vi.fn(), listMovementLinks: vi.fn(), create: vi.fn(), repay: vi.fn(), update: vi.fn(), editPayment: vi.fn(), deletePayment: vi.fn(), delete: vi.fn() } }));
const loan = { id: '1', person: 'Asha', amount: 500, repaid: 100, lent_date: '2026-11-01', due_date: null, end_date: null, payment_day: null, note: null, record_kind: 'lent' as const, installment_amount: null };
beforeEach(() => { vi.mocked(receivablesService.list).mockResolvedValue([loan]); vi.mocked(receivablesService.listMovementLinks).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('money to receive', () => {
  it.each(['Money lent', 'Money borrowed', 'EMI / loan'])('shows the relevant message and account fields for %s', async tabName => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha');
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(tabName.replace('/', '\\/')) }));
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    const dialog = screen.getByRole('dialog');
    const checkbox = within(dialog).getByRole('checkbox');
    if (checkbox instanceof HTMLInputElement && checkbox.checked) fireEvent.click(checkbox);
    expect(within(dialog).getByText(/initial transaction won’t be recorded/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Paid from account|Received into account/)).toBeNull();
    fireEvent.click(checkbox);
    expect(within(dialog).getByText(/adds it to your transaction ledger/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Paid from account|Received into account/)).toBeInTheDocument();
  });
  it.each([
    ['Money lent', 'Add money lent'],
    ['Money borrowed', 'Add money borrowed'],
    ['EMI / loan', 'Add emi / loan'],
  ])('opens and closes an add dialog for %s', async (tabName, dialogName) => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Asha')).closest('article')!;
    const button = within(record).getByRole('button', { name: 'Delete Asha' });
    fireEvent.click(button);
    expect(receivablesService.delete).not.toHaveBeenCalled();
    expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('delete its original expense transaction and all linked payment transactions'));
    fireEvent.click(button);
    expect(receivablesService.delete).toHaveBeenCalledWith(loan);
    expect(within(record).getByRole('status')).toHaveTextContent('Deleting record');
    expect(within(record).getByRole('button', { name: 'Deleting Asha' })).toBeDisabled();
    finish(['original', 'repayment']);
    await waitFor(() => expect(screen.queryByText('Asha')).toBeNull());
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    const record = (await screen.findByText('Asha')).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Edit Asha' }));
    fireEvent.change(within(record).getByLabelText('Edit name'), { target: { value: 'Anu' } });
    fireEvent.change(within(record).getByLabelText('Edit due date'), { target: { value: '2026-12-05' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(receivablesService.update).toHaveBeenCalledWith(loan, expect.objectContaining({ person: 'Anu', amount: 500, due_date: '2026-12-05' }), null));
    expect(await screen.findByText('Anu')).toBeInTheDocument();
  });
  it('updates the original ledger movement with the edited amount and date', async () => {
    const transaction = { id: 'original', title: 'Money lent to Asha', amount: 500, category: 'Loan: Money lent', date: '2026-11-01', paymentMethod: 'UPI / QR', account: 'expense' as const, type: 'expense' as const, notes: 'Loan record: 1', createdAt: 1 };
    const onTransactionUpdated = vi.fn();
    vi.mocked(receivablesService.update).mockResolvedValue({ loan: { ...loan, amount: 600, lent_date: '2026-11-02' }, transaction: { ...transaction, amount: 600, date: '2026-11-02' } });
    render(<Receivables currency="INR" today="2026-11-24" expenses={[transaction]} onTransactionUpdated={onTransactionUpdated} />);
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    const record = (await screen.findByText('Asha')).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Edit Asha' }));
    fireEvent.change(within(record).getByLabelText('Edit total payable'), { target: { value: '50' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Save changes' }));
    expect(within(record).getByRole('alert')).toHaveTextContent('at least as large');
    expect(receivablesService.update).not.toHaveBeenCalled();
  });
  it('sends the selected payment method for a new loan transaction', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', amount: 125, repaid: 0 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Asha')).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.change(within(record).getByLabelText('Payment method'), { target: { value: 'Net Banking' } });
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 150, '2026-11-24', 'expense', undefined, 'Net Banking'));
  });
  it('increments loan amount fields by one rupee and accepts paise', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha');
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
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Asha')).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark received' }));
    fireEvent.change(within(record).getByLabelText('Amount received from Asha'), { target: { value: '150' } });
    fireEvent.click(within(record).getByRole('radio', { name: /Asha repayment/ }));
    fireEvent.click(within(record).getByRole('button', { name: 'Confirm received' }));
    await waitFor(() => expect(receivablesService.repay).toHaveBeenCalledWith(loan, 150, '2026-11-24', 'expense', 'received'));
  });
  it('opens from the finance action and returns without adding a module tab', async () => {
    render(<ExpenseDashboard expenses={[]} budget={{ monthlyBudget: 3000, weeklyBudget: 700, dailyBudget: 100, currency: 'INR', categoryBudgets: {} }} initialDate="2026-11-24" onAddExpense={vi.fn()} onUpdateExpense={vi.fn()} onDeleteExpense={vi.fn()} onUpdateBudget={vi.fn()} onExportCSV={vi.fn()} customCategories={{}} onSaveCustomCategories={vi.fn()} />);
    expect(within(screen.getByRole('group', { name: 'Expense modules' })).queryByRole('button', { name: /Loans/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Loans and dues' }));
    expect(screen.getByRole('region', { name: 'Loans and dues' })).toBeInTheDocument();
    await screen.findByText('Asha');
    fireEvent.click(screen.getByRole('button', { name: 'Back to finance' }));
    expect(screen.getByRole('group', { name: 'Expense modules' })).toBeInTheDocument();
  });
  it('shows the remaining amount and records a partial repayment', async () => {
    vi.mocked(receivablesService.repay).mockResolvedValue({ loan: { ...loan, repaid: 250 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    await screen.findByText('Asha');
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(receivablesService.create).toHaveBeenCalledWith({ person: 'Sam', amount: 125, lent_date: '2026-11-24', due_date: null, end_date: null, payment_day: null, note: null, record_kind: 'lent', installment_amount: null, payment_method: 'UPI / QR' }, 'expense'));
    expect(await screen.findByText('Sam')).toBeInTheDocument();
  });

  it('records an EMI with its installment and shows it as money to pay', async () => {
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Bank', amount: 12000, repaid: 0, record_kind: 'emi', installment_amount: 1000, end_date: '2027-11-24', payment_day: 15 }, transaction: null });
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Bank')).closest('article')!;
    expect(within(record).getByText('To pay')).toBeInTheDocument();
    expect(within(record).getByText('End date: 24-11-2027')).toBeInTheDocument();
    expect(within(record).getByText('Monthly payment day: 15')).toBeInTheDocument();
    expect(within(record).getByRole('button', { name: 'Mark payment' })).toBeInTheDocument();
  });

  it('supports keyboard navigation between record type tabs', async () => {
    render(<Receivables currency="INR" today="2026-11-24" />);
    await screen.findByText('Asha');
    const lent = screen.getByRole('tab', { name: /Money lent/ });
    lent.focus();
    fireEvent.keyDown(lent, { key: 'ArrowRight' });
    const borrowed = screen.getByRole('tab', { name: /Money borrowed/ });
    expect(borrowed).toHaveAttribute('aria-selected', 'true');
    expect(borrowed).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(screen.getByLabelText('Due date (optional)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close add dialog' }));
    expect(screen.queryByText('Asha')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Money lent/ }));
    expect(screen.getByText('Asha')).toBeInTheDocument();
  });

  it('offers only enabled accounts and adds the saved movement to the ledger state', async () => {
    const transaction = { id: 'tx', title: 'Money lent to Sam', amount: 125, category: 'Loan funds movement', date: '2026-11-24', paymentMethod: 'Cash', account: 'cash' as const, type: 'expense' as const, createdAt: 1 };
    vi.mocked(receivablesService.create).mockResolvedValue({ loan: { ...loan, id: '2', person: 'Sam', amount: 125, repaid: 0 }, transaction });
    const onTransactionAdded = vi.fn();
    render(<Receivables currency="INR" today="2026-11-24" accountVisibility={{ cash: true, savings: false }} onTransactionAdded={onTransactionAdded} />);
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    await screen.findByText('Asha');
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
    await screen.findByText('Asha');
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    const record = (await screen.findByText('Asha')).closest('article')!;
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
    const record = (await screen.findByText('Asha')).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: 'Mark payment' }));
    expect(within(record).getByLabelText('Amount paid to Asha')).toHaveValue(150);
    expect(within(record).queryByText('Settled')).toBeNull();
  });
});
