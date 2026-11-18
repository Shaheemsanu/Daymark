ALTER TABLE public.custom_trackers ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.custom_trackers ADD COLUMN IF NOT EXISTS end_time TIME;
