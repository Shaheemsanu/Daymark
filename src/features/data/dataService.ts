import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { BudgetConfig, DailyTask, DailyWellness, Expense, Habit, NoteItem, CategoryInfo } from '../../types';
import { createUuid } from '../../utils/uuid';

export type CategorySettings = {
  expenses: Record<string, CategoryInfo>;
  habits: string[];
  tasks: string[];
  habitOrder?: string[];
  notes: string[];
};

export type WorkspaceData = {
  expenses: Expense[];
  budget: BudgetConfig;
  habits: Habit[];
  tasks: DailyTask[];
  wellness: Record<string, DailyWellness>;
  notes: NoteItem[];
  categories: CategorySettings;
};

const DEFAULT_BUDGET: BudgetConfig = { monthlyBudget: 30000, dailyBudget: 1000, weeklyBudget: 7000, currency: '₹', categoryBudgets: {} };
const DEFAULT_CATEGORIES: CategorySettings = { expenses: {}, habits: [], tasks: [], habitOrder: [], notes: [] };

function normalizeCategories(value: unknown): CategorySettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_CATEGORIES;
  const categories = value as Partial<CategorySettings>;
  return {
    expenses: categories.expenses && typeof categories.expenses === 'object' && !Array.isArray(categories.expenses) ? categories.expenses : {},
    habits: Array.isArray(categories.habits) ? categories.habits.filter((item): item is string => typeof item === 'string') : [],
    tasks: Array.isArray(categories.tasks) ? categories.tasks.filter((item): item is string => typeof item === 'string') : [],
    habitOrder: Array.isArray(categories.habitOrder) ? categories.habitOrder.filter((item): item is string => typeof item === 'string') : [],
    notes: Array.isArray(categories.notes) ? categories.notes.filter((item): item is string => typeof item === 'string') : []
  };
}

