import { DailyTask } from '../types';

export function orderTasks(tasks: DailyTask[], taskOrder: string[] = []): DailyTask[] {
  const ranks = new Map(taskOrder.map((id, index) => [id, index]));
  return [...tasks].sort((a, b) => {
    const rank = (ranks.get(a.id) ?? -1) - (ranks.get(b.id) ?? -1);
    if (rank !== 0) return rank;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.createdAt && b.createdAt) {
      const createdOrder = b.createdAt.localeCompare(a.createdAt);
      if (createdOrder !== 0) return createdOrder;
    }
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder !== 0) return dateOrder;
    return 0;
  });
}

export function moveTaskInOrder(orderedTasks: DailyTask[], visibleTasks: DailyTask[], id: string, direction: -1 | 1): string[] {
  const index = visibleTasks.findIndex(task => task.id === id);
  const neighbor = index >= 0 ? visibleTasks[index + direction] : undefined;
  const ids = orderedTasks.map(task => task.id);
  if (!neighbor) return ids;
  const currentIndex = ids.indexOf(id), neighborIndex = ids.indexOf(neighbor.id);
  if (currentIndex < 0 || neighborIndex < 0) return ids;
  [ids[currentIndex], ids[neighborIndex]] = [ids[neighborIndex], ids[currentIndex]];
  return ids;
}
