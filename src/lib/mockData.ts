import {
  Task,
  TaskEntry,
  CustomTracker,
  TrackerEntry,
  DailyNote,
  Expense,
  BudgetConfig,
  AppProfile
} from './types';
import { getTodayIso, formatDateIso, parseDateIso } from './dateUtils';
import { subDays } from 'date-fns';

export function getMockInitialData(userId = 'demo-user-1') {
  const today = new Date();
  const todayIso = getTodayIso();

  const getOffsetDate = (offset: number) => formatDateIso(subDays(today, offset));

  const mockProfile: AppProfile = {
    id: userId,
    email: 'user@daymark.dev',
    full_name: 'Alex Mercer',
    avatar_url: ''
  };

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      user_id: userId,
      title: 'Morning 20-min Meditation & Breathwork',
      description: 'Headspace mindfulness session before screen time',
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6], // Daily
      priority: 'high',
      time_estimate_min: 20,
      category: 'Mindfulness'
    },
    {
      id: 'task-2',
      user_id: userId,
      title: 'Deep Work: Core Engineering Block',
      description: 'Focused sprint without interruptions',
      is_active: true,
      weekdays: [1, 2, 3, 4, 5], // Mon-Fri
      priority: 'high',
      time_estimate_min: 60,
      category: 'Productivity'
    },
    {
      id: 'task-3',
      user_id: userId,
      title: 'Review Financial Run Rate & Ledger',
      description: 'Verify bank transactions and expense budgets',
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      priority: 'medium',
      time_estimate_min: 15,
      category: 'Finance'
    },
    {
      id: 'task-4',
      user_id: userId,
      title: '5km Outdoor Jog / Strength Training',
      description: 'Cardiovascular endurance session',
      is_active: true,
      weekdays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
      priority: 'high',
      time_estimate_min: 45,
      category: 'Fitness'
    },
    {
      id: 'task-5',
      user_id: userId,
      title: 'Read 25 Pages of Non-Fiction',
      description: 'High-leverage engineering or architecture book',
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      priority: 'low',
      time_estimate_min: 30,
      category: 'Learning'
    }
  ];

  // Generate independent task entries for the last 14 days
  const mockTaskEntries: TaskEntry[] = [];
  for (let offset = 0; offset <= 14; offset++) {
    const dateStr = getOffsetDate(offset);
    mockTasks.forEach((task, index) => {
      // Determine pseudo-completion for realistic historical charts
      let status: 'complete' | 'pending' | 'skipped' = 'complete';
      if (offset === 0) {
        status = index < 2 ? 'complete' : 'pending';
      } else if (offset === 1) {
        status = index === 3 ? 'skipped' : 'complete';
      } else if (offset % 4 === 0 && index === 4) {
        status = 'skipped';
      } else if (offset % 5 === 0 && index === 1) {
        status = 'pending';
      }

      mockTaskEntries.push({
        id: `entry-${task.id}-${dateStr}`,
        user_id: userId,
        task_id: task.id,
        entry_date: dateStr,
        status,
        completed_at: status === 'complete' ? new Date().toISOString() : null
      });
    });
  }

  const mockTrackers: CustomTracker[] = [
    {
      id: 'trk-1',
      user_id: userId,
      name: 'Water Intake',
      type: 'numeric',
      unit: 'ml',
      target_value: 2000,
      color: '#06B6D4',
      icon: 'droplet'
    },
    {
      id: 'trk-2',
      user_id: userId,
      name: 'Sleep Duration',
      type: 'numeric',
      unit: 'hours',
      target_value: 8.0,
      color: '#6366F1',
      icon: 'moon'
    },
    {
      id: 'trk-3',
      user_id: userId,
      name: 'No Refined Sugar',
      type: 'boolean',
      target_value: 1,
      color: '#10B981',
      icon: 'shield-check'
    },
    {
      id: 'trk-4',
      user_id: userId,
      name: 'Reading Target',
      type: 'numeric',
      unit: 'pages',
      target_value: 20,
      color: '#8B5CF6',
      icon: 'book-open'
    }
  ];

  const mockTrackerEntries: TrackerEntry[] = [];
  for (let offset = 0; offset <= 14; offset++) {
    const dateStr = getOffsetDate(offset);
    mockTrackerEntries.push(
      {
        id: `trke-1-${dateStr}`,
        user_id: userId,
        tracker_id: 'trk-1',
        entry_date: dateStr,
        numeric_value: offset === 0 ? 1750 : 2000 + (offset % 3) * 250
      },
      {
        id: `trke-2-${dateStr}`,
        user_id: userId,
        tracker_id: 'trk-2',
        entry_date: dateStr,
        numeric_value: 7.0 + (offset % 3) * 0.5
      },
      {
        id: `trke-3-${dateStr}`,
        user_id: userId,
        tracker_id: 'trk-3',
        entry_date: dateStr,
        boolean_value: offset % 4 !== 0
      },
      {
        id: `trke-4-${dateStr}`,
        user_id: userId,
        tracker_id: 'trk-4',
        entry_date: dateStr,
        numeric_value: offset === 0 ? 15 : 22 + (offset % 5)
      }
    );
  }

  const mockNotes: DailyNote[] = [
    {
      id: `note-${todayIso}`,
      user_id: userId,
      entry_date: todayIso,
      content: 'Strong morning velocity. Prioritized high-leverage backlog items and maintained budget discipline.',
      mood: 'great',
      gratitude: 'Clear headspace, quality coffee, and progress on core architecture.',
      sleep_hours: 7.8,
      water_ml: 1750,
      energy_score: 4
    },
    {
      id: `note-${getOffsetDate(1)}`,
      user_id: userId,
      entry_date: getOffsetDate(1),
      content: 'Solid day of cross-team alignment. Completed marathon training run in afternoon.',
      mood: 'good',
      gratitude: 'Autumn sunshine during the long outdoor run.',
      sleep_hours: 8.0,
      water_ml: 2250,
      energy_score: 4
    },
    {
      id: `note-${getOffsetDate(2)}`,
      user_id: userId,
      entry_date: getOffsetDate(2),
      content: 'Relaxing evening with friends. Balanced work output with social recharge.',
      mood: 'neutral',
      gratitude: 'Good Italian meal and fruitful brainstorming.',
      sleep_hours: 6.8,
      water_ml: 1750,
      energy_score: 3
    }
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      user_id: userId,
      entry_date: getOffsetDate(0),
      title: 'Apartment Monthly Lease',
      amount: 1150.00,
      category: 'Housing',
      spend_type: 'need',
      payment_method: 'Bank Transfer',
      notes: 'Monthly fixed rent payment',
      is_recurring: true
    },
    {
      id: 'exp-2',
      user_id: userId,
      entry_date: getOffsetDate(0),
      title: 'Whole Foods Market Groceries',
      amount: 86.40,
      category: 'Groceries',
      spend_type: 'need',
      payment_method: 'Credit Card',
      notes: 'Weekly pantry, vegetables, and protein'
    },
    {
      id: 'exp-3',
      user_id: userId,
      entry_date: getOffsetDate(0),
      title: 'Artisan Cafe Espresso',
      amount: 6.50,
      category: 'Food & Dining',
      spend_type: 'want',
      payment_method: 'Digital Wallet',
      notes: 'Morning coffee work session'
    },
    {
      id: 'exp-4',
      user_id: userId,
      entry_date: getOffsetDate(1),
      title: 'Fiber Internet Utility Bill',
      amount: 65.00,
      category: 'Utilities',
      spend_type: 'need',
      payment_method: 'Debit Card',
      notes: 'High-speed internet cycle',
      is_recurring: true
    },
    {
      id: 'exp-5',
      user_id: userId,
      entry_date: getOffsetDate(2),
      title: 'Metro Transit Card Pass',
      amount: 78.00,
      category: 'Transportation',
      spend_type: 'need',
      payment_method: 'Digital Wallet',
      notes: 'Monthly commuter card'
    },
    {
      id: 'exp-6',
      user_id: userId,
      entry_date: getOffsetDate(3),
      title: 'Bistro Dinner Outing',
      amount: 48.50,
      category: 'Food & Dining',
      spend_type: 'want',
      payment_method: 'Credit Card',
      notes: 'Dinner with colleagues'
    },
    {
      id: 'exp-7',
      user_id: userId,
      entry_date: getOffsetDate(5),
      title: 'Vitamins & Health Supplements',
      amount: 32.00,
      category: 'Health & Fitness',
      spend_type: 'need',
      payment_method: 'Debit Card',
      notes: 'Vitamin D3 & Electrolytes'
    },
    {
      id: 'exp-8',
      user_id: userId,
      entry_date: getOffsetDate(6),
      title: 'Spotify Premium Family',
      amount: 16.99,
      category: 'Subscriptions',
      spend_type: 'want',
      payment_method: 'Credit Card',
      is_recurring: true
    },
    {
      id: 'exp-9',
      user_id: userId,
      entry_date: getOffsetDate(8),
      title: 'Running Shoes Upgrade',
      amount: 120.00,
      category: 'Shopping',
      spend_type: 'want',
      payment_method: 'Credit Card',
      notes: 'Trail running gear'
    },
    {
      id: 'exp-10',
      user_id: userId,
      entry_date: getOffsetDate(10),
      title: 'City Power & Electric',
      amount: 84.50,
      category: 'Utilities',
      spend_type: 'need',
      payment_method: 'Bank Transfer',
      notes: 'Monthly heating & power'
    }
  ];

  const mockBudget: BudgetConfig = {
    user_id: userId,
    monthly_budget: 3200.00,
    currency: '$',
    category_budgets: {
      Housing: 1200,
      Groceries: 450,
      'Food & Dining': 300,
      Transportation: 200,
      Utilities: 220,
      'Health & Fitness': 140,
      Entertainment: 180,
      Shopping: 200,
      Subscriptions: 60,
      'Personal Care': 80,
      Education: 100,
      Other: 70
    }
  };

  return {
    profile: mockProfile,
    tasks: mockTasks,
    taskEntries: mockTaskEntries,
    trackers: mockTrackers,
    trackerEntries: mockTrackerEntries,
    notes: mockNotes,
    expenses: mockExpenses,
    budget: mockBudget
  };
}
