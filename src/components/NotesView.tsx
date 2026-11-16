import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Eye,
  AlertCircle,
  Calendar,
  X,
  Tag,
  Check,
  CheckCircle2,
  Circle,
  Upload
} from 'lucide-react';
import { LoaderCircle } from 'lucide-react';
import { NoteItem, TaskPriority } from '../types';
import { notesService } from '../features/notes/notesService';
import { formatDisplayDate } from '../utils/dateFormatting';

interface NotesViewProps {
  currencySymbol?: string;
}

const CATEGORIES = ['All', 'General', 'Work', 'Personal', 'Ideas', 'Financial', 'Study'];

const PriorityBadge = ({ priority }: { priority?: TaskPriority }) => (
  <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : priority === 'low' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
    {priority ? `${priority} priority` : 'No priority'}
  </span>
);
type NotesDateFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
type NotesSort = 'newest' | 'oldest' | 'title' | 'priority' | 'priorityAsc';

const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const NotesView: React.FC<NotesViewProps> = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [notesError, setNotesError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<NotesSort>('newest');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [categoryManagerError, setCategoryManagerError] = useState('');
  const [categoryAction, setCategoryAction] = useState<'add' | 'edit' | 'delete' | null>(null);
  const isSavingCategory = categoryAction !== null;
  const [dateFilter, setDateFilter] = useState<NotesDateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    return toLocalDateInput(date);
  });
  const [customEndDate, setCustomEndDate] = useState(() => toLocalDateInput(new Date()));

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [viewingNote, setViewingNote] = useState<NoteItem | null>(null);
  const [viewImage, setViewImage] = useState<string | undefined>();
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const viewDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (viewingNote) viewDialogRef.current?.showModal();
  }, [viewingNote]);

  useEffect(() => {
    setViewImage(undefined);
    setImageError('');
    if (!viewingNote) return;
    let cancelled = false;
    setImageLoading(true);
    notesService.getNoteImage(viewingNote.id).then(image => {
      if (!cancelled) setViewImage(image);
    }).catch(error => {
      if (!cancelled) setImageError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setImageLoading(false);
    });
    return () => { cancelled = true; };
  }, [viewingNote?.id]);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formPriority, setFormPriority] = useState<TaskPriority | ''>('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [imageChanged, setImageChanged] = useState(false);
  const [editImageLoading, setEditImageLoading] = useState(false);
  const [editImageError, setEditImageError] = useState('');
  const [editImageRetry, setEditImageRetry] = useState(0);

  useEffect(() => {
    setEditImageError('');
    setEditImageLoading(false);
    if (!isModalOpen || !editingNote || imageChanged || editingNote.imageUrl) return;
    let cancelled = false;
    setEditImageLoading(true);
    notesService.getNoteImage(editingNote.id).then(image => {
      if (!cancelled) setFormImageUrl(image || '');
    }).catch(error => {
      if (!cancelled) setEditImageError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setEditImageLoading(false);
    });
    return () => { cancelled = true; };
  }, [isModalOpen, editingNote?.id, imageChanged, editImageRetry]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadNotesData();
    loadCustomCategories();
  }, []);

  const loadNotesData = async () => {
    setLoading(true);
    setNotesError(null);
    try {
      const data = await notesService.getNotes();
      setNotes(data);
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const loadCustomCategories = async () => {
    try {
      let categories = await notesService.getCategories();
      const migrated = window.localStorage.getItem('daymark.noteCategoriesMigrated') === 'true';
      if (!migrated) {
        let legacyCategories: string[] = [];
        try {
          const stored = JSON.parse(window.localStorage.getItem('daymark.noteCategories') || '[]');
          if (Array.isArray(stored)) legacyCategories = stored.filter((item): item is string => typeof item === 'string');
        } catch {
          // Ignore malformed legacy browser data and use Supabase categories.
        }
        if (categories.length === 0 && legacyCategories.length > 0) {
          categories = legacyCategories;
          await notesService.saveCategories(categories);
        }
        window.localStorage.setItem('daymark.noteCategoriesMigrated', 'true');
      }
      setCustomCategories(categories);
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpenAdd = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('General');
    setFormPriority('');
    setFormImageUrl('');
    setImageChanged(false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: NoteItem) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormCategory(note.category || 'General');
    setFormPriority(note.priority || '');
    setFormImageUrl(note.imageUrl || '');
    setImageChanged(false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setFormError('Image size should be under 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormImageUrl(reader.result as string);
      setImageChanged(true);
      setFormError('');
    };
    reader.onerror = () => {
      setFormError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!formTitle.trim()) {
      setFormError('Note title is required.');
      return;
    }

    setSaving(true);
    try {
      const changes = {
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        priority: formPriority || undefined,
        ...(!editingNote || imageChanged ? { imageUrl: formImageUrl.trim() || undefined } : {}),
      };
      if (editingNote) {
        await notesService.updateNote(editingNote.id, changes);
        setNotes(current => current.map(note => note.id === editingNote.id ? { ...note, ...changes, updatedAt: Date.now() } : note));
      } else {
        const created = await notesService.saveNote({ ...changes, completed: false });
        setNotes(current => [created, ...current]);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
      return;
    } finally {
      setSaving(false);
    }

    setIsModalOpen(false);
  };

  const handleToggle = async (note: NoteItem) => {
    setTogglingIds(current => new Set(current).add(note.id));
    setNotesError(null);
    try {
      await notesService.updateNote(note.id, { completed: !note.completed });
      setNotes(current => current.map(item => item.id === note.id ? { ...item, completed: !note.completed } : item));
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : String(error));
    } finally {
      setTogglingIds(current => { const next = new Set(current); next.delete(note.id); return next; });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        setDeletingId(id);
        await notesService.deleteNote(id);
        await loadNotesData();
      } catch (error) {
        setNotesError(error instanceof Error ? error.message : String(error));
      } finally {
        setDeletingId(null);
      }
    }
  };

  const noteCategories = useMemo(() => Array.from(new Set([
    ...CATEGORIES.slice(1),
    ...customCategories,
    ...notes.map(note => note.category).filter(Boolean)
  ])), [customCategories, notes]);

  const saveNewCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    if (noteCategories.some(category => category.toLowerCase() === name.toLowerCase())) {
      setCategoryManagerError('This category already exists.');
      return;
    }
    setCategoryAction('add');
    setCategoryManagerError('');
    try {
      const updated = [...customCategories, name];
      await notesService.saveCategories(updated);
      setCustomCategories(updated);
      setNewCategoryName('');
    } catch (error) {
      setCategoryManagerError(error instanceof Error ? error.message : 'Could not save the category.');
    } finally {
      setCategoryAction(null);
    }
  };

  const saveCategoryEdit = async () => {
    if (!editingCategory) return;
    const nextName = editingCategoryName.trim();
    if (!nextName || nextName === editingCategory) return;
    if (noteCategories.some(category => category.toLowerCase() === nextName.toLowerCase())) {
      setCategoryManagerError('This category already exists.');
      return;
    }
    setCategoryAction('edit');
    setCategoryManagerError('');
    try {
      await Promise.all(notes.filter(note => note.category === editingCategory).map(note => notesService.updateNote(note.id, { category: nextName })));
      const updatedCategories = customCategories.includes(editingCategory)
        ? customCategories.map(category => category === editingCategory ? nextName : category)
        : [...customCategories, nextName];
      await notesService.saveCategories(updatedCategories);
      setCustomCategories(updatedCategories);
      if (selectedCategory === editingCategory) setSelectedCategory(nextName);
      await loadNotesData();
      setEditingCategory(null);
      setEditingCategoryName('');
    } catch (error) {
      setCategoryManagerError(error instanceof Error ? error.message : String(error));
    } finally {
      setCategoryAction(null);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setCategoryAction('delete');
    setCategoryManagerError('');
    try {
      await Promise.all(notes.filter(note => note.category === categoryToDelete).map(note => notesService.updateNote(note.id, { category: 'General' })));
      const updatedCategories = customCategories.filter(category => category !== categoryToDelete);
      await notesService.saveCategories(updatedCategories);
      setCustomCategories(updatedCategories);
      if (selectedCategory === categoryToDelete) setSelectedCategory('All');
      setCategoryToDelete(null);
      await loadNotesData();
    } catch (error) {
      setCategoryManagerError(error instanceof Error ? error.message : String(error));
    } finally {
      setCategoryAction(null);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes
      .filter(n => {
        if (selectedCategory !== 'All' && n.category !== selectedCategory) return false;
        const noteDate = new Date(n.createdAt);
        const noteDay = toLocalDateInput(noteDate);
        if (dateFilter === 'custom' && (noteDay < customStartDate || noteDay > customEndDate)) return false;
        if (dateFilter !== 'all' && dateFilter !== 'custom') {
          const today = new Date();
          const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (dateFilter === 'week') {
            const daysSinceMonday = (start.getDay() + 6) % 7;
            start.setDate(start.getDate() - daysSinceMonday);
          } else if (dateFilter === 'month') {
            start.setDate(1);
          } else if (dateFilter === 'year') {
            start.setMonth(0, 1);
          }
          if (noteDate < start) return false;
          if (dateFilter === 'today' && noteDay !== toLocalDateInput(today)) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchContent = n.content.toLowerCase().includes(q);
          const matchCat = n.category.toLowerCase().includes(q);
          if (!matchTitle && !matchContent && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
        if (sortBy === 'priority' || sortBy === 'priorityAsc') {
          const ranks = { high: 3, medium: 2, low: 1 };
          if (Boolean(a.priority) !== Boolean(b.priority)) return a.priority ? -1 : 1;
          const difference = (a.priority ? ranks[a.priority] : 0) - (b.priority ? ranks[b.priority] : 0);
          return (sortBy === 'priorityAsc' ? difference : -difference) || b.createdAt - a.createdAt;
        }
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        if (sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [notes, selectedCategory, searchQuery, sortBy, dateFilter, customStartDate, customEndDate]);

  return (
    <div className="relative space-y-6 pb-24 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl shadow-2xs">
            📝
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Todo Notes
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Keep track of your to-dos, add details, and set an optional priority
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => { setCategoryManagerError(''); setIsCategoryManagerOpen(true); }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Tag className="h-3.5 w-3.5" />
            Manage Categories
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-600/30 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Todo Note</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      {notesError && <div role="alert" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">Could not load or save notes in Supabase: {notesError}</div>}

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes by title, content, or tag..."
            className="h-10 w-full pl-10 pr-4 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 items-center gap-2 md:flex md:flex-wrap">
          {/* Category Filter */}
          <div className="col-span-2 flex w-full min-w-0 items-center gap-2 md:col-span-1 md:w-auto md:shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              aria-pressed={selectedCategory === 'All'}
              className={`h-10 min-w-0 flex-1 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-all md:flex-none ${
                selectedCategory === 'All'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>
            <select
              aria-label="Filter notes by category"
              value={selectedCategory === 'All' ? '' : selectedCategory}
              onChange={event => setSelectedCategory(event.target.value || 'All')}
              className={`h-10 min-w-0 max-w-none flex-1 rounded-xl border px-3 text-xs font-medium focus:outline-none focus:border-indigo-500 md:max-w-40 md:flex-none ${
                selectedCategory !== 'All'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <option value="">Categories</option>
              {noteCategories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>

          <label className="relative col-span-1 block min-w-0 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Calendar aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <select
              aria-label="Filter notes by date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as NotesDateFilter)}
              className="h-10 min-w-0 w-full text-xs py-2 pl-9 pr-3 font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none md:w-auto"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </label>

          {dateFilter === 'custom' && (
            <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                From
                <input type="date" aria-label="Notes start date" value={customStartDate} max={customEndDate} onChange={e => setCustomStartDate(e.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-normal normal-case tracking-normal text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                To
                <input type="date" aria-label="Notes end date" value={customEndDate} min={customStartDate} max={toLocalDateInput(new Date())} onChange={e => setCustomEndDate(e.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-normal normal-case tracking-normal text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
              </label>
            </div>
          )}

          {/* Sort By */}
          <select
            aria-label="Sort notes"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as NotesSort)}
            className="h-10 min-w-0 w-full text-xs py-2 px-2.5 font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none md:w-auto md:px-3"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title">Alphabetical</option>
            <option value="priority">Priority: High to Low</option>
            <option value="priorityAsc">Priority: Low to High</option>
          </select>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 h-48 text-slate-400 text-xs">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading notes from Supabase...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center text-2xl mb-3">
            📝
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No notes found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {searchQuery || selectedCategory !== 'All' || dateFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Create your first todo note to get started.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            + Create Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={event => {
                if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
                setViewingNote(note);
              }}
              className={`cursor-pointer border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all group ${note.completed ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/60 dark:hover:border-emerald-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
                    {note.category || 'General'}
                  </span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setViewingNote(note)}
                      aria-label={`View ${note.title}`}
                      title="View note"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(note)}
                      disabled={togglingIds.has(note.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit note"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={deletingId === note.id || togglingIds.has(note.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Delete note"
                    >
                      {deletingId === note.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="mb-2 flex items-start gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={Boolean(note.completed)}
                    aria-busy={togglingIds.has(note.id)}
                    disabled={togglingIds.has(note.id)}
                    onClick={() => void handleToggle(note)}
                    aria-label={`Mark ${note.title} ${note.completed ? 'incomplete' : 'complete'}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer disabled:cursor-wait"
                  >
                    {togglingIds.has(note.id) ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-sky-500" /> : note.completed ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <Circle aria-hidden="true" className="h-5 w-5 text-slate-300 hover:text-slate-400 dark:text-slate-600" />}
                  </button>
                  <h3 className={`text-sm font-bold line-clamp-1 ${note.completed ? 'text-emerald-700 dark:text-emerald-300 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                    {note.title}
                  </h3>
                </div>
                <div className="mb-3"><PriorityBadge priority={note.priority} /></div>

                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-4 leading-relaxed mb-4">
                  {note.content}
                </p>

              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>{formatDisplayDate(note.createdAt)}</span>
                {note.updatedAt && <span>(edited)</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingNote && (
        <dialog ref={viewDialogRef} onCancel={() => setViewingNote(null)} onClose={() => setViewingNote(null)} aria-labelledby="view-todo-title" className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 id="view-todo-title" className="min-w-0 break-words text-lg font-bold">{viewingNote.title}</h2>
            <button type="button" onClick={() => viewDialogRef.current?.close()} aria-label="Close note" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">{viewingNote.category || 'General'}</span>
              <PriorityBadge priority={viewingNote.priority} />
              <span className={viewingNote.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>{viewingNote.completed ? 'Completed' : 'Pending'}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">{viewingNote.content || 'No additional details.'}</p>
            {imageLoading && <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading image…</p>}
            {imageError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">Could not load image: {imageError}. Close and reopen View to retry.</p>}
            {viewImage && <img src={viewImage} alt={viewingNote.title} className="max-h-[50vh] w-full rounded-xl object-contain" />}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>Created {formatDisplayDate(viewingNote.createdAt)}</span>
              {viewingNote.updatedAt && <span>Edited {formatDisplayDate(viewingNote.updatedAt)}</span>}
            </div>
          </div>
        </dialog>
      )}

      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="notes-category-manager-title">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h3 id="notes-category-manager-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Manage Note Categories</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add, rename, or remove custom categories.</p>
              </div>
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} disabled={isSavingCategory} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800" aria-label="Close category manager"><X className="h-4 w-4" /></button>
            </div>

            <form className="border-b border-slate-200 p-5 dark:border-slate-800" onSubmit={saveNewCategory}>
              <label htmlFor="new-note-category" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">New category</label>
              <div className="flex gap-2">
                <input id="new-note-category" value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} maxLength={40} placeholder="e.g. Projects, Health" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                <button type="submit" disabled={!newCategoryName.trim() || isSavingCategory} aria-busy={categoryAction === 'add'} className={`inline-flex min-w-20 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed ${categoryAction === 'add' ? 'disabled:opacity-100' : 'disabled:opacity-50'}`}>{categoryAction === 'add' ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Plus className="h-3.5 w-3.5" />Add</>}</button>
              </div>
            </form>

            {categoryManagerError && <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{categoryManagerError}</p>}

            <div className="space-y-2 overflow-y-auto p-5">
              <h4 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">All Categories ({noteCategories.length})</h4>
              {noteCategories.map(item => {
                const isDefault = CATEGORIES.includes(item);
                const usage = notes.filter(note => note.category === item).length;
                const isEditing = editingCategory === item;
                return <div key={item} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                  {isEditing ? <input autoFocus value={editingCategoryName} onChange={event => setEditingCategoryName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveCategoryEdit(); } }} maxLength={40} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" /> : <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item}</span>}
                  <span className="shrink-0 text-[11px] text-slate-400">{usage} {usage === 1 ? 'note' : 'notes'}</span>
                  {isDefault ? <span className="shrink-0 text-[10px] font-medium text-slate-400">Default</span> : isEditing ? <>
                    <button type="button" onClick={() => void saveCategoryEdit()} disabled={isSavingCategory || !editingCategoryName.trim() || editingCategoryName.trim() === editingCategory} aria-busy={categoryAction === 'edit'} aria-label={categoryAction === 'edit' ? 'Saving category' : 'Save category'} className={`inline-flex min-w-16 items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${categoryAction === 'edit' ? 'bg-indigo-600 text-white opacity-100' : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none'}`}>{categoryAction === 'edit' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Save'}</button>
                    <button type="button" onClick={() => { setEditingCategory(null); setEditingCategoryName(''); }} disabled={isSavingCategory} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">Cancel</button>
                  </> : <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => { setEditingCategory(item); setEditingCategoryName(item); setCategoryManagerError(''); }} className="rounded-md p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400" aria-label={`Edit ${item}`}><Edit2 className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => { setCategoryToDelete(item); setCategoryManagerError(''); }} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400" aria-label={`Delete ${item}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>}
                </div>;
              })}
            </div>

            <div className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800">
              <button type="button" onClick={() => setIsCategoryManagerOpen(false)} disabled={isSavingCategory} className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">Done</button>
            </div>
          </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-note-category-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <h3 id="delete-note-category-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete “{categoryToDelete}”?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{notes.some(note => note.category === categoryToDelete) ? 'Notes in this category will be moved to General.' : 'This category will be removed from your list.'}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCategoryToDelete(null)} disabled={isSavingCategory} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={() => void confirmDeleteCategory()} disabled={isSavingCategory} aria-busy={categoryAction === 'delete'} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-100">{categoryAction === 'delete' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{categoryAction === 'delete' ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating New Note action, above mobile navigation */}
      <button
        type="button"
        onClick={handleOpenAdd}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-600 text-white shadow-xl shadow-indigo-600/35 transition-all hover:scale-105 hover:bg-indigo-700 active:scale-95 md:bottom-6 md:right-6"
        title="New Note"
        aria-label="Create a new note"
      >
        <Plus className="h-5 w-5" />
      </button>

      {/* Add / Edit Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingNote ? 'Edit Todo Note' : 'Create Todo Note'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Project Sprint Ideas & Expenses"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  {noteCategories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="todo-note-priority" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Priority (optional)</label>
                <select id="todo-note-priority" value={formPriority} onChange={event => setFormPriority(event.target.value as TaskPriority | '')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Details (optional)
                </label>
                <textarea
                  rows={5}
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="Add details, reminders, or steps for this to-do..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Image Attachment Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Attach Image (Saved to Supabase / Storage)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {(formImageUrl || (editingNote && !imageChanged && (editImageLoading || editImageError))) && (
                    <button
                      type="button"
                      onClick={() => { setFormImageUrl(''); setImageChanged(true); }}
                      className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      Remove attachment
                    </button>
                  )}
                </div>

                {editImageLoading && <p role="status" className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading existing image…</p>}
                {editImageError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">Could not load image: {editImageError}. The existing attachment is kept unless replaced or removed. <button type="button" onClick={() => setEditImageRetry(value => value + 1)} className="font-semibold underline">Retry</button></p>}

                {formImageUrl && (
                  <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {saving ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving to Supabase…</span> : editingNote ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
