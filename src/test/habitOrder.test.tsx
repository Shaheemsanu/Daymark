import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DailyOverview } from '../components/DailyOverview';
import { Habit } from '../types';
import { orderHabits } from '../utils/habitOrder';

afterEach(cleanup);

const habits: Habit[] = ['a', 'b', 'c', 'new'].map(id => ({
  id, title: `Habit ${id}`, category: 'Health', targetDaysPerWeek: 7,
  completedDates: [], streak: 0, bestStreak: 0, color: '#10B981',
}));

it('keeps unsaved habits in their original order and ignores deleted IDs', () => {
  expect(orderHabits(habits).map(habit => habit.id)).toEqual(['a', 'b', 'c', 'new']);
  expect(orderHabits(habits, ['c', 'deleted', 'a']).map(habit => habit.id)).toEqual(['b', 'new', 'c', 'a']);
  expect(habits.map(habit => habit.id)).toEqual(['a', 'b', 'c', 'new']);
});

it('places newer unranked habits first while preserving saved order', () => {
  const newer = { ...habits[0], id: 'newer', createdAt: '2026-11-18T12:00:00Z' };
  const newest = { ...habits[0], id: 'newest', createdAt: '2026-11-18T13:00:00Z' };
  expect(orderHabits([newer, ...habits.slice(0, 3), newest], ['c', 'a', 'b']).map(habit => habit.id)).toEqual(['newest', 'newer', 'c', 'a', 'b']);
});

it('updates the daily checklist and next habit from saved order while respecting scheduled days', () => {
  const props = {
    selectedDate: '2026-11-16', habits: habits.map(habit => habit.id === 'b' ? { ...habit, weekdays: [2] } : habit),
    tasks: [], expenses: [], wellness: {},
    budget: { monthlyBudget: 1000, weeklyBudget: 250, dailyBudget: 30, currency: 'USD', categoryBudgets: {} },
    onSelectDate: vi.fn(), onToggleHabit: vi.fn(), onToggleTask: vi.fn(), onAddTask: vi.fn(),
    onDeleteTask: vi.fn(), onUpdateWellness: vi.fn(), onQuickLogExpense: vi.fn(), onOpenAddHabit: vi.fn(),
  };
  const { rerender } = render(<DailyOverview {...props} habitOrder={['b', 'c', 'a', 'new']} />);
  const checklist = screen.getByRole('heading', { name: 'Daily Habits Checklist' }).parentElement!.parentElement!.parentElement!;
  const titles = () => within(checklist).getAllByText(/^Habit /).map(element => element.textContent);
  expect(titles()).toEqual(['Habit c', 'Habit a', 'Habit new']);
  expect(screen.getAllByText('Habit c')).toHaveLength(2);

  rerender(<DailyOverview {...props} habitOrder={['a', 'c', 'b', 'new']} />);
  expect(titles()).toEqual(['Habit a', 'Habit c', 'Habit new']);
  expect(screen.getAllByText('Habit a')).toHaveLength(2);

  // Completed habits move below pending habits; each group retains saved order.
  const completedHabits = props.habits.map(habit =>
    habit.id === 'a' || habit.id === 'new'
      ? { ...habit, completedDates: [props.selectedDate] }
      : habit
  );
  rerender(<DailyOverview {...props} habits={completedHabits} habitOrder={['a', 'c', 'b', 'new']} />);
  expect(titles()).toEqual(['Habit c', 'Habit a', 'Habit new']);
  expect(screen.getAllByText('Habit c')).toHaveLength(2);

  // Unchecking restores the habit's position among pending habits.
  rerender(<DailyOverview {...props} habitOrder={['a', 'c', 'b', 'new']} />);
  expect(titles()).toEqual(['Habit a', 'Habit c', 'Habit new']);

  // Completion on another date must not affect the selected day's order.
  rerender(<DailyOverview {...props} habits={completedHabits} selectedDate="2026-11-23" habitOrder={['a', 'c', 'b', 'new']} />);
  expect(titles()).toEqual(['Habit a', 'Habit c', 'Habit new']);
});
