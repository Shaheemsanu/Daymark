import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Expense } from '../../types';
import { Account } from '../../utils/accounts';

export type LoanKind = 'lent' | 'borrowed' | 'emi';
export type Receivable = { id: string; person: string; amount: number; repaid: number; lent_date: string; due_date: string | null; end_date: string | null; payment_day: number | null; note: string | null; record_kind: LoanKind; installment_amount: number | null };
export type LoanMovementLink = { loan_id: string; expense_id: string };
export type LoanEdits = Pick<Receivable, 'person' | 'amount' | 'lent_date' | 'due_date' | 'end_date' | 'payment_day' | 'note' | 'installment_amount'>;
export type OriginalEdits = { transaction: Expense; amount: number; account: Account; paymentMethod: string };
const columns = 'id,person,amount,repaid,lent_date,due_date,end_date,payment_day,note,record_kind,installment_amount';

async function context() {
  if (!supabase || !isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sign in to track loans and payments.');
  return { db: supabase, userId: data.session.user.id };
}

const mapRow = (row: Receivable): Receivable => ({ ...row, amount: Number(row.amount), repaid: Number(row.repaid), installment_amount: row.installment_amount === null ? null : Number(row.installment_amount) });
const mapMovement = (row: Record<string, unknown> | null): Expense | null => row ? ({ id: String(row.id), title: String(row.title), amount: Number(row.amount), category: String(row.category), date: String(row.entry_date), paymentMethod: String(row.payment_method), type: row.transaction_type === 'income' ? 'income' : 'expense', account: row.account as Account, isTransfer: false, notes: row.notes ? String(row.notes) : undefined, createdAt: Date.parse(String(row.created_at)) }) : null;

export const receivablesService = {
  async listMovementLinks(): Promise<LoanMovementLink[]> {
    const { db, userId } = await context();
    const { data, error } = await db.from('loan_existing_movements').select('loan_id,expense_id').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },
  async list(): Promise<Receivable[]> {
    const { db, userId } = await context();
    const { data, error } = await db.from('loans_and_dues').select(columns).eq('user_id', userId).order('lent_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRow);
  },
  async update(item: Receivable, changes: LoanEdits, original: OriginalEdits | null): Promise<{ loan: Receivable; transaction: Expense | null }> {
    const { db } = await context();
    const snapshot = original && { id: original.transaction.id, expected_amount: original.transaction.amount, expected_date: original.transaction.date, expected_account: original.transaction.account || 'expense', expected_method: original.transaction.paymentMethod || null, amount: original.amount, account: original.account, payment_method: original.paymentMethod };
    const { data, error } = await db.rpc('edit_loan_details', { p_id: item.id, p_expected: item, p_changes: changes, p_original: snapshot });
    if (error) throw error;
    const updated = mapMovement(data.transaction);
    return { loan: mapRow(data.loan), transaction: updated && original ? { ...original.transaction, ...updated } : null };
  },
  async delete(item: Receivable): Promise<string[]> {
    const { db } = await context();
    const { data, error } = await db.rpc('delete_loan_with_transactions', { p_loan_id: item.id, p_expected_amount: item.amount, p_expected_repaid: item.repaid });
    if (error) throw error;
    if (!Array.isArray(data?.deleted_transaction_ids)) throw new Error('Could not confirm which transactions were deleted. Refresh and try again.');
    return data.deleted_transaction_ids;
  },
  async create(item: Pick<Receivable, 'person' | 'amount' | 'lent_date' | 'due_date' | 'end_date' | 'payment_day' | 'note' | 'record_kind' | 'installment_amount'> & { initial_received?: number; existing_expense_id?: string; payment_method?: string }, account: Account | null): Promise<{ loan: Receivable; transaction: Expense | null }> {
    const { db } = await context();
    const { data, error } = await db.rpc('save_loan_with_movement', { p_loan: item, p_account: account });
    if (error) throw error;
    return { loan: mapRow(data.loan), transaction: mapMovement(data.transaction) };
  },
  async repay(item: Receivable, amount: number, date: string, account: Account, existingId?: string, paymentMethod?: string): Promise<{ loan: Receivable; transaction: Expense | null }> {
    const { db } = await context();
    const args = { p_id: item.id, p_expected_repaid: item.repaid, p_amount: amount, p_date: date, p_account: account };
    const { data, error } = existingId
      ? await db.rpc('link_existing_loan_payment', { ...args, p_expense_id: existingId })
      : await db.rpc('record_loan_payment_with_method', { ...args, p_payment_method: paymentMethod });
    if (error) throw error;
    return { loan: mapRow(data.loan), transaction: mapMovement(data.transaction) };
  },
  async editPayment(item: Receivable, transaction: Expense, amount: number, date: string, account: Account, method: string): Promise<{ loan: Receivable; transaction: Expense }> {
    const { db } = await context();
    const { data, error } = await db.rpc('edit_loan_payment', { p_loan_id: item.id, p_expense_id: transaction.id, p_expected_repaid: item.repaid, p_expected_amount: transaction.amount, p_expected_date: transaction.date, p_expected_account: transaction.account || 'expense', p_expected_method: transaction.paymentMethod || null, p_amount: amount, p_date: date, p_account: account, p_payment_method: method });
    if (error) throw error;
    const updated = mapMovement(data.transaction);
    if (!updated) throw new Error('The updated transaction was not returned. Refresh and try again.');
    return { loan: mapRow(data.loan), transaction: { ...transaction, ...updated } };
  },
  async deletePayment(item: Receivable, transaction: Expense): Promise<Receivable> {
    const { db } = await context();
    const { data, error } = await db.rpc('delete_loan_payment', { p_loan_id: item.id, p_expense_id: transaction.id, p_expected_repaid: item.repaid, p_expected_amount: transaction.amount, p_expected_date: transaction.date, p_expected_account: transaction.account || 'expense', p_expected_method: transaction.paymentMethod || null });
    if (error) throw error;
    return mapRow(data.loan);
  },
};
