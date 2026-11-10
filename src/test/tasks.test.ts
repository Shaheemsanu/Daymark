import { describe, it, expect } from 'vitest';
import { taskService } from '../features/tasks/taskService';
import { Task, TaskEntry } from '../lib/types';

describe('Task System & Daily Independence', () => {
  const sampleTasks: Task[] = [
    {
      id: 'task-daily',
      user_id: 'user-1',
      title: 'Daily Meditation',
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6], // Everyday
      priority: 'high'
    },
    {
      id: 'task-weekdays',
      user_id: 'user-1',
      title: 'Code Review Sprint',
      is_active: true,
      weekdays: [1, 2, 3, 4, 5], // Mon-Fri only
      priority: 'medium'
    },
    {
      id: 'task-inactive',
      user_id: 'user-1',
      title: 'Paused Routine',
      is_active: false,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      priority: 'low'
    }
  ];

  it('filters active tasks matching the day weekday', () => {
    // 2026-11-01 is a Sunday (weekday index 0)
    const sundayTasks = taskService.getScheduledTasksForDate(sampleTasks, '2026-11-01');
    expect(sundayTasks.some(t => t.id === 'task-daily')).toBe(true);
    expect(sundayTasks.some(t => t.id === 'task-weekdays')).toBe(false); // weekday only
    expect(sundayTasks.some(t => t.id === 'task-inactive')).toBe(false); // inactive

    // 2026-11-02 is a Monday (weekday index 1)
    const mondayTasks = taskService.getScheduledTasksForDate(sampleTasks, '2026-11-02');
    expect(mondayTasks.some(t => t.id === 'task-daily')).toBe(true);
    expect(mondayTasks.some(t => t.id === 'task-weekdays')).toBe(true);
  });

  it('ensures independent completion status across dates', () => {
    let entries: TaskEntry[] = [];

    // Mark task-daily complete on Sunday
    entries = taskService.upsertTaskEntry(entries, 'user-1', 'task-daily', '2026-11-01', 'complete');
    expect(taskService.getTaskStatusForDate(entries, 'task-daily', '2026-11-01')).toBe('complete');

    // Monday should still be default 'pending'
    expect(taskService.getTaskStatusForDate(entries, 'task-daily', '2026-11-02')).toBe('pending');

    // Mark Monday as 'skipped'
    entries = taskService.upsertTaskEntry(entries, 'user-1', 'task-daily', '2026-11-02', 'skipped');
    expect(taskService.getTaskStatusForDate(entries, 'task-daily', '2026-11-02')).toBe('skipped');
    // Sunday must remain 'complete'
    expect(taskService.getTaskStatusForDate(entries, 'task-daily', '2026-11-01')).toBe('complete');
  });

  it('updates existing entry when status changes without creating duplicate rows', () => {
    let entries: TaskEntry[] = [];
    entries = taskService.upsertTaskEntry(entries, 'user-1', 'task-daily', '2026-11-01', 'complete');
    expect(entries.length).toBe(1);

    // Toggle back to pending
    entries = taskService.upsertTaskEntry(entries, 'user-1', 'task-daily', '2026-11-01', 'pending');
    expect(entries.length).toBe(1);
    expect(entries[0].status).toBe('pending');
  });
});
