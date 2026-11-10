import React, { useState } from 'react';
import { CustomTracker, TrackerEntry, TrackerType } from '../../lib/types';
import { Plus, Trash2, Edit2, Droplet, Moon, Activity, CheckCircle2, Circle, Flame, Sparkles } from 'lucide-react';
import { calculateStreak } from '../../lib/dateUtils';

interface TrackerPageProps {
  trackers: CustomTracker[];
  trackerEntries: TrackerEntry[];
  selectedDate: string;
  onAddTracker: (tracker: Omit<CustomTracker, 'id' | 'user_id' | 'created_at'>) => void;
  onDeleteTracker: (id: string) => void;
  onUpdateEntry: (trackerId: string, numericVal?: number | null, boolVal?: boolean | null) => void;
}

export const TrackerPage: React.FC<TrackerPageProps> = ({
  trackers,
  trackerEntries,
  selectedDate,
  onAddTracker,
  onDeleteTracker,
  onUpdateEntry
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<TrackerType>('numeric');
  const [unit, setUnit] = useState('mins');
  const [targetValue, setTargetValue] = useState('30');
  const [color, setColor] = useState('#3B82F6');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddTracker({
      name: name.trim(),
      type,
      unit: type === 'numeric' ? unit.trim() : undefined,
      target_value: parseFloat(targetValue) || 1,
      color
    });

    setName('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Habit &amp; Metric Trackers
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Numeric and binary habit monitoring</span>
            <span aria-hidden="true">·</span>
            <span>Logging for {selectedDate}</span>
            <span aria-hidden="true">·</span>
            <span>{trackers.length} active trackers</span>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Tracker</span>
        </button>
      </div>

      {/* Tracker Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trackers.map(tracker => {
          const entry = trackerEntries.find(
            e => e.tracker_id === tracker.id && e.entry_date === selectedDate
          );

          // Calculate completed dates for streak
          const completedDates = trackerEntries
            .filter(e => {
              if (e.tracker_id !== tracker.id) return false;
              if (tracker.type === 'boolean') return !!e.boolean_value;
              return (e.numeric_value || 0) >= tracker.target_value;
            })
            .map(e => e.entry_date);

          const currentStreak = calculateStreak(completedDates);

          const isGoalMet =
            tracker.type === 'boolean'
              ? !!entry?.boolean_value
              : (entry?.numeric_value || 0) >= tracker.target_value;

          return (
            <div
              key={tracker.id}
              className={`p-5 rounded-2xl border transition-all bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between ${
                isGoalMet
                  ? 'border-emerald-200 dark:border-emerald-900/60 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tracker.color }}
                    />
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {tracker.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => onDeleteTracker(tracker.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    title="Delete tracker"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4">
                  <span>
                    Daily Target:{' '}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      {tracker.type === 'boolean'
                        ? 'Yes / Completed'
                        : `${tracker.target_value} ${tracker.unit || ''}`}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-bold">
                    <Flame className="w-3.5 h-3.5" />
                    {currentStreak}d streak
                  </span>
                </div>
              </div>

              {/* Interactive Value Controller */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                {tracker.type === 'boolean' ? (
                  <button
                    onClick={() =>
                      onUpdateEntry(
                        tracker.id,
                        null,
                        !entry?.boolean_value
                      )
                    }
                    className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                      entry?.boolean_value
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {entry?.boolean_value ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed for Today ✓</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 text-slate-400" />
                        <span>Tap to Mark Done</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Current Progress</span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                        {entry?.numeric_value || 0} / {tracker.target_value} {tracker.unit}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-3 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          backgroundColor: tracker.color,
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((entry?.numeric_value || 0) / Math.max(tracker.target_value, 1)) *
                                100
                            )
                          )}%`
                        }}
                      />
                    </div>

                    {/* Stepper buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const curr = entry?.numeric_value || 0;
                          const delta = tracker.target_value > 10 ? 5 : 1;
                          onUpdateEntry(tracker.id, Math.max(0, curr - delta), null);
                        }}
                        className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        -
                      </button>
                      <button
                        onClick={() => {
                          const curr = entry?.numeric_value || 0;
                          const delta = tracker.target_value > 10 ? 5 : 1;
                          onUpdateEntry(tracker.id, curr + delta, null);
                        }}
                        className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: New Custom Tracker */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create Custom Tracker
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tracker Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Daily Reading, Cold Shower, Pushups..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tracker Type
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as TrackerType)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="numeric">Numeric Metric (Count / Vol)</option>
                    <option value="boolean">Yes / No (Checkbox)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Daily Target
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    disabled={type === 'boolean'}
                    value={targetValue}
                    onChange={e => setTargetValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {type === 'numeric' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Measurement Unit
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="e.g. pages, mins, reps, ml..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {['#3B82F6', '#10B981', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'].map(
                    c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          color === c ? 'scale-115 ring-2 ring-slate-900 dark:ring-white ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    )
                  )}
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
                  Save Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
