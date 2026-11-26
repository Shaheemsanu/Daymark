import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, afterAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import FinancialAnalyticsDashboard from '../components/FinancialAnalyticsDashboard';
import { ExpenseDashboard } from '../components/ExpenseDashboard';
import { BudgetConfig, Expense } from '../types';
import { downloadFilteredReport, printFinancialSummary } from '../utils/financialExports';

vi.mock('../components/FinancialCharts', () => ({ financePanel: 'panel', FinancialChart: ({ title, onSelect, footerContent, headerAction }: { title: string; onSelect?: (category: string) => void; footerContent?: React.ReactNode; headerAction?: React.ReactNode }) => <section aria-label={title}><h4>{title}</h4>{headerAction}{onSelect && <button onClick={() => onSelect('Food')}>Select Food category</button>}{footerContent}</section> }));
vi.mock('../utils/financialExports', () => ({ downloadFilteredReport: vi.fn(), printFinancialSummary: vi.fn(() => true) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterAll(() => {
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});
const budget: BudgetConfig = { monthlyBudget: 3000, weeklyBudget: 700, dailyBudget: 100, currency: 'INR', categoryBudgets: { Food: 300 } };
const expenses: Expense[] = [
  { id: 'i', date: '2026-11-01', amount: 1000, type: 'income', title: 'Salary', category: 'Salary', account: 'expense', paymentMethod: 'Bank', createdAt: 1 },
  { id: 'a', date: '2026-11-05', amount: 60, title: 'Lunch', category: 'Food', account: 'cash', paymentMethod: 'Cash', createdAt: 1 },
  { id: 'b', date: '2026-11-16', amount: 40, title: 'Taxi', category: 'Transport', account: 'expense', paymentMethod: 'Card', createdAt: 1 },
];
const kpi = (name: string) => screen.getByText(name, { exact: true }).closest('article')!;

it('shows Today, This week, and This month summaries above filters', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  const summary = screen.getByRole('region', { name: 'Essential spending summary' });
  const filters = screen.getByRole('region', { name: 'Shared report filters' });
  expect(summary.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(summary).getAllByRole('heading', { level: 4 }).map(heading => heading.textContent)).toEqual(['Today', 'This week', 'This month']);
  const today = within(summary).getByRole('article', { name: 'Today spending' });
  expect(within(today).getByText('INR 40.00', { selector: 'article > p' })).toBeInTheDocument();
  expect(within(today).getByText('Largest purchase')).toBeInTheDocument();
  const moreDetails = within(summary).getByRole('button', { name: 'More details' });
  expect(moreDetails).toHaveAttribute('aria-expanded', 'false');
  expect(within(today).getByText('Smallest purchase')).not.toBeVisible();
  fireEvent.click(moreDetails);
  expect(moreDetails).toHaveAttribute('aria-expanded', 'true');
  expect(within(today).getByText('Smallest purchase')).toBeVisible();
  expect(within(today).getByText('Top spending category')).toBeVisible();
  expect(within(today).getByText('Per purchase day')).toBeVisible();
  expect(within(today).getByText('Purchases before reversals')).toBeVisible();
  expect(within(today).getByRole('region', { name: 'Today by category' })).toHaveTextContent('Transport');
  expect(within(today).getByRole('region', { name: 'Today by account' })).toHaveTextContent('Expense Account');
  expect(within(today).getByRole('region', { name: 'Today by payment method' })).toHaveTextContent('Card');
  fireEvent.click(moreDetails);
  expect(within(today).getByText('Smallest purchase')).not.toBeVisible();
  expect(within(summary).getAllByRole('img')).toHaveLength(3);
  const month = within(summary).getByRole('article', { name: 'This month spending' });
  expect(within(month).getByText('INR 100.00', { selector: 'article > p' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Analytics account'), { target: { value: 'cash' } });
  fireEvent.change(screen.getByLabelText('Analytics period'), { target: { value: 'yesterday' } });
  expect(within(today).getByText('INR 40.00', { selector: 'article > p' })).toBeInTheDocument();
  expect(within(kpi('Total expenses')).getByText('INR 0.00')).toBeInTheDocument();
});

it('mounts only the shared filter toolbar in Account Spends & Intelligence', async () => {
  render(<ExpenseDashboard expenses={expenses} budget={budget} initialDate="2026-11-16"
    onAddExpense={vi.fn()} onUpdateExpense={vi.fn()} onDeleteExpense={vi.fn()}
    onUpdateBudget={vi.fn()} onExportCSV={vi.fn()} customCategories={{}} onSaveCustomCategories={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Account Spends & Intelligence/ }));
  await screen.findByRole('region', { name: 'Shared report filters' });
  expect(screen.getAllByLabelText('Analytics period')).toHaveLength(1);
  expect(screen.getAllByLabelText('Analytics account')).toHaveLength(1);
  expect(screen.queryByText('Account Filter:')).toBeNull();
  expect(screen.queryByText('Timeframe:')).toBeNull();
  expect(screen.queryByLabelText('Report period')).toBeNull();
});

it.each([
  [{ cash: false, savings: false }, ['Expense Account']],
  [{ cash: true, savings: false }, ['Expense Account', 'Cash in Hand']],
  [{ cash: false, savings: true }, ['Expense Account', 'Savings Account']],
])('opens the report for enabled accounts: %o', async (visibility, labels) => {
  render(<ExpenseDashboard expenses={expenses} budget={budget} initialDate="2026-11-16" accountVisibility={visibility}
    onAddExpense={vi.fn()} onUpdateExpense={vi.fn()} onDeleteExpense={vi.fn()}
    onUpdateBudget={vi.fn()} onExportCSV={vi.fn()} customCategories={{}} onSaveCustomCategories={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Account Spends & Intelligence/ }));
  const filter = await screen.findByLabelText('Analytics account');
  expect(within(filter).getAllByRole('option').map(option => option.textContent)).toEqual(['All enabled accounts', ...labels]);
  expect(within(kpi('Total expenses')).getByText(visibility.cash ? 'INR 100.00' : 'INR 40.00')).toBeInTheDocument();
});

it('shares global filters across KPIs, sections, and exports', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  expect(within(kpi('Total expenses')).getByText('INR 100.00')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Analytics account'), { target: { value: 'cash' } });
  expect(within(kpi('Total expenses')).getByText('INR 60.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Expenses' }));
  expect(screen.queryByRole('region', { name: 'Matching transactions' })).toBeNull();
  expect(screen.queryByText('Taxi')).toBeNull();
  fireEvent.change(screen.getByLabelText('Report export format'), { target: { value: 'csv' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getByRole('button', { name: 'Export selected' })).toBeDisabled();
  expect(screen.getAllByRole('checkbox')).toHaveLength(6);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Overview' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Expenses' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export selected' }));
  expect(vi.mocked(downloadFilteredReport).mock.calls[0][0].total.expenses).toBe(60);
  expect(vi.mocked(downloadFilteredReport).mock.calls[0][0].filters.account).toBe('cash');
  expect(vi.mocked(downloadFilteredReport).mock.calls[0][3]).toEqual(expect.arrayContaining(['Filters', 'Summary', 'Transactions']));
  expect(vi.mocked(downloadFilteredReport).mock.calls[0][3]).not.toContain('Accounts');
  expect(within(screen.getByLabelText('Report export format')).getAllByRole('option').map(option => option.textContent)).toEqual(['PDF report (print)', 'Excel (.xlsx)', 'CSV (.csv)']);
  fireEvent.change(screen.getByLabelText('Report export format'), { target: { value: 'xlsx' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export selected' }));
  expect(vi.mocked(downloadFilteredReport).mock.calls[1][0].current.map(row => row.id)).toEqual(['a']);
  expect(vi.mocked(downloadFilteredReport).mock.calls[1][3]).toEqual(expect.arrayContaining(['Summary', 'Transactions']));
  fireEvent.change(screen.getByLabelText('Report export format'), { target: { value: 'pdf' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export selected' }));
  expect(vi.mocked(printFinancialSummary).mock.calls[0][0].current.map(row => row.id)).toEqual(['a']);
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(within(kpi('Total expenses')).getByText('INR 100.00')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Analytics payment'), { target: { value: 'Card' } });
  expect(within(kpi('Total expenses')).getByText('INR 40.00')).toBeInTheDocument();
});

it('has one shared date selector with exactly the requested ranges', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  const period = screen.getByLabelText('Analytics period');
  expect(within(period).getAllByRole('option').map(option => option.textContent)).toEqual(['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Custom range']);
  expect(screen.getAllByRole('region', { name: 'Shared report filters' })).toHaveLength(1);
  fireEvent.change(period, { target: { value: 'today' } });
  expect(within(kpi('Total expenses')).getByText('INR 40.00')).toBeInTheDocument();
  fireEvent.change(period, { target: { value: 'yesterday' } });
  expect(within(kpi('Total expenses')).getByText('INR 0.00')).toBeInTheDocument();
  expect(screen.getByText('15-11-2026')).toBeInTheDocument();
  expect(screen.getByText(/1 day · 0 transactions/)).toBeInTheDocument();
  fireEvent.change(period, { target: { value: '7days' } });
  expect(within(kpi('Total expenses')).getByText('INR 40.00')).toBeInTheDocument();
  fireEvent.change(period, { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('Analytics start date'), { target: { value: '2026-11-05' } });
  fireEvent.change(screen.getByLabelText('Analytics end date'), { target: { value: '2026-11-05' } });
  expect(within(kpi('Total expenses')).getByText('INR 60.00')).toBeInTheDocument();
});

it('uses the shared date filter without a chart grouping selector', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  expect(within(kpi('Total expenses')).getByText('INR 100.00')).toBeInTheDocument();
  expect(screen.queryByLabelText(/date grouping/)).not.toBeInTheDocument();
  expect(within(kpi('Total expenses')).getByText('INR 100.00')).toBeInTheDocument();
  expect(screen.getByText('18-10-2026 – 16-11-2026')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Analytics period'), { target: { value: 'today' } });
  expect(within(screen.getByRole('region', { name: 'Shared report filters' })).getByText('16-11-2026')).toBeInTheDocument();
  expect(within(kpi('Total expenses')).getByText('INR 40.00')).toBeInTheDocument();
});

it('supports category filtering and keeps calendar clicks in Patterns', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Expenses' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select Food category' }));
  expect(screen.getByLabelText('Analytics category')).toHaveValue('Food');
  expect(screen.getByLabelText('Analytics transaction type')).toHaveValue('expense');
  expect(within(kpi('Total expenses')).getByText('INR 60.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Patterns' }));
  fireEvent.click(screen.getByRole('button', { name: /16-11-2026:/ }));
  expect(screen.getByRole('status')).toHaveTextContent('INR 40.00');
  expect(screen.getByRole('status')).toHaveTextContent('16-11-2026');
  expect(screen.getByRole('tab', { name: 'Patterns' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'false');
  expect(screen.getByRole('heading', { name: 'Spending calendar' })).toBeInTheDocument();
});

it('refreshes from changed transaction props and shows actual category spending without budgets', () => {
  const { rerender } = render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" loading />);
  expect(screen.getByRole('status', { name: 'Loading financial analytics' })).toBeInTheDocument();
  rerender(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  expect(within(kpi('Total expenses')).getByText('INR 100.00')).toBeInTheDocument();
  rerender(<FinancialAnalyticsDashboard expenses={expenses.slice(0, 2)} budget={{ ...budget, monthlyBudget: 0, categoryBudgets: {} }} referenceDate="2026-11-16" />);
  expect(within(kpi('Total expenses')).getByText('INR 60.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Categories' }));
  const categories = within(screen.getByRole('region', { name: 'Actual category spending' }));
  expect(categories.getByRole('heading', { name: 'Food' })).toBeInTheDocument();
  expect(categories.getByText('100.0% of spending')).toBeInTheDocument();
  expect(categories.getByText('INR 60.00', { selector: 'article > p' })).toBeInTheDocument();
  expect(screen.queryByText('Budget remaining')).toBeNull();
});

it('shows only recorded category amounts and shares even when default budget caps exist', () => {
  const entries: Expense[] = [
    { ...expenses[1], id: 'g', category: 'Groceries', amount: 100 },
    { ...expenses[1], id: 'u', category: 'Utilities', amount: 130 },
    { ...expenses[1], id: 'f', category: 'Food & Dining', amount: 10 },
  ];
  const configuredBudget = { ...budget, categoryBudgets: { Groceries: 5000, Utilities: 2500, Housing: 10000 } };
  render(<FinancialAnalyticsDashboard expenses={entries} budget={configuredBudget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Categories' }));
  const categories = within(screen.getByRole('region', { name: 'Actual category spending' }));
  expect(within(categories.getByRole('button', { name: 'View Groceries details' })).getByText('INR 100.00')).toBeInTheDocument();
  expect(categories.getByText('41.7% of spending')).toBeInTheDocument();
  expect(categories.getByText('54.2% of spending')).toBeInTheDocument();
  expect(categories.getByText('4.2% of spending')).toBeInTheDocument();
  expect(categories.queryByText('Housing')).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Budgets' })).toBeNull();
  expect(screen.queryByText('Budget vs. actual')).toBeNull();
  expect(screen.queryByText('Budget remaining')).toBeNull();
  expect(screen.queryByText(/Normal ·/)).toBeNull();
  expect(configuredBudget.categoryBudgets.Housing).toBe(10000);
});

it('supports keyboard section navigation without the standalone Transactions table', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('region', { name: 'Matching transactions' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Transactions' })).toBeNull();
  expect(screen.queryByLabelText('Search report transactions')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Category spending comparison' })).toBeInTheDocument();
});

it('shows monthly category amounts and empty periods in the spending comparison', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Expenses' }));
  const comparison = screen.getByRole('region', { name: 'Category spending comparison' });
  expect(within(comparison).getByText('No spending recorded in this period.')).toBeInTheDocument();
  expect(within(comparison).getByText('Food')).toBeInTheDocument();
  expect(within(comparison).getByText('Transport')).toBeInTheDocument();
  expect(within(comparison).getByText('INR 60.00')).toBeInTheDocument();
  expect(within(comparison).getByText('INR 100.00')).toBeInTheDocument();
});

it('features the highest spending category and opens compact categories in a dialog', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses.map(row => row.id === 'a' ? { ...row, amount: 20 } : row)} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Categories' }));
  const region = screen.getByRole('region', { name: 'Actual category spending' });
  expect(within(region).getAllByRole('article')[0]).toHaveTextContent('Transport');
  expect(within(region).getByRole('heading', { name: 'Category spending changes' })).toBeInTheDocument();
  expect(within(region).getByRole('heading', { name: 'Category spending over time' })).toBeInTheDocument();
  expect(within(region).queryByText('Lunch')).toBeNull();
  const foodButton = within(region).getByRole('button', { name: 'View Food details' });
  foodButton.focus();
  fireEvent.click(foodButton);
  const dialog = screen.getByRole('dialog', { name: 'Food' });
  expect(within(dialog).getByRole('table', { name: 'Food transactions' })).toHaveTextContent('Lunch');
  expect(within(dialog).getByRole('heading', { name: 'By account' })).toBeInTheDocument();
  expect(within(dialog).getByText('Expense reversals')).toBeInTheDocument();
  expect(within(dialog).getByText('Median purchase')).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close category details' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('');
  expect(foodButton).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.change(screen.getByLabelText('Sort category spending'), { target: { value: 'name' } });
  expect(within(region).getAllByRole('article')[0]).toHaveTextContent('Transport');
  fireEvent.click(within(region).getByRole('button', { name: 'View Transport details' }));
  const topDialog = screen.getByRole('dialog', { name: 'Transport' });
  expect(within(topDialog).getByRole('table', { name: 'Transport transactions' })).toHaveTextContent('Taxi');
  fireEvent(topDialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByLabelText('Analytics category')).toHaveValue('all');
});

it('keeps every category transaction accessible in the dialog and closes it when filters change', () => {
  const records = Array.from({ length: 51 }, (_, index) => ({ ...expenses[1], id: `food-${index}`, title: `Purchase ${index}`, amount: index + 1 }));
  render(<FinancialAnalyticsDashboard expenses={records} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Categories' }));
  fireEvent.click(screen.getByRole('button', { name: 'View Food details' }));
  const dialog = screen.getByRole('dialog', { name: 'Food' });
  expect(within(dialog).getByText('Showing 50 of 51')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Show more transactions' }));
  expect(within(dialog).getByText('Showing 51 of 51')).toBeInTheDocument();
  expect(within(dialog).getAllByRole('row')).toHaveLength(52);
  expect(within(dialog).queryByRole('button', { name: 'Show more transactions' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Analytics account'), { target: { value: 'expense' } });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('');
});

it('shows the highest spending day insight for the current filters', () => {
  render(<FinancialAnalyticsDashboard expenses={expenses} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Insights' }));
  const insight = () => screen.getByRole('heading', { name: 'Highest spending day' }).closest('article')!;
  expect(insight()).toHaveTextContent('INR 60.00 on 05-11-2026');
  expect(insight()).toHaveTextContent('60.0% of spending');
  fireEvent.change(screen.getByLabelText('Analytics account'), { target: { value: 'expense' } });
  expect(insight()).toHaveTextContent('INR 40.00 on 16-11-2026');
  expect(insight()).toHaveTextContent('100.0% of spending');
  fireEvent.change(screen.getByLabelText('Analytics transaction type'), { target: { value: 'income' } });
  expect(screen.queryByRole('heading', { name: 'Highest spending day' })).toBeNull();
});

it('fills the ranking chart footer with filtered category totals using the same positive-category shares as the donut', () => {
  const refund: Expense = { ...expenses[1], id: 'refund', category: 'Reversed category', amount: -20 };
  render(<FinancialAnalyticsDashboard expenses={[...expenses, refund]} budget={budget} referenceDate="2026-11-16" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Expenses' }));
  const summary = () => within(screen.getByRole('region', { name: 'Category ranking summary' }));
  expect(summary().getByRole('row', { name: /Food/ })).toHaveTextContent('INR 60.00');
  expect(summary().getByRole('row', { name: /Food/ })).toHaveTextContent('60.0%');
  expect(summary().getByText(/INR 100.00 · 100.0%/)).toBeInTheDocument();
  expect(summary().queryByText('Reversed category')).toBeNull();
  fireEvent.change(screen.getByLabelText('Analytics account'), { target: { value: 'expense' } });
  expect(summary().queryByText('Food')).toBeNull();
  expect(summary().getByRole('row', { name: /Transport/ })).toHaveTextContent('INR 40.00');
  expect(summary().getByRole('row', { name: /Transport/ })).toHaveTextContent('100.0%');
});
