# Daymark — Daily Todo &amp; Habit Tracker

> Production-ready, full-stack daily productivity workspace and financial intelligence dashboard built with React 18, TypeScript, Supabase, and Recharts.

Daymark is designed around the core philosophy of **Daily Independence**: unlike traditional task managers that overwrite a task's state, Daymark tracks recurring habits, routine tasks, and custom metrics independently for every calendar day. It also features a built-in **Expense &amp; Budget Analysis Dashboard** to provide holistic life and financial tracking in a unified interface.

---

## 🌟 Key Features

### 1. User Authentication &amp; Security
- **Supabase Auth**: Secure email &amp; password sign-up and sign-in.
- **Session Handling**: Persistent session state and automatic token refresh.
- **Row Level Security (RLS)**: Enforced across all PostgreSQL database tables requiring `auth.uid() = user_id`.
- **Zero-Secret Client**: Only public anon keys are used in the client bundle; service role keys are never exposed.
- **Instant Demo Mode**: 1-click preview mode available for evaluation when running without live Supabase credentials.

### 2. Recurring Tasks System (Daily Independence)
- **Weekday Scheduling**: Define recurring tasks for specific days (e.g. Everyday, Weekdays, Weekends, custom days).
- **Per-Date Independence**: Every task maintains a completely separate status for every single calendar day:
  - `complete` (marked done)
  - `pending` (scheduled but not completed yet)
  - `skipped` (deliberately skipped for the day without breaking historic records)
- **Active / Paused Status**: Pause recurring templates without deleting past historical logs.
- **Priority &amp; Time Estimates**: Categorize tasks by priority (`high`, `medium`, `low`) and expected duration in minutes.

### 3. Habit &amp; Custom Metrics Tracker
- **Numeric Trackers**: Track quantitative daily targets (e.g. pages read, pushups, meditation minutes).
- **Boolean Habits**: Simple yes/no daily consistency checkboxes (e.g. cold showers, floss, sugar-free).
- **Built-in Hydration**: Quick-adjust water tracker ($250\,\text{ml}$ steps) toward daily hydration targets.
- **Built-in Sleep Tracker**: Log hours slept with half-hour increment controls.
- **Streak Calculation**: Continuous streak counts calculated across historical daily records.

### 4. Expense &amp; Budget Analysis Dashboard
- **Executive Financial KPIs**: Total Period Spend, Daily Burn Rate, Remaining Safe Buffer, and Peak Outflow Sector.
- **50 / 30 / 20 Financial Discipline Framework**: Real-time breakdown comparing essential Needs (50%), discretionary Wants (30%), and Savings/Buffer (20%).
- **Recharts Data Visualizations**:
  - Interactive **Sector Distribution Donut Chart** with category color coding.
  - **Daily Spending Velocity Bar Chart** tracking disbursement volume per day.
- **Transaction Ledger**: Searchable, filterable by category, payment method, and timeframe with sorting.
- **Custom Budget Caps**: Set monthly baseline budget and category-level spending limits.

### 5. Daily Notes &amp; Reflections
- Freeform daily journal notes saved independently per date.
- Mood selection: *Great*, *Good*, *Neutral*, *Low*, *Stressed*.
- Daily gratitude and highlight prompt.
- Energy level score rating ($1$ to $5$).

### 6. Analytics &amp; Reports
- Historical analytics with 7-day, 14-day, and 30-day timeframes.
- Stacked bar charts showing task completion consistency.
- Status distribution pie chart (Completed vs. Skipped vs. Pending).
- Sleep duration and water intake telemetry.
- Expense velocity lines over time.

### 7. History, Search &amp; Data Portability
- Query historical logs by calendar date or keyword search.
- **CSV Export**: Instant download of tasks history and expense transaction ledgers.
- **Full JSON Backup &amp; Restore**: Portable, zero-loss export and import of all user data.

---

## 🏗 Project Architecture &amp; Layout

```
/src
  /app
    App.tsx                # Main authenticated application shell
    Layout.tsx             # 3-Zone navigation header & responsive subnav
  /components
    QuickLogModal.tsx      # Universal + Quick Log drawer modal
  /features
    /auth
      AuthPage.tsx         # Sign-in, sign-up, and demo mode switch
      authService.ts       # Supabase Auth client & session management
    /dashboard
      DashboardPage.tsx    # Daily execution command center & 7-day strip
    /expenses
      ExpensePage.tsx      # Expense dashboard, charts, & ledger table
    /tasks
      TaskManager.tsx      # Recurring task definitions & schedule editor
      taskService.ts       # Daily independence logic & entry upserting
    /trackers
      TrackerPage.tsx      # Custom numeric & boolean habit trackers
    /notes
      NotesPage.tsx        # Daily notes, mood, and gratitude journal
    /reports
      ReportsPage.tsx      # Recharts weekly & monthly performance trends
    /history
      HistoryPage.tsx      # Historical archive, CSV exports, & JSON backup
  /lib
    supabase.ts            # Supabase client initialization & status check
    types.ts               # Core TypeScript data models & definitions
    dateUtils.ts           # date-fns utilities, streaks, & intervals
    exportUtils.ts         # CSV builders & JSON backup serializers
    mockData.ts            # Rich seed data for offline preview & evaluation
  /test
    setup.ts               # Test setup for Vitest, jsdom, & Testing Library
    tasks.test.ts          # Daily independence & recurring task tests
    logic.test.ts          # Streaks, date calculations, & export tests
    auth.test.ts           # Authentication & session persistence tests
  main.tsx                 # Application entry point
  styles.css               # Global styles with Tailwind CSS & typography
  vite-env.d.ts            # Environment variable type declarations

/supabase
  schema.sql               # Full PostgreSQL database schema with RLS & triggers
  README.md                # Supabase configuration guide & project instructions

/.github
  /workflows
    deploy.yml             # Automatic GitHub Pages CI/CD build & deployment
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ installed
- npm or pnpm

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_BASE_PATH=/
```
*(Note: If left empty, Daymark seamlessly runs in offline local-storage mode for instant testing.)*

### 3. Database Setup (Supabase)
1. Open your Supabase project dashboard at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor**.
3. Copy and run the entire [`supabase/schema.sql`](./supabase/schema.sql) file.
4. Go to **Authentication** &gt; **URL Configuration** and add:
   - Site URL: `http://localhost:3000/`
   - Redirect URLs: `http://localhost:3000/**` and your production URL.

### 4. Running the App
Start the local Vite development server:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Testing &amp; Verification

Run the automated test suite powered by Vitest:
```bash
# Run unit tests once
npm test

# Run tests in watch mode
npm run test:watch

# TypeScript typechecking
npm run typecheck

# Production build
npm run build
```

---

## 🚢 GitHub Pages Deployment

The repository includes a ready-to-run GitHub Actions workflow in `.github/workflows/deploy.yml`.

1. In your GitHub repository, go to **Settings** &gt; **Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. In **Settings** &gt; **Secrets and variables** &gt; **Actions**, add two repository secrets:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key.
4. Push to the `main` branch: GitHub Actions will automatically test, compile the frontend with the correct repository base path, and deploy it to GitHub Pages.

---

## 🔒 Security &amp; Data Integrity

- **Row Level Security (RLS)** is enabled on all 8 tables.
- Foreign keys with `ON DELETE CASCADE` prevent orphaned records.
- Unique constraints like `(user_id, task_id, entry_date)` ensure complete data integrity.
- Zero tracking scripts or third-party telemetry.
