import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CompactDateNavigator } from '../components/CompactDateNavigator';
import { TasksView } from '../components/TasksView';
import { formatDate } from '../utils/constants';

afterEach(cleanup);

describe('compact date navigation', () => {
  it('moves across month boundaries and supports a direct date selection', () => {
    function Harness() {
      const [date, setDate] = useState('2026-03-01');
      return <CompactDateNavigator date={date} onChange={setDate} />;
    }
    render(<Harness />);
    expect(screen.getByText('01-03-2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select 01-03-2026' })).toBeInTheDocument();
    const input = screen.getByLabelText('Selected date') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(input.value).toBe('2026-02-28');
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(input.value).toBe('2026-03-01');
    fireEvent.change(input, { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(input.value).toBe('2027-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(input.value).toBe(formatDate(new Date()));
  });

  it('filters tasks by the chosen day and lets users return to all dates', () => {
    const props = {
      tasks: [
        { id: 'one', title: 'Selected day task', date: '2026-11-15', priority: 'high' as const, completed: false },
        { id: 'two', title: 'Another day task', date: '2026-11-14', priority: 'high' as const, completed: false },
      ],
      customCategories: [], onAddTask: vi.fn(), onToggleTask: vi.fn(), onDeleteTask: vi.fn(), onUpdateTask: vi.fn(), onSaveCustomCategories: vi.fn(),
    };
    const { rerender } = render(<TasksView {...props} selectedDate="2026-11-15" />);
    expect(screen.getByText('Selected day task')).not.toBeNull();
    expect(screen.queryByText('Another day task')).toBeNull();
    expect(screen.getByRole('button', { name: '15-11-2026' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'All dates' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'All dates' }));
    expect(screen.getByText('Another day task')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'All dates' }).getAttribute('aria-pressed')).toBe('true');
    rerender(<TasksView {...props} selectedDate="2026-11-14" />);
    expect(screen.getByText('Another day task')).not.toBeNull();
    expect(screen.queryByText('Selected day task')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect((screen.getByLabelText('Scheduled Date') as HTMLInputElement).value).toBe('2026-11-14');
  });
});
