-- Save payment methods on new loan ledger movements. Requires the loan ledger matching migration.

CREATE OR REPLACE FUNCTION public.save_loan_with_movement(p_loan jsonb, p_account text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
  kind text := p_loan->>'record_kind';
  existing_id uuid := NULLIF(p_loan->>'existing_expense_id', '')::uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to save a loan'; END IF;
  IF length(COALESCE(p_loan->>'payment_method', '')) > 120 THEN RAISE EXCEPTION 'Payment method is too long'; END IF;
  IF existing_id IS NOT NULL AND p_account IS NULL THEN RAISE EXCEPTION 'Select the account for the existing transaction'; END IF;
  IF p_account IS NOT NULL THEN
    IF p_account NOT IN ('expense', 'cash', 'savings') OR
       (p_account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR
       (p_account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN
      RAISE EXCEPTION 'This account is not enabled';
    END IF;
    IF kind = 'emi' AND (NULLIF(p_loan->>'initial_received', '') IS NULL OR (p_loan->>'initial_received')::numeric <= 0 OR (p_loan->>'initial_received')::numeric <> round((p_loan->>'initial_received')::numeric, 2)) THEN RAISE EXCEPTION 'Enter a valid amount received'; END IF;
  END IF;
  INSERT INTO public.loans_and_dues (user_id, person, record_kind, amount, lent_date, due_date, end_date, payment_day, installment_amount, note)
  VALUES (uid, p_loan->>'person', kind, (p_loan->>'amount')::numeric, (p_loan->>'lent_date')::date,
    NULLIF(p_loan->>'due_date', '')::date, NULLIF(p_loan->>'end_date', '')::date,
    NULLIF(p_loan->>'payment_day', '')::smallint, NULLIF(p_loan->>'installment_amount', '')::numeric, NULLIF(p_loan->>'note', ''))
  RETURNING * INTO loan;
  IF existing_id IS NOT NULL THEN
    SELECT * INTO movement FROM public.expenses WHERE id = existing_id AND user_id = uid FOR UPDATE;
    IF NOT FOUND OR movement.entry_date IS DISTINCT FROM loan.lent_date OR movement.amount IS DISTINCT FROM (CASE WHEN kind = 'emi' THEN (p_loan->>'initial_received')::numeric ELSE loan.amount END)
      OR COALESCE(movement.account, 'expense') IS DISTINCT FROM p_account OR COALESCE(movement.transaction_type, 'expense') IS DISTINCT FROM (CASE WHEN kind = 'lent' THEN 'expense' ELSE 'income' END)
      OR COALESCE(movement.is_transfer, false) OR lower(movement.category) LIKE '%transfer%'
      OR movement.category IN ('Loan funds movement', 'Loan: Money lent', 'Loan: Money borrowed', 'Loan: EMI / loan') THEN
      RAISE EXCEPTION 'The selected transaction no longer matches. Refresh and try again.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.loan_existing_movements WHERE expense_id = existing_id) THEN RAISE EXCEPTION 'This transaction is already linked to a loan.'; END IF;
    INSERT INTO public.loan_existing_movements(user_id, loan_id, expense_id) VALUES (uid, loan.id, existing_id);
  ELSIF p_account IS NOT NULL THEN
    INSERT INTO public.expenses (user_id, entry_date, title, amount, category, spend_type, transaction_type, account, is_transfer, payment_method, notes)
    VALUES (uid, loan.lent_date, CASE WHEN kind = 'lent' THEN 'Money lent to ' WHEN kind = 'emi' THEN 'Loan received from ' ELSE 'Money borrowed from ' END || loan.person,
      CASE WHEN kind = 'emi' THEN (p_loan->>'initial_received')::numeric ELSE loan.amount END, CASE kind WHEN 'lent' THEN 'Loan: Money lent' WHEN 'borrowed' THEN 'Loan: Money borrowed' ELSE 'Loan: EMI / loan' END, 'need', CASE WHEN kind = 'lent' THEN 'expense' ELSE 'income' END,
      p_account, false, COALESCE(NULLIF(trim(p_loan->>'payment_method'), ''), CASE WHEN p_account = 'cash' THEN 'Cash' ELSE 'Bank Transfer' END), 'Loan record: ' || loan.id::text)
    RETURNING * INTO movement;
  END IF;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', CASE WHEN p_account IS NULL OR existing_id IS NOT NULL THEN NULL ELSE to_jsonb(movement) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_loan_payment_with_method(p_id uuid, p_expected_repaid numeric, p_amount numeric, p_date date, p_account text, p_payment_method text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to record a payment'; END IF;
  IF length(COALESCE(p_payment_method, '')) > 120 THEN RAISE EXCEPTION 'Payment method is too long'; END IF;
  IF p_account IS NULL OR p_account NOT IN ('expense', 'cash', 'savings') OR
     (p_account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR
     (p_account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN
    RAISE EXCEPTION 'This account is not enabled';
  END IF;
  SELECT * INTO loan FROM public.loans_and_dues WHERE id = p_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR loan.repaid IS DISTINCT FROM p_expected_repaid THEN RAISE EXCEPTION 'This record changed elsewhere. Refresh and try again.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) OR p_amount > loan.amount - loan.repaid THEN RAISE EXCEPTION 'Invalid payment amount'; END IF;
  IF p_date IS NULL OR p_date < loan.lent_date THEN RAISE EXCEPTION 'Payment date cannot be before the loan start date'; END IF;
  UPDATE public.loans_and_dues SET repaid = repaid + p_amount WHERE id = p_id AND user_id = uid RETURNING * INTO loan;
  INSERT INTO public.expenses (user_id, entry_date, title, amount, category, spend_type, transaction_type, account, is_transfer, payment_method, notes)
  VALUES (uid, p_date, CASE WHEN loan.record_kind = 'lent' THEN 'Loan repayment from ' ELSE 'Loan payment to ' END || loan.person,
    p_amount, CASE loan.record_kind WHEN 'lent' THEN 'Loan: Money lent' WHEN 'borrowed' THEN 'Loan: Money borrowed' ELSE 'Loan: EMI / loan' END, 'need', CASE WHEN loan.record_kind = 'lent' THEN 'income' ELSE 'expense' END,
    p_account, false, COALESCE(NULLIF(trim(p_payment_method), ''), CASE WHEN p_account = 'cash' THEN 'Cash' ELSE 'Bank Transfer' END), 'Loan record: ' || loan.id::text)
  RETURNING * INTO movement;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', to_jsonb(movement));
END;
$$;
REVOKE ALL ON FUNCTION public.record_loan_payment_with_method(uuid, numeric, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_loan_payment_with_method(uuid, numeric, numeric, date, text, text) TO authenticated;
