import { beforeEach, expect, it, vi } from 'vitest';
import { notesService } from '../features/notes/notesService';
import { dataService } from '../features/data/dataService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}));
vi.mock('../features/data/dataService', () => ({ dataService: {
  loadWorkspace: vi.fn(), saveCategories: vi.fn(), saveNote: vi.fn(), deleteNote: vi.fn(),
} }));

const query = {
  select: vi.fn(), eq: vi.fn(), order: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user' } } }, error: null } as never);
  vi.mocked(supabase!.from).mockReturnValue(query as never);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.update.mockReturnValue(query);
});

it('loads only notes and maps completion and priority', async () => {
  query.order.mockResolvedValue({ data: [{ id: 'note', title: 'Todo', content: '', category: 'Work', completed: true, priority: 'high', created_at: '2026-11-16T00:00:00Z' }], error: null });
  const notes = await notesService.getNotes();
  expect(supabase!.from).toHaveBeenCalledExactlyOnceWith('notes');
  expect(query.select.mock.calls[0][0].split(',')).not.toContain('image_url');
  expect(query.select.mock.calls[0][0]).not.toBe('*');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
  expect(notes[0]).toMatchObject({ id: 'note', completed: true, priority: 'high' });
  expect(dataService.loadWorkspace).not.toHaveBeenCalled();
});

it('fetches the image for only the selected note', async () => {
  query.maybeSingle.mockResolvedValue({ data: { image_url: 'data:image/png;base64,test' }, error: null });
  expect(await notesService.getNoteImage('note')).toBe('data:image/png;base64,test');
  expect(query.select).toHaveBeenCalledWith('image_url');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
  expect(query.eq).toHaveBeenCalledWith('id', 'note');
});

it('includes attachments when explicitly exporting notes', async () => {
  query.order.mockResolvedValue({ data: [{ id: 'note', title: 'Todo', image_url: 'attachment', created_at: '2026-11-16T00:00:00Z' }], error: null });
  const notes = await notesService.getNotes({ includeImages: true });
  expect(query.select).toHaveBeenCalledWith('*');
  expect(notes[0].imageUrl).toBe('attachment');
});

it('loads categories without fetching the workspace', async () => {
  query.maybeSingle.mockResolvedValue({ data: { custom_categories: { notes: ['Projects', 123] } }, error: null });
  expect(await notesService.getCategories()).toEqual(['Projects']);
  expect(supabase!.from).toHaveBeenCalledExactlyOnceWith('budget_configs');
  expect(query.select).toHaveBeenCalledWith('custom_categories');
  expect(dataService.loadWorkspace).not.toHaveBeenCalled();
});

it('updates only requested fields and clears optional priority without reading notes first', async () => {
  query.maybeSingle.mockResolvedValue({ data: { id: 'note' }, error: null });
  await notesService.updateNote('note', { completed: true, priority: undefined });
  expect(query.update).toHaveBeenCalledWith({ completed: true, priority: null, updated_at: expect.any(String) });
  expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
  expect(query.eq).toHaveBeenCalledWith('id', 'note');
  expect(supabase!.from).toHaveBeenCalledExactlyOnceWith('notes');
  expect(dataService.loadWorkspace).not.toHaveBeenCalled();
});

it('preserves other category settings when saving note categories', async () => {
  query.maybeSingle.mockResolvedValue({ data: { custom_categories: { habits: ['Health'], taskOrder: ['task'], notes: ['Old'] } }, error: null });
  await notesService.saveCategories(['New']);
  expect(dataService.saveCategories).toHaveBeenCalledWith('user', expect.objectContaining({ habits: ['Health'], taskOrder: ['task'], notes: ['New'] }));
  expect(dataService.loadWorkspace).not.toHaveBeenCalled();
});

it('reports an update failure rather than marking a missing note saved', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(notesService.updateNote('missing', { completed: true })).rejects.toThrow('Note not found');
});
