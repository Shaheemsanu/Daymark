import { FinancialAnalytics, accountNames, sourceAccount } from './financialAnalytics';
import { createExcelWorkbook, escapeExportXML, ExportTable } from './excelWorkbook';

export type FinancialExportFormat = 'pdf' | 'xlsx' | 'csv';
const roundExport = (value: number) => Math.round(value * 100) / 100;

/** Every format consumes these same tables from the current filtered report. */
export function filteredFinancialTables(report: FinancialAnalytics, currency: string): ExportTable[] {
  const purchases = report.current.filter(row => row.type !== 'income' && row.amount > 0);
  const hasExpenses = report.current.some(row => row.type !== 'income');
  const amounts = purchases.map(row => row.amount);
  return [
    { name: 'Filters', rows: [['Filter', 'Value'], ['From', report.filters.start], ['To', report.filters.end], ['Currency', currency],
      ['Account', report.filters.account === 'all' ? 'All accounts' : accountNames[report.filters.account]], ['Category', report.filters.category],
      ['Payment', report.filters.payment || 'all'], ['Transaction type', report.filters.type], ['Chart grouping', report.filters.grouping],
      ['Scope', 'Current filters only; the fixed Today / Last 7 days / Last 30 days snapshots are excluded.'],
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
    { name: 'Accounts', rows: [['Account', 'Income', 'Expenses', 'Opening balance', 'Closing balance'], ...report.accounts.map(row => [row.name, row.income, row.expenses, row.opening, row.balance])] },
    { name: 'Transactions', rows: [['Date', 'Description', 'Type', 'Category', 'Account', 'Payment', 'Amount'], ...report.current.map(row => [row.date, row.title, row.type || 'expense', row.category, accountNames[sourceAccount(row)], row.paymentMethod, row.amount])] },
  ];
}

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r])/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function filteredFinancialCSV(report: FinancialAnalytics, currency: string) {
  return filteredFinancialTables(report, currency).flatMap(table => [[table.name], ...table.rows, []])
    .map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadFilteredReport(report: FinancialAnalytics, format: 'csv' | 'xlsx', currency: string) {
  const blob = format === 'csv'
    ? new Blob(['\uFEFF', filteredFinancialCSV(report, currency)], { type: 'text/csv;charset=utf-8' })
    : new Blob([createExcelWorkbook(filteredFinancialTables(report, currency))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

export function filteredFinancialHTML(report: FinancialAnalytics, currency: string) {
  const tables = filteredFinancialTables(report, currency);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Daymark filtered financial report</title><style>body{font:12px system-ui;color:#0f172a;padding:28px}h1{font-size:23px}h2{font-size:16px;margin:24px 0 8px}table{border-collapse:collapse;width:100%;margin:8px 0 20px}td,th{padding:7px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group;background:#f1f5f9}tr{break-inside:avoid}small{color:#475569}button{padding:10px 16px}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}body{padding:0}}</style></head><body><h1>Daymark filtered financial report</h1><p>${escapeExportXML(report.filters.start)} to ${escapeExportXML(report.filters.end)} · ${escapeExportXML(currency)}</p><p><button id="print-report">Print / Save as PDF</button></p>${tables.map(table => `<section><h2>${escapeExportXML(table.name)}</h2><table><thead><tr>${table.rows[0].map(cell => `<th>${escapeExportXML(cell)}</th>`).join('')}</tr></thead><tbody>${table.rows.slice(1).map(row => `<tr>${row.map(cell => `<td>${escapeExportXML(typeof cell === 'number' ? Number.isInteger(cell) ? String(cell) : cell.toFixed(2) : cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>${table.rows.length === 1 ? '<small>No matching records.</small>' : ''}</section>`).join('')}</body></html>`;
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

export function printFinancialSummary(report: FinancialAnalytics, currency: string) {
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) return false;
  popup.opener = null;
  popup.document.write(filteredFinancialHTML(report, currency));
  popup.document.close();
  popup.document.getElementById('print-report')?.addEventListener('click', () => popup.print());
  popup.focus(); popup.print();
  return true;
}
