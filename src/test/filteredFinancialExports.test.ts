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
    expect(files.get('xl/workbook.xml')).toContain('name="Transactions" sheetId="8" r:id="rId8"');
    expect(files.get('xl/_rels/workbook.xml.rels')).toContain('Target="worksheets/sheet8.xml"');
    const transactions = files.get('xl/worksheets/sheet8.xml')!;
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
