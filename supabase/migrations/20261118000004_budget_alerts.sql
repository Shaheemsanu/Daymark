-- Create alerts when an expense crosses a current target.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';

CREATE OR REPLACE FUNCTION public.create_budget_alerts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  cfg public.budget_configs%ROWTYPE;
  today date;
  zone_name text;
  period_start date;
  target numeric;
  total numeric;
  previous_total numeric;
  new_amount numeric;
  old_amount numeric;
  period_name text;
BEGIN
  SELECT * INTO cfg FROM public.budget_configs WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT timezone INTO zone_name FROM public.reminder_preferences WHERE user_id = NEW.user_id;
  BEGIN
    today := (now() AT TIME ZONE coalesce(zone_name, 'Asia/Kolkata'))::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    today := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  END;
  FOREACH period_name IN ARRAY ARRAY['daily', 'weekly', 'monthly'] LOOP
    period_start := CASE period_name WHEN 'daily' THEN today WHEN 'weekly' THEN today - 6 ELSE date_trunc('month', today)::date END;
    target := CASE period_name WHEN 'daily' THEN cfg.daily_budget WHEN 'weekly' THEN cfg.weekly_budget ELSE cfg.monthly_budget END;
    IF target IS NULL OR target <= 0 THEN CONTINUE; END IF;
    SELECT coalesce(sum(amount), 0) INTO total FROM public.expenses
      WHERE user_id = NEW.user_id AND entry_date BETWEEN period_start AND today
        AND coalesce(account, 'expense') = 'expense' AND transaction_type = 'expense'
        AND NOT coalesce(is_transfer, false);
    new_amount := CASE WHEN NEW.entry_date BETWEEN period_start AND today AND coalesce(NEW.account, 'expense') = 'expense'
      AND NEW.transaction_type = 'expense' AND NOT coalesce(NEW.is_transfer, false) THEN NEW.amount ELSE 0 END;
    old_amount := 0;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.user_id = NEW.user_id AND OLD.entry_date BETWEEN period_start AND today AND coalesce(OLD.account, 'expense') = 'expense'
         AND OLD.transaction_type = 'expense' AND NOT coalesce(OLD.is_transfer, false) THEN old_amount := OLD.amount; END IF;
    END IF;
    previous_total := total - new_amount + old_amount;
    IF total > target AND previous_total <= target THEN
      INSERT INTO public.notifications (user_id, title, body, view, kind)
      VALUES (NEW.user_id, initcap(period_name) || ' budget exceeded',
        'Expense account spending is ' || cfg.currency || to_char(total, 'FM999999999999990.00') ||
        ', above your ' || period_name || ' target of ' || cfg.currency || to_char(target, 'FM999999999999990.00') || '.',
        'expenses', 'budget_alert');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expense_budget_alerts ON public.expenses;
CREATE TRIGGER expense_budget_alerts AFTER INSERT OR UPDATE OF amount, entry_date, account, transaction_type, is_transfer
ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.create_budget_alerts();
