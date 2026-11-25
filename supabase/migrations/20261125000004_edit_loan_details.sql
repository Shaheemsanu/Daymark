-- Update loan details and the original ledger movement atomically.
CREATE OR REPLACE FUNCTION public.edit_loan_details(p_id uuid, p_expected jsonb, p_changes jsonb, p_original jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
  candidate public.expenses%ROWTYPE;
  link_id uuid;
  original_count integer := 0;
  new_amount numeric := (p_changes->>'amount')::numeric;
  new_date date := (p_changes->>'lent_date')::date;
  original_amount numeric;
  new_account text;
  new_method text;
  payment_total numeric;
  first_payment date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to edit a loan'; END IF;
  SELECT * INTO loan FROM public.loans_and_dues WHERE id = p_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR to_jsonb(loan)->'amount' IS DISTINCT FROM p_expected->'amount' OR to_jsonb(loan)->'repaid' IS DISTINCT FROM p_expected->'repaid' OR
     to_jsonb(loan)->>'lent_date' IS DISTINCT FROM p_expected->>'lent_date' OR to_jsonb(loan)->>'person' IS DISTINCT FROM p_expected->>'person' OR
     to_jsonb(loan)->>'due_date' IS DISTINCT FROM p_expected->>'due_date' OR to_jsonb(loan)->>'end_date' IS DISTINCT FROM p_expected->>'end_date' OR
     to_jsonb(loan)->'payment_day' IS DISTINCT FROM p_expected->'payment_day' OR to_jsonb(loan)->'installment_amount' IS DISTINCT FROM p_expected->'installment_amount' OR
     to_jsonb(loan)->>'note' IS DISTINCT FROM p_expected->>'note' THEN RAISE EXCEPTION 'This loan changed elsewhere. Refresh and try again.'; END IF;
  IF new_amount IS NULL OR new_amount <= 0 OR new_amount >= 10000000000 OR new_amount <> round(new_amount, 2) OR new_amount < loan.repaid OR new_date IS NULL THEN RAISE EXCEPTION 'Enter a valid total no less than payments already recorded.'; END IF;
  IF NULLIF(trim(p_changes->>'person'), '') IS NULL OR length(trim(p_changes->>'person')) > 120 THEN RAISE EXCEPTION 'Enter a valid name.'; END IF;
  IF NULLIF(p_changes->>'due_date','')::date < new_date OR NULLIF(p_changes->>'end_date','')::date < new_date THEN RAISE EXCEPTION 'The due or end date cannot be before the start date.'; END IF;
  SELECT COALESCE(sum(e.amount), 0), min(e.entry_date) INTO payment_total, first_payment FROM public.expenses e
  WHERE e.user_id = uid AND e.transaction_type = CASE WHEN loan.record_kind = 'lent' THEN 'income' ELSE 'expense' END AND NOT e.is_transfer AND
    ((e.notes = 'Loan record: ' || loan.id::text AND e.category IN ('Loan funds movement','Loan: Money lent','Loan: Money borrowed','Loan: EMI / loan')) OR
    EXISTS (SELECT 1 FROM public.loan_existing_movements l WHERE l.loan_id = loan.id AND l.user_id = uid AND l.expense_id = e.id));
  IF new_date IS DISTINCT FROM loan.lent_date AND (payment_total < loan.repaid OR first_payment < new_date) THEN RAISE EXCEPTION 'The start date cannot be changed past an existing payment or while payment details are incomplete.'; END IF;
  FOR candidate IN SELECT e.* FROM public.expenses e WHERE e.user_id = uid AND e.transaction_type = CASE WHEN loan.record_kind = 'lent' THEN 'expense' ELSE 'income' END AND NOT e.is_transfer AND
    ((e.notes = 'Loan record: ' || loan.id::text AND e.category IN ('Loan funds movement','Loan: Money lent','Loan: Money borrowed','Loan: EMI / loan')) OR
    EXISTS (SELECT 1 FROM public.loan_existing_movements l WHERE l.loan_id = loan.id AND l.user_id = uid AND l.expense_id = e.id)) ORDER BY e.id FOR UPDATE OF e
  LOOP original_count := original_count + 1; movement := candidate; END LOOP;
  IF original_count > 1 THEN RAISE EXCEPTION 'More than one original transaction was found. Contact support before editing.'; END IF;
  IF original_count = 0 AND p_original IS NOT NULL AND p_original <> 'null'::jsonb THEN RAISE EXCEPTION 'The original transaction changed. Refresh and try again.'; END IF;
  IF original_count = 1 THEN
    IF p_original IS NULL OR p_original = 'null'::jsonb OR movement.id::text IS DISTINCT FROM p_original->>'id' OR movement.amount IS DISTINCT FROM (p_original->>'expected_amount')::numeric OR movement.entry_date IS DISTINCT FROM (p_original->>'expected_date')::date OR movement.account IS DISTINCT FROM p_original->>'expected_account' OR movement.payment_method IS DISTINCT FROM p_original->>'expected_method' THEN RAISE EXCEPTION 'The original transaction changed. Refresh and try again.'; END IF;
    new_account := p_original->>'account'; new_method := trim(p_original->>'payment_method');
    original_amount := CASE WHEN loan.record_kind = 'emi' THEN (p_original->>'amount')::numeric ELSE new_amount END;
    IF original_amount IS NULL OR original_amount <= 0 OR original_amount >= 10000000000 OR original_amount <> round(original_amount, 2) THEN RAISE EXCEPTION 'Enter a valid amount received.'; END IF;
    IF new_account IS NULL OR new_account NOT IN ('expense','cash','savings') OR (new_account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR (new_account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR (movement.account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR (movement.account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN RAISE EXCEPTION 'An account used by this transaction is not enabled.'; END IF;
    IF new_method IS NULL OR length(new_method) = 0 OR length(new_method) > 120 OR (new_account = 'cash' AND new_method <> 'Cash') THEN RAISE EXCEPTION 'Select a valid payment method.'; END IF;
    SELECT id INTO link_id FROM public.loan_existing_movements WHERE user_id = uid AND loan_id = loan.id AND expense_id = movement.id;
    IF link_id IS NOT NULL THEN DELETE FROM public.loan_existing_movements WHERE id = link_id AND user_id = uid; END IF;
    UPDATE public.expenses SET amount = original_amount, entry_date = new_date, account = new_account, payment_method = new_method,
      title = CASE WHEN link_id IS NULL THEN (CASE WHEN loan.record_kind = 'lent' THEN 'Money lent to ' WHEN loan.record_kind = 'emi' THEN 'Loan received from ' ELSE 'Money borrowed from ' END) || trim(p_changes->>'person') ELSE title END
      WHERE id = movement.id AND user_id = uid RETURNING * INTO movement;
    IF link_id IS NOT NULL THEN INSERT INTO public.loan_existing_movements(id,user_id,loan_id,expense_id) VALUES (link_id,uid,loan.id,movement.id); END IF;
  END IF;
  UPDATE public.loans_and_dues SET person = trim(p_changes->>'person'), amount = new_amount, lent_date = new_date,
    due_date = NULLIF(p_changes->>'due_date','')::date, end_date = NULLIF(p_changes->>'end_date','')::date,
    payment_day = NULLIF(p_changes->>'payment_day','')::smallint, installment_amount = NULLIF(p_changes->>'installment_amount','')::numeric,
    note = NULLIF(trim(p_changes->>'note'),'') WHERE id = loan.id AND user_id = uid RETURNING * INTO loan;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', CASE WHEN original_count = 1 THEN to_jsonb(movement) ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.edit_loan_details(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_loan_details(uuid, jsonb, jsonb, jsonb) TO authenticated;
