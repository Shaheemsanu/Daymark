import { Habit } from '../types';

export function orderHabits(habits: Habit[], habitOrder: string[] = []): Habit[] {
  const ranks = new Map(habitOrder.map((id, index) => [id, index]));
  return [...habits].sort((a, b) =>
    (ranks.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}
