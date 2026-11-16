import { NoteItem } from '../../types';
import { dataService } from '../data/dataService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { createUuid } from '../../utils/uuid';
import { NOTE_LIST_COLUMNS } from '../../utils/noteFields';

async function currentUserId(): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sign in to access your notes.');
  return data.session.user.id;
}

export const notesService = {
  async getNotes({ includeImages = false }: { includeImages?: boolean } = {}): Promise<NoteItem[]> {
    const userId = await currentUserId();
    const table = supabase!.from('notes');
    const query = includeImages ? table.select('*') : table.select(NOTE_LIST_COLUMNS);
    const { data, error } = await query.eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id, title: row.title, content: row.content,
      category: row.category || 'General', imageUrl: row.image_url || undefined,
      completed: Boolean(row.completed), priority: row.priority || undefined,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
    }));
  },

  async getNoteImage(id: string): Promise<string | undefined> {
    const userId = await currentUserId();
    const { data, error } = await supabase!.from('notes').select('image_url')
      .eq('user_id', userId).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Note not found.');
    return data.image_url || undefined;
  },

  async getCategories(): Promise<string[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase!.from('budget_configs').select('custom_categories')
      .eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const categories = data?.custom_categories?.notes;
    return Array.isArray(categories) ? categories.filter((item): item is string => typeof item === 'string') : [];
  },

  async saveCategories(categories: string[]): Promise<void> {
    const userId = await currentUserId();
    const { data, error } = await supabase!.from('budget_configs').select('custom_categories')
      .eq('user_id', userId).maybeSingle();
    if (error) throw error;
    await dataService.saveCategories(userId, { expenses: {}, habits: [], tasks: [], ...data?.custom_categories, notes: categories });
  },

  async saveNote(note: Omit<NoteItem, 'id' | 'createdAt'>): Promise<NoteItem> {
    const newNote: NoteItem = {
      ...note,
      id: createUuid(),
      createdAt: Date.now()
    };
    await dataService.saveNote(await currentUserId(), newNote);
    return newNote;
  },

  async updateNote(id: string, partial: Partial<NoteItem>): Promise<void> {
    const userId = await currentUserId();
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('title' in partial) changes.title = partial.title;
    if ('content' in partial) changes.content = partial.content;
    if ('category' in partial) changes.category = partial.category || 'General';
    if ('imageUrl' in partial) changes.image_url = partial.imageUrl || null;
    if ('completed' in partial) changes.completed = partial.completed ?? false;
    if ('priority' in partial) changes.priority = partial.priority || null;
    const { data, error } = await supabase!.from('notes').update(changes)
      .eq('user_id', userId).eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Note not found.');
  },

  async deleteNote(id: string): Promise<void> {
    await dataService.deleteNote(await currentUserId(), id);
  }
};
