import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, PiggyBank, Percent, Receipt, CalendarDays, Gauge, Download, RotateCcw, Info, LayoutDashboard, ChartPie, Lightbulb } from 'lucide-react';
import { BudgetConfig, Expense } from '../types';
import { AnalyticsFilters, FinancialAnalytics, accountNames, analyticsAccounts, buildFinancialAnalytics, resolveAnalyticsRange, sourceAccount, transferTarget, automaticChartGrouping, analyticsGroupLabel, isOperatingTransaction } from '../utils/financialAnalytics';
import { shiftReportDate } from '../utils/expenseReports';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import { FinancialExportFormat, PrintableChart, downloadFilteredReport, printFinancialSummary } from '../utils/financialExports';
import { FinancialChart, financePanel } from './FinancialCharts';
import CategorySpendingAnalytics from './CategorySpendingAnalytics';
import SpendingSnapshot from './SpendingSnapshot';
import CategoryRankingSummary from './CategoryRankingSummary';
import CategorySpendingComparison from './CategorySpendingComparison';

const control = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
const action = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800';
const sections = ['Overview', 'Expenses', 'Categories', 'Patterns', 'Accounts', 'Insights'] as const;
type Section = typeof sections[number];
const sectionIcons = { Overview: LayoutDashboard, Expenses: Receipt, Categories: ChartPie, Patterns: CalendarDays, Accounts: Wallet, Insights: Lightbulb };
const rounded = (amount: number) => Math.round(amount * 100) / 100;
const exportSections = [
  ['Overview', 'Financial summary, income, expenses and savings'],
  ['Expenses', 'Spending, purchases and matching transactions'],
  ['Categories', 'Spending by category and comparisons'],
  ['Patterns', 'Calendar, spending patterns and recurring payments'],
  ['Accounts', 'Account balances, spending and transfers'],
  ['Insights', 'Spending insights and estimates'],
] as const;
const exportSectionContents: Record<string, string[]> = {
  Overview: ['Summary', 'Chart periods', 'Income vs. expenses chart', 'Savings trend chart', 'Cash flow chart'],
  Expenses: ['Daily spending', 'Monthly spending', 'Monthly categories', 'Transactions', 'Category spending chart', 'Top spending categories chart', 'Daily spending chart', 'Monthly category comparison'],
  Categories: ['Categories', 'Category details', 'Where your money goes chart', 'Category changes chart', 'Category trends chart'],
  Patterns: ['Spending patterns', 'Recurring payments', 'Unusual transactions', 'Spending calendar', 'Weekday spending chart', 'Weekday vs. weekend chart'],
  Accounts: ['Accounts', 'Account transfers', 'Account spending chart', 'Account balance history chart'],
  Insights: ['Insight details', 'Insights'],
};

function captureReportCharts(container: HTMLElement | null): Record<string, PrintableChart> {
  const names: Record<string, string> = { 'Income vs. expenses': 'Income vs. expenses chart', 'Savings trend': 'Savings trend chart', 'Cash flow reconciliation': 'Cash flow chart', 'Category spending': 'Category spending chart', 'Top spending categories': 'Top spending categories chart', 'Daily spending & spikes': 'Daily spending chart', 'Where your money goes': 'Where your money goes chart', 'Category spending changes': 'Category changes chart', 'Category spending over time': 'Category trends chart', 'Average spending by weekday': 'Weekday spending chart', 'Weekday vs. weekend': 'Weekday vs. weekend chart', 'Account-wise spending': 'Account spending chart', 'Balance history': 'Account balance history chart' };
  const charts: Record<string, PrintableChart> = {};
  if (!container) return charts;
  for (const panel of container.querySelectorAll<HTMLElement>('section[aria-label]')) {
    const name = names[panel.getAttribute('aria-label') || ''];
    const svg = panel.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!name || !svg || !svg.getAttribute('width') || !svg.getAttribute('height')) continue;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('viewBox', `0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`);
    let legend = [...panel.querySelectorAll<HTMLElement>('div.my-3 > span')].map(item => ({ label: item.textContent || '', color: item.querySelector<HTMLElement>('span')?.style.backgroundColor || '#6366f1' }));
    if (!legend.length) legend = [...panel.querySelectorAll<HTMLElement>("div[class~=\"space-y-1.5\"] > button")].map(item => ({ label: item.textContent || '', color: item.querySelector<HTMLElement>('span[style]')?.style.backgroundColor || '#6366f1' }));
    charts[name] = { svg: copy.outerHTML, description: panel.querySelector('header p')?.textContent || '', legend, title: panel.querySelector('header h4')?.textContent || name };
  }
  return charts;
}

function captureInsights(container: HTMLElement | null) {
  return [...(container?.querySelectorAll('[data-export-insights] article') || [])].map(item => ({ title: item.querySelector('h4')?.textContent || '', body: item.querySelector('p')?.textContent || '' }));
}

