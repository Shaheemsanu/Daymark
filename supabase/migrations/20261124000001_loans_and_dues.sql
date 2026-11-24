CREATE TABLE IF NOT EXISTS public.loans_and_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person TEXT NOT NULL CHECK (length(trim(person)) BETWEEN 1 AND 120),
  record_kind TEXT NOT NULL DEFAULT 'lent' CHECK (record_kind IN ('lent', 'borrowed', 'emi')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  repaid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (repaid >= 0 AND repaid <= amount),
  installment_amount NUMERIC(12,2) CHECK (installment_amount IS NULL OR installment_amount > 0),
  lent_date DATE NOT NULL,
  end_date DATE CHECK (end_date IS NULL OR end_date >= lent_date),
  payment_day SMALLINT CHECK (payment_day IS NULL OR payment_day BETWEEN 1 AND 31),
  due_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loans_and_dues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can select own loans and dues" ON public.loans_and_dues;
DROP POLICY IF EXISTS "Users can insert own loans and dues" ON public.loans_and_dues;
DROP POLICY IF EXISTS "Users can update own loans and dues" ON public.loans_and_dues;
DROP POLICY IF EXISTS "Users can delete own loans and dues" ON public.loans_and_dues;
CREATE POLICY "Users can select own loans and dues" ON public.loans_and_dues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loans and dues" ON public.loans_and_dues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans and dues" ON public.loans_and_dues FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans and dues" ON public.loans_and_dues FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_loans_and_dues_user_date ON public.loans_and_dues(user_id, lent_date DESC);

-- Create each loan movement and its ledger entry in the same database transaction.
CREATE OR REPLACE FUNCTION public.save_loan_with_movement(p_loan jsonb, p_account text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
  kind text := p_loan->>'record_kind';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to save a loan'; END IF;
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
  IF p_account IS NOT NULL THEN
    INSERT INTO public.expenses (user_id, entry_date, title, amount, category, spend_type, transaction_type, account, is_transfer, payment_method, notes)
    VALUES (uid, loan.lent_date, CASE WHEN kind = 'lent' THEN 'Money lent to ' WHEN kind = 'emi' THEN 'Loan received from ' ELSE 'Money borrowed from ' END || loan.person,
      CASE WHEN kind = 'emi' THEN (p_loan->>'initial_received')::numeric ELSE loan.amount END, CASE kind WHEN 'lent' THEN 'Loan: Money lent' WHEN 'borrowed' THEN 'Loan: Money borrowed' ELSE 'Loan: EMI / loan' END, 'need', CASE WHEN kind = 'lent' THEN 'expense' ELSE 'income' END,
      p_account, false, CASE WHEN p_account = 'cash' THEN 'Cash' ELSE 'Bank Transfer' END, 'Loan record: ' || loan.id::text)
    RETURNING * INTO movement;
  END IF;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', CASE WHEN p_account IS NULL THEN NULL ELSE to_jsonb(movement) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_loan_payment(p_id uuid, p_expected_repaid numeric, p_amount numeric, p_date date, p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to record a payment'; END IF;
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
    p_account, false, CASE WHEN p_account = 'cash' THEN 'Cash' ELSE 'Bank Transfer' END, 'Loan record: ' || loan.id::text)
  RETURNING * INTO movement;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', to_jsonb(movement));
END;
$$;
REVOKE ALL ON FUNCTION public.save_loan_with_movement(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_loan_payment(uuid, numeric, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_loan_with_movement(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, numeric, date, text) TO authenticated;
