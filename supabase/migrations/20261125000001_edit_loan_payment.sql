-- Update a payment and its ledger transaction atomically.
CREATE OR REPLACE FUNCTION public.edit_loan_payment(
  p_loan_id uuid, p_expense_id uuid, p_expected_repaid numeric,
  p_expected_amount numeric, p_expected_date date, p_expected_account text, p_expected_method text,
  p_amount numeric, p_date date, p_account text, p_payment_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
  link_id uuid;
  new_repaid numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to edit a payment'; END IF;
  IF p_account IS NULL OR p_account NOT IN ('expense', 'cash', 'savings') OR
     (p_account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR
     (p_account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN
    RAISE EXCEPTION 'This account is not enabled';
  END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 OR length(p_payment_method) > 120 OR (p_account = 'cash' AND p_payment_method <> 'Cash') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;
  SELECT * INTO loan FROM public.loans_and_dues WHERE id = p_loan_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR loan.repaid IS DISTINCT FROM p_expected_repaid THEN RAISE EXCEPTION 'This loan changed elsewhere. Refresh and try again.'; END IF;
  SELECT * INTO movement FROM public.expenses WHERE id = p_expense_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF (movement.account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR
     (movement.account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN RAISE EXCEPTION 'The original account is not enabled'; END IF;
  IF movement.amount IS DISTINCT FROM p_expected_amount OR movement.entry_date IS DISTINCT FROM p_expected_date OR
     movement.account IS DISTINCT FROM p_expected_account OR movement.payment_method IS DISTINCT FROM p_expected_method THEN
    RAISE EXCEPTION 'This payment changed elsewhere. Refresh and try again.';
  END IF;
  SELECT id INTO link_id FROM public.loan_existing_movements WHERE user_id = uid AND loan_id = loan.id AND expense_id = movement.id;
  IF (link_id IS NULL AND (movement.notes IS DISTINCT FROM 'Loan record: ' || loan.id::text OR movement.category NOT IN ('Loan funds movement', 'Loan: Money lent', 'Loan: Money borrowed', 'Loan: EMI / loan'))) OR
     movement.transaction_type IS DISTINCT FROM (CASE WHEN loan.record_kind = 'lent' THEN 'income' ELSE 'expense' END) OR movement.is_transfer THEN
    RAISE EXCEPTION 'This transaction is not a payment for this loan';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) OR p_amount >= 10000000000 THEN RAISE EXCEPTION 'Enter a valid payment amount'; END IF;
  IF p_date IS NULL OR p_date < loan.lent_date THEN RAISE EXCEPTION 'Payment date cannot be before the loan start date'; END IF;
  new_repaid := loan.repaid - movement.amount + p_amount;
  IF new_repaid < 0 OR new_repaid > loan.amount THEN RAISE EXCEPTION 'The payment amount exceeds the loan balance or the payment history is incomplete'; END IF;
  -- The link protection trigger blocks direct edits; temporarily remove and restore this
  -- verified link within the same transaction, so no other request can observe a gap.
  IF link_id IS NOT NULL THEN DELETE FROM public.loan_existing_movements WHERE id = link_id AND user_id = uid; END IF;
  UPDATE public.expenses SET amount = p_amount, entry_date = p_date, account = p_account, payment_method = trim(p_payment_method)
    WHERE id = movement.id AND user_id = uid RETURNING * INTO movement;
  IF link_id IS NOT NULL THEN INSERT INTO public.loan_existing_movements(id, user_id, loan_id, expense_id) VALUES (link_id, uid, loan.id, movement.id); END IF;
  UPDATE public.loans_and_dues SET repaid = new_repaid WHERE id = loan.id AND user_id = uid RETURNING * INTO loan;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', to_jsonb(movement));
END;
$$;
REVOKE ALL ON FUNCTION public.edit_loan_payment(uuid, uuid, numeric, numeric, date, text, text, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_loan_payment(uuid, uuid, numeric, numeric, date, text, text, numeric, date, text, text) TO authenticated;
