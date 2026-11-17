# Account Spends & Intelligence

The existing expense tab hosts the dashboard in `FinancialAnalyticsDashboard.tsx`.
Its six sections share date, account, category, payment, type, and grouping state. There are
no new database queries or external AI requests. Calculations are memoized from
the workspace transaction and budget props, and update when those props change.
The dashboard is loaded as a separate JavaScript chunk when its tab is opened.

The single filter toolbar offers Today, Yesterday, Last 7 days, Last 30 days,
and Custom range. Rolling ranges include the selected reference day. Both endpoints
of a custom range are included. Reset restores Last 30 days and clears all filters.

Chart grouping lives in a collapsed Chart display settings panel, separate from
the transaction date filters. Auto uses daily points up to 45 days, weekly up to
180 days, monthly up to 730 days, and yearly beyond that. Users can override it.
Grouping never expands the selected dates or changes totals; chart labels use
actual covered dates for partial calendar weeks, months, and years.

## Calculations

`financialAnalytics.ts` is the source for KPIs, charts, tables, and exports.

- Income and expense totals use recorded transaction types and integer cents.
  Negative expenses reduce spending. Duplicate row IDs are counted once.
- Internal transfers, opening balances, balance adjustments, and categories named
  `Credit Card Payment` or `Credit Card Repayment` do not contribute to operating
  totals. Transfers still affect individual account balances.
- Refunds stored as income remain income: the current model has no refund link,
  reversal status, or payment-status field. The dashboard explains this rule.
  It does not infer a repayment from an ordinary Credit Card purchase.
- Net savings is income minus expenses. Savings rate and expense ratio require
  positive income. Percentage changes require a nonzero comparison base;
  undefined comparisons show N/A. Savings-rate changes use percentage points.
- Daily averages include every selected calendar day. Date-only ISO values are
  maintained without converting transaction dates to another timezone.
- The comparison is the immediately preceding period with the same day count.
- Real balances are scoped by account and end date, not by category or transaction
  type. The cash-flow waterfall includes Other movements to reconcile filtered
  operating totals with actual opening and closing balances.
- The report's Categories section displays only categories with recorded expenses,
  their actual amounts, counts, and percentages of total selected spending. No
  assumed targets, budget remaining, utilization warnings, or prorated budget
  comparisons are displayed. Existing budget settings are not changed. The
  calculation utility retains budget fields for compatibility, but the dashboard
  and PDF summary do not present them as user-provided targets.

## Estimates

Month-end spending extends the selected month's observed daily pace only when
the selection includes the beginning of an unfinished month. It is explicitly
an estimate and does not predict scheduled bills.

Recurring detection groups descriptions and categories, checks similar amounts
and regular positive date intervals, and preserves explicitly marked recurring
entries. A monthly estimate is unavailable without interval evidence. Same-date,
same-description, same-amount records are flagged as possible duplicates, never
automatically removed or confirmed as duplicate subscriptions.

Unusual transactions exceed three times the median positive expense, with at
least five positive expenses required. Potential savings calculations are labeled
scenarios rather than promises.

## Exports and accessibility

An essential spending summary sits above the shared filters. It shows Today,
Last 7 days, and Last 30 days, each ending on the report reference date, across
all accounts and categories. These fixed snapshots remain independent of the
detailed filters. Each shows net spending, expense count, daily average,
positive-purchase average and extrema, highest/lowest net spending days, and
zero-net-spending day counts. Daily statistics include zero-spend calendar days;
ties use the earliest date. With no expense records, daily extrema and purchase
statistics show N/A. Transfers, adjustments, income, and future entries are excluded.

Snapshot cards emphasize totals, daily averages, and largest purchases. A shared
More details button expands the remaining metrics across all three cards. Empty
purchase/day metrics display a dash. Mini activity charts use one bar per day and
independent scales per card; amber denotes negative net spending. Accessible chart
labels include each day's exact amount. Calculation notes are available in a
disclosure below the cards.

Snapshots also compare net spending with the preceding non-overlapping 1, 7, or
30 days. Absolute changes always display, while percentage changes require a
positive previous net total. Cards identify the largest positive net category
and show averages per positive purchase and per purchase day. Expanded details
include gross purchases, reversals, purchase counts/days, medians, and full net
category/account/payment breakdowns. These breakdowns reconcile to net spending;
shares require a positive net total and may exceed 100% or be negative following
reversals. Per purchase day uses positive purchase totals rather than net spending.

The Categories section ranks actual spending and shows transaction counts, purchase
days, daily net averages, and positive-purchase averages, minimums, maximums, and
medians. Purchase statistics exclude zero and negative entries; totals, shares,
and account/payment breakdowns include reversals. Previous-period comparisons use
the same filters over the preceding equal-length date range. A zero comparison
base has no percentage change. The distribution switches to signed bars if a
category has negative net spending. Trend lines show the five largest positive
categories. The largest current net-spending category has a featured card;
remaining categories appear as compact sortable rows. Clicking either opens a
native modal dialog containing the full statistics, previous-period comparison,
account/payment breakdowns, and transactions, without leaving the report. The
dialog supports Escape and a close button, traps keyboard focus, restores focus
on close, and locks background scrolling. Records render in batches of 50, with
Show more transactions retaining access to the complete category history in the
selected range. No category budgets or
targets are inferred.

The category comparison chart shows only categories with a nonzero net amount in
the selected or previous period, including negative reversals. Categories with
zero in both periods remain hidden until they have a value. Selecting a specific
category still narrows the comparison to that category.
Comparisons grow to fit every category without an internal scrollbar or skipped
labels. The plot spans the neighboring donut's legend space, extending down toward
the data disclosure instead of leaving a blank area below it. No budget caps are
inferred from the category list.

The export selector offers PDF, Excel (.xlsx), and CSV for the current shared
filters. All three use `filteredFinancialTables` from `financialExports.ts`:
filter metadata, summary metrics, daily spending, chart periods, partial monthly
totals, categories, accounts, and matching transactions. Current-only category
rows exclude categories seen only in comparison periods. Fixed spending snapshots
above the filters are excluded from these downloads. Balance figures retain the
documented historical-account scope.

CSV contains labeled sections, escaped cells, and spreadsheet formula protection.
Excel uses a native XLSX workbook with eight worksheets, numeric amount cells,
literal text cells, and frozen header rows. `excelWorkbook.ts` packages worksheet
XML into an uncompressed ZIP locally, without a network service or dependency.
PDF uses the browser's Print / Save as PDF dialog and includes the same filtered
detail tables, with repeated column headers on printed pages. No remote document
service receives financial information.

Charts have text legends and expandable data tables. Category legends support
keyboard activation. Calendar days are informational, with hover details and
focusable accessible labels; clicking a date never changes sections. The six internal section tabs support arrow,
Home, and End keys. Category transaction details are available in a view dialog;
the Expenses section shows charts without a standalone transaction table.
Chart rendering samples long time series for performance; aggregate report totals
and CSV exports retain the complete selected data.
