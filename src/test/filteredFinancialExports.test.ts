import { describe, expect, it } from 'vitest';
import { buildFinancialAnalytics, AnalyticsFilters } from '../utils/financialAnalytics';
import { filteredFinancialCSV, filteredFinancialHTML, filteredFinancialTables } from '../utils/financialExports';
import { createExcelWorkbook } from '../utils/excelWorkbook';
import { BudgetConfig, Expense } from '../types';

const budget: BudgetConfig = { monthlyBudget: 1000, dailyBudget: 100, weeklyBudget: 500, currency: 'INR', categoryBudgets: { Food: 500 } };
const filters: AnalyticsFilters = { start: '2026-11-10', end: '2026-11-16', account: 'cash', category: 'Food', payment: 'UPI', type: 'expense', grouping: 'weekly' };
const tx = (id: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id, amount, title: id, category: 'Food', paymentMethod: 'UPI', date: '2026-11-12', account: 'cash', createdAt: 1, ...extra });
const records = [tx('included', 25.5, { title: '=SUM(A1) <script> & "quote"' }), tx('refund', -5.5),
  tx('wrong account', 200, { account: 'expense' }), tx('wrong category', 300, { category: 'Utilities' }),
  tx('wrong payment', 400, { paymentMethod: 'Cash' }), tx('income', 500, { type: 'income' }),
  tx('previous', 100, { date: '2026-11-05' }), tx('future', 200, { date: '2026-11-17' }),
  tx('transfer', 300, { isTransfer: true }),
];

function unzipStored(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let cursor = 0;
  while (view.getUint32(cursor, true) === 0x04034b50) {
    expect(view.getUint16(cursor + 8, true)).toBe(0);
    const size = view.getUint32(cursor + 18, true), nameLength = view.getUint16(cursor + 26, true), extraLength = view.getUint16(cursor + 28, true);
    const name = decoder.decode(bytes.slice(cursor + 30, cursor + 30 + nameLength));
    const start = cursor + 30 + nameLength + extraLength;
    files.set(name, decoder.decode(bytes.slice(start, start + size)));
    cursor = start + size;
  }
  expect(view.getUint32(cursor, true)).toBe(0x02014b50);
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  return files;
}

