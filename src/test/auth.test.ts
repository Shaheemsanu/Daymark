import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../features/auth/authService';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  supabase: null,
}));

describe('Auth Service & Session Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('signs in or falls back gracefully in offline environment', async () => {
    const { user, error } = await authService.signIn('alex@daymark.dev', 'password123');
    expect(error).toBeNull();
    expect(user).toBeDefined();
    expect(user?.email).toBe('alex@daymark.dev');
  });

  it('persists and retrieves current user profile', async () => {
    await authService.signIn('tester@daymark.dev', 'secret');
    const currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeDefined();
    expect(currentUser?.email).toBe('tester@daymark.dev');
  });

  it('clears stored session on sign out', async () => {
    await authService.signIn('tester@daymark.dev', 'secret');
    await authService.signOut();
    const currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeNull();
  });
});
