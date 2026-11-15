import { WellnessGoals } from '../types';

export function normalizeWellnessGoals(value?: Partial<WellnessGoals> | null): WellnessGoals {
  return {
    waterMl: typeof value?.waterMl === 'number' && Number.isFinite(value.waterMl) && value.waterMl > 0 && value.waterMl <= 5000 ? value.waterMl : 2000,
    sleepHours: typeof value?.sleepHours === 'number' && Number.isFinite(value.sleepHours) && value.sleepHours > 0 && value.sleepHours <= 16 ? value.sleepHours : 8,
  };
}
