-- Associate EMI repayments with the installment they cover. Deleting the payment
-- or loan removes its association automatically.
CREATE TABLE public.loan_payment_installments (
  expense_id uuid PRIMARY KEY REFERENCES public.expenses(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans_and_dues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installment_date date NOT NULL
);
ALTER TABLE public.loan_payment_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their installment assignments" ON public.loan_payment_installments FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.loan_payment_installments TO authenticated;

CREATE FUNCTION public.assign_loan_payment_installment(p_loan_id uuid, p_expense_id uuid, p_installment_date date)
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
  IF loan.payment_day IS NULL THEN RAISE EXCEPTION 'Set a monthly payment day first'; END IF;
  expected := date_trunc('month', p_installment_date)::date + LEAST(loan.payment_day::int, EXTRACT(day FROM (date_trunc('month', p_installment_date) + interval '1 month - 1 day'))::int) - 1;
  IF p_installment_date <> expected OR p_installment_date < loan.lent_date OR (loan.end_date IS NOT NULL AND p_installment_date > loan.end_date) THEN
    RAISE EXCEPTION 'Choose a scheduled installment within the loan period';
  END IF;
  INSERT INTO public.loan_payment_installments(expense_id,loan_id,user_id,installment_date)
    VALUES (movement.id,loan.id,uid,p_installment_date)
    ON CONFLICT (expense_id) DO UPDATE SET installment_date = EXCLUDED.installment_date WHERE loan_payment_installments.user_id = uid AND loan_payment_installments.loan_id = loan.id;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_loan_payment_installment(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_loan_payment_installment(uuid,uuid,date) TO authenticated;

CREATE FUNCTION public.record_emi_payment_for_installment(p_id uuid, p_expected_repaid numeric, p_amount numeric, p_date date, p_account text, p_payment_method text, p_expense_id uuid, p_installment_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF p_installment_date IS NULL THEN RAISE EXCEPTION 'Choose an installment date'; END IF;
  IF p_expense_id IS NULL THEN
    result := public.record_loan_payment_with_method(p_id,p_expected_repaid,p_amount,p_date,p_account,p_payment_method);
  ELSE
    result := public.link_existing_loan_payment(p_id,p_expected_repaid,p_amount,p_date,p_account,p_expense_id);
  END IF;
  PERFORM public.assign_loan_payment_installment(p_id,COALESCE(p_expense_id,(result->'transaction'->>'id')::uuid),p_installment_date);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.record_emi_payment_for_installment(uuid,numeric,numeric,date,text,text,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_emi_payment_for_installment(uuid,numeric,numeric,date,text,text,uuid,date) TO authenticated;
