import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TasksView } from '../components/TasksView';
import { DailyTask } from '../types';
import { orderTasks, moveTaskInOrder } from '../utils/taskOrder';

afterEach(cleanup);
const tasks: DailyTask[] = [
  { id: 'a', title: 'First', completed: false, date: '2026-11-15', priority: 'high', category: 'Work' },
  { id: 'b', title: 'Hidden', completed: true, date: '2026-11-15', priority: 'medium', category: 'Personal' },
  { id: 'c', title: 'Last', completed: false, date: '2026-11-14', priority: 'low', category: 'Work' },
];

describe('task ordering', () => {
  it('keeps existing default sorting until a custom order is saved', () => {
    expect(orderTasks(tasks).map(task => task.id)).toEqual(['a', 'c', 'b']);
    expect(orderTasks(tasks, ['c', 'a', 'b']).map(task => task.id)).toEqual(['c', 'a', 'b']);
    expect(tasks.map(task => task.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves filtered tasks while retaining hidden tasks and handling removed IDs', () => {
    const ordered = orderTasks(tasks, ['a', 'b', 'c', 'deleted']);
    const visible = ordered.filter(task => !task.completed);
    expect(moveTaskInOrder(ordered, visible, 'a', 1)).toEqual(['c', 'b', 'a']);
    expect(moveTaskInOrder(ordered, visible, 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(orderTasks([...tasks, { ...tasks[0], id: 'new' }], ['c', 'a', 'deleted']).map(task => task.id)).toEqual(['new', 'b', 'c', 'a']);
  });

  it('places newer unranked tasks first and keeps saved ranks intact', () => {
    const newer = { ...tasks[0], id: 'newer', createdAt: '2026-11-18T12:00:00Z' };
    const newest = { ...tasks[0], id: 'newest', createdAt: '2026-11-18T13:00:00Z' };
    expect(orderTasks([newer, ...tasks, newest], ['c', 'a', 'b']).map(task => task.id)).toEqual(['newest', 'newer', 'c', 'a', 'b']);
  });

  it('edits order, saves moves and restores edit/delete actions on Done', async () => {
    const save = vi.fn();
    function Harness() {
      const [taskOrder, setTaskOrder] = useState<string[]>([]);
      return <TasksView tasks={tasks} customCategories={[]} taskOrder={taskOrder}
        onAddTask={vi.fn()} onToggleTask={vi.fn()} onDeleteTask={vi.fn()} onUpdateTask={vi.fn()} onSaveCustomCategories={vi.fn()}
        onSaveTaskOrder={async order => { save(order); setTaskOrder(order); return true; }} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Order' }));
    expect((screen.getByRole('button', { name: 'Move First up' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move First down' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(['c', 'a', 'b']));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Move Last up' }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Edit First' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Move First down' })).toBeNull();
  });

  it('shows a failure when saving order fails', async () => {
    render(<TasksView tasks={tasks} customCategories={[]} onAddTask={vi.fn()} onToggleTask={vi.fn()}
      onDeleteTask={vi.fn()} onUpdateTask={vi.fn()} onSaveCustomCategories={vi.fn()} onSaveTaskOrder={vi.fn().mockResolvedValue(false)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move First down' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Could not save');
  });
});
