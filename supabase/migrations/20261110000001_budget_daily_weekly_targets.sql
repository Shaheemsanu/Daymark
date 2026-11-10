-- Add user-configurable daily and weekly spending targets.
ALTER TABLE public.budget_configs
  ADD COLUMN IF NOT EXISTS daily_budget NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS weekly_budget NUMERIC(12,2);

-- Preserve each existing user's monthly budget when setting initial targets.
UPDATE public.budget_configs
SET daily_budget = 1000.00
WHERE daily_budget IS NULL;

UPDATE public.budget_configs
SET weekly_budget = 7000.00
WHERE weekly_budget IS NULL;

ALTER TABLE public.budget_configs
  ALTER COLUMN daily_budget SET DEFAULT 1000.00,
  ALTER COLUMN daily_budget SET NOT NULL,
  ALTER COLUMN weekly_budget SET DEFAULT 7000.00,
  ALTER COLUMN weekly_budget SET NOT NULL;
