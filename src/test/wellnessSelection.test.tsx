import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HabitsView } from '../components/HabitsView';
import { DailyOverview } from '../components/DailyOverview';
import { DailyWellness } from '../types';

afterEach(cleanup);

it.each(['habits', 'overview'])('toggles mood and energy off and back on in %s', view => {
  const save = vi.fn();
  const date = '2026-11-13';
  function Harness() {
    const [record, setRecord] = useState<DailyWellness>({
      date, mood: 'great', energyScore: 2, sleepHours: 7, waterGlasses: 0,
      gratitude: 'Saved highlight', journalNotes: 'Saved reflection',
    });
    const shared = {
      habits: [], selectedDate: date, wellness: { [date]: record },
      onToggleHabit: vi.fn(),
      onUpdateWellness: (target: string, data: Partial<DailyWellness>) => {
        save(target, data);
        setRecord(current => ({ ...current, ...data }));
      },
    };
    return view === 'habits'
      ? <HabitsView {...shared} customCategories={[]} onAddHabit={vi.fn()}
          onUpdateHabit={vi.fn()} onDeleteHabit={vi.fn()}
          onSaveCustomCategories={vi.fn()} onSaveHabitOrder={vi.fn()} />
      : <DailyOverview {...shared} tasks={[]} expenses={[]} onSelectDate={vi.fn()}
          budget={{ monthlyBudget: 1000, weeklyBudget: 250, dailyBudget: 30, currency: 'USD', categoryBudgets: {} }}
          onToggleTask={vi.fn()} onAddTask={vi.fn()} onDeleteTask={vi.fn()}
          onQuickLogExpense={vi.fn()} onOpenAddHabit={vi.fn()} />;
  }
  render(<Harness />);
  const gratitude = screen.getByLabelText('Gratitude / Highlight') as HTMLInputElement;
  const journal = screen.getByLabelText('Daily Reflection / Journal') as HTMLTextAreaElement;
  expect(gratitude.readOnly).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(gratitude.readOnly).toBe(false);
  expect(journal.readOnly).toBe(false);
  fireEvent.change(gratitude, { target: { value: 'Updated highlight' } });
  fireEvent.change(journal, { target: { value: 'Updated reflection' } });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenLastCalledWith(date, { gratitude: 'Updated highlight', journalNotes: 'Updated reflection' });
  expect(journal.readOnly).toBe(true);
  // Focusing or clicking saved fields must not unlock them.
  fireEvent.focus(journal);
  fireEvent.click(journal);
  fireEvent.focus(gratitude);
  fireEvent.click(gratitude);
  expect(journal.readOnly).toBe(true);
  expect(gratitude.readOnly).toBe(true);
  fireEvent.change(journal, { target: { value: 'Blocked change' } });
  expect(journal.value).toBe('Updated reflection');
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(journal.readOnly).toBe(false);
  fireEvent.change(journal, { target: { value: 'Edited after unlocking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenLastCalledWith(date, { gratitude: 'Updated highlight', journalNotes: 'Edited after unlocking' });
  expect(journal.readOnly).toBe(true);
  const mood = screen.getByRole('button', { name: 'Great' });
  const energy = screen.getByRole('button', { name: 'Energy level 2' });
  expect(mood.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(mood);
  expect(save).toHaveBeenLastCalledWith(date, { mood: undefined });
  expect(mood.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(mood);
  expect(mood.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(energy);
  expect(save).toHaveBeenLastCalledWith(date, { energyScore: 0 });
  expect(energy.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(energy);
  expect(energy.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Energy level 4' }));
  expect(energy.getAttribute('aria-pressed')).toBe('false');
  expect(save).toHaveBeenLastCalledWith(date, { energyScore: 4 });
});
