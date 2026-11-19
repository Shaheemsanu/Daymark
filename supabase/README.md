# Supabase Database Configuration for Daymark

### Optional account permissions

Run `migrations/20261119000001_account_permissions.sql` in the Supabase SQL Editor (or apply it with your migration workflow). It creates one `public.account_permissions` row per user, including users created later. New rows default to `can_select_accounts = false`, `cash_enabled = false`, and `savings_enabled = false`. Run `migrations/20261119000002_disable_optional_accounts_by_default.sql` once to apply the disabled state to existing users as well.

An administrator can change a user's row in the Supabase Table Editor or SQL Editor. For example:

```sql
UPDATE public.account_permissions
SET can_select_accounts = true, cash_enabled = true, savings_enabled = false
WHERE user_id = '<user UUID>';
```

When `can_select_accounts` is true, the user can change the two account switches in Settings. When false, the switches are hidden and the administrator's `cash_enabled` and `savings_enabled` values determine what the app shows. Authenticated users can read only their own row and cannot change `can_select_accounts`; they may update the two enabled flags only while selection is allowed. Disabling an account hides its controls and transactions in supported views without deleting data. These flags control app features and are not transaction-data access policies.

### Administrator-managed features

Apply `migrations/20261119000003_feature_permissions.sql` after the account permissions migrations. It adds `habits_enabled`, `tasks_enabled`, `notes_enabled`, `analytics_enabled`, and `ai_enabled` to `public.account_permissions`. All default to false for existing and new users. These switches are not exposed in Settings; administrators can change them using the Table Editor or SQL Editor:

```sql
UPDATE public.account_permissions
SET habits_enabled = true, tasks_enabled = true, notes_enabled = false,
    analytics_enabled = false, ai_enabled = false
WHERE user_id = '<user UUID>';
```

The app hides disabled features, including their overview sections and navigation. These feature flags control app presentation and do not replace database RLS or API authorization policies. Existing records are retained.

Apply `migrations/20261119000004_wellness_permission.sql` after the feature permissions migration to add `wellness_enabled`, also false by default. Administrators can turn it on per user in the Table Editor or with `UPDATE public.account_permissions SET wellness_enabled = true WHERE user_id = '<user UUID>';`. The flag is not shown in Settings and does not delete wellness records.

This directory contains the database schema and initialization instructions for **Daymark — Daily Todo & Habit Tracker**.

---

## 1. Quick Setup in Supabase Dashboard

For Todo Notes on an existing database, run [`migrations/20261116000000_todo_notes.sql`](./migrations/20261116000000_todo_notes.sql) in the SQL Editor to add completion and optional priority fields.

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
   - If you already created the original schema, run [`migrations/20261110000000_existing_schema_app_fields.sql`](./migrations/20261110000000_existing_schema_app_fields.sql) to apply the approved additions: titled notes, expense transaction fields, and custom categories JSONB.
   - Run [`migrations/20261110000001_budget_daily_weekly_targets.sql`](./migrations/20261110000001_budget_daily_weekly_targets.sql) to add daily and weekly budget targets. Existing rows receive defaults of ₹1,000 daily and ₹7,000 weekly.

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

- **Row Level Security (RLS)**: User data tables (`profiles`, `tasks`, `task_entries`, `custom_trackers`, `tracker_entries`, `daily_notes`, `notes`, `expenses`, `budget_configs`) have RLS policies scoped to `auth.uid() = user_id`.
- **Daily Independence Constraint**:
  - The `task_entries` table enforces `UNIQUE (user_id, task_id, entry_date)`: each recurring task has a completely independent status (`pending`, `complete`, `skipped`) for each calendar date.
  - The `tracker_entries` table enforces `UNIQUE (user_id, tracker_id, entry_date)`: tracking values (water, habits, metrics) are isolated per day.
- **Auto Profile & Budget Trigger**: An automated database trigger (`on_auth_user_created`) provisions a user profile and default budget configuration upon signup.
- **Supabase-only application data**: Daymark reads and writes expenses, budgets and custom categories, tasks and task entries, habits and tracker entries, wellness entries, and titled notes through their matching tables. RLS scopes records to the signed-in user. Supabase Auth keeps its session in browser storage.
