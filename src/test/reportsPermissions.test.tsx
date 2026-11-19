import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReportsPage } from '../features/reports/ReportsPage';

afterEach(cleanup);

it('shows only enabled analytics and returns to the combined view when access changes', () => {
  const data = { habits: [], tasks: [], expenses: [], wellness: {} };
  const { rerender } = render(<ReportsPage {...data} habitsEnabled tasksEnabled wellnessEnabled />);
  expect(screen.getByText('Habits Active')).toBeTruthy();
  expect(screen.getByText('Tasks Completed')).toBeTruthy();
  expect(screen.getByText('Sleep & Water')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Habit Analytics' }));

  rerender(<ReportsPage {...data} habitsEnabled={false} tasksEnabled={false} wellnessEnabled={false} />);
  expect(screen.queryByText('Habits Active')).toBeNull();
  expect(screen.queryByText('Tasks Completed')).toBeNull();
  expect(screen.queryByText('Sleep & Water')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Habit Analytics' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Daily Tasks Analytics' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sleep & Hydration Curves' })).toBeNull();
  expect(screen.queryByText(/Habit Analytics: Completion/)).toBeNull();
  expect(screen.queryByText(/Daily Tasks Analytics: Completion/)).toBeNull();
  expect(screen.getByText(/Expense Analytics: Disbursement Velocity/)).toBeTruthy();
});
