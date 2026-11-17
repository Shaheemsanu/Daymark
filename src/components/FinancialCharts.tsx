import React from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '../utils/constants';

export const FINANCE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#f43f5e', '#64748b'];
export const financePanel = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5';
type Point = Record<string, string | number | null | number[]>;
type Series = { key: string; label: string; color?: string; percent?: boolean };

export function FinancialChart({ title, description, data, series, currency, kind = 'bar', stacked = false, horizontal = false, onSelect, center, empty = false, footerContent, plotClassName = '', plotHeight = 256, fillLegendSpace = false }: {
  title: string; description?: string; data: Point[]; series: Series[]; currency: string;
  kind?: 'bar' | 'line' | 'area' | 'pie' | 'waterfall'; stacked?: boolean; horizontal?: boolean; onSelect?: (name: string) => void; center?: number; empty?: boolean;
  footerContent?: React.ReactNode;
  plotClassName?: string;
  plotHeight?: number;
  fillLegendSpace?: boolean;
}) {
  const axis = { fontSize: 10, fill: '#94a3b8' };
  const money = (value: unknown) => formatCurrency(Number(value), currency);
  const formatTooltip = (value: unknown, name: unknown, entry?: { payload?: Record<string, unknown> }) => series.find(item => item.label === name)?.percent ? `${Number(value).toFixed(1)}%` : Array.isArray(value) ? money(entry?.payload?.signed ?? Number(value[1]) - Number(value[0])) : money(value);
  const tooltip = <Tooltip formatter={formatTooltip} contentStyle={{ backgroundColor: 'var(--finance-tooltip-bg, #fff)', color: 'var(--finance-tooltip-text, #0f172a)', borderRadius: 12, border: '1px solid #94a3b855', fontSize: 12 }} />;
  const axes = <><CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} /><XAxis type={horizontal ? 'number' : 'category'} dataKey={horizontal ? undefined : 'name'} tick={axis} interval="preserveStartEnd" /><YAxis interval={horizontal ? 0 : undefined} type={horizontal ? 'category' : 'number'} dataKey={horizontal ? 'name' : undefined} tick={axis} width={horizontal ? 105 : 65} />{series.some(item => item.percent) && <YAxis yAxisId="rate" orientation="right" tick={axis} unit="%" width={45} />}{tooltip}</>;
  // Paired chart cards share five row tracks, so wrapping descriptions and
  // legends never shift one plot or footer below its neighbour.
  return <section className={`${financePanel} row-span-5 grid grid-rows-subgrid gap-y-0 self-stretch [--finance-tooltip-bg:white] [--finance-tooltip-text:#0f172a] dark:[--finance-tooltip-bg:#1e293b] dark:[--finance-tooltip-text:#e2e8f0]`} aria-label={title}>
    <header><h4 className="text-sm font-semibold">{title}</h4>{description && <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>}</header>
    {empty || !data.length ? <><div className="my-3 min-h-4" aria-hidden="true" /><p className="flex h-64 items-center justify-center text-xs text-slate-500">No matching data for this chart.</p><div aria-hidden="true" /><div aria-hidden="true" /></> : <>
      <div className="my-3 flex min-h-4 flex-wrap items-start gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">{kind !== 'pie' && series.map((item, index) => <span key={item.key} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || FINANCE_COLORS[index % FINANCE_COLORS.length] }} />{item.label}</span>)}</div>
      <div className={`w-full min-w-0 ${fillLegendSpace ? 'row-span-2 self-stretch' : ''} ${plotClassName}`} style={{ height: fillLegendSpace ? '100%' : plotHeight, minHeight: plotHeight }} aria-label={`${title} chart`}><div style={{ height: '100%' }}><ResponsiveContainer width="100%" height="100%">
        {kind === 'pie' ? <PieChart accessibilityLayer><Pie data={data} nameKey="name" dataKey="amount" innerRadius="58%" outerRadius="85%" paddingAngle={2}>{data.map((row, index) => <Cell key={String(row.name)} fill={FINANCE_COLORS[index % FINANCE_COLORS.length]} onClick={() => onSelect?.(String(row.name))} style={onSelect ? { cursor: 'pointer' } : undefined} />)}</Pie>{tooltip}{center !== undefined && <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize={13} fontWeight={600}>{formatCurrency(center, currency)}</text>}</PieChart>
          : kind === 'line' ? <LineChart data={data} accessibilityLayer>{axes}{series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} yAxisId={item.percent ? 'rate' : 0} stroke={item.color || FINANCE_COLORS[index % FINANCE_COLORS.length]} dot={item.key === 'spike' ? { r: 4 } : false} strokeWidth={item.key === 'spike' ? 0 : 2} connectNulls={false} isAnimationActive={false} />)}</LineChart>
          : kind === 'area' ? <AreaChart data={data} accessibilityLayer>{axes}{series.map((item, index) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color || FINANCE_COLORS[index % FINANCE_COLORS.length]} fill={item.color || FINANCE_COLORS[index % FINANCE_COLORS.length]} fillOpacity={.12} isAnimationActive={false} />)}</AreaChart>
          : <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} accessibilityLayer>{axes}{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} stackId={stacked ? 'spending' : undefined} fill={item.color || FINANCE_COLORS[index % FINANCE_COLORS.length]} radius={[3, 3, 0, 0]} isAnimationActive={false}>{kind === 'waterfall' && data.map((row, cellIndex) => <Cell key={String(row.name)} fill={FINANCE_COLORS[cellIndex % FINANCE_COLORS.length]} />)}</Bar>)}</BarChart>}
      </ResponsiveContainer></div></div>
      {kind === 'pie' ? <div className="mt-3 space-y-1.5">{data.map((row, index) => <button key={String(row.name)} type="button" disabled={!onSelect} onClick={() => onSelect?.(String(row.name))} className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800 disabled:cursor-default"><span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: FINANCE_COLORS[index % FINANCE_COLORS.length] }} />{String(row.name)}</span><span>{money(row.amount)} · {Number(row.share || 0).toFixed(1)}%</span></button>)}</div> : footerContent ? <div className="mt-3">{footerContent}</div> : fillLegendSpace ? null : <div aria-hidden="true" />}
      <details className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="cursor-pointer text-[11px] font-medium text-slate-500">View chart data</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left text-[11px]"><thead><tr><th className="p-2">Period / group</th>{series.map(item => <th key={item.key} className="p-2 text-right">{item.label}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={index} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{String(row.name)}</td>{series.map(item => <td key={item.key} className="p-2 text-right">{row[item.key] === null ? 'N/A' : item.percent ? `${Number(row[item.key]).toFixed(1)}%` : formatTooltip(row[item.key], item.label, { payload: row })}</td>)}</tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
