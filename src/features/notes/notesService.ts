import { NoteItem } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const LOCAL_STORAGE_KEY = 'daymark_notes_v1';

export const notesService = {
  async getNotes(): Promise<NoteItem[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((item: any) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category || 'General',
            imageUrl: item.image_url || item.imageUrl,
            createdAt: new Date(item.created_at || item.createdAt).getTime(),
            updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : undefined
          }));
        }
      } catch (err) {
        console.warn('Supabase getNotes failed, falling back to localStorage:', err);
      }
    }

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load notes from localStorage', e);
      return [];
    }
  },

  async saveNote(note: Omit<NoteItem, 'id' | 'createdAt'>): Promise<NoteItem> {
    const newNote: NoteItem = {
      ...note,
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        let finalImageUrl = newNote.imageUrl;
        // If image is a base64 data URL, optionally upload to Supabase storage if bucket exists or store directly
        const { error } = await supabase.from('notes').insert({
          id: newNote.id,
          title: newNote.title,
          content: newNote.content,
          category: newNote.category,
          image_url: finalImageUrl,
          created_at: new Date(newNote.createdAt).toISOString()
        });

        if (error) {
          console.warn('Supabase insert note error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase saveNote failed:', err);
      }
    }

    // Always update localStorage as primary/fallback store
    try {
      const current = await this.getNotes();
      const updated = [newNote, ...current];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save note to localStorage', e);
    }

    return newNote;
  },

  async updateNote(id: string, partial: Partial<NoteItem>): Promise<void> {
    const updatedData = {
      ...partial,
      updatedAt: Date.now()
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const payload: any = {};
        if (partial.title !== undefined) payload.title = partial.title;
        if (partial.content !== undefined) payload.content = partial.content;
        if (partial.category !== undefined) payload.category = partial.category;
        if (partial.imageUrl !== undefined) payload.image_url = partial.imageUrl;
        payload.updated_at = new Date().toISOString();

        await supabase.from('notes').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateNote failed:', err);
      }
    }

    try {
      const current = await this.getNotes();
      const updated = current.map(n => (n.id === id ? { ...n, ...updatedData } : n));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update note in localStorage', e);
    }
  },

  async deleteNote(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('notes').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteNote failed:', err);
      }
    }

    try {
      const current = await this.getNotes();
      const updated = current.filter(n => n.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete note from localStorage', e);
    }
  }
};
