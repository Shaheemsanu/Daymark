-- ==============================================================================
-- Daymark — Daily Todo & Habit Tracker Database Schema
-- Supabase PostgreSQL Schema with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 2. Recurring Tasks Definition Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  weekdays INTEGER[] DEFAULT '{0,1,2,3,4,5,6}' NOT NULL, -- 0=Sun, 1=Mon, ..., 6=Sat
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  time_estimate_min INTEGER DEFAULT 30,
  start_time TIME,
  end_time TIME,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time TIME;

CREATE POLICY "Users can select own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);

-- ------------------------------------------------------------------------------
-- 3. Daily Task Entries Table (Independent per Date)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'skipped')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_task_date UNIQUE (user_id, task_id, entry_date)
);

ALTER TABLE public.task_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own task entries"
  ON public.task_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task entries"
  ON public.task_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task entries"
  ON public.task_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task entries"
  ON public.task_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_entries_user_date ON public.task_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_task_entries_task_id ON public.task_entries(task_id);

-- ------------------------------------------------------------------------------
-- 4. Custom Trackers & Habits Definition
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean')),
  unit TEXT, -- e.g. 'ml', 'hours', 'pages', 'mins'
  target_value NUMERIC DEFAULT 1,
  weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time TIME,
  end_time TIME,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.custom_trackers
  ADD COLUMN IF NOT EXISTS weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';

ALTER TABLE public.custom_trackers ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.custom_trackers ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE public.custom_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own custom trackers"
  ON public.custom_trackers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom trackers"
  ON public.custom_trackers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom trackers"
  ON public.custom_trackers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom trackers"
  ON public.custom_trackers FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_custom_trackers_user_id ON public.custom_trackers(user_id);

-- ------------------------------------------------------------------------------
-- 5. Tracker Entries (Per Date)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id UUID REFERENCES public.custom_trackers(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  numeric_value NUMERIC,
  boolean_value BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_tracker_date UNIQUE (user_id, tracker_id, entry_date)
);

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own tracker entries"
  ON public.tracker_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracker entries"
  ON public.tracker_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracker entries"
  ON public.tracker_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracker entries"
  ON public.tracker_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tracker_entries_user_date ON public.tracker_entries(user_id, entry_date);

-- ------------------------------------------------------------------------------
-- 6. Daily Notes & Reflections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  mood TEXT,
  gratitude TEXT,
  sleep_hours NUMERIC,
  water_ml NUMERIC,
  energy_score INTEGER CHECK (energy_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_note_date UNIQUE (user_id, entry_date)
);

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own notes"
  ON public.daily_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.daily_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.daily_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.daily_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_notes_user_date ON public.daily_notes(user_id, entry_date);

-- ------------------------------------------------------------------------------
-- 6b. Titled Notes (separate from one-per-day wellness notes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  image_url TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own titled notes"
  ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own titled notes"
  ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own titled notes"
  ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own titled notes"
  ON public.notes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON public.notes(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. Expenses Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  spend_type TEXT NOT NULL DEFAULT 'need' CHECK (spend_type IN ('need', 'want', 'savings')),
  transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'income')),
  account TEXT NOT NULL DEFAULT 'expense' CHECK (account IN ('expense', 'savings', 'cash')),
  is_transfer BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT DEFAULT 'Credit Card',
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(user_id, category);

-- ------------------------------------------------------------------------------
-- 8. Budget Configurations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  monthly_budget NUMERIC(12,2) DEFAULT 3200.00 NOT NULL,
  daily_budget NUMERIC(12,2) DEFAULT 1000.00 NOT NULL,
  weekly_budget NUMERIC(12,2) DEFAULT 7000.00 NOT NULL,
  currency TEXT DEFAULT '$' NOT NULL,
  category_budgets JSONB DEFAULT '{}'::jsonb NOT NULL,
  custom_categories JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.budget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own budget"
  ON public.budget_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own budget"
  ON public.budget_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Firebase Messaging device registrations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

