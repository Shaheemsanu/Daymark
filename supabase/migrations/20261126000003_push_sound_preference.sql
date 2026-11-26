-- Each registered device can mute its own background notifications.
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true;
