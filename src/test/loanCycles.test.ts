import { describe, expect, it } from 'vitest';
import { countPayments, nextPaymentDate, type Schedule } from '../utils/loanSchedule';
import { loanRemindersForDate, type ReminderLoan } from '../../supabase/functions/_shared/loanReminders';

const base: Schedule = { lent_date: '2026-11-26', end_date: '2026-12-31', payment_day: null };
describe('installment cycles', () => {
  it.each([
    ['daily', null, '2026-11-28', 5],
    ['weekly', null, '2026-12-03', 1],
    ['custom', 3, '2026-11-29', 2],
  ] as const)('calculates %s dates and counts from the start date', (payment_cycle, payment_interval_days, next, count) => {
    const schedule = { ...base, payment_cycle, payment_interval_days };
    expect(nextPaymentDate(schedule, '2026-11-28')).toBe(next);
    expect(countPayments(schedule, '2026-11-30')).toBe(count);
    expect(nextPaymentDate(schedule, '2027-01-01')).toBeNull();
  });
  it('uses the selected first date for weekly and custom schedules', () => {
    const weekly: Schedule = { ...base, payment_cycle: 'weekly', first_payment_date: '2026-11-30' };
    const custom: Schedule = { ...base, payment_cycle: 'custom', payment_interval_days: 3, first_payment_date: '2026-11-28' };
    expect(nextPaymentDate(weekly, '2026-11-26')).toBe('2026-11-30');
    expect(countPayments(weekly, '2026-12-07')).toBe(2);
    expect(nextPaymentDate(custom, '2026-11-29')).toBe('2026-12-01');
    expect(countPayments(custom, '2026-11-27')).toBe(0);
    const loan: ReminderLoan = { ...weekly, id: '2', person: 'Bank', record_kind: 'emi', amount: 100, repaid: 0, due_date: null };
    expect(loanRemindersForDate([loan], '2026-11-29')[0]?.body).toContain('tomorrow');
    expect(loanRemindersForDate([loan], '2026-11-26')).toEqual([]);
  });
  it('continues to clamp monthly dates', () => {
    expect(nextPaymentDate({ ...base, lent_date: '2028-01-01', end_date: null, payment_day: 31 }, '2028-02-01')).toBe('2028-02-29');
  });
  it('sends reminders on custom schedule dates', () => {
    const loan: ReminderLoan = { ...base, id: '1', person: 'Bank', record_kind: 'emi', amount: 100, repaid: 0, due_date: null, payment_cycle: 'custom', payment_interval_days: 3 };
    expect(loanRemindersForDate([loan], '2026-11-28').map(r => r.body)).toEqual(['An installment for Bank is scheduled tomorrow.']);
    expect(loanRemindersForDate([loan], '2026-11-29').map(r => r.body)).toEqual(['An installment for Bank is scheduled today.']);
  });
});