CREATE POLICY "Users can read their own push tokens" ON public.push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own push tokens" ON public.push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own push tokens" ON public.push_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own push tokens" ON public.push_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Notification history
-- ------------------------------------------------------------------------------
-- Notification history is created by trusted server processes.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  view TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY "Users can read their notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can mark their notifications read" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Reminder scheduling
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminder_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminder_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_preferences TO authenticated;
CREATE POLICY "Users manage their reminder preferences" ON public.reminder_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Kept separately from notification history so clearing the bell cannot re-send a reminder.
CREATE TABLE IF NOT EXISTS public.reminder_runs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (user_id, reminder_date, kind)
);
ALTER TABLE public.reminder_runs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Budget alerts
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- Trigger for automatic user profile creation on signup
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.budget_configs (user_id, monthly_budget, daily_budget, weekly_budget, currency, category_budgets)
  VALUES (
    NEW.id,
    30000.00,
    1000.00,
    7000.00,
    '₹',
    '{"Housing": 1200, "Groceries": 450, "Food & Dining": 300, "Transportation": 200, "Utilities": 220, "Health & Fitness": 140, "Entertainment": 180, "Shopping": 200, "Subscriptions": 60, "Personal Care": 80, "Education": 100, "Other": 70}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Administrators control can_select_accounts; users may update only the two
-- account switches, and only while account selection is allowed.
CREATE TABLE IF NOT EXISTS public.account_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_select_accounts boolean NOT NULL DEFAULT false,
  cash_enabled boolean NOT NULL DEFAULT false,
  savings_enabled boolean NOT NULL DEFAULT false,
  habits_enabled boolean NOT NULL DEFAULT false,
  tasks_enabled boolean NOT NULL DEFAULT false,
  notes_enabled boolean NOT NULL DEFAULT false,
  analytics_enabled boolean NOT NULL DEFAULT false,
  account_intelligence_enabled boolean NOT NULL DEFAULT false,
  ai_enabled boolean NOT NULL DEFAULT false,
  wellness_enabled boolean NOT NULL DEFAULT false
);

ALTER TABLE public.account_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_permissions TO authenticated;
GRANT UPDATE (cash_enabled, savings_enabled) ON public.account_permissions TO authenticated;
DROP POLICY IF EXISTS account_permissions_read_own ON public.account_permissions;
CREATE POLICY account_permissions_read_own ON public.account_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS account_permissions_update_own ON public.account_permissions;
CREATE POLICY account_permissions_update_own ON public.account_permissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND can_select_accounts)
  WITH CHECK (auth.uid() = user_id AND can_select_accounts);

