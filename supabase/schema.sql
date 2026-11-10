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
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

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
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

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
