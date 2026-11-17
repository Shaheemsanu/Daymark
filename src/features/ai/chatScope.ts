export const DATA_SOURCES = { expenses: 'Expenses', habits: 'Habits', tasks: 'Tasks', notes: 'Todo notes', wellness: 'Wellness journal' } as const;
export type DataSource = keyof typeof DATA_SOURCES;
export type ChatSource = DataSource;
export type DataScope = { source: DataSource; start: string; end: string };
export type SourceFact = { label: string; value: string };
export type ContextMeta = DataScope & { recordCount: number; facts?: SourceFact[] };
export function isDataSource(value: unknown): value is DataSource {
  return typeof value === 'string' && Object.hasOwn(DATA_SOURCES, value);
}
export function validScopeDates(start: unknown, end: unknown): boolean {
  const valid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(start) && valid(end) && start <= end && (Date.parse(end) - Date.parse(start)) / 86400000 < 366;
}