INSERT INTO public.account_permissions (user_id)
SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_account_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.account_permissions (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_account_permissions() FROM PUBLIC;
DROP TRIGGER IF EXISTS create_account_permissions_for_user ON auth.users;
CREATE TRIGGER create_account_permissions_for_user AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_account_permissions();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'account_permissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.account_permissions;
  END IF;
END $$;


-- Feature access is managed by administrators; existing and new users default off.
ALTER TABLE public.account_permissions
  ADD COLUMN IF NOT EXISTS habits_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tasks_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false;

-- Only cash_enabled and savings_enabled remain user-updatable.
REVOKE UPDATE (habits_enabled, tasks_enabled, notes_enabled, analytics_enabled, ai_enabled)
  ON public.account_permissions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.account_permissions
  ADD COLUMN IF NOT EXISTS wellness_enabled boolean NOT NULL DEFAULT false;
REVOKE UPDATE (wellness_enabled) ON public.account_permissions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.account_permissions
  ADD COLUMN IF NOT EXISTS account_intelligence_enabled boolean NOT NULL DEFAULT false;
REVOKE UPDATE (account_intelligence_enabled) ON public.account_permissions FROM PUBLIC, anon, authenticated;

-- Analytics always includes account intelligence.
CREATE OR REPLACE FUNCTION public.enable_account_intelligence_for_analytics()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.analytics_enabled THEN
    NEW.account_intelligence_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enable_account_intelligence_for_analytics() FROM PUBLIC;
DROP TRIGGER IF EXISTS account_intelligence_follows_analytics ON public.account_permissions;
CREATE TRIGGER account_intelligence_follows_analytics
  BEFORE INSERT OR UPDATE ON public.account_permissions
  FOR EACH ROW EXECUTE FUNCTION public.enable_account_intelligence_for_analytics();

UPDATE public.account_permissions SET account_intelligence_enabled = true
WHERE analytics_enabled AND NOT account_intelligence_enabled;

-- User details in the permissions table follow Supabase Auth.
ALTER TABLE public.account_permissions
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text;

INSERT INTO public.account_permissions (user_id, full_name, email)
SELECT id, COALESCE(NULLIF(raw_user_meta_data->>'full_name', ''), split_part(email, '@', 1)), email
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

CREATE OR REPLACE FUNCTION public.sync_account_permissions_user_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.account_permissions (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_account_permissions_user_details() FROM PUBLIC;
DROP TRIGGER IF EXISTS sync_account_permissions_user_details ON auth.users;
CREATE TRIGGER sync_account_permissions_user_details
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_permissions_user_details();


-- Loans and dues
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

-- A ledger entry may be matched to only one loan movement.
CREATE TABLE IF NOT EXISTS public.loan_existing_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans_and_dues(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL UNIQUE REFERENCES public.expenses(id) ON DELETE RESTRICT
);
ALTER TABLE public.loan_existing_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own loan matches" ON public.loan_existing_movements;
DROP POLICY IF EXISTS "Users can create own loan matches" ON public.loan_existing_movements;
CREATE POLICY "Users can view own loan matches" ON public.loan_existing_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own loan matches" ON public.loan_existing_movements FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.loans_and_dues WHERE id = loan_id AND user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.expenses WHERE id = expense_id AND user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.protect_linked_loan_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.loan_existing_movements WHERE expense_id = OLD.id)
    AND (NEW.entry_date IS DISTINCT FROM OLD.entry_date OR NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.account IS DISTINCT FROM OLD.account OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type
      OR NEW.is_transfer IS DISTINCT FROM OLD.is_transfer) THEN
    RAISE EXCEPTION 'This transaction is linked to a loan. Its amount, date, account and direction cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_linked_loan_movement ON public.expenses;
CREATE TRIGGER protect_linked_loan_movement BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.protect_linked_loan_movement();

-- Create each loan movement and its ledger entry in the same database transaction.
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
      p_account, false, CASE WHEN p_account = 'cash' THEN 'Cash' ELSE 'Bank Transfer' END, 'Loan record: ' || loan.id::text)
    RETURNING * INTO movement;
  END IF;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', CASE WHEN p_account IS NULL OR existing_id IS NOT NULL THEN NULL ELSE to_jsonb(movement) END);
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
-- Apply a payment using a ledger entry the user confirmed, without inserting another.
CREATE OR REPLACE FUNCTION public.link_existing_loan_payment(p_id uuid, p_expected_repaid numeric, p_amount numeric, p_date date, p_account text, p_expense_id uuid)
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
  SELECT * INTO movement FROM public.expenses WHERE id = p_expense_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR movement.entry_date IS DISTINCT FROM p_date OR movement.amount IS DISTINCT FROM p_amount
    OR COALESCE(movement.account, 'expense') IS DISTINCT FROM p_account OR COALESCE(movement.transaction_type, 'expense') IS DISTINCT FROM (CASE WHEN loan.record_kind = 'lent' THEN 'income' ELSE 'expense' END)
    OR COALESCE(movement.is_transfer, false) OR lower(movement.category) LIKE '%transfer%'
    OR movement.category IN ('Loan funds movement', 'Loan: Money lent', 'Loan: Money borrowed', 'Loan: EMI / loan') THEN
    RAISE EXCEPTION 'The selected transaction no longer matches. Refresh and try again.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.loan_existing_movements WHERE expense_id = p_expense_id) THEN RAISE EXCEPTION 'This transaction is already linked to a loan.'; END IF;
  INSERT INTO public.loan_existing_movements(user_id, loan_id, expense_id) VALUES (uid, loan.id, p_expense_id);
  UPDATE public.loans_and_dues SET repaid = repaid + p_amount WHERE id = p_id AND user_id = uid RETURNING * INTO loan;
  RETURN jsonb_build_object('loan', to_jsonb(loan), 'transaction', NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.link_existing_loan_payment(uuid, numeric, numeric, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_existing_loan_payment(uuid, numeric, numeric, date, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.save_loan_with_movement(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_loan_payment(uuid, numeric, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_loan_with_movement(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, numeric, date, text) TO authenticated;

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

-- Associate EMI repayments with the installment they cover. Deleting the payment
-- or loan removes its association automatically.
CREATE TABLE IF NOT EXISTS public.loan_payment_installments (
  expense_id uuid PRIMARY KEY REFERENCES public.expenses(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans_and_dues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installment_date date NOT NULL
);
ALTER TABLE public.loan_payment_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their installment assignments" ON public.loan_payment_installments;
CREATE POLICY "Users can read their installment assignments" ON public.loan_payment_installments FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.loan_payment_installments TO authenticated;

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

CREATE OR REPLACE FUNCTION public.record_emi_payment_for_installment(p_id uuid, p_expected_repaid numeric, p_amount numeric, p_date date, p_account text, p_payment_method text, p_expense_id uuid, p_installment_date date)
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

-- Installment cycle support (also safe to apply to an existing schema).
ALTER TABLE public.loans_and_dues ADD COLUMN IF NOT EXISTS payment_cycle text NOT NULL DEFAULT 'monthly' CHECK (payment_cycle IN ('daily','weekly','monthly','custom'));
ALTER TABLE public.loans_and_dues ADD COLUMN IF NOT EXISTS payment_interval_days integer CHECK ((payment_cycle = 'custom' AND payment_interval_days IS NOT NULL AND payment_interval_days BETWEEN 1 AND 36500) OR (payment_cycle <> 'custom' AND payment_interval_days IS NULL));

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


-- Select the first date for weekly and custom installment schedules.
ALTER TABLE public.loans_and_dues ADD COLUMN IF NOT EXISTS first_payment_date date CHECK (first_payment_date IS NULL OR (payment_cycle IN ('weekly', 'custom') AND first_payment_date >= lent_date AND (end_date IS NULL OR first_payment_date <= end_date)));

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
  INSERT INTO public.loans_and_dues (user_id, person, record_kind, amount, lent_date, due_date, end_date, payment_day, installment_amount, note, payment_cycle, payment_interval_days, first_payment_date)
  VALUES (uid, p_loan->>'person', kind, (p_loan->>'amount')::numeric, (p_loan->>'lent_date')::date,
    NULLIF(p_loan->>'due_date', '')::date, NULLIF(p_loan->>'end_date', '')::date,
    NULLIF(p_loan->>'payment_day', '')::smallint, NULLIF(p_loan->>'installment_amount', '')::numeric, NULLIF(p_loan->>'note', ''), COALESCE(p_loan->>'payment_cycle','monthly'), NULLIF(p_loan->>'payment_interval_days','')::integer, NULLIF(p_loan->>'first_payment_date','')::date)
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
     to_jsonb(loan)->>'first_payment_date' IS DISTINCT FROM p_expected->>'first_payment_date' OR to_jsonb(loan)->>'payment_cycle' IS DISTINCT FROM COALESCE(p_expected->>'payment_cycle', 'monthly') OR to_jsonb(loan)->'payment_interval_days' IS DISTINCT FROM COALESCE(p_expected->'payment_interval_days', 'null'::jsonb) OR to_jsonb(loan)->'payment_day' IS DISTINCT FROM p_expected->'payment_day' OR to_jsonb(loan)->'installment_amount' IS DISTINCT FROM p_expected->'installment_amount' OR
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
    first_payment_date = NULLIF(p_changes->>'first_payment_date','')::date, payment_cycle = COALESCE(p_changes->>'payment_cycle','monthly'), payment_interval_days = NULLIF(p_changes->>'payment_interval_days','')::integer, payment_day = NULLIF(p_changes->>'payment_day','')::smallint, installment_amount = NULLIF(p_changes->>'installment_amount','')::numeric,
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
    expected := CASE WHEN p_installment_date >= COALESCE(loan.first_payment_date, loan.lent_date) AND (p_installment_date - COALESCE(loan.first_payment_date, loan.lent_date)) % (CASE loan.payment_cycle WHEN 'daily' THEN 1 WHEN 'weekly' THEN 7 ELSE loan.payment_interval_days END) = 0 THEN p_installment_date ELSE NULL END;
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

