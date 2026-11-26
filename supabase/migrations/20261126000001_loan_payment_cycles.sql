ALTER TABLE public.loans_and_dues ADD COLUMN payment_cycle text NOT NULL DEFAULT 'monthly' CHECK (payment_cycle IN ('daily','weekly','monthly','custom'));
ALTER TABLE public.loans_and_dues ADD COLUMN payment_interval_days integer CHECK ((payment_cycle = 'custom' AND payment_interval_days IS NOT NULL AND payment_interval_days BETWEEN 1 AND 36500) OR (payment_cycle <> 'custom' AND payment_interval_days IS NULL));

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
  INSERT INTO public.loans_and_dues (user_id, person, record_kind, amount, lent_date, due_date, end_date, payment_day, installment_amount, note, payment_cycle, payment_interval_days)
  VALUES (uid, p_loan->>'person', kind, (p_loan->>'amount')::numeric, (p_loan->>'lent_date')::date,
    NULLIF(p_loan->>'due_date', '')::date, NULLIF(p_loan->>'end_date', '')::date,
    NULLIF(p_loan->>'payment_day', '')::smallint, NULLIF(p_loan->>'installment_amount', '')::numeric, NULLIF(p_loan->>'note', ''), COALESCE(p_loan->>'payment_cycle','monthly'), NULLIF(p_loan->>'payment_interval_days','')::integer)
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
     to_jsonb(loan)->>'payment_cycle' IS DISTINCT FROM COALESCE(p_expected->>'payment_cycle', 'monthly') OR to_jsonb(loan)->'payment_interval_days' IS DISTINCT FROM COALESCE(p_expected->'payment_interval_days', 'null'::jsonb) OR to_jsonb(loan)->'payment_day' IS DISTINCT FROM p_expected->'payment_day' OR to_jsonb(loan)->'installment_amount' IS DISTINCT FROM p_expected->'installment_amount' OR
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
    payment_cycle = COALESCE(p_changes->>'payment_cycle','monthly'), payment_interval_days = NULLIF(p_changes->>'payment_interval_days','')::integer, payment_day = NULLIF(p_changes->>'payment_day','')::smallint, installment_amount = NULLIF(p_changes->>'installment_amount','')::numeric,
    note = NULLIF(trim(p_changes->>'note'),'') WHERE id = loan.id AND user_id = uid RETURNING * INTO loan;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', CASE WHEN original_count = 1 THEN to_jsonb(movement) ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.edit_loan_details(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_loan_details(uuid, jsonb, jsonb, jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.assign_loan_payment_installment(p_loan_id uuid, p_expense_id uuid, p_installment_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); loan public.loans_and_dues%ROWTYPE; movement public.expenses%ROWTYPE; expected date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to assign an installment'; END IF;
  SELECT * INTO loan FROM public.loans_and_dues WHERE id = p_loan_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR loan.record_kind <> 'emi' THEN RAISE EXCEPTION 'EMI loan not found'; END IF;
  SELECT * INTO movement FROM public.expenses WHERE id = p_expense_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR movement.transaction_type IS DISTINCT FROM 'expense' OR COALESCE(movement.is_transfer, false) OR NOT COALESCE((
    (movement.notes = 'Loan record: ' || loan.id::text AND movement.category IN ('Loan funds movement','Loan: Money lent','Loan: Money borrowed','Loan: EMI / loan')) OR
    EXISTS (SELECT 1 FROM public.loan_existing_movements WHERE user_id = uid AND loan_id = loan.id AND expense_id = movement.id)
  ), false) THEN RAISE EXCEPTION 'Payment not found for this loan'; END IF;
  IF p_installment_date IS NULL THEN
    DELETE FROM public.loan_payment_installments WHERE expense_id = p_expense_id AND user_id = uid;
    RETURN;
  END IF;
  IF loan.payment_cycle = 'monthly' THEN
    IF loan.payment_day IS NULL THEN RAISE EXCEPTION 'Set a monthly payment day first'; END IF;
    expected := date_trunc('month', p_installment_date)::date + LEAST(loan.payment_day::int, EXTRACT(day FROM (date_trunc('month', p_installment_date) + interval '1 month - 1 day'))::int) - 1;
  ELSE
    expected := CASE WHEN p_installment_date >= loan.lent_date AND (p_installment_date - loan.lent_date) % (CASE loan.payment_cycle WHEN 'daily' THEN 1 WHEN 'weekly' THEN 7 ELSE loan.payment_interval_days END) = 0 THEN p_installment_date ELSE NULL END;
  END IF;
  IF expected IS DISTINCT FROM p_installment_date OR p_installment_date < loan.lent_date OR (loan.end_date IS NOT NULL AND p_installment_date > loan.end_date) THEN
    RAISE EXCEPTION 'Choose a scheduled installment within the loan period';
  END IF;
  INSERT INTO public.loan_payment_installments(expense_id,loan_id,user_id,installment_date)
    VALUES (movement.id,loan.id,uid,p_installment_date)
    ON CONFLICT (expense_id) DO UPDATE SET installment_date = EXCLUDED.installment_date WHERE loan_payment_installments.user_id = uid AND loan_payment_installments.loan_id = loan.id;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_loan_payment_installment(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_loan_payment_installment(uuid,uuid,date) TO authenticated;

