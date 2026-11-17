import type { DataScope, ContextMeta, SourceFact } from '../src/features/ai/chatScope.ts';

export class RetrievalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = Record<string, any>;
export async function readDaymarkContext(scope: DataScope, access: { url: string; anonKey: string; token: string; userId: string }, request: typeof fetch) {
  // All database access lives here: fixed GETs, authenticated RLS and an explicit
  // owner filter. No SQL, arbitrary URLs, service keys or mutations are accepted.
  const read = async (table: string, columns: string, dateColumn?: string): Promise<Row[]> => {
    const rows: Row[] = [];
    const seenIds = new Set<string>();
    let expectedTotal: number | null = null;
    while (rows.length <= 2000) {
      const query = new URLSearchParams({ select: columns, user_id: 'eq.' + access.userId, order: dateColumn ? dateColumn + '.asc,id.asc' : 'id.asc', limit: '200', offset: String(rows.length) });
      if (dateColumn) {
        query.append(dateColumn, 'gte.' + scope.start + (dateColumn === 'created_at' ? 'T00:00:00Z' : ''));
        query.append(dateColumn, dateColumn === 'created_at' ? 'lt.' + new Date(Date.parse(scope.end) + 86400000).toISOString().slice(0, 10) + 'T00:00:00Z' : 'lte.' + scope.end);
      }
      const response = await request(access.url + '/rest/v1/' + table + '?' + query, {
        method: 'GET', headers: { apikey: access.anonKey, Authorization: 'Bearer ' + access.token, Prefer: 'count=exact' }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new RetrievalError(502, 'Could not read the selected records. Check your Supabase connection and existing schema.');
      const page = await response.json();
      if (!Array.isArray(page)) throw new RetrievalError(502, 'The data source returned an unexpected response.');
      const match = /\/(\d+)$/.exec(response.headers.get('content-range') || '');
      const total = match ? Number(match[1]) : null;
      if (expectedTotal !== null && total !== null && expectedTotal !== total) throw new RetrievalError(409, 'Your records changed while loading. Please ask again for a fresh answer.');
      if (total !== null) expectedTotal = total;
      if (page.some(row => !row || typeof row.id !== 'string' || seenIds.has(row.id))) throw new RetrievalError(409, 'Could not load a consistent set of records. Please try again.');
      for (const row of page) {
        if (seenIds.has(row.id)) throw new RetrievalError(409, 'Could not load a consistent set of records. Please try again.');
        seenIds.add(row.id);
      }
      rows.push(...page);
      if (rows.length > 2000 || total !== null && total > 2000) throw new RetrievalError(413, 'Too many records. Choose a shorter date range.');
      if (expectedTotal !== null && (rows.length > expectedTotal || !page.length && rows.length < expectedTotal)) throw new RetrievalError(409, 'The selected records could not be loaded completely. Please try again.');
      if (!page.length || expectedTotal !== null && rows.length === expectedTotal) return rows;
    }
    throw new RetrievalError(413, 'Too many records. Choose a shorter date range.');
  };
  let data: Record<string, unknown>, recordCount = 0;
  let facts: SourceFact[] = [];
  if (scope.source === 'expenses') {
    const [rows, budgets] = await Promise.all([
      read('expenses', 'id,entry_date,title,amount,category,spend_type,transaction_type,account,is_transfer,payment_method,is_recurring', 'entry_date'),
      read('budget_configs', 'id,currency'),
    ]);
    recordCount = rows.length;
    if (rows.some(row => row.amount === null || typeof row.amount !== 'number' && typeof row.amount !== 'string' || String(row.amount).trim() === '' || !Number.isFinite(Number(row.amount)) || !Number.isSafeInteger(Math.round(Number(row.amount) * 100)))) throw new RetrievalError(422, 'Some transaction amounts are invalid. Check your records before requesting financial analysis.');
    const operating = rows.filter(row => !row.is_transfer && !/transfer/i.test(row.category) && !/^(opening balance|balance adjustment|credit card payment|credit card repayment)$/i.test(row.category) && Number.isFinite(Number(row.amount)));
    const expenseRows = operating.filter(row => (row.transaction_type || 'expense') === 'expense');
    const incomeRows = operating.filter(row => row.transaction_type === 'income');
    const sum = (records: Row[]) => records.reduce((value, row) => value + Math.round(Number(row.amount) * 100), 0);
    const spent = sum(expenseRows), income = sum(incomeRows);
    const categories = new Map<string, { name: string; cents: number; count: number }>();
    for (const row of expenseRows) { const value = categories.get(row.category) || { name: row.category, cents: 0, count: 0 }; value.cents += Math.round(Number(row.amount) * 100); value.count++; categories.set(row.category, value); }
    const days = (Date.parse(scope.end) - Date.parse(scope.start)) / 86400000 + 1;
    const currency = budgets[0]?.currency || 'INR';
    const categoryRows = [...categories.values()].sort((a, b) => b.cents - a.cents).map(row => ({ name: row.name, amount: row.cents / 100, count: row.count, sharePercent: spent > 0 ? row.cents / spent * 100 : null }));
    const daily = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.parse(scope.start) + index * 86400000).toISOString().slice(0, 10);
      return { date, expenses: sum(expenseRows.filter(row => row.entry_date === date)) / 100, income: sum(incomeRows.filter(row => row.entry_date === date)) / 100 };
    });
    const money = (value: number) => String(currency) + ' ' + value.toFixed(2);
    facts = [
      { label: 'Total expenses', value: money(spent / 100) },
      { label: 'Total income', value: money(income / 100) },
      { label: 'Income minus expenses', value: money((income - spent) / 100) },
      { label: 'Average per calendar day', value: money(spent / 100 / days) },
      { label: 'Expense transactions included', value: String(expenseRows.length) },
      { label: 'Calendar days', value: String(days) },
      ...categoryRows.map(row => ({ label: row.name, value: money(row.amount) + (row.sharePercent === null ? '' : ' · ' + row.sharePercent.toFixed(1) + '% of expenses') })),
    ];
    data = { currency, summary: { expenses: spent / 100, income: income / 100, net: (income - spent) / 100, dailyAverage: spent / 100 / days, calendarDays: days, expenseCount: expenseRows.length, incomeCount: incomeRows.length }, categories: categoryRows, daily, transactions: rows, note: 'Transfers, opening balances, balance adjustments and card repayments are excluded from the summary. No actual account balance or budget target is supplied. Daily average includes every calendar day.' };
  } else if (scope.source === 'habits') {
    const [definitions, entries] = await Promise.all([read('custom_trackers', 'id,name,type,unit,target_value,weekdays'), read('tracker_entries', 'id,tracker_id,entry_date,numeric_value,boolean_value', 'entry_date')]);
    recordCount = definitions.length + entries.length;
    facts = [{ label: 'Current habit definitions', value: String(definitions.length) }, { label: 'Recorded entries in range', value: String(entries.length) }];
    data = { definitions, entries, note: 'Current definitions and schedules; weekdays are 0=Sunday through 6=Saturday. Missing entries are unrecorded, not failures.' };
  } else if (scope.source === 'tasks') {
    const [definitions, entries] = await Promise.all([read('tasks', 'id,title,is_active,weekdays,priority,time_estimate_min,category'), read('task_entries', 'id,task_id,entry_date,status,completed_at', 'entry_date')]);
    recordCount = definitions.length + entries.length;
    facts = [{ label: 'Current task definitions', value: String(definitions.length) }, ...['pending', 'complete', 'skipped'].map(status => ({ label: 'Recorded ' + status + ' entries', value: String(entries.filter(row => row.status === status).length) }))];
    data = { definitions, entries, note: 'Current definitions; only entries show recorded statuses. Missing entries have no recorded status.' };
  } else if (scope.source === 'notes') {
    const notes = await read('notes', 'id,title,content,category,completed,priority,created_at,updated_at', 'created_at');
    recordCount = notes.length;
    facts = [{ label: 'Notes created in range (UTC)', value: String(notes.length) }, { label: 'Completed notes', value: String(notes.filter(row => row.completed === true).length) }, { label: 'Unfinished notes', value: String(notes.filter(row => row.completed === false).length) }];
    data = { notes, note: 'Selected by note creation date in UTC. Image and media data are excluded.' };
  } else {
    const entries = await read('daily_notes', 'id,entry_date,content,mood,gratitude,sleep_hours,water_ml,energy_score', 'entry_date');
    recordCount = entries.length;
    facts = [{ label: 'Recorded journal days', value: String(entries.length) }];
    data = { entries, note: 'Only recorded journal entries are included. Missing values are unknown, not zero. Do not make medical diagnoses.' };
  }
  const meta: ContextMeta = { ...scope, recordCount, facts };
  if (JSON.stringify({ ...meta, data }).length > 180000) throw new RetrievalError(413, 'The selected records are too large. Choose a shorter date range.');
  return { ...meta, data };
}
