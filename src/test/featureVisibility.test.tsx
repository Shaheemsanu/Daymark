import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Layout } from '../app/Layout';

afterEach(cleanup);

describe('administrator-managed feature visibility', () => {
  it('hides disabled features from desktop and mobile navigation', () => {
    render(<Layout currentView="daily" onSelectView={vi.fn()} user={null} onSignOut={vi.fn()} isDarkMode={false} onToggleDarkMode={vi.fn()} onRefreshData={vi.fn()} isRefreshingData={false} isSyncing={false} featureVisibility={{ habits: false, tasks: true, notes: false, analytics: false, ai: false }}><div /></Layout>);
    expect(screen.queryByText('Habit Tracker')).toBeNull();
    expect(screen.queryByText('Habits')).toBeNull();
    expect(screen.queryByText('Todo Notes')).toBeNull();
    expect(screen.queryByText('Analytics')).toBeNull();
    expect(screen.queryByLabelText('Daymark AI')).toBeNull();
    expect(screen.getByText('Daily Tasks')).toBeTruthy();
    expect(screen.getByText('Tasks')).toBeTruthy();
  });
});