function Intelligence({ report, currency }: { report: FinancialAnalytics; currency: string }) {
  const money = (value: number) => formatCurrency(value, currency);
  const messages: { title: string; body: string; level: 'info' | 'warning' | 'good' }[] = [];
  if (report.total.count) messages.push({ title: 'Daily spending', body: `You spent ${money(report.dailyAverage)} per calendar day across ${report.dayCount} days.`, level: 'info' });
  if (report.categories[0]) messages.push({ title: 'Largest spending category', body: `${report.categories[0].name} accounts for ${report.categories[0].share.toFixed(1)}% of expenses (${money(report.categories[0].amount)}).`, level: 'info' });
  if (report.changes.expenses !== null) messages.push({ title: 'Expense trend', body: `Spending is ${Math.abs(report.changes.expenses).toFixed(1)}% ${report.changes.expenses >= 0 ? 'higher' : 'lower'} than the preceding equal-length period.`, level: report.changes.expenses > 0 ? 'warning' : 'good' });
  if (report.changes.income !== null) messages.push({ title: 'Income trend', body: `Recorded income is ${Math.abs(report.changes.income).toFixed(1)}% ${report.changes.income >= 0 ? 'higher' : 'lower'} than the preceding period.`, level: report.changes.income >= 0 ? 'good' : 'warning' });
  if (report.changes.savingsRate !== null) messages.push({ title: 'Savings rate', body: `Your savings rate changed by ${report.changes.savingsRate.toFixed(1)} percentage points.`, level: report.changes.savingsRate >= 0 ? 'good' : 'warning' });
  for (const category of report.categories.filter(row => row.change !== null && Math.abs(row.change) >= 10).slice(0, 3)) messages.push({ title: `${category.name} trend`, body: `${category.name} spending ${category.change! > 0 ? 'increased' : 'decreased'} by ${Math.abs(category.change!).toFixed(1)}% (${money(category.previous)} → ${money(category.amount)}).`, level: category.change! > 0 ? 'warning' : 'good' });
  const weekends = report.weekday.slice(5), weekdays = report.weekday.slice(0, 5);
  const average = (rows: typeof weekdays) => { const days = rows.reduce((sum, row) => sum + row.days, 0); return days ? rows.reduce((sum, row) => sum + row.amount, 0) / days : null; };
  const weekendAverage = average(weekends), weekdayAverage = average(weekdays);
  if (weekendAverage !== null && weekdayAverage !== null && weekendAverage > weekdayAverage) messages.push({ title: 'Weekend pattern', body: `Average spending is higher on weekends: ${money(weekendAverage)} per day vs. ${money(weekdayAverage)} on weekdays.`, level: 'info' });
  if (report.projection !== null) messages.push({ title: 'Estimated month-end spending', body: `${money(report.projection)} if the selected month's current daily pace continues. This is an estimate based on recorded spending, not a forecast of scheduled bills.`, level: 'info' });
  if (report.unusual.length) messages.push({ title: 'Unusually large expenses', body: `${report.unusual.length} transactions exceed three times the median positive expense (${money(report.median)}). Review them in Patterns; this heuristic does not establish an error.`, level: 'warning' });
  const wants = report.current.filter(row => row.type !== 'income' && row.spendType === 'want').reduce((sum, row) => sum + row.amount, 0);
  if (wants > 0) messages.push({ title: 'Potential savings scenario', body: `Reducing expenses marked as wants by 10% would free up approximately ${money(wants * .1)} over an equivalent period. This is a scenario, not a guaranteed saving.`, level: 'info' });
  const duplicates = report.recurring.filter(row => row.possibleDuplicate);
  if (duplicates.length) messages.push({ title: 'Possible duplicate payments', body: `${duplicates.length} groups have the same description, category, amount, and date. Review before assuming they are duplicate subscriptions.`, level: 'warning' });
  if (report.highestDay.expenses > 0) {
    const share = report.total.expenses > 0 ? report.highestDay.expenses / report.total.expenses * 100 : null;
    messages.push({ title: 'Highest spending day', body: `Your highest net spending was ${money(report.highestDay.expenses)} on ${formatDisplayDate(report.highestDay.date)}.${share === null ? '' : ` That is ${share.toFixed(1)}% of spending for the selected period.`}${share !== null && share > 100 ? ' Expense reversals reduced the period total.' : ''}`, level: 'info' });
  }
  return <div className="grid gap-3 md:grid-cols-2">{messages.length ? messages.map((message, index) => <article key={index} className={`${financePanel} border-l-4 ${message.level === 'warning' ? 'border-l-amber-500' : message.level === 'good' ? 'border-l-emerald-500' : 'border-l-indigo-500'}`}><h4 className="text-sm font-semibold">{message.title}</h4><p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{message.body}</p></article>) : <p className={`${financePanel} text-sm text-slate-500`}>Add transactions or widen your date range to generate insights.</p>}</div>;
}

