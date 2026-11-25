import type { DataScope, ContextMeta, SourceFact } from '../src/features/ai/chatScope.ts';
import { getAccountBalance } from '../src/utils/accounts.ts';
import { normalizeWellnessGoals } from '../src/utils/wellnessGoals.ts';

export class RetrievalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = Record<string, any>;
export async function readDaymarkContext(scope: DataScope, access: { url: string; anonKey: string; token: string; userId: string }, request: typeof fetch) {
  // All database access lives here: fixed GETs, authenticated RLS and an explicit
  // owner filter. No SQL, arbitrary URLs, service keys or mutations are accepted.
  const read = async (table: string, columns: string, dateColumn?: string, key = 'id', includeEarlier = false): Promise<Row[]> => {
    const rows: Row[] = [];
    const seenIds = new Set<string>();
    let expectedTotal: number | null = null;
    while (rows.length <= 2000) {
      const query = new URLSearchParams({ select: columns, user_id: 'eq.' + access.userId, order: dateColumn && dateColumn !== key ? dateColumn + '.asc,' + key + '.asc' : key + '.asc', limit: '1000', offset: String(rows.length) });
      if (dateColumn) {
        if (!includeEarlier) query.append(dateColumn, 'gte.' + scope.start + (dateColumn === 'created_at' ? 'T00:00:00Z' : ''));
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
      if (page.some(row => !row || typeof row[key] !== 'string' || seenIds.has(row[key]))) throw new RetrievalError(409, 'Could not load a consistent set of records. Please try again.');
      for (const row of page) {
        if (seenIds.has(row[key])) throw new RetrievalError(409, 'Could not load a consistent set of records. Please try again.');
        seenIds.add(row[key]);
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
    const [rows, budgets, loans, matches, installments, balanceRows] = await Promise.all([
      read('expenses', 'id,entry_date,title,amount,category,spend_type,transaction_type,account,is_transfer,payment_method,notes,is_recurring', 'entry_date'),
      read('budget_configs', 'id,currency,monthly_budget,weekly_budget,daily_budget,category_budgets,custom_categories,updated_at'),
      read('loans_and_dues', 'id,person,record_kind,amount,repaid,installment_amount,lent_date,end_date,payment_day,due_date,note,created_at'),
      read('loan_existing_movements', 'id,loan_id,expense_id'),
      read('loan_payment_installments', 'expense_id,loan_id,installment_date', 'installment_date', 'expense_id'),
      read('expenses', 'id,entry_date,amount,category,transaction_type,account,is_transfer', 'entry_date', 'id', true),
    ]);
    const transactionIds = new Set(rows.map(row => row.id));
    const relatedMatches = matches.filter(row => transactionIds.has(row.expense_id));
    const linkedTransactions = rows.flatMap(row => {
      const loanId = typeof row.notes === 'string' ? /^Loan record: ([0-9a-f-]+)$/i.exec(row.notes)?.[1] : undefined;
      return loanId ? [{ expense_id: row.id, loan_id: loanId }] : [];
    });
    recordCount = rows.length + loans.length + relatedMatches.length + installments.length + budgets.length;
    if ([...rows, ...balanceRows].some(row => row.amount === null || typeof row.amount !== 'number' && typeof row.amount !== 'string' || String(row.amount).trim() === '' || !Number.isFinite(Number(row.amount)) || !Number.isSafeInteger(Math.round(Number(row.amount) * 100)))) throw new RetrievalError(422, 'Some transaction amounts are invalid. Check your records before requesting financial analysis.');
    const ledger = balanceRows.map(row => ({ id: row.id, date: row.entry_date, amount: Number(row.amount), category: row.category || '', type: row.transaction_type || 'expense', account: row.account || 'expense', isTransfer: Boolean(row.is_transfer), title: '', paymentMethod: '', createdAt: 0 }));
    const accountBalances = Object.fromEntries((['expense', 'cash', 'savings'] as const).map(account => [account, getAccountBalance(ledger, account, scope.end)]));
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
      ...Object.entries(accountBalances).map(([account, value]) => ({ label: `${account} account balance as of ${scope.end}`, value: money(value) })),
      ...categoryRows.map(row => ({ label: row.name, value: money(row.amount) + (row.sharePercent === null ? '' : ' · ' + row.sharePercent.toFixed(1) + '% of expenses') })),
    ];
    data = { currency, summary: { expenses: spent / 100, income: income / 100, net: (income - spent) / 100, dailyAverage: spent / 100 / days, calendarDays: days, expenseCount: expenseRows.length, incomeCount: incomeRows.length }, accountBalancesAsOfEnd: accountBalances, categories: categoryRows, daily, transactions: rows.map(row => ({ ...row, notes: typeof row.notes === 'string' && /^Loan record: [0-9a-f-]+$/i.test(row.notes) ? 'Linked loan movement' : row.notes })), budget: budgets[0] || null, loans, loanMovementMatches: [...relatedMatches, ...linkedTransactions], installmentAssignments: installments, note: 'Account balances use the complete recorded ledger through the selected end date, including transfers and opening balances, as in Overview. They depend on recorded transactions and are not bank-verified. Transactions and installment assignments are restricted to the selected dates. Loans and budget are current snapshots, not historical balances: repaid and targets may have changed since the selected dates. A loan can start before the range and still have a due date or payment within it. Match transactions to loans using loanMovementMatches; do not double count a loan movement and its transaction. Transfers, opening balances, balance adjustments and card repayments are excluded from the summary. Daily average includes every calendar day.' };
  } else if (scope.source === 'habits') {
    const [definitions, entries, settings] = await Promise.all([read('custom_trackers', 'id,name,type,unit,target_value,weekdays,start_time,end_time,color,icon,created_at'), read('tracker_entries', 'id,tracker_id,entry_date,numeric_value,boolean_value', 'entry_date'), read('budget_configs', 'id,custom_categories')]);
    recordCount = definitions.length + entries.length;
    facts = [{ label: 'Current habit definitions', value: String(definitions.length) }, { label: 'Recorded entries in range', value: String(entries.length) }];
    data = { definitions, entries, currentCategories: settings[0]?.custom_categories?.habits || [], note: 'Current definitions, categories and schedules; weekdays are 0=Sunday through 6=Saturday. Missing entries are unrecorded, not failures.' };
  } else if (scope.source === 'tasks') {
    const [definitions, entries, settings] = await Promise.all([read('tasks', 'id,title,description,is_active,weekdays,priority,time_estimate_min,start_time,end_time,category,created_at,updated_at'), read('task_entries', 'id,task_id,entry_date,status,completed_at', 'entry_date'), read('budget_configs', 'id,custom_categories')]);
    recordCount = definitions.length + entries.length;
    facts = [{ label: 'Current task definitions', value: String(definitions.length) }, ...['pending', 'complete', 'skipped'].map(status => ({ label: 'Recorded ' + status + ' entries', value: String(entries.filter(row => row.status === status).length) }))];
    data = { definitions, entries, currentCategories: settings[0]?.custom_categories?.tasks || [], note: 'Current definitions and categories; only entries show recorded statuses. Missing entries have no recorded status.' };
  } else if (scope.source === 'notes') {
    const [notes, settings] = await Promise.all([read('notes', 'id,title,content,category,completed,priority,created_at,updated_at', 'created_at'), read('budget_configs', 'id,custom_categories')]);
    recordCount = notes.length;
    facts = [{ label: 'Notes created in range (UTC)', value: String(notes.length) }, { label: 'Completed notes', value: String(notes.filter(row => row.completed === true).length) }, { label: 'Unfinished notes', value: String(notes.filter(row => row.completed === false).length) }];
    data = { notes, currentCategories: settings[0]?.custom_categories?.notes || [], note: 'Selected by note creation date in UTC. Categories are current settings. Image and media data are excluded.' };
  } else {
    const [entries, settings] = await Promise.all([read('daily_notes', 'id,entry_date,content,mood,gratitude,sleep_hours,water_ml,energy_score', 'entry_date'), read('budget_configs', 'id,custom_categories')]);
    recordCount = entries.length;
    facts = [{ label: 'Recorded journal days', value: String(entries.length) }];
    data = { entries, currentGoals: normalizeWellnessGoals(settings[0]?.custom_categories?.wellnessGoals), note: 'Goals are current settings, not necessarily the goals in effect during the selected dates. Only recorded journal entries are included. Missing values are unknown, not zero. Do not make medical diagnoses.' };
  }
  const meta: ContextMeta = { ...scope, recordCount, facts };
  if (JSON.stringify({ ...meta, data }).length > 180000) throw new RetrievalError(413, 'The selected records are too large. Choose a shorter date range.');
  return { ...meta, data };
}
