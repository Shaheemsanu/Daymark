import { FinancialAnalytics, accountNames, sourceAccount, transferTarget } from './financialAnalytics';
import { createExcelWorkbook, escapeExportXML, ExportTable } from './excelWorkbook';
import { buildCategoryDetails } from './categoryAnalytics';

export type FinancialExportFormat = 'pdf' | 'xlsx' | 'csv';
const roundExport = (value: number) => Math.round(value * 100) / 100;

/** Every format consumes these same tables from the current filtered report. */
export function filteredFinancialTables(report: FinancialAnalytics, currency: string, sections?: string[]): ExportTable[] {
  const purchases = report.current.filter(row => row.type !== 'income' && row.amount > 0);
  const hasExpenses = report.current.some(row => row.type !== 'income');
  const amounts = purchases.map(row => row.amount);
  const tables: ExportTable[] = [
    { name: 'Filters', rows: [['Filter', 'Value'], ['From', report.filters.start], ['To', report.filters.end], ['Currency', currency],
      ['Account', report.filters.account === 'all' ? 'All accounts' : accountNames[report.filters.account]], ['Category', report.filters.category],
      ['Payment', report.filters.payment || 'all'], ['Transaction type', report.filters.type], ['Chart grouping', report.filters.grouping],
      ['Scope', 'Current filters only; the fixed Today / This week / This month snapshots are excluded.'],
      ['Calculation notes', 'Operating totals exclude transfers, opening balances, adjustments, and explicitly categorized card repayments. Negative expenses reduce spending.'],
      ['Balance scope', 'Balances include historical account movements through the end date. Category, payment, and type filters do not change actual balances.'],
    ] },
    { name: 'Summary', rows: [['Metric', 'Value'], ['Total income', report.total.income], ['Total expenses', report.total.expenses], ['Net savings', report.total.net],
      ['Savings rate (%)', report.total.savingsRate === null ? 'N/A' : roundExport(report.total.savingsRate)],
      ['Expense ratio (%)', report.total.expenseRatio === null ? 'N/A' : roundExport(report.total.expenseRatio)],
      ['Transaction count', report.total.count], ['Calendar days', report.dayCount], ['Average daily spending', roundExport(report.dailyAverage)],
      ['Average positive purchase', purchases.length ? roundExport(purchases.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100 / purchases.length) : 'N/A'],
      ['Largest purchase', amounts.length ? amounts.reduce((max, amount) => Math.max(max, amount)) : 'N/A'],
      ['Smallest purchase', amounts.length ? amounts.reduce((min, amount) => Math.min(min, amount)) : 'N/A'],
      ['Median positive purchase', amounts.length ? roundExport(report.median) : 'N/A'], ['Days with no net spending', report.noSpendDays],
      ['Highest spending day', hasExpenses ? report.highestDay.date : 'N/A'], ['Highest daily spending', hasExpenses ? report.highestDay.expenses : 'N/A'],
      ['Lowest spending day', hasExpenses ? report.lowestDay.date : 'N/A'], ['Lowest daily spending', hasExpenses ? report.lowestDay.expenses : 'N/A'],
      ['Opening account balance', report.openingBalance], ['Closing account balance', report.closingBalance],
    ] },
    { name: 'Daily spending', rows: [['Date', 'Income', 'Expenses', 'Net savings', 'Transaction count'], ...report.days.map(row => [row.date, row.income, row.expenses, row.net, row.count])] },
    { name: 'Chart periods', rows: [['From', 'To', 'Income', 'Expenses', 'Net savings', 'Transaction count'], ...report.groups.map(row => [row.start, row.end, row.income, row.expenses, row.net, row.count])] },
    { name: 'Monthly spending', rows: [['Month', 'Included from', 'Included to', 'Income', 'Expenses', 'Net savings'], ...report.months.map(row => [row.date, row.start, row.end, row.income, row.expenses, row.net])] },
    { name: 'Categories', rows: [['Category', 'Expenses', 'Share (%)', 'Expense count'], ...report.categories.filter(row => row.count > 0).map(row => [row.name, row.amount, report.total.expenses > 0 ? roundExport(row.share) : 'N/A', row.count])] },
    { name: 'Category details', rows: [['Category', 'Purchases', 'Reversals', 'Purchase count', 'Purchase days', 'Daily average', 'Average purchase', 'Smallest purchase', 'Largest purchase', 'Median purchase'], ...buildCategoryDetails(report).map(row => [row.name, row.purchased, row.reversed, row.purchaseCount, row.activeDays, roundExport(row.dailyAverage), row.averagePurchase === null ? 'N/A' : roundExport(row.averagePurchase), row.minimum ?? 'N/A', row.maximum ?? 'N/A', row.median === null ? 'N/A' : roundExport(row.median)])] },
    { name: 'Monthly categories', rows: [['From', 'To', 'Category', 'Net spending'], ...report.months.flatMap(month => Object.entries(month.categories).map(([name, amount]) => [month.start, month.end, name, roundExport(amount)]))] },
    { name: 'Accounts', rows: [['Account', 'Income', 'Expenses', 'Opening balance', 'Closing balance'], ...report.accounts.map(row => [row.name, row.income, row.expenses, row.opening, row.balance])] },
    { name: 'Transactions', rows: [['Date', 'Description', 'Type', 'Category', 'Account', 'Payment', 'Amount'], ...report.current.map(row => [row.date, row.title, row.type || 'expense', row.category, accountNames[sourceAccount(row)], row.paymentMethod, row.amount])] },
    { name: 'Recurring payments', rows: [['Description', 'Category', 'Evidence', 'Occurrences', 'Interval (days)', 'Monthly estimate'], ...report.recurring.map(row => [row.name, row.category, row.confirmed ? 'Marked recurring' : row.detected ? 'Possible recurring pattern' : 'Possible duplicate', row.count, row.cadence ? roundExport(row.cadence) : 'N/A', row.monthlyEstimate === null ? 'N/A' : roundExport(row.monthlyEstimate)])] },
    { name: 'Unusual transactions', rows: [['Date', 'Description', 'Category', 'Amount'], ...report.unusual.map(row => [row.date, row.title, row.category, row.amount])] },
    { name: 'Account transfers', rows: [['Date', 'From', 'To', 'Amount'], ...report.transfers.map(row => [row.date, accountNames[sourceAccount(row)], accountNames[transferTarget(row)], row.amount])] },
    { name: 'Spending patterns', rows: [['Metric', 'Value'], ['Highest spending day', report.highestDay.date], ['Highest spending', report.highestDay.expenses], ['Lowest spending day', report.lowestDay.date], ['Lowest spending', report.lowestDay.expenses], ['Days without net spending', report.noSpendDays], ['Days with positive spending', report.days.filter(day => day.expenses > 0).length], ['Most used category', report.mostFrequent?.name || 'N/A'], ['Median positive expense', report.median], ['Estimated month-end spending', report.projection === null ? 'N/A' : roundExport(report.projection)]] },
    { name: 'Insight details', rows: [['Insight', 'Value'], ['Average daily spending', roundExport(report.dailyAverage)], ['Largest spending category', report.categories[0]?.name || 'N/A'], ['Largest category amount', report.categories[0]?.amount ?? 'N/A'], ['Expense change vs. previous period (%)', report.changes.expenses === null ? 'N/A' : roundExport(report.changes.expenses)], ['Estimated month-end spending', report.projection === null ? 'N/A' : roundExport(report.projection)]] },
  ];
  return sections ? tables.filter(table => sections.includes(table.name)) : tables;
}

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r])/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function filteredFinancialCSV(report: FinancialAnalytics, currency: string, sections?: string[]) {
  return filteredFinancialTables(report, currency, sections).flatMap(table => [[table.name], ...table.rows, []])
    .map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadFilteredReport(report: FinancialAnalytics, format: 'csv' | 'xlsx', currency: string, sections?: string[]) {
  const blob = format === 'csv'
    ? new Blob(['\uFEFF', filteredFinancialCSV(report, currency, sections)], { type: 'text/csv;charset=utf-8' })
    : new Blob([createExcelWorkbook(filteredFinancialTables(report, currency, sections))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `daymark-filtered-report-${report.filters.start}-${report.filters.end}.${format}`;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    // Give the browser time to begin the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export type PrintableChart = { svg: string; description: string; legend: { label: string; color: string }[]; title?: string };
export type PrintableInsight = { title: string; body: string };
export function filteredFinancialHTML(report: FinancialAnalytics, currency: string, sections?: string[], renderedCharts: Record<string, PrintableChart> = {}, renderedInsights: PrintableInsight[] = [], selectedGroups?: string[]) {
  const tables = filteredFinancialTables(report, currency, sections);
  const chartNames = ['Income vs. expenses chart', 'Savings trend chart', 'Cash flow chart', 'Category spending chart', 'Top spending categories chart', 'Daily spending chart', 'Where your money goes chart', 'Category changes chart', 'Category trends chart', 'Weekday spending chart', 'Weekday vs. weekend chart', 'Account spending chart', 'Account balance history chart'];
  const renderChart = (name: string) => {
    if (!sections?.includes(name) || !renderedCharts[name]) return ''; 
    const rendered = renderedCharts[name];
    return `<section class="screen-chart"><h2>${escapeExportXML(rendered.title || (name === 'Cash flow chart' ? 'Cash flow reconciliation' : name.replace(/ chart$/, '')))}</h2><p>${escapeExportXML(rendered.description)}</p><div class="chart-legend">${rendered.legend.map(item => `<span><i style="background:${escapeExportXML(item.color)}"></i>${escapeExportXML(item.label)}</span>`).join('')}</div>${rendered.svg}</section>`;
  };
  const calendar = sections?.includes('Spending calendar') ? (() => {
    const days = report.days.slice(-366), max = Math.max(0, ...days.map(day => day.expenses));
    const colors = ['#dbe5f5', '#a7b9e6', '#7c91db', '#645bd1', '#803ee8'];
    const offset = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
    return `<section><h2>Spending calendar</h2><p>Last ${days.length} days of the selected range. Indigo intensity indicates spending; green indicates refunds exceed spending.</p><div class="calendar">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `<b>${day}</b>`).join('')}${'<span></span>'.repeat(offset)}${days.map(day => { const color = day.expenses < 0 ? '#047857' : day.expenses === 0 ? '#e2e8f0' : colors[Math.min(4, Math.ceil(Math.sqrt(day.expenses / max) * 5) - 1)]; const text = day.expenses < 0 || (day.expenses > 0 && day.expenses / max > .36) ? '#fff' : '#0f172a'; return `<div style="background:${color};color:${text}"><strong>${escapeExportXML(day.date)}</strong><br/>${escapeExportXML(currency)} ${day.expenses.toFixed(2)}</div>`; }).join('')}</div></section>`;
  })() : '';
  const monthlyComparison = sections?.includes('Monthly category comparison') ? (() => {
    const max = Math.max(0, ...report.months.flatMap(month => Object.values(month.categories).map(Math.abs)));
    return `<section><h2>Category spending comparison</h2><div class="monthly-cards">${report.months.map(month => `<article><h3>${escapeExportXML(month.start)} – ${escapeExportXML(month.end)}</h3><p>${month.days} days included · Net spent: ${escapeExportXML(currency)} ${month.expenses.toFixed(2)}</p>${Object.entries(month.categories).sort((a, b) => b[1] - a[1]).map(([name, amount]) => `<div class="category-row"><span>${escapeExportXML(name)}</span><strong>${escapeExportXML(currency)} ${amount.toFixed(2)}</strong><div class="bar-track"><div style="width:${max ? Math.abs(amount) / max * 100 : 0}%;background:${amount < 0 ? '#d97706' : '#6366f1'}"></div></div></div>`).join('') || '<p>No spending recorded in this period.</p>'}</article>`).join('')}</div></section>`;
  })() : '';
  const insights = sections?.includes('Insights') ? `<section><h2>Insights</h2>${renderedInsights.length ? renderedInsights.map(item => `<article><h3>${escapeExportXML(item.title)}</h3><p>${escapeExportXML(item.body)}</p></article>`).join('') : '<p>No insights available for this selection.</p>'}</section>` : '';
  const renderTable = (table: ExportTable) => `<section><h2>${escapeExportXML(table.name)}</h2><table><thead><tr>${table.rows[0].map(cell => `<th>${escapeExportXML(cell)}</th>`).join('')}</tr></thead><tbody>${table.rows.slice(1).map(row => `<tr>${row.map(cell => `<td>${escapeExportXML(typeof cell === 'number' ? Number.isInteger(cell) ? String(cell) : cell.toFixed(2) : cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>${table.rows.length === 1 ? '<small>No matching records.</small>' : ''}</section>`;
  const groups: Record<string, string[]> = {
    Overview: ['Summary', 'Income vs. expenses chart', 'Savings trend chart', 'Cash flow chart', 'Chart periods'],
    Expenses: ['Category spending chart', 'Top spending categories chart', 'Daily spending chart', 'Monthly category comparison', 'Daily spending', 'Monthly spending', 'Monthly categories', 'Transactions'],
    Categories: ['Where your money goes chart', 'Category changes chart', 'Category trends chart', 'Categories', 'Category details'],
    Patterns: ['Spending calendar', 'Weekday spending chart', 'Weekday vs. weekend chart', 'Spending patterns', 'Recurring payments', 'Unusual transactions'],
    Accounts: ['Accounts', 'Account spending chart', 'Account balance history chart', 'Account transfers'],
    Insights: ['Insights', 'Insight details'],
  };
  const renderItem = (name: string) => {
    if (name === 'Spending calendar') return calendar;
    if (name === 'Monthly category comparison') return monthlyComparison;
    if (name === 'Insights') return insights;
    if (chartNames.includes(name)) return renderChart(name);
    const table = tables.find(item => item.name === name);
    return table ? renderTable(table) : '';
  };
  const content = selectedGroups ? (tables.find(table => table.name === 'Filters') ? renderTable(tables.find(table => table.name === 'Filters')!) : '') + Object.entries(groups).filter(([name]) => selectedGroups.includes(name)).map(([name, items]) => `<section class="report-group"><h2 class="group-title">${escapeExportXML(name)}</h2>${items.map(renderItem).join('')}</section>`).join('') : chartNames.map(renderChart).join('') + monthlyComparison + calendar + insights + tables.map(renderTable).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Daymark filtered financial report</title><style>body{font:12px system-ui;color:#0f172a;padding:28px}h1{font-size:23px}h2{font-size:16px;margin:24px 0 8px}table{border-collapse:collapse;width:100%;margin:8px 0 20px}td,th{padding:7px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group;background:#f1f5f9}tr{break-inside:avoid}h2{break-after:avoid}.group-title{font-size:20px;color:#3730a3;border-bottom:2px solid #c7d2fe;padding-bottom:8px;margin-top:28px}.screen-chart{break-inside:avoid;margin:12px 0}small{color:#475569}.screen-chart{padding:20px;background:#0f172a;color:#f8fafc;border:1px solid #263449;border-radius:14px}.screen-chart h2{margin:0 0 8px}.screen-chart p{color:#94a3b8}.screen-chart svg{display:block;width:100%;height:auto;max-height:125mm}.chart-legend{display:flex;gap:16px;color:#94a3b8;font-size:11px;margin:14px 0}.chart-legend span{display:flex;align-items:center;gap:6px}.chart-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}button{padding:10px 16px}.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.calendar div{padding:6px;border-radius:5px;font-size:10px}.calendar b{padding:5px}.monthly-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.monthly-cards article{border:1px solid #cbd5e1;border-radius:10px;padding:12px;break-inside:avoid}.monthly-cards h3{margin:0}.category-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;margin-top:10px}.bar-track{width:100%;height:5px;border-radius:4px;background:#e2e8f0}.bar-track div{height:100%;border-radius:4px}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}body{padding:0}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><h1>Daymark filtered financial report</h1><p>${escapeExportXML(report.filters.start)} to ${escapeExportXML(report.filters.end)} · ${escapeExportXML(currency)}</p><p><button id="print-report">Print / Save as PDF</button></p>${content}</body></html>`;
}

export type FinancialExport = 'transactions' | 'monthly' | 'categories' | 'accounts';
export function financialReportCSV(report: FinancialAnalytics, kind: FinancialExport): string {
  const meta = [['Report', kind], ['From', report.filters.start], ['To', report.filters.end], ['Account', report.filters.account], ['Category', report.filters.category], ['Payment', report.filters.payment || 'all'], ['Transaction type', report.filters.type], ['Income', report.total.income.toFixed(2)], ['Expenses', report.total.expenses.toFixed(2)], ['Net savings', report.total.net.toFixed(2)]];
  const rows = kind === 'transactions' ? [['Date', 'Description', 'Type', 'Category', 'Account', 'Payment', 'Amount'], ...report.current.map(row => [row.date, row.title, row.type || 'expense', row.category, accountNames[sourceAccount(row)], row.paymentMethod, row.amount.toFixed(2)])]
    : kind === 'monthly' ? [['Month', 'Income', 'Expenses', 'Net savings', 'Savings rate'], ...report.months.map(row => [row.date, row.income.toFixed(2), row.expenses.toFixed(2), row.net.toFixed(2), row.rate === null ? 'N/A' : row.rate.toFixed(2)])]
    : kind === 'categories' ? [['Category', 'Expenses', 'Share (%)', 'Count', 'Previous expenses'], ...report.categories.map(row => [row.name, row.amount.toFixed(2), row.share.toFixed(2), row.count, row.previous.toFixed(2)])]
    : [['Account', 'Income', 'Expenses', 'Opening balance', 'Closing balance', 'Share of positive funds (%)'], ...report.accounts.map(row => [row.name, row.income.toFixed(2), row.expenses.toFixed(2), row.opening.toFixed(2), row.balance.toFixed(2), row.share === null ? 'N/A' : row.share.toFixed(2)])];
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [...meta, [], ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

export function downloadFinancialReport(report: FinancialAnalytics, kind: FinancialExport) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', financialReportCSV(report, kind)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `daymark-${kind}-${report.filters.start}-${report.filters.end}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export function printFinancialSummary(report: FinancialAnalytics, currency: string, sections?: string[], renderedCharts?: Record<string, PrintableChart>, renderedInsights?: PrintableInsight[], selectedGroups?: string[]) {
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) return false;
  popup.opener = null;
  popup.document.write(filteredFinancialHTML(report, currency, sections, renderedCharts, renderedInsights, selectedGroups));
  popup.document.close();
  popup.document.getElementById('print-report')?.addEventListener('click', () => popup.print());
  popup.focus(); popup.print();
  return true;
}
