import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Plus, LoaderCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DATA_SOURCES, validScopeDates } from './chatScope';
import type { ChatSource, ContextMeta } from './chatScope';
import { formatDate } from '../../utils/constants';

type Message = { role: 'user' | 'assistant'; text: string; context?: ContextMeta };
export default function GeneralChatScreen({ active }: { active: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<ChatSource>('expenses');
  const today = formatDate(new Date());
  const [start, setStart] = useState(today.slice(0, 7) + '-01');
  const [end, setEnd] = useState(today);
  const validDates = validScopeDates(start, end);
  const resetChat = () => { setMessages([]); setDraft(''); setFailed(''); setError(''); };
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    setChecking(true);
    fetch('/api/general-chat/status', { cache: 'no-store', signal: abort.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Start Daymark with its Node backend to use Daymark AI.');
      const result = await response.json(); setReady(result.configured);
      setError(result.configured ? '' : 'Add GEMINI_GENERAL_API_KEY and your existing Supabase settings to the server environment, then restart.');
    }).catch(cause => { if (!abort.signal.aborted) { setReady(false); setError(cause instanceof Error ? cause.message : 'Could not connect to chat.'); } }).finally(() => { if (!abort.signal.aborted) setChecking(false); });
    return () => abort.abort();
  }, [active]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, pending, active]);

  const send = async (retry = false) => {
    const text = (retry ? failed : draft).trim();
    if (!ready || checking || !validDates || busy.current || !text || text.length > 2000) return;
    const history = retry ? messages.slice(0, -1) : messages;
    busy.current = true; setPending(true); setError(''); setFailed(''); setDraft('');
    if (!retry) setMessages(previous => [...previous, { role: 'user', text }]);
    try {
      if (!supabase) throw new Error('Sign in to use Daymark AI.');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) throw new Error('Your session expired. Sign in again.');
      const response = await fetch('/api/general-chat/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
        body: JSON.stringify({ message: text, source, start, end, history: history.slice(-8).map(item => ({ role: item.role, text: item.text.slice(0, 4000) })) }), signal: AbortSignal.timeout(90000),
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The chat backend is unavailable. Check your server setup.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not complete the chat request.');
      setMessages(previous => [...previous, { role: 'assistant', text: result.answer, ...(result.context ? { context: result.context } : {}) }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send your message.'); setFailed(text); }
    finally { busy.current = false; setPending(false); input.current?.focus(); }
  };

  return <section aria-label="Daymark AI" className="mx-auto max-w-4xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-500"><Sparkles className="h-5 w-5" /></span><div><h1 className="text-xl font-bold">Daymark AI</h1><p className="mt-1 text-xs text-slate-500">Insights and suggestions from your selected records.</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Read-only access</span></header>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 space-y-1 text-xs text-slate-500 sm:col-span-1">Data source<select aria-label="AI data source" value={source} disabled={pending} onChange={event => { resetChat(); setSource(event.target.value as ChatSource); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700 dark:bg-slate-900">{Object.entries(DATA_SOURCES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-500">From<input aria-label="AI start date" type="date" value={start} max={end} disabled={pending} onChange={event => { resetChat(); setStart(event.target.value); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700" /></label>
        <label className="space-y-1 text-xs text-slate-500">To<input aria-label="AI end date" type="date" value={end} min={start} max={today} disabled={pending} onChange={event => { resetChat(); setEnd(event.target.value); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700" /></label>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{validDates ? 'Only your selected source and dates are retrieved. Changing these starts a fresh conversation.' : 'Choose a valid date range of up to 366 days.'}{source === 'notes' ? ' Notes use their creation date in UTC.' : source === 'habits' || source === 'tasks' ? ' Current definitions are included alongside dated entries.' : ''}</p>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800"><p role="status" className="text-xs text-slate-500">{checking ? 'Checking connection…' : ready ? 'Ready to chat' : 'Connection needs setup'}</p><button type="button" disabled={pending || !messages.length} onClick={() => { setMessages([]); setFailed(''); setError(''); setDraft(''); input.current?.focus(); }} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><Plus className="h-4 w-4" />New chat</button></div>
      <div ref={log} role="log" aria-label="Chat messages" aria-live="polite" className="h-[50dvh] min-h-64 space-y-4 overflow-y-auto p-4 sm:p-6">
        {!messages.length && <div className="mx-auto max-w-lg py-6 sm:py-12"><h2 className="text-lg font-semibold">What would you like to understand?</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Ask about your selected records, get explanations, or ask for suggestions. The AI cannot add, edit, complete or delete anything.</p><div className="mt-5 grid gap-2">{['Summarize these records and the main patterns', 'What can I improve based on this data?', 'Show important details and explain your findings'].map(text => <button key={text} type="button" onClick={() => { setDraft(text); input.current?.focus(); }} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:border-indigo-400 dark:border-slate-700">{text}</button>)}</div></div>}
        {messages.map((message, index) => <article key={index} aria-label={message.role === 'user' ? 'Your message' : 'Daymark AI answer'} className={message.role === 'user' ? 'ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white sm:max-w-[80%]' : 'max-w-[95%] rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800/60'}><p className="mb-1 text-[10px] font-semibold uppercase opacity-60">{message.role === 'user' ? 'You' : 'Daymark AI'}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>{message.context && <p className="mt-3 border-t border-slate-200 pt-2 text-[10px] text-slate-500 dark:border-slate-700">Source: {DATA_SOURCES[message.context.source]} · {message.context.start} – {message.context.end} · {message.context.recordCount} retrieved records</p>}{message.context?.facts?.length ? <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-300">View source figures</summary><p className="mt-2 text-[10px] text-slate-500">Calculated directly from your fetched records for these dates.</p><dl className="mt-2 space-y-2">{message.context.facts.map((fact, factIndex) => <div key={factIndex} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs"><dt className="text-slate-500">{fact.label}</dt><dd className="font-medium tabular-nums">{fact.value}</dd></div>)}</dl></details> : null}</article>)}
        {pending && <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Reading selected records and preparing an answer…</p>}
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
        {error && <div role="alert" className="mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}{failed && <button type="button" disabled={pending} onClick={() => void send(true)} className="ml-2 inline-flex min-h-9 items-center gap-1 font-semibold underline"><RotateCcw className="h-3 w-3" />Try again</button>}</div>}
        <form onSubmit={event => { event.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-2xl border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-indigo-500/30 dark:border-slate-700"><textarea ref={input} aria-label="Message Daymark AI" rows={2} maxLength={2000} value={draft} disabled={pending} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="Ask about your selected data…" className="min-w-0 flex-1 resize-y bg-transparent px-2 py-1 text-sm outline-none" /><button type="submit" aria-label="Send message" disabled={!ready || checking || pending || !validDates || !draft.trim()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:cursor-not-allowed disabled:opacity-40">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Sending shares the selected records and summaries with the AI service for this answer. Images are excluded. Read-only access: no changes or deletions. Check important details against your records. Enter sends · Shift+Enter adds a line.</p>
      </div>
    </div>
  </section>;
}
