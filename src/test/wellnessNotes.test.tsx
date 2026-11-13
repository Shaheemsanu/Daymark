import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WellnessNotes } from '../components/WellnessNotes';

afterEach(cleanup);

it.each(['amber', 'blue'] as const)('keeps Edit from submitting, then saves changes with the %s accent', accent => {
  const save = vi.fn();
  function Harness() {
    const [notes, setNotes] = useState({ gratitude: '', journalNotes: '' });
    return <WellnessNotes {...notes} accent={accent} onSave={next => { save(next); setNotes(next); }} />;
  }
  render(<Harness />);
  const gratitude = screen.getByLabelText('Gratitude / Highlight') as HTMLInputElement;
  const journal = screen.getByLabelText('Daily Reflection / Journal') as HTMLTextAreaElement;
  fireEvent.change(gratitude, { target: { value: 'Family' } });
  fireEvent.change(journal, { target: { value: 'A peaceful day' } });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenLastCalledWith({ gratitude: 'Family', journalNotes: 'A peaceful day' });
  expect(gratitude.readOnly).toBe(true);
  expect(journal.readOnly).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  expect(gratitude.readOnly).toBe(false);
  expect(journal.readOnly).toBe(false);
  expect(document.activeElement).toBe(gratitude);
  fireEvent.change(gratitude, { target: { value: 'Friends' } });
  fireEvent.change(journal, { target: { value: 'Updated reflection' } });
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenLastCalledWith({ gratitude: 'Friends', journalNotes: 'Updated reflection' });
  expect(journal.readOnly).toBe(true);
});

it('opens saved notes in Edit mode and resets drafts when the selected date changes', () => {
  const { rerender } = render(<WellnessNotes key="day-one" gratitude="Saved highlight" journalNotes="Saved journal" onSave={vi.fn()} />);
  expect((screen.getByLabelText('Gratitude / Highlight') as HTMLInputElement).readOnly).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText('Gratitude / Highlight'), { target: { value: 'Unsaved edit' } });
  rerender(<WellnessNotes key="day-two" gratitude="" journalNotes="" onSave={vi.fn()} />);
  expect((screen.getByLabelText('Gratitude / Highlight') as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('button', { name: 'Save' })).not.toBeNull();
});
