import { Task, TaskEntry, TaskStatus, TaskPriority } from '../../lib/types';
import { getWeekdayIndex } from '../../lib/dateUtils';

export const taskService = {
  // Filters active tasks scheduled for the day's weekday
  getScheduledTasksForDate(tasks: Task[], dateIso: string): Task[] {
    const weekday = getWeekdayIndex(dateIso);
    return tasks.filter(t => t.is_active && (t.weekdays?.includes(weekday) ?? true));
  },

  // Returns status for a task on a specific date
  getTaskStatusForDate(taskEntries: TaskEntry[], taskId: string, dateIso: string): TaskStatus {
    const entry = taskEntries.find(e => e.task_id === taskId && e.entry_date === dateIso);
    return entry ? entry.status : 'pending';
  },

  // Updates or creates an independent task entry for a specific date
  upsertTaskEntry(
    entries: TaskEntry[],
    userId: string,
    taskId: string,
    dateIso: string,
    status: TaskStatus
  ): TaskEntry[] {
    const existingIndex = entries.findIndex(e => e.task_id === taskId && e.entry_date === dateIso);
    const updatedEntry: TaskEntry = {
      id: existingIndex >= 0 ? entries[existingIndex].id : `entry-${taskId}-${dateIso}`,
      user_id: userId,
      task_id: taskId,
      entry_date: dateIso,
      status,
      completed_at: status === 'complete' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      const copy = [...entries];
      copy[existingIndex] = updatedEntry;
      return copy;
    } else {
      return [updatedEntry, ...entries];
    }
  },

  // Calculate task streak based on historical entries
  calculateTaskStreak(entries: TaskEntry[], taskId: string, historyDates: string[]): number {
    let streak = 0;
    const completedSet = new Set(
      entries
        .filter(e => e.task_id === taskId && e.status === 'complete')
        .map(e => e.entry_date)
    );

    for (const d of historyDates) {
      if (completedSet.has(d)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
};
