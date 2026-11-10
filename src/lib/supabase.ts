import { createClient, SupabaseClient } from '@supabase/supabase-js';

const sanitizeSupabaseUrl = (url: string | undefined): string => {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  // If a PostgreSQL URI is provided (e.g. postgresql://db.xxx.supabase.co:5432/postgres), extract the project ref to construct the HTTPS REST API URL
  if (cleaned.startsWith('postgresql://') || cleaned.startsWith('postgres://')) {
    const match = cleaned.match(/@?db\.([a-z0-9]+)\.supabase\.co/);
    if (match && match[1]) {
      return `https://${match[1]}.supabase.co`;
    }
  }
  return cleaned;
};

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.length > 0 &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
    !supabaseUrl.includes('your-project') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 0 &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
