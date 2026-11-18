import { Habit } from '../types';

export function orderHabits(habits: Habit[], habitOrder: string[] = []): Habit[] {
  const ranks = new Map(habitOrder.map((id, index) => [id, index]));
  return [...habits].sort((a, b) => {
    const rank = (ranks.get(a.id) ?? -1) - (ranks.get(b.id) ?? -1);
    if (rank !== 0) return rank;
    if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return 0;
  });
}
