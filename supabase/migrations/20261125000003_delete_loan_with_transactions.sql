-- Delete a loan and its associated ledger movements in one transaction.
CREATE OR REPLACE FUNCTION public.delete_loan_with_transactions(p_loan_id uuid, p_expected_amount numeric, p_expected_repaid numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  loan public.loans_and_dues%ROWTYPE;
  movement public.expenses%ROWTYPE;
  movement_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to delete a loan'; END IF;
  SELECT * INTO loan FROM public.loans_and_dues WHERE id = p_loan_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR loan.amount IS DISTINCT FROM p_expected_amount OR loan.repaid IS DISTINCT FROM p_expected_repaid THEN
    RAISE EXCEPTION 'This loan changed elsewhere. Refresh and try again.';
  END IF;
  FOR movement IN
    SELECT e.* FROM public.expenses e
    WHERE e.user_id = uid AND (
      (e.notes = 'Loan record: ' || loan.id::text AND e.category IN ('Loan funds movement', 'Loan: Money lent', 'Loan: Money borrowed', 'Loan: EMI / loan'))
      OR EXISTS (SELECT 1 FROM public.loan_existing_movements l WHERE l.user_id = uid AND l.loan_id = loan.id AND l.expense_id = e.id)
    ) ORDER BY e.id FOR UPDATE OF e
  LOOP
    IF (movement.account = 'cash' AND NOT COALESCE((SELECT cash_enabled FROM public.account_permissions WHERE user_id = uid), false)) OR
       (movement.account = 'savings' AND NOT COALESCE((SELECT savings_enabled FROM public.account_permissions WHERE user_id = uid), false)) THEN
      RAISE EXCEPTION 'Enable all accounts used by this loan before deleting it.';
    END IF;
    movement_ids := array_append(movement_ids, movement.id);
  END LOOP;
  DELETE FROM public.loan_existing_movements WHERE user_id = uid AND loan_id = loan.id;
  DELETE FROM public.expenses WHERE user_id = uid AND id = ANY(movement_ids);
  DELETE FROM public.loans_and_dues WHERE id = loan.id AND user_id = uid;
  RETURN jsonb_build_object('deleted_transaction_ids', to_jsonb(movement_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.delete_loan_with_transactions(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_loan_with_transactions(uuid, numeric, numeric) TO authenticated;