export default function FinancialAnalyticsDashboard({ expenses, budget, referenceDate, loading = false, categoryNames = [], accountVisibility = { cash: true, savings: true } }: { expenses: Expense[]; budget: BudgetConfig; referenceDate: string; loading?: boolean; categoryNames?: string[]; accountVisibility?: { cash: boolean; savings: boolean } }) {
  const enabledAccounts = useMemo(() => analyticsAccounts.filter(name => name === 'expense' || accountVisibility[name]), [accountVisibility.cash, accountVisibility.savings]);
  const visibleExpenses = useMemo(() => expenses.filter(row => enabledAccounts.includes(sourceAccount(row))), [expenses, enabledAccounts]);
  const expenseCategoryNames = [...new Set([...categoryNames, ...visibleExpenses.filter(row => row.type !== 'income' && isOperatingTransaction(row)).map(row => row.category)])];
  const [section, setSection] = useState<Section>('Overview');
  const [preset, setPreset] = useState('30days');
  const [customStart, setCustomStart] = useState(referenceDate.slice(0, 7) + '-01');
  const [customEnd, setCustomEnd] = useState(referenceDate);
  const [account, setAccount] = useState<AnalyticsFilters['account']>('all');
  useEffect(() => { if (account !== 'all' && !enabledAccounts.includes(account)) setAccount('all'); }, [account, enabledAccounts]);
  const [category, setCategory] = useState('all');
  const [payment, setPayment] = useState('all');
  const [type, setType] = useState<AnalyticsFilters['type']>('all');
  const [exportKind, setExportKind] = useState<FinancialExportFormat>('pdf');
  const [exportError, setExportError] = useState('');
  const exportDialog = useRef<HTMLDialogElement>(null);
  const exportChartRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSectionsSelected, setExportSectionsSelected] = useState<string[]>(() => exportSections.map(([name]) => name));
  const selectedExportSections = exportSectionsSelected.length ? [...new Set(['Filters', ...exportSectionsSelected.flatMap(name => exportSectionContents[name] || [])])] : [];
  const range = preset === 'custom' ? { start: customStart, end: customEnd } : resolveAnalyticsRange(preset, referenceDate);
  const grouping = automaticChartGrouping(range.start, range.end);
  const report = useMemo(() => buildFinancialAnalytics(expenses, budget, { ...range, account: account !== 'all' && !enabledAccounts.includes(account) ? 'all' : account, category, payment, type, grouping }, enabledAccounts), [expenses, budget, range.start, range.end, account, category, payment, type, grouping, enabledAccounts]);
  const currency = budget.currency;
  const money = (value: number) => formatCurrency(value, currency);
  const reset = () => { setPreset('30days'); setAccount('all'); setCategory('all'); setPayment('all'); setType('all'); };
  const canReset = preset !== '30days' || account !== 'all' || category !== 'all' || payment !== 'all' || type !== 'all';
  const drillCategory = (name: string) => { setCategory(name); setType('expense'); setSection('Expenses'); };
  const exportReport = () => {
    if (!report || !selectedExportSections.length) return;
    setExportError('');
    try {
      if (exportKind === 'pdf') {
        if (!printFinancialSummary(report, currency, selectedExportSections, captureReportCharts(exportChartRef.current), captureInsights(exportChartRef.current), exportSectionsSelected)) { setExportError('Allow the report popup, then export again.'); return; }
      } else downloadFilteredReport(report, exportKind, currency, selectedExportSections);
      exportDialog.current?.close();
      setExportOpen(false);
    } catch {
      setExportError('Unable to export this report. Please try again.');
    }
  };
  if (loading) return <div role="status" aria-label="Loading financial analytics" className="space-y-4"><span className="sr-only">Loading financial analytics…</span><div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div><div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /></div>;
  const groups = report?.groups || [];
  const limit = <T,>(rows: T[]) => rows.length > 120 ? rows.filter((_, index) => index % Math.ceil(rows.length / 120) === 0 || index === rows.length - 1) : rows;
  const positiveCategories = report?.categories.filter(row => row.amount > 0) || [];
  const chartGroups = groups.map(row => ({ name: analyticsGroupLabel(row), income: row.income, expenses: row.expenses, net: row.net, rate: row.rate }));
  const savingsOrder = [...groups].sort((a, b) => a.net - b.net);
  const worstSavings = savingsOrder[0], bestSavings = savingsOrder[savingsOrder.length - 1];
  const accountSeries = enabledAccounts.filter(name => account === 'all' || account === name).map(name => ({ key: name, label: accountNames[name] }));
  const overviewCharts = report && <>
          <div className="grid gap-5 xl:grid-cols-2"><FinancialChart title="Income vs. expenses" description={`${grouping} totals. Only the selected account, category, and transaction types are included.`} data={limit(chartGroups)} series={[{ key: 'income', label: 'Income', color: '#10b981' }, { key: 'expenses', label: 'Expenses', color: '#6366f1' }]} currency={currency} /><FinancialChart title="Savings trend" description={`Net savings = income minus expenses. Best: ${bestSavings ? analyticsGroupLabel(bestSavings) : 'N/A'} (${money(bestSavings?.net || 0)}); lowest: ${worstSavings ? analyticsGroupLabel(worstSavings) : 'N/A'} (${money(worstSavings?.net || 0)}). Savings rate uses the right-hand axis.`} data={limit(chartGroups)} series={[{ key: 'net', label: 'Net savings' }, { key: 'rate', label: 'Savings rate', percent: true, color: '#10b981' }]} kind="line" currency={currency} /></div>
          <FinancialChart title="Cash flow reconciliation" description="Balances reflect actual account movements. Other movements reconcile transfers, balance adjustments, card repayments, and transactions hidden by category or type filters." kind="waterfall" currency={currency} series={[{ key: 'range', label: 'Movement' }]} data={(() => { let value = report.openingBalance; return [{ name: 'Opening balance', signed: value, range: [Math.min(0, value), Math.max(0, value)] }, ...[{ name: 'Income', amount: report.total.income }, { name: 'Expenses', amount: -report.total.expenses }, { name: 'Other movements', amount: report.cashOther }].map(row => { const before = value; value = rounded(value + row.amount); return { name: row.name, signed: row.amount, range: [Math.min(before, value), Math.max(before, value)] }; }), { name: 'Closing balance', signed: report.closingBalance, range: [Math.min(0, report.closingBalance), Math.max(0, report.closingBalance)] }]; })()} />
  </>;
  const expensesCharts = report && <>
          <div className="grid gap-5 xl:grid-cols-2"><FinancialChart title="Category spending" description="Select a slice or legend item to filter transactions. Slices show positive net categories; their shares use the positive-category total. The center shows overall net expenses including reversals." data={positiveCategories.map(row => ({ name: row.name, amount: row.amount, share: row.amount / positiveCategories.reduce((sum, category) => sum + category.amount, 0) * 100 }))} series={[{ key: 'amount', label: 'Expenses' }]} currency={currency} kind="pie" center={report.total.expenses} onSelect={drillCategory} /><FinancialChart title="Top spending categories" description="Compare amounts across your ten largest positive net-spending categories. Exact amounts, shares, and expense counts are shown below." footerContent={<CategoryRankingSummary categories={report.categories} currency={currency} />} data={positiveCategories.slice(0, 10).map(row => ({ name: row.name, amount: row.amount }))} series={[{ key: 'amount', label: 'Expenses' }]} horizontal currency={currency} /></div>
          <FinancialChart title="Daily spending & spikes" description="Current and previous periods aligned by day. Dots highlight days above 2× the selected daily average; this is a spending signal, not evidence of an error. Reversals can produce negative totals." data={limit(report.days).map(row => ({ name: row.date, expenses: row.expenses, previous: row.previousExpenses, spike: row.expenses > 0 && row.expenses > report.dailyAverage * 2 ? row.expenses : null }))} series={[{ key: 'expenses', label: 'Current period' }, { key: 'previous', label: 'Previous period', color: '#f59e0b' }, { key: 'spike', label: 'Spending spike', color: '#f43f5e' }]} kind="line" currency={currency} />
          <CategorySpendingComparison months={report.months} currency={currency} />
  </>;
  const patternsCharts = report && <>
          <SpendingCalendar report={report} currency={currency} />
          <div className="grid gap-5 xl:grid-cols-2"><FinancialChart title="Average spending by weekday" data={report.weekday.map(row => ({ name: row.name, amount: row.average }))} series={[{ key: 'amount', label: 'Daily average' }]} currency={currency} /><FinancialChart title="Weekday vs. weekend" description="Average per calendar day, including days without spending, to account for different numbers of weekdays and weekends." data={[{ name: 'Weekdays', rows: report.weekday.slice(0, 5) }, { name: 'Weekends', rows: report.weekday.slice(5) }].map(row => ({ name: row.name, amount: row.rows.reduce((sum, day) => sum + day.days, 0) ? row.rows.reduce((sum, day) => sum + day.amount, 0) / row.rows.reduce((sum, day) => sum + day.days, 0) : 0 }))} series={[{ key: 'amount', label: 'Daily average' }]} currency={currency} /></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Highest spending day', `${formatDisplayDate(report.highestDay.date)} · ${money(report.highestDay.expenses)}`], ['Lowest spending day', `${formatDisplayDate(report.lowestDay.date)} · ${money(report.lowestDay.expenses)}`], ['No-spend days', String(report.noSpendDays)], ['Spending frequency', `${(report.days.filter(row => row.expenses > 0).length / report.dayCount * 100).toFixed(1)}% of days`], ['Most used category', report.mostFrequent ? `${report.mostFrequent.name} · ${report.mostFrequent.count} entries` : 'N/A'], ['Highest average weekday', report.total.expenses ? [...report.weekday].sort((a, b) => b.average - a.average)[0].name : 'N/A'], ['Median positive expense', money(report.median)], ['Expense ratio', report.total.expenseRatio === null ? 'N/A' : `${report.total.expenseRatio.toFixed(1)}% of income`]].map(([label, value]) => <article key={label} className={financePanel}><h4 className="text-xs text-slate-500">{label}</h4><p className="mt-2 text-sm font-semibold">{value}</p></article>)}</div>
          <RecurringPayments report={report} currency={currency} />
          <div className={financePanel}><h4 className="text-sm font-semibold">Unusually large transactions</h4><p className="mt-1 text-xs text-slate-500">Heuristic: more than 3× the median positive expense, with at least five expenses in the selection.</p>{report.unusual.length ? <ul className="mt-3 space-y-2 text-xs">{report.unusual.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-2 dark:border-slate-800"><span>{row.title} · {formatDisplayDate(row.date)}</span><span>{money(row.amount)}</span></li>)}</ul> : <p className="mt-3 text-xs text-slate-500">No transactions flagged, or insufficient data.</p>}</div>
  </>;
  const accountsCharts = report && <>
          <div className="grid gap-3 md:grid-cols-3">{report.accounts.map(row => <article key={row.account} className={financePanel}><h4 className="text-sm font-semibold">{row.name}</h4><p className="mt-3 text-2xl font-bold">{money(row.balance)}</p><p className="mt-1 text-xs text-slate-500">Balance through {formatDisplayDate(range.end)}</p><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><dt>Income</dt><dd>{money(row.income)}</dd></div><div className="flex justify-between"><dt>Expenses</dt><dd>{money(row.expenses)}</dd></div><div className="flex justify-between"><dt>Share of positive funds</dt><dd>{row.share === null ? 'N/A' : `${row.share.toFixed(1)}%`}</dd></div></dl></article>)}</div>
          <FinancialChart title="Account-wise spending" data={limit(groups).map(row => ({ name: analyticsGroupLabel(row), ...Object.fromEntries(analyticsAccounts.map(name => [name, row.accounts[name] || 0])) }))} series={accountSeries} stacked currency={currency} />
          <FinancialChart title="Balance history" description="Balances at the end of each grouped period. All actual movements are included, independently of category and type filters." data={limit(groups).map(row => ({ name: analyticsGroupLabel(row), ...row.balances }))} series={accountSeries} kind="line" currency={currency} />
          <div className={financePanel}><h4 className="text-sm font-semibold">Account transfers</h4><p className="mt-1 text-xs text-slate-500">Internal movements are shown once and excluded from operating income and expenses. Select Income & expenses to include this separate transfer list.</p><div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Date</th><th className="p-2">From</th><th className="p-2">To</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{report.transfers.map(row => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="whitespace-nowrap p-2">{formatDisplayDate(row.date)}</td><td className="p-2">{accountNames[sourceAccount(row)]}</td><td className="p-2">{accountNames[transferTarget(row)]}</td><td className="p-2 text-right">{money(row.amount)}</td></tr>)}</tbody></table>{!report.transfers.length && <p className="py-4 text-xs text-slate-500">No transfers match the current filters.</p>}</div></div>
  </>;
  return <section className="space-y-5" aria-label="Financial analytics dashboard">
    {exportOpen && report && <div ref={exportChartRef} aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 1100, pointerEvents: 'none' }}>{overviewCharts}{expensesCharts}<CategorySpendingAnalytics report={report} currency={currency} categoryNames={expenseCategoryNames} />{patternsCharts}{accountsCharts}<div data-export-insights><Intelligence report={report} currency={currency} /></div></div>}
    <SpendingSnapshot expenses={visibleExpenses} referenceDate={referenceDate} currency={currency} />
    <div className={financePanel} role="region" aria-label="Shared report filters">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold tracking-tight">Your financial picture</h3><p className="mt-1 text-xs text-slate-500">One set of filters for all summaries, charts, insights, and exports.</p></div>{canReset && <button type="button" onClick={reset} className={action}><RotateCcw className="h-3.5 w-3.5" />Reset filters</button>}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <label className="space-y-1 text-xs text-slate-500">Date range<select aria-label="Analytics period" value={preset} onChange={event => setPreset(event.target.value)} className={control}>{[['today', 'Today'], ['yesterday', 'Yesterday'], ['7days', 'Last 7 days'], ['30days', 'Last 30 days'], ['custom', 'Custom range']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-500">Account<select aria-label="Analytics account" value={account} onChange={event => setAccount(event.target.value as typeof account)} className={control}><option value="all">All enabled accounts</option>{enabledAccounts.map(name => <option key={name} value={name}>{accountNames[name]}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-500">Category<select aria-label="Analytics category" value={category} onChange={event => setCategory(event.target.value)} className={control}><option value="all">All categories</option>{[...new Set(visibleExpenses.map(row => row.category))].sort().map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-500">Payment<select aria-label="Analytics payment" value={payment} onChange={event => setPayment(event.target.value)} className={control}><option value="all">All payment methods</option>{[...new Set(visibleExpenses.map(row => row.paymentMethod))].sort().map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-500">Type<select aria-label="Analytics transaction type" value={type} onChange={event => setType(event.target.value as typeof type)} className={control}><option value="all">Income & expenses</option><option value="income">Income only</option><option value="expense">Expenses only</option></select></label>
      </div>
      {preset === 'custom' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs text-slate-500">From<input aria-label="Analytics start date" type="date" max={customEnd} value={customStart} onChange={event => setCustomStart(event.target.value)} className={control} /></label><label className="space-y-1 text-xs text-slate-500">To<input aria-label="Analytics end date" type="date" min={customStart} max={referenceDate} value={customEnd} onChange={event => setCustomEnd(event.target.value)} className={control} /></label></div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex min-w-0 items-start gap-2.5 rounded-xl bg-indigo-50/60 px-3 py-2.5 dark:bg-indigo-950/20"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Included dates</p><p className="mt-0.5 text-xs font-semibold">{report ? range.start === range.end ? formatDisplayDate(range.start) : `${formatDisplayDate(range.start)} – ${formatDisplayDate(range.end)}` : 'Choose a valid date range'}</p>{report && <p className="mt-1 text-[11px] text-slate-500">{report.dayCount} {report.dayCount === 1 ? 'day' : 'days'} · {report.total.count} {report.total.count === 1 ? 'transaction' : 'transactions'} · Both start and end dates included</p>}</div></div>
        <div className="flex w-full gap-2 sm:w-auto"><select aria-label="Report export format" aria-describedby="filtered-export-help" className={`${control} sm:w-48`} value={exportKind} onChange={event => setExportKind(event.target.value as typeof exportKind)}><option value="pdf">PDF report (print)</option><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option></select><button type="button" disabled={!report} className={action} onClick={() => { setExportError(''); setExportOpen(true); exportDialog.current?.showModal(); }}><Download className="h-4 w-4" />Export</button></div>
      </div>
      <p id="filtered-export-help" className="mt-2 text-[11px] text-slate-500">Choose which report sections to export. Your current filters apply.</p>
      <dialog ref={exportDialog} onClose={() => setExportOpen(false)} aria-labelledby="export-dialog-title" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <h3 id="export-dialog-title" className="text-base font-semibold">Choose what to export</h3><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Choose the app sections to include. Your current filters apply. {exportKind === 'pdf' ? 'PDF includes charts, the spending calendar, insights and data tables.' : 'Excel and CSV contain data tables; choose PDF for charts.'}</p>
        <div className="mt-4 flex gap-3 text-xs"><button type="button" className="font-semibold text-indigo-600 dark:text-indigo-400" onClick={() => setExportSectionsSelected(exportSections.map(([name]) => name))}>Select all</button><button type="button" className="font-semibold text-slate-500 dark:text-slate-400" onClick={() => setExportSectionsSelected([])}>Clear all</button></div>
        <fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">Report sections</legend>{exportSections.map(([name, description]) => <label key={name} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" aria-label={name} checked={exportSectionsSelected.includes(name)} onChange={event => setExportSectionsSelected(selected => event.target.checked ? [...selected, name] : selected.filter(item => item !== name))} className="mt-0.5 accent-indigo-500" /><span><span className="block text-xs font-semibold">{name}</span><span className="mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</span></span></label>)}</fieldset>
        {exportError && <p role="alert" className="mt-3 text-xs text-rose-500">{exportError}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-slate-400">{exportSectionsSelected.length} of {exportSections.length} sections selected</p><div className="flex gap-2"><button type="button" className={action} onClick={() => { exportDialog.current?.close(); setExportOpen(false); }}>Cancel</button><button type="button" className={`${action} bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500`} disabled={!selectedExportSections.length} onClick={exportReport}>Export selected</button></div></div>
      </dialog>
    </div>
    {!report ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">Select valid start and end dates in chronological order.</p> : <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Total income', value: money(report.total.income), change: report.changes.income, icon: ArrowDownLeft, goodUp: true },
          { label: 'Total expenses', value: money(report.total.expenses), change: report.changes.expenses, icon: ArrowUpRight, goodUp: false },
          { label: 'Net savings', value: money(report.total.net), change: report.changes.net, icon: PiggyBank, goodUp: true },
          { label: 'Savings rate', value: report.total.savingsRate === null ? 'N/A' : `${report.total.savingsRate.toFixed(1)}%`, change: report.changes.savingsRate, icon: Percent, goodUp: true, points: true },
          { label: 'Expense ratio', value: report.total.expenseRatio === null ? 'N/A' : `${report.total.expenseRatio.toFixed(1)}%`, change: report.total.expenseRatio !== null && report.prior.expenseRatio !== null ? report.total.expenseRatio - report.prior.expenseRatio : null, icon: Gauge, goodUp: false, points: true },
          { label: 'Total transactions', value: String(report.total.count), change: report.changes.count, icon: Receipt, neutral: true },
          { label: 'Average daily spending', value: money(report.dailyAverage), change: report.changes.daily, icon: CalendarDays, goodUp: false },
          { label: 'Current account balance', value: money(report.closingBalance), change: report.changes.balance, icon: Wallet, goodUp: true },
        ].map(card => <article key={card.label} className={financePanel}><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p><card.icon className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" /></div><p className="mt-3 break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{card.value}</p><p className={`mt-2 text-[11px] ${card.change === null || card.neutral || card.change === 0 ? 'text-slate-500' : (card.change > 0) === card.goodUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{card.change === null ? 'N/A · No comparable base' : `${card.change > 0 ? '↑' : card.change < 0 ? '↓' : '→'} ${Math.abs(card.change).toFixed(1)}${card.points ? ' pp' : '%'} vs. previous period`}</p></article>)}
      </div>
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Comparison: {formatDisplayDate(report.previousStart)} – {formatDisplayDate(report.previousEnd)}. Balances include all account movements through {formatDisplayDate(range.end)}; category and type filters apply to transaction totals, not the actual account balance. Category percentages show shares of actual spending, not budget targets.</p>
      {!report.current.length && <div className={`${financePanel} text-center`}><h4 className="text-sm font-semibold">No matching income or expenses</h4><p className="mt-1 text-xs text-slate-500">Try a wider period. Account balances and transfer records can still exist.</p>{canReset && <button type="button" className={`${action} mt-3`} onClick={reset}>Reset filters</button>}</div>}
      <div role="tablist" aria-label="Financial report sections" className="-mx-6 grid grid-cols-3 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 dark:border-slate-700/70 dark:bg-slate-950/40 sm:mx-0 sm:flex sm:gap-1 sm:overflow-x-auto sm:rounded-xl sm:bg-slate-100 sm:p-1 dark:sm:bg-slate-800">
        {sections.map((name, index) => {
          const Icon = sectionIcons[name];
          const active = section === name;
          return <button key={name} type="button" role="tab" id={`finance-tab-${name}`} aria-controls="finance-section" aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => setSection(name)} onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const index = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (sections.indexOf(name) + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length;
              setSection(sections[index]);
              document.getElementById(`finance-tab-${sections[index]}`)?.focus();
            }
          }} className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 sm:min-h-11 sm:shrink-0 sm:flex-row sm:gap-2 sm:rounded-lg sm:border-0 sm:px-4 ${index < 3 ? 'border-b border-slate-100 dark:border-slate-800' : ''} ${index % 3 !== 2 ? 'border-r border-slate-100 dark:border-slate-800' : ''} ${active ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 sm:bg-white sm:text-indigo-600 sm:shadow-sm dark:sm:bg-slate-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg sm:h-4 sm:w-4 ${active ? 'bg-indigo-100 dark:bg-indigo-500/20 sm:bg-transparent dark:sm:bg-transparent' : ''}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /></span><span className="max-w-full truncate">{name}</span>{active && <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-indigo-500 sm:hidden" />}</button>;
        })}
      </div>
      <div role="tabpanel" id="finance-section" aria-labelledby={`finance-tab-${section}`} className="space-y-5">
        {section === 'Overview' && <>
          <section className={financePanel} aria-label="Period highlights">
            <div><h4 className="text-sm font-semibold">Period highlights</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A quick look at spending for the selected dates and filters.</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><h5 className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Top spending category</h5><p className="mt-1.5 break-words text-sm font-semibold">{positiveCategories[0]?.name || 'No positive spending'}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{positiveCategories[0] ? money(positiveCategories[0].amount) : 'No category total available'}</p></article>
              <article className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><h5 className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Highest spending day</h5><p className="mt-1.5 text-sm font-semibold tabular-nums">{report.highestDay.expenses > 0 ? money(report.highestDay.expenses) : 'No positive spending'}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{report.highestDay.expenses > 0 ? formatDisplayDate(report.highestDay.date) : 'In the selected period'}</p></article>
              <article className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><h5 className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Days with spending</h5><p className="mt-1.5 text-sm font-semibold tabular-nums">{report.days.filter(day => day.expenses > 0).length} of {report.dayCount} days</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Days with positive net spending</p></article>
              <article className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><h5 className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Previous period spending</h5><p className="mt-1.5 text-sm font-semibold tabular-nums">{money(report.prior.expenses)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDisplayDate(report.previousStart)} – {formatDisplayDate(report.previousEnd)}</p></article>
            </div>
          </section>
          <div className="space-y-5">{overviewCharts}</div>
        </>}
        {section === 'Expenses' && expensesCharts}
        {section === 'Categories' && <CategorySpendingAnalytics report={report} currency={currency} categoryNames={expenseCategoryNames} />}
        {section === 'Patterns' && patternsCharts}
        {section === 'Accounts' && accountsCharts}
        {section === 'Insights' && <Intelligence report={report} currency={currency} />}
      </div>
      <details className={`${financePanel} text-xs text-slate-500 dark:text-slate-400`}><summary className="cursor-pointer font-medium">How these reports are calculated</summary><div className="mt-3 space-y-2 leading-relaxed"><p>Operating income and expenses exclude internal transfers, opening balances, balance adjustments, and categories explicitly named Credit Card Payment or Credit Card Repayment. Mark other internal repayments as transfers to prevent counting them twice.</p><p>Negative expenses reduce spending as reversals. Income-coded refunds remain income according to the recorded transaction type; the app has no separate refund links or payment-status fields. Deleted transactions disappear from reports.</p><p>Net savings = income − expenses; savings rate and expense ratio divide by positive income. Comparisons with a zero base show N/A. All sums are rounded in currency cents. Days use local calendar dates; ISO date arithmetic avoids daylight-saving shifts.</p><p>Category shares divide actual category expenses by total actual expenses. Shares are N/A if the total is zero or negative; reversals can produce negative category shares. No targets or remaining-budget amounts are shown.</p><p>Balances include all historical account movements through the selected end date. Cash flow includes an Other movements bridge to reconcile filtered operating totals with real balances. Predictions and recurring detections are estimates.</p></div></details>
    </>}
  </section>;
}

function SpendingCalendar({ report, currency }: { report: FinancialAnalytics; currency: string }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = report.days.slice(-366);
  const maximum = Math.max(0, ...days.map(row => row.expenses));
  const spendingColors = ['#30415f', '#364f8b', '#405fc0', '#554de3', '#803ee8'];
  const spendingLevel = (amount: number) => Math.min(spendingColors.length - 1, Math.ceil(Math.sqrt(amount / maximum) * spendingColors.length) - 1);
  const selectedDay = days.find(day => day.date === selectedDate);
  const offset = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monthLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const label = days[0].date.slice(0, 7) === days[days.length - 1].date.slice(0, 7) ? monthLabel(days[0].date) : `${monthLabel(days[0].date)} – ${monthLabel(days[days.length - 1].date)}`;
  const weekdays = [['Mo', 'Monday'], ['Tu', 'Tuesday'], ['We', 'Wednesday'], ['Th', 'Thursday'], ['Fr', 'Friday'], ['Sa', 'Saturday'], ['Su', 'Sunday']];
  return <section className={financePanel}>
    <h4 className="text-sm font-semibold">Spending calendar</h4>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last {days.length} days of the selected range. Select a date to see its spending. More intense indigo indicates higher spending.</p>
    <div className="mt-5 grid gap-5 lg:min-h-56 lg:grid-cols-2 lg:items-stretch">
    <div className="w-full" role="group" aria-label="Selected dates calendar">
          <h5 className="mb-3 text-xs font-semibold">{label}</h5>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekdays.map(([short, full]) => <abbr key={full} title={full} className="mb-1 text-[10px] font-medium text-slate-500 no-underline dark:text-slate-400">{short}</abbr>)}
            {Array.from({ length: offset }, (_, index) => <span key={`space-${index}`} aria-hidden="true" />)}
            {days.map(row => <button type="button" key={row.date} onClick={() => setSelectedDate(row.date)} aria-pressed={selectedDate === row.date} title={`${formatDisplayDate(row.date)} · ${formatCurrency(row.expenses, currency)} · ${row.count} transactions`} aria-label={`${formatDisplayDate(row.date)}: ${formatCurrency(row.expenses, currency)}, ${row.count} transactions`} className={`flex h-9 w-full items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${selectedDate === row.date ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''} ${row.expenses === 0 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : row.expenses < 0 ? 'bg-emerald-700 text-white' : 'text-white'}`} style={row.expenses > 0 ? { backgroundColor: spendingColors[spendingLevel(row.expenses)] } : undefined}>{Number(row.date.slice(-2))}</button>)}
          </div>
    </div>
    <div className="relative min-w-0">
    <aside aria-label="Selected date details" className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/30 lg:absolute lg:inset-0">
      {selectedDay ? <div role="status" className="flex h-full min-h-0 flex-col"><div className="flex shrink-0 flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Selected date</p><h5 className="mt-1 text-base font-semibold">{formatDisplayDate(selectedDay.date)}</h5><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{selectedDay.count} {selectedDay.count === 1 ? 'transaction' : 'transactions'}</p></div><div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Net spent</p><p className="mt-1 text-xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-300">{formatCurrency(selectedDay.expenses, currency)}</p></div></div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-slate-200 pt-3 dark:border-slate-700/70"><h6 className="shrink-0 text-xs font-semibold">Transactions</h6>{selectedDay.count ? <ul className="mt-1 max-h-56 min-h-0 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-700/60 lg:max-h-none lg:flex-1">{report.current.filter(row => row.date === selectedDay.date).map(row => <li key={row.id} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><p className="break-words text-xs font-medium">{row.title}</p><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{row.category} · {row.type === 'income' ? 'Income' : 'Expense'}</p></div><span className="shrink-0 text-xs font-semibold tabular-nums">{formatCurrency(row.amount, currency)}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No transactions on this date.</p>}</div>
      </div> : <div className="flex min-h-36 flex-col items-center justify-center text-center"><CalendarDays aria-hidden="true" className="h-6 w-6 text-indigo-400" /><p className="mt-3 text-sm font-semibold">Select a date</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose a day to see its spending and transactions.</p></div>}
    </aside>
    </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400" aria-label="Calendar color legend">
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600" />No spending</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-700" />Refunds exceed spending</span>
      {maximum > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="font-medium">Spending levels</span>{spendingColors.map((color, index) => {
        const lower = maximum * (index / spendingColors.length) ** 2;
        const upper = maximum * ((index + 1) / spendingColors.length) ** 2;
        return <span key={color} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-1 ring-inset ring-white/15" style={{ backgroundColor: color }} />{index === 0 ? `Up to ${formatCurrency(upper, currency)}` : `${formatCurrency(lower, currency)} – ${formatCurrency(upper, currency)}`}</span>;
      })}</div>}
    </div>
    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{formatDisplayDate(days[0].date)} – {formatDisplayDate(days[days.length - 1].date)} · Color levels use a square-root scale relative to the highest spending day, making smaller amounts easier to distinguish.</p>
  </section>;
}

function RecurringPayments({ report, currency }: { report: FinancialAnalytics; currency: string }) {
  const estimate = report.recurring.reduce((sum, row) => sum + (row.monthlyEstimate || 0), 0);
  return <section className={financePanel}><h4 className="text-sm font-semibold">Recurring & subscription-like payments</h4><p className="mt-1 text-xs leading-relaxed text-slate-500">Marked recurring entries and payments with similar descriptions, amounts, and regular intervals. Detection does not confirm a subscription; overlapping same-day entries are only possible duplicates.</p><p className="mt-3 text-sm font-semibold">Estimated monthly cost: {report.recurring.some(row => row.monthlyEstimate !== null) ? formatCurrency(estimate, currency) : 'N/A · insufficient interval history'}</p><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Description</th><th className="p-2">Evidence</th><th className="p-2">Occurrences</th><th className="p-2 text-right">Monthly estimate</th></tr></thead><tbody>{report.recurring.map(row => <tr key={`${row.name}-${row.category}`} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{row.name}<span className="block text-[10px] text-slate-500">{row.category}</span></td><td className="p-2">{row.confirmed ? 'Marked recurring' : row.detected ? 'Possible recurring pattern' : 'Possible duplicate'}{row.possibleDuplicate && row.confirmed ? ' · Check duplicate' : ''}</td><td className="p-2">{row.count}{row.cadence > 0 ? ` · ~${row.cadence.toFixed(0)} days apart` : ''}</td><td className="p-2 text-right">{row.monthlyEstimate === null ? 'N/A' : formatCurrency(row.monthlyEstimate, currency)}</td></tr>)}</tbody></table>{!report.recurring.length && <p className="py-4 text-xs text-slate-500">No recurring payments identified in this range.</p>}</div></section>;
}


