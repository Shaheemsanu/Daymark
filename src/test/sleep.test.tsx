import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SleepScene, getSleepSceneState } from '../components/SleepScene';
import { HabitsView } from '../components/HabitsView';

afterEach(cleanup);

describe('duration-driven sleep scene', () => {
  it('adds preparation steps, keeps the light on through 3h, and stays dark after sleep', () => {
    expect(getSleepSceneState(0)).toMatchObject({ lamp: 1, comfort: 0, eyesClosed: 0, dreaming: false });
    expect(getSleepSceneState(0.5).comfort).toBe(1);
    expect(getSleepSceneState(1).pillow).toBe(1);
    expect(getSleepSceneState(1.5).shoulders).toBe(1);
    expect(getSleepSceneState(2).arms).toBe(1);
    expect(getSleepSceneState(2.5).relaxed).toBe(1);
    expect(getSleepSceneState(3).lamp).toBe(1);
    expect(getSleepSceneState(3.5).lamp).toBe(0.5);
    expect(getSleepSceneState(4).lamp).toBe(0);
    expect(getSleepSceneState(3.5).eyesClosed).toBe(0);
    expect(getSleepSceneState(4)).toMatchObject({ eyesClosed: 0, dreaming: false, breathing: false });
    expect(getSleepSceneState(4.5)).toMatchObject({ eyesClosed: 1, dreaming: false, breathing: false });
    expect(getSleepSceneState(5)).toMatchObject({ dreaming: true, breathing: false });
    expect(getSleepSceneState(5.5).breathing).toBe(true);
    expect(getSleepSceneState(6).night).toBe(1);
    expect(getSleepSceneState(6).twinkling).toBe(false);
    expect(getSleepSceneState(6.5).twinkling).toBe(true);
    for (let hours = 7; hours <= 16; hours += 0.5) {
      expect(getSleepSceneState(hours)).toEqual(getSleepSceneState(7));
    }
    expect(getSleepSceneState(16).message).toBe('Well rested');
  });

  it('keeps the blanket position identical from 3.5h onward, independently of breathing', () => {
    const { container, rerender } = render(<SleepScene hours={3.5} />);
    const blanket = container.querySelector('.sleep-scene-blanket')!;
    const finalPosition = blanket.getAttribute('style');
    for (let hours = 4; hours <= 16; hours += 0.5) {
      rerender(<SleepScene hours={hours} />);
      expect(blanket.getAttribute('style')).toBe(finalPosition);
      expect(blanket.closest('.is-breathing')).toBeNull();
      expect(blanket.querySelector('.is-breathing')).toBeNull();
    }
    rerender(<SleepScene hours={3} />);
    expect(blanket.getAttribute('style')).not.toBe(finalPosition);
    const midway = getSleepSceneState(3).blanket;
    expect(getSleepSceneState(2.5).blanket).toBeLessThan(midway);
    expect(midway).toBeLessThan(getSleepSceneState(3.5).blanket);
    expect(getSleepSceneState(2).blanket).toBe(0);
  });

  it('uses saved duration on first render without waiting for a sequence to play', () => {
    const { container } = render(<SleepScene hours={7.5} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/7.5 hours/);
    expect(container.querySelector('.is-breathing')).not.toBeNull();
    expect(container.querySelector('.is-twinkling')).not.toBeNull();
    expect(container.querySelectorAll('.is-floating')).toHaveLength(3);
    expect(container.querySelector('[id$="-dawn"]')).toBeNull();
    expect(container.querySelector('.sleep-scene-blanket')?.getAttribute('style')).toContain('translate(-18px, -8px)');
  });

  it('preserves saved zero and updates the existing storage callback, progress, and scene in both directions', () => {
    const save = vi.fn();
    const date = '2026-11-13';
    function Harness() {
      const [hours, setHours] = useState(0);
      return <HabitsView habits={[]} selectedDate={date} customCategories={[]}
        onAddHabit={vi.fn()} onUpdateHabit={vi.fn()} onDeleteHabit={vi.fn()}
        onToggleHabit={vi.fn()} onSaveCustomCategories={vi.fn()} onSaveHabitOrder={vi.fn()}
        wellness={{ [date]: { date, sleepHours: hours, waterGlasses: 0, energyScore: 3, journalNotes: '', gratitude: '' } }}
        onUpdateWellness={(target, data) => { save(target, data); setHours(data.sleepHours!); }} />;
    }
    render(<Harness />);
    expect(screen.getByText('0 hrs')).not.toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Decrease sleep by 30 minutes' }) as HTMLButtonElement).disabled).toBe(true);
    const increase = screen.getByRole('button', { name: 'Increase sleep by 30 minutes' });
    for (let halfHours = 1; halfHours <= 16; halfHours++) fireEvent.click(increase);
    expect(save).toHaveBeenLastCalledWith(date, { sleepHours: 8 });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('8');
    expect(screen.getByRole('img', { name: /8 hours of sleep/ }).getAttribute('aria-label')).toMatch(/8 hours of sleep/);
    expect(screen.getByText('Well rested')).not.toBeNull();
    const decrease = screen.getByRole('button', { name: 'Decrease sleep by 30 minutes' });
    for (let halfHours = 16; halfHours > 0; halfHours--) fireEvent.click(decrease);
    expect(save).toHaveBeenLastCalledWith(date, { sleepHours: 0 });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('img', { name: /0 hours of sleep/ }).getAttribute('aria-label')).toMatch(/0 hours of sleep/);
  });
});
