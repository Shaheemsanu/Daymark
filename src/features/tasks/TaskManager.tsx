import React, { useState } from 'react';
import { Task, TaskPriority } from '../../lib/types';
import { Plus, Trash2, Edit2, Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface TaskManagerProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

const WEEKDAYS = [
  { day: 0, label: 'Sun' },
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' }
];

export const TaskManager: React.FC<TaskManagerProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [timeEstimate, setTimeEstimate] = useState('30');
  const [category, setCategory] = useState('General');

  const openAdd = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setWeekdays([0, 1, 2, 3, 4, 5, 6]);
    setPriority('medium');
    setTimeEstimate('30');
    setCategory('General');
    setIsModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setWeekdays(task.weekdays || [0, 1, 2, 3, 4, 5, 6]);
    setPriority(task.priority);
    setTimeEstimate(task.time_estimate_min?.toString() || '30');
    setCategory(task.category || 'General');
    setIsModalOpen(true);
  };

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      if (weekdays.length > 1) {
        setWeekdays(weekdays.filter(d => d !== day));
      }
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      onUpdateTask(editingTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        weekdays,
        priority,
        time_estimate_min: parseInt(timeEstimate) || 30,
        category: category.trim() || 'General'
      });
    } else {
      onAddTask({
        title: title.trim(),
        description: description.trim() || undefined,
        is_active: true,
        weekdays,
        priority,
        time_estimate_min: parseInt(timeEstimate) || 30,
        category: category.trim() || 'General'
      });
    }
    setIsModalOpen(false);
  };

  const formatScheduleText = (days: number[]) => {
    if (days.length === 7) return 'Everyday';
    if (days.length === 5 && days.includes(1) && days.includes(2) && days.includes(3) && days.includes(4) && days.includes(5)) {
      return 'Weekdays (Mon-Fri)';
    }
    if (days.length === 2 && days.includes(0) && days.includes(6)) {
      return 'Weekends';
    }
    return days.map(d => WEEKDAYS.find(w => w.day === d)?.label).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Recurring Tasks Configuration
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Independent daily state tracking</span>
            <span aria-hidden="true">·</span>
            <span>Weekday schedule assignment</span>
            <span aria-hidden="true">·</span>
            <span>{tasks.length} defined recurring routines</span>
          </div>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Recurring Task</span>
        </button>
      </div>

      {/* Task definitions list */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {tasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">
              No recurring tasks defined yet. Click &quot;New Recurring Task&quot; to create your daily productivity template.
            </div>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {task.title}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-medium ${
                        task.priority === 'high'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                          : task.priority === 'medium'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {task.category || 'General'}
                    </span>
                    {!task.is_active && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                        Paused
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 pt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      {formatScheduleText(task.weekdays)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {task.time_estimate_min || 30} mins
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => onUpdateTask(task.id, { is_active: !task.is_active })}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      task.is_active
                        ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    {task.is_active ? 'Active' : 'Paused'}
                  </button>

                  <button
                    onClick={() => openEdit(task)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit task"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingTask ? 'Edit Recurring Task' : 'Define Recurring Task'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Morning 20-min Meditation, Code Review..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Notes, link, or outcome definition..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Weekday schedule picker */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Scheduled Days (Recurring)
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map(w => {
                    const isSelected = weekdays.includes(w.day);
                    return (
                      <button
                        type="button"
                        key={w.day}
                        onClick={() => toggleWeekday(w.day)}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Est. Duration
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="5"
                    value={timeEstimate}
                    onChange={e => setTimeEstimate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="General"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
