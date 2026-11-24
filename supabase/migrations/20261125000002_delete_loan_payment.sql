-- Delete a confirmed loan payment and its ledger movement together.
CREATE OR REPLACE FUNCTION public.delete_loan_payment(
  p_loan_id uuid, p_expense_id uuid, p_expected_repaid numeric,
  p_expected_amount numeric, p_expected_date date, p_expected_account text, p_expected_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
  link_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to delete a payment'; END IF;
  SELECT * INTO loan FROM public.loans_and_dues WHERE id = p_loan_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR loan.repaid IS DISTINCT FROM p_expected_repaid THEN RAISE EXCEPTION 'This loan changed elsewhere. Refresh and try again.'; END IF;
  SELECT * INTO movement FROM public.expenses WHERE id = p_expense_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF (movement.account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR
     (movement.account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN RAISE EXCEPTION 'This account is not enabled'; END IF;
  IF movement.amount IS DISTINCT FROM p_expected_amount OR movement.entry_date IS DISTINCT FROM p_expected_date OR
     movement.account IS DISTINCT FROM p_expected_account OR movement.payment_method IS DISTINCT FROM p_expected_method THEN
    RAISE EXCEPTION 'This payment changed elsewhere. Refresh and try again.';
  END IF;
  SELECT id INTO link_id FROM public.loan_existing_movements WHERE user_id = uid AND loan_id = loan.id AND expense_id = movement.id;
  IF (link_id IS NULL AND (movement.notes IS DISTINCT FROM 'Loan record: ' || loan.id::text OR movement.category NOT IN ('Loan funds movement', 'Loan: Money lent', 'Loan: Money borrowed', 'Loan: EMI / loan'))) OR
     movement.transaction_type IS DISTINCT FROM (CASE WHEN loan.record_kind = 'lent' THEN 'income' ELSE 'expense' END) OR movement.is_transfer THEN
    RAISE EXCEPTION 'This transaction is not a payment for this loan';
  END IF;
  IF loan.repaid < movement.amount THEN RAISE EXCEPTION 'The payment history is incomplete. Refresh and check the loan before deleting.'; END IF;
  IF link_id IS NOT NULL THEN DELETE FROM public.loan_existing_movements WHERE id = link_id AND user_id = uid; END IF;
  DELETE FROM public.expenses WHERE id = movement.id AND user_id = uid;
  UPDATE public.loans_and_dues SET repaid = repaid - movement.amount WHERE id = loan.id AND user_id = uid RETURNING * INTO loan;
  RETURN jsonb_build_object('loan', to_jsonb(loan));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_loan_payment(uuid, uuid, numeric, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_loan_payment(uuid, uuid, numeric, numeric, date, text, text) TO authenticated;
