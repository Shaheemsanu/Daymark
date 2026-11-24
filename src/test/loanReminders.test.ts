import { describe, expect, it } from 'vitest';
import { loanRemindersForDate, type ReminderLoan } from '../../supabase/functions/_shared/loanReminders';

const lent: ReminderLoan = { id: 'a', person: 'Asha', record_kind: 'lent', amount: 500, repaid: 100, lent_date: '2026-11-01', due_date: '2026-11-25', end_date: null, payment_day: null };
const emi: ReminderLoan = { ...lent, id: 'b', person: 'Bank', record_kind: 'emi', due_date: null, payment_day: 31, end_date: '2028-03-31' };

describe('loan reminders', () => {
  it('reminds before and on the due date for lent and borrowed money', () => {
    const borrowed: ReminderLoan = { ...lent, id: 'c', record_kind: 'borrowed' };
    expect(loanRemindersForDate([lent, borrowed], '2026-11-24').map(r => r.body)).toEqual(['Money from Asha is expected tomorrow.', 'Payment to Asha is due tomorrow.']);
    expect(loanRemindersForDate([lent, borrowed], '2026-11-25').map(r => r.body)).toEqual(['Money from Asha is expected today.', 'Payment to Asha is due today.']);
    expect(loanRemindersForDate([lent], '2026-11-26')).toEqual([]);
  });
  it('clamps monthly payment days and honors the start and end dates', () => {
    expect(loanRemindersForDate([emi], '2028-02-28')[0]?.body).toContain('tomorrow');
    expect(loanRemindersForDate([emi], '2028-02-29')[0]?.body).toContain('today');
    expect(loanRemindersForDate([emi], '2028-04-29')).toEqual([]);
    expect(loanRemindersForDate([{ ...emi, lent_date: '2028-03-01' }], '2028-02-28')).toEqual([]);
  });
  it('skips settled records and loans without a due date or payment day', () => {
    expect(loanRemindersForDate([{ ...lent, repaid: 500 }, { ...lent, due_date: null }, { ...emi, payment_day: null }], '2026-11-24')).toEqual([]);
  });
  it('uses separate deduplication keys for each due date and notification phase', () => {
    const before = loanRemindersForDate([lent], '2026-11-24')[0];
    const due = loanRemindersForDate([lent], '2026-11-25')[0];
    expect(before.kind).not.toBe(due.kind);
    expect(before.date).toBe('2026-11-24');
    expect(due.date).toBe('2026-11-25');
  });
});
