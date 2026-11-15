import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WellnessGoalSettings } from '../components/WellnessGoalSettings';
import { HabitsView } from '../components/HabitsView';
import { normalizeWellnessGoals } from '../utils/wellnessGoals';

afterEach(cleanup);

describe('personal wellness goals', () => {
  it('uses safe defaults for older settings and invalid values', () => {
    expect(normalizeWellnessGoals()).toEqual({ waterMl: 2000, sleepHours: 8 });
    expect(normalizeWellnessGoals({ waterMl: -1, sleepHours: NaN })).toEqual({ waterMl: 2000, sleepHours: 8 });
  });

  it('saves user-selected goals, including fractional sleep hours', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<WellnessGoalSettings goals={{ waterMl: 2000, sleepHours: 8 }} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set wellness goals' }));
    fireEvent.change(screen.getByLabelText('Daily water goal (ml)'), { target: { value: '2500' } });
    fireEvent.change(screen.getByLabelText('Daily sleep goal (hours)'), { target: { value: '7.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goals' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ waterMl: 2500, sleepHours: 7.5 }));
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  });

  it('discards unsaved changes when canceled', () => {
    const onSave = vi.fn();
    render(<WellnessGoalSettings goals={{ waterMl: 2000, sleepHours: 8 }} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set wellness goals' }));
    fireEvent.change(screen.getByLabelText('Daily water goal (ml)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set wellness goals' }));
    expect((screen.getByLabelText('Daily water goal (ml)') as HTMLInputElement).valueAsNumber).toBe(2000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('retains selected values when saving fails', async () => {
    render(<WellnessGoalSettings goals={{ waterMl: 2000, sleepHours: 8 }} onSave={vi.fn().mockResolvedValue(false)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set wellness goals' }));
    fireEvent.change(screen.getByLabelText('Daily water goal (ml)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goals' }));
    expect(await screen.findByRole('alert')).not.toBeNull();
    expect((screen.getByLabelText('Daily water goal (ml)') as HTMLInputElement).valueAsNumber).toBe(1500);
  });

  it('calculates progress against personal targets without changing recorded values', () => {
    const date = '2026-11-15';
    render(<HabitsView habits={[]} selectedDate={date} customCategories={[]} wellnessGoals={{ waterMl: 1000, sleepHours: 6 }}
      onAddHabit={vi.fn()} onUpdateHabit={vi.fn()} onDeleteHabit={vi.fn()} onToggleHabit={vi.fn()}
      onSaveCustomCategories={vi.fn()} onSaveHabitOrder={vi.fn()}
      wellness={{ [date]: { date, waterGlasses: 2, sleepHours: 3, energyScore: 0, gratitude: '', journalNotes: '' } }} />);
    expect(screen.getByText('500 / 1,000 ml')).not.toBeNull();
    const sleep = screen.getByRole('progressbar', { name: 'Sleep toward a 6 hour goal' });
    expect(sleep.getAttribute('aria-valuemax')).toBe('6');
    expect(sleep.getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByText(/50% toward 6 hours/)).not.toBeNull();
  });
});
