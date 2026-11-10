import {
  format,
  parseISO,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday as dateFnsIsToday,
  getDay,
  isValid,
  subWeeks,
  subMonths,
  subYears,
  startOfYear,
  endOfYear
} from 'date-fns';

export const DATE_FORMAT = 'yyyy-MM-dd';

export function getTodayIso(): string {
  return format(new Date(), DATE_FORMAT);
}

export function formatDateIso(date: Date): string {
  return format(date, DATE_FORMAT);
}

export function parseDateIso(isoString: string): Date {
  const parsed = parseISO(isoString);
  return isValid(parsed) ? parsed : new Date();
}

export function formatHeaderDate(isoString: string): string {
  const date = parseDateIso(isoString);
  return format(date, 'EEEE, MMM d, yyyy');
}

export function formatShortDate(isoString: string): string {
  const date = parseDateIso(isoString);
  return format(date, 'MMM d');
}

export function isDateToday(isoString: string): boolean {
  const date = parseDateIso(isoString);
  return dateFnsIsToday(date);
}

export function getWeekdayIndex(isoString: string): number {
  const date = parseDateIso(isoString);
  return getDay(date); // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

export function getSurroundingDays(isoString: string, count = 7): Array<{
  iso: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isCurrent: boolean;
}> {
  const center = parseDateIso(isoString);
  const half = Math.floor(count / 2);
  const result = [];

  for (let i = -half; i <= half; i++) {
    const d = addDays(center, i);
    const iso = formatDateIso(d);
    result.push({
      iso,
      dayName: format(d, 'EEE'),
      dayNumber: d.getDate(),
      isToday: isDateToday(iso),
      isCurrent: iso === isoString
    });
  }

  return result;
}

export function getDaysInInterval(startIso: string, endIso: string): string[] {
  const start = parseDateIso(startIso);
  const end = parseDateIso(endIso);
  if (start > end) return [startIso];
  const days = eachDayOfInterval({ start, end });
  return days.map(d => formatDateIso(d));
}

export function getPastNDays(n = 30): string[] {
  const today = new Date();
  const past = subDays(today, n - 1);
  return eachDayOfInterval({ start: past, end: today }).map(d => formatDateIso(d));
}

export function getDaysForCurrentMonth(): string[] {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return eachDayOfInterval({ start, end }).map(d => formatDateIso(d));
}

export function getDaysForCurrentWeek(): string[] {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(d => formatDateIso(d));
}

export function calculateStreak(completedDates: string[]): number {
  if (!completedDates || completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const today = new Date();
  const todayIso = formatDateIso(today);
  const yesterdayIso = formatDateIso(subDays(today, 1));

  let currentCheck = set.has(todayIso) ? today : set.has(yesterdayIso) ? subDays(today, 1) : null;
  if (!currentCheck) return 0;

  let streak = 0;
  while (set.has(formatDateIso(currentCheck))) {
    streak++;
    currentCheck = subDays(currentCheck, 1);
  }
  return streak;
}

export interface PeriodInterval {
  key: string;
  label: string;
  subLabel?: string;
  startDate: string;
  endDate: string;
  days: string[];
}

export function getPastNWeeks(numWeeks = 8): PeriodInterval[] {
  const now = new Date();
  const intervals: PeriodInterval[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const targetDate = subWeeks(now, i);
    const start = startOfWeek(targetDate, { weekStartsOn: 1 });
    const end = endOfWeek(targetDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end }).map(d => formatDateIso(d));
    const label = `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
    const shortLabel = `W${format(start, 'w')}`;
    intervals.push({
      key: `week-${formatDateIso(start)}`,
      label: i === 0 ? 'This Week' : shortLabel,
      subLabel: label,
      startDate: formatDateIso(start),
      endDate: formatDateIso(end),
      days
    });
  }

  return intervals;
}

export function getPastNMonths(numMonths = 6): PeriodInterval[] {
  const now = new Date();
  const intervals: PeriodInterval[] = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const targetDate = subMonths(now, i);
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);
    const days = eachDayOfInterval({ start, end }).map(d => formatDateIso(d));
    const label = format(start, 'MMM yyyy');
    intervals.push({
      key: `month-${formatDateIso(start)}`,
      label: format(start, 'MMM'),
      subLabel: label,
      startDate: formatDateIso(start),
      endDate: formatDateIso(end),
      days
    });
  }

  return intervals;
}

export function getPastNYears(numYears = 3): PeriodInterval[] {
  const now = new Date();
  const intervals: PeriodInterval[] = [];

  for (let i = numYears - 1; i >= 0; i--) {
    const targetDate = subYears(now, i);
    const start = startOfYear(targetDate);
    const end = endOfYear(targetDate);
    const days = eachDayOfInterval({ start, end }).map(d => formatDateIso(d));
    const label = format(start, 'yyyy');
    intervals.push({
      key: `year-${formatDateIso(start)}`,
      label,
      subLabel: label,
      startDate: formatDateIso(start),
      endDate: formatDateIso(end),
      days
    });
  }

  return intervals;
}
