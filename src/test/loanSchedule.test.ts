import { describe, expect, it } from 'vitest';
import { countMonthlyPayments, nextMonthlyPaymentDate } from '../utils/loanSchedule';

describe('monthly payment schedule', () => {
  it('uses today or the loan start date as the earliest scheduled date', () => {
    expect(nextMonthlyPaymentDate(15, '2026-01-01', '2026-11-15')).toBe('2026-11-15');
    expect(nextMonthlyPaymentDate(15, '2026-01-01', '2026-11-24')).toBe('2026-12-15');
    expect(nextMonthlyPaymentDate(15, '2027-01-20', '2026-11-24')).toBe('2027-02-15');
  });
  it('uses the last day of shorter months and respects the loan end', () => {
    expect(nextMonthlyPaymentDate(31, '2026-01-01', '2026-02-01')).toBe('2026-02-28');
    expect(nextMonthlyPaymentDate(31, '2028-01-01', '2028-02-01')).toBe('2028-02-29');
    expect(nextMonthlyPaymentDate(15, '2026-01-01', '2026-11-24', '2026-12-01')).toBeNull();
  });
  it('counts actual scheduled days within inclusive boundaries', () => {
    expect(countMonthlyPayments('2026-11-24', '2027-11-24', 15)).toBe(12);
    expect(countMonthlyPayments('2026-11-24', '2027-11-24', 24)).toBe(13);
    expect(countMonthlyPayments('2028-01-31', '2028-03-30', 31)).toBe(2);
    expect(countMonthlyPayments('2026-01-20', '2026-02-10', 15)).toBe(0);
    expect(countMonthlyPayments('2026-02-30', '2026-03-31', 15)).toBe(0);
  });
});
