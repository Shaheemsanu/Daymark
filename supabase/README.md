# Supabase Database Configuration for Daymark

This directory contains the database schema and initialization instructions for **Daymark — Daily Todo & Habit Tracker**.

---

## 1. Quick Setup in Supabase Dashboard

1. **Create a Supabase Project**:
   - Go to [database.new](https://database.new) or log in to [Supabase](https://supabase.com).
   - Create a new project named `daymark` (or your preferred name).
   - Set a strong database password and pick your closest region.

2. **Execute Database Schema**:
   - In your Supabase project dashboard, open the **SQL Editor** from the left navigation.
   - Click **+ New Query**.
   - Copy the entire content of [`supabase/schema.sql`](./schema.sql) and paste it into the editor.
   - Click **Run** to execute the script.
   - All tables, constraints, foreign keys, triggers, and Row Level Security (RLS) policies will be created.

3. **Get API Keys**:
   - Navigate to **Project Settings** → **API**.
   - Copy the **Project URL** (e.g., `https://xyzcompany.supabase.co`).
   - Copy the **anon / public** key (`sb_publishable_...` or JWT anon key).
   - *Never share or expose your `service_role` key in frontend code.*

4. **Configure Authentication Redirects**:
   - In Supabase dashboard, go to **Authentication** → **URL Configuration**.
   - Under **Site URL**, add your local dev URL: `http://localhost:3000/`.
   - Under **Redirect URLs**, add:
     - `http://localhost:3000/**`
     - Your production URL (e.g. `https://<username>.github.io/daymark/**`)

5. **Set Environment Variables**:
   - In your local project root, create a `.env` file (or copy `.env.example`):
     ```bash
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-public-key
     VITE_BASE_PATH=/
     ```

---

## 2. Architecture & Security Model

- **Row Level Security (RLS)**: Every single table (`profiles`, `tasks`, `task_entries`, `custom_trackers`, `tracker_entries`, `daily_notes`, `expenses`, `budget_configs`) has RLS enabled with strict policies verifying `auth.uid() = user_id`.
- **Daily Independence Constraint**:
  - The `task_entries` table enforces `UNIQUE (user_id, task_id, entry_date)`: each recurring task has a completely independent status (`pending`, `complete`, `skipped`) for each calendar date.
  - The `tracker_entries` table enforces `UNIQUE (user_id, tracker_id, entry_date)`: tracking values (water, habits, metrics) are isolated per day.
- **Auto Profile & Budget Trigger**: An automated database trigger (`on_auth_user_created`) provisions a user profile and default budget configuration upon signup.
- **Offline / Local Demo Fallback**: When Supabase credentials are not supplied, Daymark operates smoothly in offline local-first mode using browser storage and full demo seeds so testing and evaluation remain seamless.
