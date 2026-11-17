import React from 'react';
import { FinancialAnalytics } from '../utils/financialAnalytics';
import { formatCurrency } from '../utils/constants';

export default function CategoryRankingSummary({ categories, currency }: { categories: FinancialAnalytics['categories']; currency: string }) {
  const positive = categories.filter(row => row.amount > 0);
  const total = positive.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
  const leaders = positive.slice(0, 2);
  const leadingTotal = leaders.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
  if (!positive.length) return null;
  return <section aria-label="Category ranking summary" className="space-y-2">
    <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><caption className="sr-only">Top category amounts and expense counts</caption><thead className="text-[10px] font-medium text-slate-500"><tr><th className="pb-1 font-medium">Category</th><th className="pb-1 text-right font-medium">Spent</th><th className="pb-1 text-right font-medium">Share</th><th className="pb-1 pl-2 text-right font-medium">Records</th></tr></thead><tbody>{positive.slice(0, 3).map(row => <tr key={row.name} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5 pr-2 font-medium">{row.name}</td><td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatCurrency(row.amount, currency)}</td><td className="py-1.5 pl-2 text-right tabular-nums">{(row.amount / total * 100).toFixed(1)}%</td><td className="py-1.5 pl-2 text-right tabular-nums">{row.count}</td></tr>)}</tbody></table></div>
    <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Top {leaders.length === 1 ? 'category' : '2 categories'}: <span className="font-semibold">{formatCurrency(leadingTotal, currency)} · {(leadingTotal / total * 100).toFixed(1)}%</span> of positive-category spending.</p>
    <p className="text-[10px] leading-relaxed text-slate-500">{positive.length} positive {positive.length === 1 ? 'category' : 'categories'}. Shares use the positive-category total{positive.length > 3 ? '; the three largest are listed here' : ''}.</p>
  </section>;
}
