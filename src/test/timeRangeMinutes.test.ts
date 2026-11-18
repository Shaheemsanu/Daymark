import { expect, it } from 'vitest';
import { timeRangeMinutes } from '../utils/habitTime';

it('calculates same-day durations and rejects invalid ranges', () => {
  expect(timeRangeMinutes('09:00', '10:30')).toBe(90);
  expect(timeRangeMinutes('11:45', '12:15')).toBe(30);
  expect(timeRangeMinutes('09:00', '09:00')).toBeNull();
  expect(timeRangeMinutes('21:00', '08:00')).toBeNull();
  expect(timeRangeMinutes('25:00', '26:00')).toBeNull();
  expect(timeRangeMinutes('', '10:00')).toBeNull();
});
