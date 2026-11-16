import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotesView } from '../components/NotesView';
import { notesService } from '../features/notes/notesService';

vi.mock('../features/notes/notesService', () => ({ notesService: {
  getNotes: vi.fn(), getCategories: vi.fn(), saveCategories: vi.fn(),
  saveNote: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn(),
} }));

const note = { id: 'one', title: 'Buy groceries', content: '', category: 'General', createdAt: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(notesService.getCategories).mockResolvedValue([]);
  vi.mocked(notesService.getNotes).mockResolvedValue([note]);
});
afterEach(cleanup);

it('creates title-only todo notes with no priority by default', async () => {
  render(<NotesView />);
  await screen.findByText(note.title);
  fireEvent.click(screen.getByRole('button', { name: 'New Todo Note' }));
  expect(screen.getByLabelText('Priority (optional)')).toHaveValue('');
  fireEvent.change(screen.getByPlaceholderText('e.g. Project Sprint Ideas & Expenses'), { target: { value: 'Call dentist' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await waitFor(() => expect(notesService.saveNote).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Call dentist', content: '', completed: false, priority: undefined,
  })));
});

it('edits and clears optional priority', async () => {
  vi.mocked(notesService.getNotes).mockResolvedValue([{ ...note, priority: 'high' }]);
  render(<NotesView />);
  await screen.findByText('high priority');
  fireEvent.click(screen.getByTitle('Edit note'));
  expect(screen.getByLabelText('Priority (optional)')).toHaveValue('high');
  fireEvent.change(screen.getByLabelText('Priority (optional)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Note' }));
  await waitFor(() => expect(notesService.updateNote).toHaveBeenCalledWith(note.id, expect.objectContaining({ priority: undefined })));
});

it('saves completion, moves checked notes below pending notes and allows unchecking', async () => {
  vi.mocked(notesService.getNotes).mockResolvedValue([note, { ...note, id: 'two', title: 'Read book', createdAt: 0 }]);
  render(<NotesView />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Mark Buy groceries complete' });
  fireEvent.click(checkbox);
  await waitFor(() => expect(checkbox).toBeChecked());
  expect(notesService.updateNote).toHaveBeenCalledWith(note.id, { completed: true });
  expect(screen.getAllByRole('checkbox').map(item => item.getAttribute('aria-label'))).toEqual(['Mark Read book complete', 'Mark Buy groceries incomplete']);
  fireEvent.click(checkbox);
  await waitFor(() => expect(checkbox).not.toBeChecked());
  expect(notesService.updateNote).toHaveBeenLastCalledWith(note.id, { completed: false });
});

it('keeps the note pending when saving completion fails', async () => {
  vi.mocked(notesService.updateNote).mockRejectedValue(new Error('Connection failed'));
  render(<NotesView />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Mark Buy groceries complete' });
  fireEvent.click(checkbox);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
  expect(checkbox).not.toBeChecked();
  expect(checkbox).toBeEnabled();
});

it('sorts by priority with unassigned notes last and completed notes below pending notes', async () => {
  vi.mocked(notesService.getNotes).mockResolvedValue([
    { ...note, id: 'none', title: 'No priority', createdAt: 10 },
    { ...note, id: 'low', title: 'Low', priority: 'low' },
    { ...note, id: 'done', title: 'Done', priority: 'high', completed: true },
    { ...note, id: 'medium', title: 'Medium', priority: 'medium' },
    { ...note, id: 'high', title: 'High', priority: 'high' },
  ]);
  render(<NotesView />);
  await screen.findByText('No priority');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort notes' }), { target: { value: 'priority' } });
  expect(screen.getAllByRole('checkbox').map(item => item.getAttribute('aria-label'))).toEqual([
    'Mark High complete', 'Mark Medium complete', 'Mark Low complete', 'Mark No priority complete', 'Mark Done incomplete',
  ]);
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort notes' }), { target: { value: 'priorityAsc' } });
  expect(screen.getAllByRole('checkbox').map(item => item.getAttribute('aria-label'))).toEqual([
    'Mark Low complete', 'Mark Medium complete', 'Mark High complete', 'Mark No priority complete', 'Mark Done incomplete',
  ]);
});
