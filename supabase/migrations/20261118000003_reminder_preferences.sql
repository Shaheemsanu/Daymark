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
