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
