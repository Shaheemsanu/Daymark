import React, { useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';

type Notes = { gratitude: string; journalNotes: string };

interface WellnessNotesProps extends Notes {
  onSave?: (notes: Notes) => void;
  footerText?: string;
  accent?: 'amber' | 'blue';
}

export const WellnessNotes: React.FC<WellnessNotesProps> = ({ gratitude, journalNotes, onSave, footerText, accent = 'amber' }) => {
  const [draft, setDraft] = useState<Notes | null>(null);
  const [mode, setMode] = useState<'auto' | 'editing' | 'saved'>('auto');
  const firstField = useRef<HTMLInputElement>(null);
  const editing = mode === 'editing' || (mode === 'auto' && !gratitude && !journalNotes);
  const values = editing && draft ? draft : { gratitude, journalNotes };
  const beginEditing = () => {
    if (!onSave || editing) return;
    setDraft({ gratitude, journalNotes });
    setMode('editing');
  };
  const saveNotes = () => {
    if (!onSave || !editing) return;
    onSave(values);
    setDraft(null);
    setMode('saved');
  };
  const colors = accent === 'blue' ? {
    focus: 'focus:ring-blue-500',
    note: 'text-slate-500 dark:text-slate-400',
    save: 'bg-blue-600 text-white hover:bg-blue-500',
    edit: 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40',
  } : {
    focus: 'focus:ring-amber-500',
    note: 'text-amber-700/80 dark:text-amber-300/70',
    save: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
    edit: 'border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40',
  };
  const fieldClass = `mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${colors.focus} read-only:cursor-default read-only:caret-transparent read-only:focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`;

  return (
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      saveNotes();
    }}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        Gratitude / Highlight
        <input ref={firstField} type="text" value={values.gratitude}
          readOnly={!editing || !onSave}
          onChange={event => {
            if (editing && onSave) setDraft({ ...values, gratitude: event.target.value });
          }}
          placeholder="One thing I'm grateful for today..." className={fieldClass} />
      </label>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        Daily Reflection / Journal
        <textarea rows={3} value={values.journalNotes}
          readOnly={!editing || !onSave}
          onChange={event => {
            if (editing && onSave) setDraft({ ...values, journalNotes: event.target.value });
          }}
          placeholder="Key observations, accomplishments, thoughts..."
          className={`${fieldClass} resize-y`} />
      </label>
      <div className="flex items-center justify-end gap-3">
        {footerText && <p className={`mr-auto text-[11px] leading-relaxed ${colors.note}`}>{footerText}</p>}
        <button type="button" disabled={!onSave} onClick={event => {
          // Keep the native action stable as Edit changes to Save. A submit
          // button here can immediately submit the same click and lock fields.
          event.preventDefault();
          if (editing) {
            saveNotes();
          } else {
            beginEditing();
            firstField.current?.focus();
          }
        }} className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${editing ? colors.save : `border ${colors.edit}`}`}>
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>
    </form>
  );
};
