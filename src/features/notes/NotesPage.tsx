import React, { useState } from 'react';
import { DailyNote, MoodType } from '../../lib/types';
import { formatHeaderDate } from '../../lib/dateUtils';
import { formatDisplayDate } from '../../utils/dateFormatting';
import { Calendar, Search, Sparkles, Heart, Moon, Zap, Save, Check } from 'lucide-react';

interface NotesPageProps {
  notes: DailyNote[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSaveNote: (date: string, updates: Partial<DailyNote>) => void;
}

const MOODS: { type: MoodType; label: string; icon: string }[] = [
  { type: 'great', label: 'Great', icon: '😄' },
  { type: 'good', label: 'Good', icon: '🙂' },
  { type: 'neutral', label: 'Neutral', icon: '😐' },
  { type: 'low', label: 'Low', icon: '😔' },
  { type: 'stressed', label: 'Stressed', icon: '😫' }
];

export const NotesPage: React.FC<NotesPageProps> = ({
  notes,
  selectedDate,
  onSelectDate,
  onSaveNote
}) => {
  const currentNote = notes.find(n => n.entry_date === selectedDate) || {
    id: `note-${selectedDate}`,
    user_id: '',
    entry_date: selectedDate,
    content: '',
    mood: undefined,
    gratitude: '',
    sleep_hours: 7.5,
    water_ml: 2000,
    energy_score: 3
  };

  const [content, setContent] = useState(currentNote.content || '');
  const [gratitude, setGratitude] = useState(currentNote.gratitude || '');
  const [mood, setMood] = useState<MoodType | undefined>(currentNote.mood || undefined);
  const [energyScore, setEnergyScore] = useState<number>(currentNote.energy_score || 3);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state if selectedDate changes
  React.useEffect(() => {
    const n = notes.find(item => item.entry_date === selectedDate);
    setContent(n?.content || '');
    setGratitude(n?.gratitude || '');
    setMood(n?.mood || undefined);
    setEnergyScore(n?.energy_score || 3);
    setSavedSuccess(false);
  }, [selectedDate, notes]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveNote(selectedDate, {
      content: content.trim(),
      gratitude: gratitude.trim() || null,
      mood: mood || null,
      energy_score: energyScore
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const pastNotes = notes.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.content?.toLowerCase().includes(q) ||
      n.gratitude?.toLowerCase().includes(q) ||
      n.entry_date.includes(q)
    );
  }).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daily Notes &amp; Reflections
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Cognitive journal &amp; daily mindfulness</span>
            <span aria-hidden="true">·</span>
            <span>{formatHeaderDate(selectedDate)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && onSelectDate(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
          />

          <button
            onClick={() => handleSave()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs whitespace-nowrap"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Saved!' : 'Save Reflection'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Editor */}
        <div className="lg:col-span-8 space-y-5">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-5">
            {/* Mood Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Emotional State / Mood
              </label>
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map(m => (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => {
                      setMood(m.type);
                      onSaveNote(selectedDate, { mood: m.type });
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                      mood === m.type
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl leading-none">{m.icon}</span>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Energy Score */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                <span className="font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Energy Level</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {energyScore} / 5
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => {
                      setEnergyScore(score);
                      onSaveNote(selectedDate, { energy_score: score });
                    }}
                    className={`py-2 rounded-xl border text-xs font-mono font-semibold transition-colors ${
                      energyScore === score
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Level {score}
                  </button>
                ))}
              </div>
            </div>

            {/* Gratitude Prompt */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Daily Highlight &amp; Gratitude</span>
              </label>
              <input
                type="text"
                value={gratitude}
                onChange={e => setGratitude(e.target.value)}
                placeholder="What brought you genuine joy or clarity today?"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Freeform Journal */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Daily Journal &amp; Notes
              </label>
              <textarea
                rows={8}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Document your key decisions, thoughts, lessons learned, or stream of consciousness..."
                className="w-full px-3.5 py-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400 font-sans"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleSave()}
                className="px-5 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors"
              >
                {savedSuccess ? 'Changes Saved ✓' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>

        {/* Previous Notes Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Historical Notes Index
            </h3>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes by keyword..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {pastNotes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No historical notes found.</p>
              ) : (
                pastNotes.map(n => {
                  const isCurrent = n.entry_date === selectedDate;
                  return (
                    <div
                      key={n.id}
                      onClick={() => onSelectDate(n.entry_date)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500'
                          : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                          {formatDisplayDate(n.entry_date)}
                        </span>
                        {n.mood && (
                          <span className="capitalize text-[11px] text-slate-400">
                            {n.mood}
                          </span>
                        )}
                      </div>
                      {n.gratitude && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1">
                          ✨ {n.gratitude}
                        </p>
                      )}
                      <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                        {n.content || '(Empty entry)'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
