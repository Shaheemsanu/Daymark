export function formatHabitTime(start?: string | null, end?: string | null): string {
  if (!start || !end) return '';
  const format = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, hours, minutes));
  };
  return `${format(start)} – ${format(end)}`;
}

export function timeRangeMinutes(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
  const duration = endHour * 60 + endMinute - startHour * 60 - startMinute;
  return duration > 0 ? duration : null;
}

export function formatDuration(minutes: number): string {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
}
