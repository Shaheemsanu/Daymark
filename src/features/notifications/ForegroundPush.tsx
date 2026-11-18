import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { getMessaging, isSupported, onMessage } from 'firebase/messaging';
import { firebaseApp } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';

type Notice = { id: string; title: string; body: string; receivedAt: number; read: boolean; view?: string };
export function ForegroundPush({ userId, onNavigate }: { userId: string; onNavigate: (view: string) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);
  const [error, setError] = useState('');
  const loadNotices = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('notifications').select('id,title,body,view,created_at,read_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
    if (error) { setError('Could not load notifications.'); return; }
    setError('');
    setNotices((data || []).map(row => ({ id: row.id, title: row.title, body: row.body, view: row.view || undefined, receivedAt: Date.parse(row.created_at), read: !!row.read_at })));
  };
  useEffect(() => {
    setNotices([]); setMessage(null); setOpen(false);
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void loadNotices();
    const onFocus = () => { void loadNotices(); };
    window.addEventListener('focus', onFocus);
    const channel = supabase?.channel(`notification-history:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onFocus).subscribe();
    void isSupported().then((supported) => {
      if (!supported || disposed) return;
      unsubscribe = onMessage(getMessaging(firebaseApp), (payload) => {
        const notice: Notice = { id: payload.messageId || crypto.randomUUID(), title: payload.notification?.title || 'Daymark', body: payload.notification?.body || '', receivedAt: Date.now(), read: false, view: payload.data?.view };
        setMessage(notice);
        void loadNotices();
      });
    }).catch(() => {});
    return () => { disposed = true; unsubscribe?.(); window.removeEventListener('focus', onFocus); if (channel && supabase) void supabase.removeChannel(channel); };
  }, [userId]);
  const unread = notices.filter(notice => !notice.read).length;
  const updateNotices = async (next: Notice[]) => {
    if (!supabase) return;
    const removed = notices.filter(old => !next.some(item => item.id === old.id)).map(item => item.id);
    const marked = next.filter(item => item.read && notices.some(old => old.id === item.id && !old.read)).map(item => item.id);
    if (removed.length) { const { error } = await supabase.from('notifications').delete().eq('user_id', userId).in('id', removed); if (error) { setError('Could not clear notifications.'); return; } }
    if (marked.length) { const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).in('id', marked); if (error) { setError('Could not mark notifications as read.'); return; } }
    await loadNotices();
  };
  return <>
    <div className="relative">
      <button type="button" onClick={() => { if (!open) void loadNotices(); setOpen(!open); }} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />}
      </button>
      {open && <section aria-label="Recent notifications" className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
        <div className="border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900 dark:text-slate-100">Notifications</h2><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Your recent notifications across devices.</p></div><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="-mt-1 shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-4 w-4" /></button></div>
          {error && <p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}
          {notices.length > 0 && <div className="mt-3 flex items-center justify-between gap-3">{unread > 0 ? <button type="button" onClick={() => updateNotices(notices.map(notice => ({ ...notice, read: true })))} className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"><CheckCheck className="h-3.5 w-3.5" />Mark all as read</button> : <span className="text-xs text-slate-500">All caught up</span>}<button type="button" onClick={() => updateNotices([])} className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">Clear all</button></div>}
        </div>
        {notices.length === 0 ? <p className="px-4 py-7 text-center text-sm text-slate-500">No notifications yet.</p> : <ul className="max-h-80 space-y-2 overflow-y-auto p-3">{notices.map(notice => <li key={notice.id} className={`rounded-xl border p-3 ${notice.read ? 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'}`}>
          <button type="button" className="w-full rounded text-left" onClick={() => { updateNotices(notices.map(item => item.id === notice.id ? { ...item, read: true } : item)); if (notice.view) { onNavigate(notice.view); setOpen(false); } }}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{!notice.read && <span aria-label="Unread" className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />}{notice.title}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notice.body}</p>
          </button>
          <time className="mt-2 block text-xs text-slate-500 dark:text-slate-400" dateTime={new Date(notice.receivedAt).toISOString()}>{new Date(notice.receivedAt).toLocaleString()}</time>
          <div className="mt-3 flex items-center gap-2">{!notice.read && <button type="button" onClick={() => updateNotices(notices.map(item => item.id === notice.id ? { ...item, read: true } : item))} className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900">Mark as read</button>}<button type="button" onClick={() => updateNotices(notices.filter(item => item.id !== notice.id))} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"><Trash2 className="h-3 w-3" />Clear</button></div>
        </li>)}</ul>}
      </section>}
    </div>
    {message && <div role="status" className="fixed right-4 top-20 z-50 max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <strong>{message.title}</strong><p className="text-sm">{message.body}</p>
      <button type="button" className="mt-2 text-sm underline" onClick={() => setMessage(null)}>Dismiss</button>
    </div>}
  </>;
}
