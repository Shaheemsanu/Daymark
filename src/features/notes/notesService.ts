import { NoteItem } from '../../types';
import { dataService } from '../data/dataService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { createUuid } from '../../utils/uuid';

async function currentUserId(): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to access your notes.');
  return data.user.id;
}

export const notesService = {
  async getNotes(): Promise<NoteItem[]> {
    return (await dataService.loadWorkspace(await currentUserId())).notes;
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
    const existing = (await dataService.loadWorkspace(userId)).notes.find(note => note.id === id);
    if (!existing) throw new Error('Note not found.');
    await dataService.saveNote(userId, { ...existing, ...partial, updatedAt: Date.now() });
  },

  async deleteNote(id: string): Promise<void> {
    await dataService.deleteNote(await currentUserId(), id);
  }
};
