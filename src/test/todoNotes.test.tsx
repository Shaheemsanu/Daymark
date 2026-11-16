import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NotesView } from '../components/NotesView';
import { notesService } from '../features/notes/notesService';

vi.mock('../features/notes/notesService', () => ({ notesService: {
  getNotes: vi.fn(), getNoteImage: vi.fn(), getCategories: vi.fn(), saveCategories: vi.fn(),
  saveNote: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn(),
} }));

const note = { id: 'one', title: 'Buy groceries', content: '', category: 'General', createdAt: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(notesService.getCategories).mockResolvedValue([]);
  vi.mocked(notesService.getNotes).mockResolvedValue([note]);
  vi.mocked(notesService.getNoteImage).mockResolvedValue(undefined);
});
afterEach(cleanup);

it('creates title-only todo notes with no priority by default', async () => {
  vi.mocked(notesService.saveNote).mockResolvedValue({ ...note, id: 'created', title: 'Call dentist', completed: false });
  render(<NotesView />);
  await screen.findByText(note.title);
  fireEvent.click(screen.getByRole('button', { name: 'New Todo Note' }));
  expect(screen.getByLabelText('Priority (optional)')).toHaveValue('');
  fireEvent.change(screen.getByPlaceholderText('e.g. Project Sprint Ideas & Expenses'), { target: { value: 'Call dentist' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await waitFor(() => expect(notesService.saveNote).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Call dentist', content: '', completed: false, priority: undefined,
  })));
  await screen.findByRole('heading', { name: 'Call dentist' });
  expect(notesService.getNotes).toHaveBeenCalledTimes(1);
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
  expect(vi.mocked(notesService.updateNote).mock.calls[0][1]).not.toHaveProperty('imageUrl');
  expect(notesService.getNoteImage).toHaveBeenCalledWith(note.id);
  await waitFor(() => expect(screen.queryByText('high priority')).toBeNull());
  expect(notesService.getNotes).toHaveBeenCalledTimes(1);
});

it('retains the draft and list if saving a new note fails', async () => {
  vi.mocked(notesService.saveNote).mockRejectedValue(new Error('Unable to save'));
  render(<NotesView />);
  await screen.findByText(note.title);
  fireEvent.click(screen.getByRole('button', { name: 'New Todo Note' }));
  const title = screen.getByPlaceholderText('e.g. Project Sprint Ideas & Expenses');
  fireEvent.change(title, { target: { value: 'Keep this draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
  await screen.findByText('Unable to save');
  expect(title).toHaveValue('Keep this draft');
  expect(screen.getByRole('heading', { name: note.title })).toBeInTheDocument();
  expect(notesService.getNotes).toHaveBeenCalledTimes(1);
});

it('loads the existing image in Edit and allows removing it', async () => {
  vi.mocked(notesService.getNoteImage).mockResolvedValue('data:image/png;base64,existing');
  render(<NotesView />);
  await screen.findByText(note.title);
  expect(notesService.getNoteImage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTitle('Edit note'));
  expect(await screen.findByRole('img', { name: 'Preview' })).toHaveAttribute('src', 'data:image/png;base64,existing');
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
  expect(screen.queryByRole('img', { name: 'Preview' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Update Note' }));
  await waitFor(() => expect(notesService.updateNote).toHaveBeenCalledWith(note.id, expect.objectContaining({ imageUrl: undefined })));
});

it('does not restore an image removed while its preview was loading', async () => {
  let finishLoad!: (image: string) => void;
  vi.mocked(notesService.getNoteImage).mockImplementation(() => new Promise(resolve => { finishLoad = resolve; }));
  render(<NotesView />);
  await screen.findByText(note.title);
  fireEvent.click(screen.getByTitle('Edit note'));
  await screen.findByText('Loading existing image…');
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
  finishLoad('data:image/png;base64,old');
  await waitFor(() => expect(screen.queryByText('Loading existing image…')).toBeNull());
  expect(screen.queryByRole('img', { name: 'Preview' })).toBeNull();
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

it('shows a spinner while completion saves and colors the completed card', async () => {
  let finishSave!: () => void;
  vi.mocked(notesService.updateNote).mockImplementation(() => new Promise<void>(resolve => { finishSave = resolve; }));
  render(<NotesView />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Mark Buy groceries complete' });
  fireEvent.click(checkbox);
  expect(checkbox).toBeDisabled();
  expect(checkbox).toHaveAttribute('aria-busy', 'true');
  expect(checkbox.querySelector('.animate-spin')).not.toBeNull();
  finishSave();
  await waitFor(() => expect(checkbox).toBeChecked());
  expect(checkbox).toBeEnabled();
  expect(checkbox.querySelector('.animate-spin')).toBeNull();
  expect(screen.getByText(note.title).closest('.group')).toHaveClass('border-emerald-200');
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
  await screen.findByRole('heading', { name: 'No priority' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort notes' }), { target: { value: 'priority' } });
  expect(screen.getAllByRole('checkbox').map(item => item.getAttribute('aria-label'))).toEqual([
    'Mark High complete', 'Mark Medium complete', 'Mark Low complete', 'Mark No priority complete', 'Mark Done incomplete',
  ]);
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort notes' }), { target: { value: 'priorityAsc' } });
  expect(screen.getAllByRole('checkbox').map(item => item.getAttribute('aria-label'))).toEqual([
    'Mark Low complete', 'Mark Medium complete', 'Mark High complete', 'Mark No priority complete', 'Mark Done incomplete',
  ]);
});

it('shows priority on cards and opens full note details without editing', async () => {
  // jsdom does not implement native dialog methods.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  vi.mocked(notesService.getNotes).mockResolvedValue([{ ...note, content: 'Full todo details', priority: 'medium' }]);
  vi.mocked(notesService.getNoteImage).mockResolvedValue('data:image/png;base64,test');
  render(<NotesView />);
  await screen.findByText('medium priority');
  expect(notesService.getNoteImage).not.toHaveBeenCalled();
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('heading', { name: note.title }));
  const dialog = await screen.findByRole('dialog', { name: 'Buy groceries' });
  expect(within(dialog).getByText('Full todo details')).toBeInTheDocument();
  expect(within(dialog).getByText('medium priority')).toBeInTheDocument();
  expect(within(dialog).getByText('Pending')).toBeInTheDocument();
  expect(within(dialog).queryByRole('textbox')).toBeNull();
  expect(await within(dialog).findByRole('img', { name: note.title })).toHaveAttribute('src', 'data:image/png;base64,test');
  expect(notesService.getNoteImage).toHaveBeenCalledExactlyOnceWith(note.id);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close note' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(notesService.updateNote).not.toHaveBeenCalled();
});
