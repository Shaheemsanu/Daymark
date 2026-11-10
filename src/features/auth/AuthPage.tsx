import React, { useState } from 'react';
import { authService } from './authService';
import { AppProfile } from '../../lib/types';
import { Lock, Mail, User, ArrowRight, ShieldCheck, LoaderCircle } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: (user: AppProfile) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { user, error } = await authService.signUp(email, password, fullName);
        if (error) {
          setErrorMsg(error.message);
        } else if (user) {
          onAuthSuccess({
            id: user.id,
            email: user.email || email,
            full_name: fullName || email.split('@')[0]
          });
        }
      } else {
        const { user, error } = await authService.signIn(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else if (user) {
          onAuthSuccess({
            id: user.id,
            email: user.email || email,
            full_name: user.email?.split('@')[0] || 'User'
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold text-xl mb-3 shadow-md">
            D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Daymark
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Daily Todo &amp; Habit Tracker with Expense Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isSignUp ? 'Create Daymark Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isSignUp ? 'Start tracking your daily independent habits' : 'Sign in to access your daily dashboard'}
              </p>
            </div>
            {!authService.isConfigured() && (
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Supabase Required
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-950 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <><LoaderCircle className="w-3.5 h-3.5 animate-spin" /><span>Connecting to Supabase...</span></> : <><span>{isSignUp ? 'Create Account' : 'Sign In'}</span><ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>

          {/* Toggle signup/signin */}
          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>
          </div>

        </div>

        {/* Security footer note */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-6">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secured via Supabase Row-Level Security</span>
        </div>
      </div>
    </div>
  );
};