describe('exports of the current filtered report', () => {
  const report = buildFinancialAnalytics(records, budget, filters)!;
  it('includes only the selected sections across report formats', () => {
    const selected = ['Summary', 'Transactions'];
    expect(filteredFinancialTables(report, 'INR', selected).map(table => table.name)).toEqual(selected);
    expect(filteredFinancialCSV(report, 'INR', selected)).not.toContain('Monthly spending');
    expect(filteredFinancialHTML(report, 'INR', selected)).not.toContain('<h2>Accounts</h2>');
    const workbook = unzipStored(createExcelWorkbook(filteredFinancialTables(report, 'INR', selected)));
    expect(workbook.get('xl/workbook.xml')).toContain('Transactions');
    expect(workbook.get('xl/workbook.xml')).not.toContain('Accounts');
    expect(workbook.get('xl/worksheets/sheet1.xml')).toContain('fitToWidth="1" fitToHeight="0"');
  });

  it('does not invent a chart when the on-screen diagram is unavailable', () => {
    const html = filteredFinancialHTML(report, 'INR', ['Category spending chart']);
    expect(html).not.toContain('<h2>Category spending chart</h2>');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<h2>Income vs. expenses chart</h2>');
    expect(html).not.toContain('<h2>Transactions</h2>');
  });

  it('uses the rendered chart in the PDF when it is available', () => {
    const html = filteredFinancialHTML(report, 'INR', ['Income vs. expenses chart'], {
      'Income vs. expenses chart': { svg: '<svg viewBox="0 0 100 50"><path d="M0 0L10 10"/></svg>', description: 'Daily totals', legend: [{ label: 'Expenses', color: '#6366f1' }] },
    });
    expect(html).toContain('class="screen-chart"');
    expect(html).toContain('<path d="M0 0L10 10"/>');
    expect(html).toContain('Daily totals');
    expect(html).toContain('Expenses');
  });

  it('includes selected charts from the other tabs and the full captured insights', () => {
    const chart = { svg: '<svg><path d="M0 0"/></svg>', description: 'Displayed chart', legend: [], title: 'Daily spending & spikes' };
    const html = filteredFinancialHTML(report, 'INR', ['Daily spending chart', 'Monthly category comparison', 'Insights'], { 'Daily spending chart': chart }, [{ title: 'Income trend', body: 'Income increased.' }]);
    expect(html).toContain('Daily spending &amp; spikes');
    expect(html).toContain('<h2>Category spending comparison</h2>');
    expect(html).toContain('<h3>Income trend</h3>');
    expect(html).toContain('Income increased.');
  });

  it('places selected charts and tables under their matching report section', () => {
    const chart = { svg: '<svg></svg>', description: '', legend: [], title: 'Daily spending & spikes' };
    const html = filteredFinancialHTML(report, 'INR', ['Filters', 'Daily spending', 'Daily spending chart', 'Accounts'], { 'Daily spending chart': chart }, [], ['Expenses', 'Accounts']);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const groups = [...doc.querySelectorAll('.report-group')];
    expect(groups.map(group => group.querySelector('.group-title')?.textContent)).toEqual(['Expenses', 'Accounts']);
    expect(groups[0].textContent).toContain('Daily spending & spikes');
    expect(groups[0].textContent).toContain('Daily spending');
    expect(groups[1].textContent).toContain('Accounts');
    expect(groups[1].textContent).not.toContain('Daily spending & spikes');
  });

  it('includes selected patterns, transfers, calendar and insights', () => {
    const html = filteredFinancialHTML(report, 'INR', ['Spending calendar', 'Insights', 'Recurring payments', 'Account transfers', 'Savings trend chart'], { 'Savings trend chart': { svg: '<svg></svg>', description: '', legend: [] } });
    for (const title of ['Spending calendar', 'Insights', 'Recurring payments', 'Account transfers', 'Savings trend']) expect(html).toContain(`<h2>${title}</h2>`);
    expect(html).toContain('2026-11-12');
    expect(html).not.toContain('<h2>Summary</h2>');
  });
  it('shares one set of filtered summary and detail tables across formats', () => {
    const tables = filteredFinancialTables(report, 'INR');
    expect(tables.find(table => table.name === 'Transactions')!.rows).toHaveLength(3);
    expect(tables.find(table => table.name === 'Summary')!.rows).toContainEqual(['Total expenses', 20]);
    expect(tables.find(table => table.name === 'Categories')!.rows).toContainEqual(['Food', 20, 100, 2]);
    expect(tables.find(table => table.name === 'Monthly spending')!.rows).toContainEqual(['2026-11', '2026-11-10', '2026-11-16', 0, 20, -20]);
    expect(tables.find(table => table.name === 'Filters')!.rows).toContainEqual(['Payment', 'UPI']);
    const transactions = JSON.stringify(tables.find(table => table.name === 'Transactions'));
    for (const excluded of ['wrong account', 'wrong category', 'wrong payment', 'income', 'previous', 'future', 'transfer']) expect(transactions).not.toContain(`"${excluded}"`);
    expect(tables.some(table => table.rows.some(row => row[0] === 'Budget remaining'))).toBe(false);
  });

  it('escapes CSV formulas and HTML markup while retaining the filtered data', () => {
    const csv = filteredFinancialCSV(report, 'INR');
    expect(csv).toContain('"Total expenses","20"');
    expect(csv).toContain('"\'=SUM(A1) <script> & ""quote"""');
    const html = filteredFinancialHTML(report, 'INR');
    expect(html).toContain('&lt;script&gt; &amp; &quot;quote&quot;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<th>Amount</th>');
    expect(html).not.toContain('wrong payment');
    expect(html).toContain('UPI');
  });

  it('creates an XLSX with linked worksheets, numeric cells, and safe literal text', () => {
    const tables = filteredFinancialTables(report, 'INR');
    const files = unzipStored(createExcelWorkbook(tables));
    expect(files.size).toBe(4 + tables.length);
    expect(files.get('[Content_Types].xml')).toContain('spreadsheetml.sheet.main+xml');
    const transactionSheet = tables.findIndex(table => table.name === 'Transactions') + 1;
    expect(files.get('xl/workbook.xml')).toContain(`name="Transactions" sheetId="${transactionSheet}" r:id="rId${transactionSheet}"`);
    expect(files.get('xl/_rels/workbook.xml.rels')).toContain(`Target="worksheets/sheet${transactionSheet}.xml"`);
    const transactions = files.get(`xl/worksheets/sheet${transactionSheet}.xml`)!;
    expect(transactions).toContain('<c r="G2"><v>25.5</v></c>');
    expect(transactions).toContain('<c r="G3"><v>-5.5</v></c>');
    expect(transactions).toContain('=SUM(A1) &lt;script&gt; &amp; &quot;quote&quot;');
    expect(transactions).not.toContain('<f>');
    for (const content of files.values()) if (content.startsWith('<?xml')) expect(new DOMParser().parseFromString(content, 'application/xml').querySelector('parsererror')).toBeNull();
  });

  it('handles an empty filtered report without unrelated categories or transactions', () => {
    const empty = buildFinancialAnalytics(records, budget, { ...filters, category: 'Missing' })!;
    const tables = filteredFinancialTables(empty, 'INR');
    expect(tables.find(table => table.name === 'Categories')!.rows).toHaveLength(1);
    expect(tables.find(table => table.name === 'Transactions')!.rows).toHaveLength(1);
    expect(tables.find(table => table.name === 'Summary')!.rows).toContainEqual(['Total expenses', 0]);
    expect(filteredFinancialHTML(empty, 'INR')).toContain('No matching records.');
  });
});