function client() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function uuid(id?: string): string {
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : createUuid();
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    date: row.entry_date,
    paymentMethod: row.payment_method || 'Credit Card',
    type: row.transaction_type || 'expense',
    account: row.account || 'expense',
    isTransfer: Boolean(row.is_transfer),
    notes: row.notes || undefined,
    isRecurring: Boolean(row.is_recurring),
    spendType: row.spend_type || 'need',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

function expenseRow(userId: string, item: Expense) {
  return {
    id: uuid(item.id),
    user_id: userId,
    entry_date: item.date,
    title: item.title,
    amount: item.amount,
    category: item.category,
    spend_type: item.spendType || 'need',
    transaction_type: item.type || 'expense',
    account: item.account || 'expense',
    is_transfer: Boolean(item.isTransfer),
    payment_method: item.paymentMethod || 'Credit Card',
    notes: item.notes || null,
    is_recurring: Boolean(item.isRecurring)
  };
}

function mappedHabit(row: any, completedDates: string[]): Habit {
  const sorted = [...new Set(completedDates)].sort();
  const done = new Set(sorted);
  const today = new Date();
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!done.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (done.has(iso(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  let bestStreak = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const dateText of sorted) {
    const [year, month, day] = dateText.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (previous) {
      const diff = Math.round((date.getTime() - previous.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }
  return {
    id: row.id,
    title: row.name,
    category: row.unit || 'Health',
    targetDaysPerWeek: Number(row.target_value) || 1,
    weekdays: Array.isArray(row.weekdays) ? row.weekdays.map(Number).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6) : [0, 1, 2, 3, 4, 5, 6],
    completedDates: sorted,
    streak,
    bestStreak,
    color: row.color || '#10B981'
  };
}

function taskRow(userId: string, task: DailyTask) {
  const day = new Date(`${task.date}T12:00:00`).getDay();
  return {
    id: uuid(task.id),
    user_id: userId,
    title: task.title,
    description: null,
    is_active: true,
    weekdays: [day],
    priority: task.priority,
    time_estimate_min: task.timeEstimateMin || 30,
    category: task.category || 'General'
  };
}

function taskEntryRow(userId: string, task: DailyTask) {
  return {
    user_id: userId,
    task_id: uuid(task.id),
    entry_date: task.date,
    status: task.completed ? 'complete' : 'pending',
    completed_at: task.completed && task.completedAt ? new Date(task.completedAt).toISOString() : null
  };
}

function wellnessRow(userId: string, item: DailyWellness) {
  return {
    user_id: userId,
    entry_date: item.date,
    content: item.journalNotes || '',
    mood: item.mood || null,
    gratitude: item.gratitude || '',
    sleep_hours: item.sleepHours,
    water_ml: Math.round((item.waterGlasses || 0) * 250),
    energy_score: item.energyScore
  };
}

export const dataService = {
  async loadWorkspace(userId: string): Promise<WorkspaceData> {
    const db = client();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const results = await Promise.race([
        Promise.all([
          db.from('expenses').select('*').eq('user_id', userId).order('entry_date', { ascending: false }),
          db.from('budget_configs').select('*').eq('user_id', userId).maybeSingle(),
          db.from('custom_trackers').select('*').eq('user_id', userId),
          db.from('tracker_entries').select('*').eq('user_id', userId),
          db.from('tasks').select('*').eq('user_id', userId),
          db.from('task_entries').select('*').eq('user_id', userId),
          db.from('daily_notes').select('*').eq('user_id', userId),
          db.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Supabase workspace loading timed out after 15 seconds. Check your connection and use Refresh to try again.')), 15000);
        })
      ]);
      const [expenseResult, budgetResult, trackerResult, trackerEntriesResult, taskResult, taskEntriesResult, wellnessResult, notesResult] = results;
      for (const result of [expenseResult, budgetResult, trackerResult, trackerEntriesResult, taskResult, taskEntriesResult, wellnessResult, notesResult]) {
        if (result.error) throw result.error;
      }

      const trackerEntries = trackerEntriesResult.data || [];
      const habits = (trackerResult.data || [])
        .filter(row => row.type === 'boolean')
        .map(row => mappedHabit(row, trackerEntries
          .filter(entry => entry.tracker_id === row.id && entry.boolean_value === true)
          .map(entry => entry.entry_date)));

      const taskById = new Map((taskResult.data || []).map(row => [row.id, row]));
      const tasks = (taskEntriesResult.data || []).flatMap(entry => {
        const row = taskById.get(entry.task_id);
        if (!row) return [];
        return [{
          id: row.id,
          date: entry.entry_date,
          title: row.title,
          completed: entry.status === 'complete',
          priority: row.priority || 'medium',
          timeEstimateMin: row.time_estimate_min || undefined,
          category: row.category || undefined,
          completedAt: entry.completed_at ? new Date(entry.completed_at).getTime() : undefined
        } as DailyTask];
      });

      const wellness = Object.fromEntries((wellnessResult.data || []).map(row => [row.entry_date, {
        date: row.entry_date,
        mood: row.mood || undefined,
        waterGlasses: Number(row.water_ml || 0) / 250,
        sleepHours: Number(row.sleep_hours ?? 7.5),
        energyScore: Number(row.energy_score ?? 3),
        journalNotes: row.content || '',
        gratitude: row.gratitude || ''
      } as DailyWellness]));

      const budgetRow = budgetResult.data;
      return {
        expenses: (expenseResult.data || []).map(mapExpense),
        budget: budgetRow ? {
          monthlyBudget: Number(budgetRow.monthly_budget),
          dailyBudget: Number(budgetRow.daily_budget ?? 1000),
          weeklyBudget: Number(budgetRow.weekly_budget ?? 7000),
          currency: budgetRow.currency,
          categoryBudgets: budgetRow.category_budgets || {}
        } : DEFAULT_BUDGET,
        habits,
        tasks,
        wellness,
        notes: (notesResult.data || []).map(row => ({
          id: row.id,
          title: row.title,
          content: row.content,
          category: row.category || 'General',
          imageUrl: row.image_url || undefined,
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
        })),
        categories: normalizeCategories(budgetRow?.custom_categories)
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  },

  async saveExpense(userId: string, item: Expense): Promise<void> {
    const { error } = await client().from('expenses').upsert(expenseRow(userId, item), { onConflict: 'id' });
    if (error) throw error;
  },
  async createExpense(userId: string, item: Expense): Promise<void> {
    const { error } = await client().from('expenses').insert(expenseRow(userId, item));
    if (error) throw error;
  },
  async deleteExpense(userId: string, id: string): Promise<void> {
    const { error } = await client().from('expenses').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  },

  async saveHabit(userId: string, item: Habit): Promise<void> {
    const db = client();
    const id = uuid(item.id);
    const { error: trackerError } = await db.from('custom_trackers').upsert({
      id, user_id: userId, name: item.title, type: 'boolean', unit: item.category,
      target_value: item.targetDaysPerWeek, weekdays: item.weekdays || [0, 1, 2, 3, 4, 5, 6], color: item.color, icon: null
    }, { onConflict: 'id' });
    if (trackerError) throw trackerError;
    const { data: current, error: readError } = await db.from('tracker_entries')
      .select('entry_date').eq('user_id', userId).eq('tracker_id', id);
    if (readError) throw readError;
    const wanted = new Set(item.completedDates);
    const removed = (current || []).map(row => row.entry_date).filter(date => !wanted.has(date));
    if (removed.length) {
      const { error } = await db.from('tracker_entries').delete()
        .eq('user_id', userId).eq('tracker_id', id).in('entry_date', removed);
      if (error) throw error;
    }
    if (item.completedDates.length) {
      const { error } = await db.from('tracker_entries').upsert(item.completedDates.map(date => ({
        user_id: userId, tracker_id: id, entry_date: date, boolean_value: true
      })), { onConflict: 'user_id,tracker_id,entry_date' });
      if (error) throw error;
    }
  },
  async deleteHabit(userId: string, id: string): Promise<void> {
    const { error } = await client().from('custom_trackers').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  },

  async saveTask(userId: string, item: DailyTask): Promise<void> {
    const db = client();
    const normalized = { ...item, id: uuid(item.id) };
    const { error: taskError } = await db.from('tasks').upsert(taskRow(userId, normalized), { onConflict: 'id' });
    if (taskError) throw taskError;
    const { error } = await db.from('task_entries').upsert(taskEntryRow(userId, normalized), {
      onConflict: 'user_id,task_id,entry_date'
    });
    if (error) throw error;
  },
  async deleteTask(userId: string, id: string): Promise<void> {
    const { error } = await client().from('tasks').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  },

  async saveWellness(userId: string, item: DailyWellness): Promise<void> {
    const { error } = await client().from('daily_notes').upsert(wellnessRow(userId, item), {
      onConflict: 'user_id,entry_date'
    });
    if (error) throw error;
  },

  async saveBudget(userId: string, item: BudgetConfig): Promise<void> {
    const db = client();
    const values = {
      monthly_budget: item.monthlyBudget,
      daily_budget: item.dailyBudget,
      weekly_budget: item.weeklyBudget,
      currency: item.currency,
      category_budgets: item.categoryBudgets
    };
    const { data, error } = await db.from('budget_configs').update(values).eq('user_id', userId).select('user_id').maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error: insertError } = await db.from('budget_configs').insert({ user_id: userId, ...values });
      if (insertError) throw insertError;
    }
  },
  async saveCategories(userId: string, item: CategorySettings): Promise<void> {
    const db = client();
    const safeItem = normalizeCategories(item);
    const { data, error } = await db.from('budget_configs').update({ custom_categories: safeItem })
      .eq('user_id', userId).select('user_id').maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error: insertError } = await db.from('budget_configs').insert({
        user_id: userId, monthly_budget: DEFAULT_BUDGET.monthlyBudget,
        daily_budget: DEFAULT_BUDGET.dailyBudget, weekly_budget: DEFAULT_BUDGET.weeklyBudget,
        currency: DEFAULT_BUDGET.currency, category_budgets: {}, custom_categories: safeItem
      });
      if (insertError) throw insertError;
    }
  },

  async saveNote(userId: string, note: NoteItem): Promise<void> {
    const { error } = await client().from('notes').upsert({
      id: uuid(note.id), user_id: userId, title: note.title, content: note.content,
      category: note.category || 'General', image_url: note.imageUrl || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) throw error;
  },
  async deleteNote(userId: string, id: string): Promise<void> {
    const { error } = await client().from('notes').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
  },

  async importWorkspace(userId: string, data: Partial<WorkspaceData>): Promise<void> {
    const db = client();
    if (data.expenses) {
      const { error } = await db.from('expenses').delete().eq('user_id', userId);
      if (error) throw error;
      for (const item of data.expenses) await this.saveExpense(userId, { ...item, id: uuid(item.id) });
    }
    if (data.habits) {
      const { error } = await db.from('custom_trackers').delete().eq('user_id', userId);
      if (error) throw error;
      for (const item of data.habits) await this.saveHabit(userId, { ...item, id: uuid(item.id) });
    }
    if (data.tasks) {
      const { error } = await db.from('tasks').delete().eq('user_id', userId);
      if (error) throw error;
      for (const item of data.tasks) await this.saveTask(userId, { ...item, id: uuid(item.id) });
    }
    if (data.wellness) {
      const { error } = await db.from('daily_notes').delete().eq('user_id', userId);
      if (error) throw error;
      for (const item of Object.values(data.wellness)) await this.saveWellness(userId, item);
    }
    if (data.notes) {
      const { error } = await db.from('notes').delete().eq('user_id', userId);
      if (error) throw error;
      for (const item of data.notes) await this.saveNote(userId, { ...item, id: uuid(item.id) });
    }
    if (data.budget) await this.saveBudget(userId, data.budget);
    if (data.categories) await this.saveCategories(userId, data.categories);
  },
  async resetWorkspace(userId: string): Promise<void> {
    const db = client();
    for (const table of ['expenses', 'tasks', 'custom_trackers', 'daily_notes', 'notes']) {
      const { error } = await db.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    }
    await this.saveBudget(userId, DEFAULT_BUDGET);
    await this.saveCategories(userId, DEFAULT_CATEGORIES);
  }
};
