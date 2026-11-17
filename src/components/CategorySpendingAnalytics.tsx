import React, { useEffect, useMemo, useState } from 'react';
import { FinancialAnalytics, analyticsGroupLabel } from '../utils/financialAnalytics';
import { buildCategoryDetails, buildCategoryComparison } from '../utils/categoryAnalytics';
import { formatCurrency } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateFormatting';
import { FinancialChart, financePanel } from './FinancialCharts';
import { ArrowUpRight, Eye } from 'lucide-react';
import CategorySpendingDialog from './CategorySpendingDialog';

export default function CategorySpendingAnalytics({ report, currency, categoryNames = [] }: { report: FinancialAnalytics; currency: string; categoryNames?: string[] }) {
  const categories = useMemo(() => buildCategoryDetails(report), [report]);
  const [sort, setSort] = useState('amount');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = categories.find(row => row.name === selectedName);
  useEffect(() => setSelectedName(null), [report.filters.start, report.filters.end, report.filters.account, report.filters.category, report.filters.payment, report.filters.type]);
  const money = (value: number) => formatCurrency(value, currency);
  const ranked = [...categories].sort((a, b) => sort === 'count' ? b.count - a.count : sort === 'name' ? a.name.localeCompare(b.name) : b.amount - a.amount);
  const leading = categories[0];
  const others = ranked.filter(row => row.name !== leading?.name);
  const positive = categories.filter(row => row.amount > 0);
  const hasNegativeCategory = categories.some(row => row.amount < 0);
  const top = positive.slice(0, 5);
  const mostFrequent = [...categories].sort((a, b) => b.purchaseCount - a.purchaseCount)[0];
  const topThreeShare = report.total.expenses > 0 ? positive.slice(0, 3).reduce((sum, row) => sum + row.amount, 0) / report.total.expenses * 100 : null;
  const comparison = buildCategoryComparison(report, categoryNames);
  // Series keys are independent of category names (including punctuation or dots).
  const chartGroups = report.groups.length > 120 ? report.groups.filter((_, index) => index % Math.ceil(report.groups.length / 120) === 0 || index === report.groups.length - 1) : report.groups;
  const trend = chartGroups.map(group => ({ name: analyticsGroupLabel(group), ...Object.fromEntries(top.map((row, index) => [`category${index}`, group.categories[row.name] || 0])) }));
  return <section className="space-y-5" aria-label="Actual category spending">
    <div className={financePanel}>
      <h4 className="text-base font-semibold">Category spending shares</h4>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">Total spent: {money(report.total.expenses)}. See where your money went, how often you spent, and what changed. Shares use net spending after expense reversals, for the selected filters.</p>
      {!categories.length ? <p className="mt-5 text-sm text-slate-500">No recorded expenses match the selected filters.</p> : <>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['Largest category', positive[0]?.name || 'No positive spending', positive[0] ? `${money(positive[0].amount)} · ${report.total.expenses > 0 ? `${positive[0].share.toFixed(1)}% of total` : 'Share N/A'}` : 'Only zero amounts or reversals'],
            ['Most frequent purchases', mostFrequent?.purchaseCount ? mostFrequent.name : 'No purchases', `${mostFrequent?.purchaseCount || 0} positive expense ${mostFrequent?.purchaseCount === 1 ? 'record' : 'records'}`],
            ['Spending concentration', topThreeShare === null ? 'N/A' : `${topThreeShare.toFixed(1)}%`, `In your top ${Math.min(3, positive.length)} categories · ${categories.length} categories used`],
          ].map(([label, value, detail]) => <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}
        </div>
        <div className="my-5 flex flex-wrap items-center justify-between gap-3"><h5 className="text-sm font-semibold">Spending by category</h5><label className="flex items-center gap-2 text-xs text-slate-500">Sort by<select aria-label="Sort category spending" value={sort} onChange={event => setSort(event.target.value)} className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800"><option value="amount">Highest spending</option><option value="count">Most transactions</option><option value="name">Category name</option></select></label></div>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
          {leading && <article className="relative min-w-0 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 pb-14 dark:border-indigo-500/30 dark:bg-indigo-500/5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Top spending category</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-2"><h5 className="text-lg font-semibold">{leading.name}</h5><span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{report.total.expenses > 0 ? `${leading.share.toFixed(1)}% of spending` : 'Share N/A'}</span></div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{money(leading.amount)}</p>
            <p className="mt-1 text-xs text-slate-500">{leading.count} expense records · {leading.activeDays} purchase days</p>
            {report.total.expenses > 0 && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, leading.share))}%` }} /></div>}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-indigo-100 pt-4 text-xs dark:border-indigo-500/15">{[
              ['Per calendar day', money(leading.dailyAverage)], ['Average purchase', leading.averagePurchase === null ? 'N/A' : money(leading.averagePurchase)],
              ['Smallest purchase', leading.minimum === null ? 'N/A' : money(leading.minimum)], ['Largest purchase', leading.maximum === null ? 'N/A' : money(leading.maximum)],
            ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl>
            <button type="button" aria-label={`View ${leading.name} details`} onClick={() => setSelectedName(leading.name)} className="absolute inset-0 flex items-end justify-end gap-2 rounded-2xl p-4 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-400"><Eye className="h-4 w-4" aria-hidden="true" />View details</button>
          </article>}
          <section aria-label="Other spending categories" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800"><h5 className="text-sm font-semibold">Other categories <span className="ml-1 text-xs font-normal text-slate-500">({others.length})</span></h5><p className="mt-1 text-[11px] text-slate-500">Select a category to view its full breakdown.</p></div>
            {others.length ? <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{others.map(row => <button key={row.name} type="button" aria-label={`View ${row.name} details`} onClick={() => setSelectedName(row.name)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800/60"><div className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{row.name}</span><span className="mt-1 block text-[11px] text-slate-500">{row.count} {row.count === 1 ? 'expense' : 'expenses'} · {row.activeDays} purchase days</span></div><div className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{money(row.amount)}</span><span className="mt-1 block text-[11px] text-indigo-600 dark:text-indigo-400">{report.total.expenses > 0 ? `${row.share.toFixed(1)}% of spending` : 'Share N/A'}</span></div><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /></button>)}</div> : <p className="p-4 text-xs text-slate-500">All recorded expenses are in the top category.</p>}
          </section>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Daily averages include all {report.dayCount} selected calendar days. Purchase averages, minimums, maximums, and medians use positive expenses only. Net totals and account/payment breakdowns include reversals.</p>
      </>}
    </div>
    {comparison.length > 0 && <>
      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <FinancialChart title="Where your money goes" description={hasNegativeCategory ? 'Net spending by category, including negative expense reversals.' : 'Each slice shows a category’s share of recorded net spending.'} data={(hasNegativeCategory ? categories : positive).map(row => ({ name: row.name, amount: row.amount, share: row.share }))} series={[{ key: 'amount', label: 'Spent' }]} currency={currency} kind={hasNegativeCategory ? 'bar' : 'pie'} horizontal={hasNegativeCategory} />
        <FinancialChart title="Category spending changes" description={`Selected period vs. ${formatDisplayDate(report.previousStart)} – ${formatDisplayDate(report.previousEnd)}. Only categories with a nonzero amount in either period are shown. Categories with zero in both periods are hidden.`} data={comparison} series={[{ key: 'current', label: 'Selected period' }, { key: 'previous', label: 'Previous period', color: '#94a3b8' }]} currency={currency} horizontal plotHeight={Math.max(256, comparison.length * 28 + 40)} fillLegendSpace plotClassName="translate-y-4" />
      </div>
      {top.length > 0 && <FinancialChart title="Category spending over time" description="Your five largest positive net-spending categories, using the chart interval selected above. Days without spending are included." data={trend} series={top.map((row, index) => ({ key: `category${index}`, label: row.name }))} currency={currency} kind="line" />}
    </>}
    {selected && <CategorySpendingDialog key={selected.name} row={selected} report={report} currency={currency} onClose={() => setSelectedName(null)} />}
  </section>;
}
