-- Adds only fields that the existing Daymark schema needs for the current UI.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'expense'
    CHECK (transaction_type IN ('expense', 'income')),
  ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT 'expense'
    CHECK (account IN ('expense', 'savings', 'cash')),
  ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.budget_configs
  ADD COLUMN IF NOT EXISTS custom_categories JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;

DROP POLICY IF EXISTS "Users can select own titled notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert own titled notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own titled notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own titled notes" ON public.notes;

CREATE POLICY "Users can select own titled notes"
  ON public.notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own titled notes"
  ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own titled notes"
  ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own titled notes"
  ON public.notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_created ON public.notes(user_id, created_at DESC);
