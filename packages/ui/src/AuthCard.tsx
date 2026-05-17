import { useState } from 'react';
import type { FormEvent } from 'react';
import { ScholiumLogo } from './ScholiumLogo';
import './AuthCard.css';

type AuthMode = 'signin' | 'signup' | 'forgot';

export interface AuthCardProps {
  onSignIn: (email: string, password: string) => Promise<string | null | void>;
  onSignUp: (email: string, password: string) => Promise<string | null | void>;
  onForgotPassword: (email: string) => Promise<string | null | void>;
  hint?: string;
}

export function AuthCard({ onSignIn, onSignUp, onForgotPassword, hint }: AuthCardProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setPassword('');
    setConfirm('');
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Please enter your email.'); return; }
      setLoading(true);
      try {
        const result = await onForgotPassword(email.trim());
        if (typeof result === 'string') setError(result);
        else setSuccess('Check your email for a password reset link.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setLoading(true);
      try {
        const result = await onSignUp(email.trim(), password);
        if (typeof result === 'string') setError(result);
        else setSuccess('Account created! Check your email if confirmation is required.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign up failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const result = await onSignIn(email.trim(), password);
      if (typeof result === 'string') setError(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<AuthMode, string> = {
    signin: 'Sign in to your Scholium account',
    signup: 'Create your Scholium account',
    forgot: 'Reset your password',
  };

  const submitLabels: Record<AuthMode, string> = {
    signin: loading ? 'Signing in…' : 'Sign in →',
    signup: loading ? 'Creating account…' : 'Create account →',
    forgot: loading ? 'Sending…' : 'Send reset link →',
  };

  return (
    <div className="rui-auth-page">
      <form className="rui-auth-card" onSubmit={handleSubmit}>
        <div className="rui-auth-logo">
          <ScholiumLogo size="lg" />
        </div>

        <div className="rui-auth-heading">
          <h1 className="rui-auth-title">{titles[mode]}</h1>
          {mode === 'signin' && hint ? (
            <p className="rui-auth-subtitle">{hint}</p>
          ) : null}
          {mode === 'forgot' ? (
            <p className="rui-auth-subtitle">
              Enter your email and we'll send you a link to set a new password.
            </p>
          ) : null}
        </div>

        <label className="rui-auth-label">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />
        </label>

        {mode !== 'forgot' ? (
          <label className="rui-auth-label">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
        ) : null}

        {mode === 'signup' ? (
          <label className="rui-auth-label">
            <span>Confirm Password</span>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
        ) : null}

        {error ? <div className="rui-auth-error">{error}</div> : null}
        {success ? <div className="rui-auth-success">{success}</div> : null}

        <button type="submit" disabled={loading} className="rui-auth-submit">
          {submitLabels[mode]}
        </button>

        <div className="rui-auth-links">
          {mode === 'signin' ? (
            <div className="rui-auth-secondary-row">
              <button type="button" className="rui-auth-secondary-btn" onClick={() => switchMode('signup')}>
                Create Account
              </button>
              <button type="button" className="rui-auth-secondary-btn" onClick={() => switchMode('forgot')}>
                Forgot Password?
              </button>
            </div>
          ) : (
            <button type="button" className="rui-auth-link" onClick={() => switchMode('signin')}>
              ← Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
