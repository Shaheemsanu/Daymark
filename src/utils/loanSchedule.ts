/** Next scheduled calendar date, not evidence that earlier installments were paid. */
export function nextMonthlyPaymentDate(paymentDay: number, startDate: string, asOfDate: string, endDate?: string | null): string | null {
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return null;
  const threshold = startDate > asOfDate ? startDate : asOfDate;
  let year = Number(threshold.slice(0, 4)), month = Number(threshold.slice(5, 7));
  if (month < 1 || month > 12) return null;
  const dateInMonth = () => {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(paymentDay, lastDay)).padStart(2, '0')}`;
  };
  let next = dateInMonth();
  if (next < threshold) {
    month++;
    if (month === 13) { month = 1; year++; }
    next = dateInMonth();
  }
  return endDate && next > endDate ? null : next;
}

/** Count scheduled dates within the loan period, including both boundary dates. */
export function countMonthlyPayments(startDate: string, endDate: string, paymentDay: number): number {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return 0;
  const first = nextMonthlyPaymentDate(paymentDay, startDate, startDate, endDate);
  if (!first) return 0;
  const lastMonth = `${endDate.slice(0, 7)}-01`;
  const last = nextMonthlyPaymentDate(paymentDay, lastMonth, lastMonth);
  if (!last) return 0;
  const months = (Number(endDate.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(endDate.slice(5, 7)) - Number(first.slice(5, 7)) + 1;
  return Math.max(0, months - (last > endDate ? 1 : 0));
}

export type PaymentCycle = 'daily' | 'weekly' | 'monthly' | 'custom';
export type Schedule = { lent_date: string; end_date: string | null; payment_day: number | null; payment_cycle?: PaymentCycle | null; payment_interval_days?: number | null; first_payment_date?: string | null };
export function nextPaymentDate(item: Schedule, asOf: string): string | null {
  if ((item.payment_cycle || 'monthly') === 'monthly') return item.payment_day ? nextMonthlyPaymentDate(item.payment_day, item.lent_date, asOf, item.end_date) : null;
  const interval = item.payment_cycle === 'daily' ? 1 : item.payment_cycle === 'weekly' ? 7 : item.payment_interval_days;
  const start = Date.parse((item.first_payment_date || item.lent_date) + 'T00:00:00Z'), target = Date.parse(asOf + 'T00:00:00Z');
  if (!interval || !Number.isInteger(interval) || interval < 1 || !Number.isFinite(start) || !Number.isFinite(target)) return null;
  const result = new Date(start + Math.max(0, Math.ceil((target - start) / 86400000 / interval)) * interval * 86400000).toISOString().slice(0, 10);
  return item.end_date && result > item.end_date ? null : result;
}
export function countPayments(item: Schedule, end: string): number {
  if (end < item.lent_date) return 0;
  if ((item.payment_cycle || 'monthly') === 'monthly') return countMonthlyPayments(item.lent_date, end, item.payment_day || Number(item.lent_date.slice(8, 10)));
  const interval = item.payment_cycle === 'daily' ? 1 : item.payment_cycle === 'weekly' ? 7 : item.payment_interval_days;
  const days = (Date.parse(end + 'T00:00:00Z') - Date.parse((item.first_payment_date || item.lent_date) + 'T00:00:00Z')) / 86400000;
  return interval && interval > 0 && Number.isFinite(days) ? Math.max(0, Math.floor(days / interval) + 1) : 0;
}
