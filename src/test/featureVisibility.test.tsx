import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Layout } from '../app/Layout';

afterEach(cleanup);

describe('administrator-managed feature visibility', () => {
  it('keeps the mobile AI view within the visible area when the keyboard opens', () => {
    const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const originalWidth = window.innerWidth;
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { container } = render(<Layout currentView="ai" onSelectView={vi.fn()} user={null} onSignOut={vi.fn()} isDarkMode={false} onToggleDarkMode={vi.fn()} onRefreshData={vi.fn()} isRefreshingData={false} isSyncing={false}><textarea aria-label="Message Daymark AI" /></Layout>);
    fireEvent.focusIn(screen.getByLabelText('Message Daymark AI'));
    act(() => { viewport.height = 480; viewport.offsetTop = 12; viewport.dispatchEvent(new Event('resize')); });
    expect(container.firstElementChild).toHaveStyle({ height: '480px', top: '12px', position: 'fixed' });
    expect(screen.getByText('Overview').closest('nav')).toHaveClass('hidden');
    fireEvent.focusOut(screen.getByLabelText('Message Daymark AI'));
    expect(container.firstElementChild).not.toHaveStyle({ position: 'fixed' });
    if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
    else Reflect.deleteProperty(window, 'visualViewport');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });
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
