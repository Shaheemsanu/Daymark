import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Plus, LoaderCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DATA_SOURCES, validScopeDates } from './chatScope';
import type { ChatSource, ContextMeta } from './chatScope';
import { formatDate } from '../../utils/constants';
import AssistantMessage from './AssistantMessage';
import { readChatResponse } from './chatResponse';

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
    const conversation: Message[] = [...history, { role: 'user', text }];
    busy.current = true; setPending(true); setError(''); setFailed(''); setDraft('');
    setMessages(conversation);
    try {
      if (!supabase) throw new Error('Sign in to use Daymark AI.');
      const { data, error: sessionError } = await supabase.auth.getSession();
      let session = data.session;
      if (!sessionError && session && typeof session.expires_at === 'number' && session.expires_at * 1000 <= Date.now() + 60000 && supabase.auth.refreshSession) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session) session = refreshed.data.session;
      }
      if (sessionError || !session) throw new Error('Your session expired. Sign in again.');
      const postChat = (accessToken: string) => fetch('/api/general-chat/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', 'X-Daymark-Json-Errors': '1', Authorization: 'Bearer ' + accessToken },
        body: JSON.stringify({ message: text, source, start, end, history: history.slice(-8).map(item => ({ role: item.role, text: item.text.slice(0, 4000) })) }), signal: AbortSignal.timeout(90000),
      });
      let response = await postChat(session.access_token);
      if (response.status === 401 && supabase.auth.refreshSession) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session?.access_token) {
          response = await postChat(refreshed.data.session.access_token);
        }
      }
      await readChatResponse(response, answer => setMessages([...conversation, { role: 'assistant', ...answer }]));
    } catch (cause) { setMessages(conversation); setError(cause instanceof Error ? cause.message : 'Could not send your message.'); setFailed(text); }
    finally { busy.current = false; setPending(false); input.current?.focus(); }
  };

  return <section aria-label="Daymark AI" className="mx-auto flex h-full min-h-0 max-w-4xl flex-col gap-1 md:block md:h-auto md:space-y-2">
    <header className="hidden shrink-0 flex-wrap items-center justify-between gap-2 md:flex md:gap-2"><div className="flex items-center gap-2 md:gap-2"><span className="rounded-lg bg-indigo-500/10 p-1 text-indigo-500 md:rounded-xl md:p-2"><Sparkles className="h-4 w-4 md:h-4 md:w-4" /></span><div><h1 className="text-sm font-bold md:text-lg">Daymark AI</h1><p className="mt-0.5 hidden text-[11px] text-slate-500 md:block">Insights and suggestions from your selected records.</p></div></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] md:gap-1.5 font-medium md:px-2 md:py-1 md:text-[10px] text-emerald-600 dark:text-emerald-300"><ShieldCheck className="h-3 w-3 md:h-3.5 md:w-3.5" />Read-only access</span></header>
    <div className="max-h-[35%] shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white px-1.5 py-1 dark:border-slate-800 dark:bg-slate-900 md:max-h-none md:rounded-xl md:px-2.5 md:py-2">
      <div className="grid min-w-0 grid-cols-3 gap-1 md:gap-2">
        <label className="block min-w-0 space-y-0 text-[10px] leading-3 text-slate-500 md:space-y-0.5 md:text-[11px] md:leading-normal">Data source<select aria-label="AI data source" value={source} disabled={pending} onChange={event => { resetChat(); setSource(event.target.value as ChatSource); }} className="h-6 min-w-0 w-full rounded-lg border border-slate-200 bg-transparent px-1 dark:border-slate-700 dark:bg-slate-900 md:h-8 md:w-full md:rounded-lg md:px-2">{Object.entries(DATA_SOURCES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className="block min-w-0 space-y-0 text-[10px] leading-3 text-slate-500 md:space-y-0.5 md:text-[11px] md:leading-normal">From<input aria-label="AI start date" type="date" value={start} max={end} disabled={pending} onChange={event => { resetChat(); setStart(event.target.value); }} className="h-6 min-w-0 w-full max-w-full flex-1 rounded-lg border border-slate-200 bg-transparent px-1 dark:border-slate-700 md:h-8 md:rounded-lg md:px-2" /></label>
        <label className="block min-w-0 space-y-0 text-[10px] leading-3 text-slate-500 md:space-y-0.5 md:text-[11px] md:leading-normal">To<input aria-label="AI end date" type="date" value={end} min={start} max={today} disabled={pending} onChange={event => { resetChat(); setEnd(event.target.value); }} className="h-6 min-w-0 w-full max-w-full flex-1 rounded-lg border border-slate-200 bg-transparent px-1 dark:border-slate-700 md:h-8 md:rounded-lg md:px-2" /></label>
      </div>
      <p className={`${validDates ? 'hidden md:block' : 'block'} mt-1 text-[10px] leading-snug text-slate-500 md:mt-1 md:text-[10px] md:leading-snug`}>{validDates ? 'Only your selected source and dates are retrieved. Changing these starts a fresh conversation.' : 'Choose a valid date range of up to 366 days.'}{source === 'notes' ? ' Notes use their creation date in UTC.' : source === 'habits' || source === 'tasks' ? ' Current definitions are included alongside dated entries.' : ''}</p>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 dark:border-slate-800 md:gap-3 md:px-3 md:py-0.5"><div className="flex min-w-0 items-center gap-1.5 md:hidden"><Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" /><span className="whitespace-nowrap text-xs font-semibold">Daymark AI</span><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Read-only</span></div><p role="status" className="sr-only text-xs text-slate-500 md:not-sr-only">{checking ? 'Checking connection…' : ready ? 'Ready to chat' : 'Connection needs setup'}</p><button type="button" disabled={pending || !messages.length} onClick={() => { setMessages([]); setFailed(''); setError(''); setDraft(''); input.current?.focus(); }} className="inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><Plus className="h-4 w-4" /><span>New chat</span></button></div>
      <div ref={log} role="log" aria-label="Chat messages" aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 [overflow-wrap:anywhere] md:h-[50dvh] md:min-h-64 md:p-6">
        {!messages.length && <div className="mx-auto max-w-lg md:py-12"><h2 className="text-sm font-semibold md:text-lg">What would you like to understand?</h2><p className="mt-1 text-[11px] leading-snug text-slate-500 md:mt-2 md:text-sm md:leading-relaxed">Ask about your selected records, get explanations, or ask for suggestions. The AI cannot add, edit, complete or delete anything.</p><div className="mt-2 grid gap-1.5 md:mt-5 md:gap-2">{['Summarize these records and the main patterns', 'What can I improve based on this data?', 'Show important details and explain your findings'].map(text => <button key={text} type="button" onClick={() => { setDraft(text); input.current?.focus(); }} className="min-h-8 rounded-xl border border-slate-200 px-2 py-1.5 text-left text-[11px] hover:border-indigo-400 dark:border-slate-700 md:min-h-11 md:px-3 md:py-2 md:text-xs">{text}</button>)}</div></div>}
        {messages.map((message, index) => <article key={index} aria-label={message.role === 'user' ? 'Your message' : 'Daymark AI answer'} className={message.role === 'user' ? 'ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white sm:max-w-[80%]' : 'max-w-[95%] rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800/60'}><p className="mb-1 text-[10px] font-semibold uppercase opacity-60">{message.role === 'user' ? 'You' : 'Daymark AI'}</p>{message.role === 'assistant' ? <AssistantMessage text={message.text} /> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>}{message.context && <p className="mt-3 border-t border-slate-200 pt-2 text-[10px] text-slate-500 dark:border-slate-700">Source: {DATA_SOURCES[message.context.source]} · {message.context.start} – {message.context.end} · {message.context.recordCount} retrieved records</p>}{message.context?.facts?.length ? <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-300">View source figures</summary><p className="mt-2 text-[10px] text-slate-500">Calculated directly from your fetched records for these dates.</p><dl className="mt-2 space-y-2">{message.context.facts.map((fact, factIndex) => <div key={factIndex} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs"><dt className="text-slate-500">{fact.label}</dt><dd className="font-medium tabular-nums">{fact.value}</dd></div>)}</dl></details> : null}</article>)}
        {pending && <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Reading selected records and preparing an answer…</p>}
      </div>
      <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900 md:max-h-none md:p-2">
        {error && <div role="alert" className="mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}{failed && <button type="button" disabled={pending} onClick={() => void send(true)} className="ml-2 inline-flex min-h-9 items-center gap-1 font-semibold underline"><RotateCcw className="h-3 w-3" />Try again</button>}</div>}
        <form onSubmit={event => { event.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-2xl border border-slate-200 p-0.5 md:p-1 focus-within:ring-2 focus-within:ring-indigo-500/30 dark:border-slate-700"><textarea ref={input} aria-label="Message Daymark AI" rows={2} maxLength={2000} value={draft} disabled={pending} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="Ask about your selected data…" className="h-8 max-h-24 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-xs leading-4 outline-none" /><button type="submit" aria-label="Send message" disabled={!ready || checking || pending || !validDates || !draft.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:cursor-not-allowed disabled:opacity-40">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form>
        <p className="mt-2 hidden text-[10px] leading-relaxed text-slate-500 md:block">Sending shares the selected records and summaries with the AI service for this answer. Images are excluded. Read-only access: no changes or deletions. Check important details against your records. Enter sends · Shift+Enter adds a line.</p>
      </div>
    </div>
  </section>;
}
