import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import App from './App.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { apiRequest } from './lib/api.js';
import './auth-recovery.css';

function BrandHeader() {
  return (
    <div className="brand-block auth-brand">
      <span className="brand-mark">P</span>
      <div>
        <strong>Pioneer</strong>
        <span>Administration</span>
      </div>
    </div>
  );
}

function RecoveryLoginPage() {
  const { login, error: connectionError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <BrandHeader />

        <div className="auth-heading">
          <p className="eyebrow">Pioneer Legacy Works</p>
          <h1>Admin sign in</h1>
          <p>Use your Pioneer platform account to continue.</p>
        </div>

        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <div className="auth-password-label-row">
          <label className="field-label" htmlFor="password">Password</label>
          <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {(error || connectionError) && <p className="form-error">{error || connectionError}</p>}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await apiRequest('/api/auth/password/reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setAccepted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request a password reset.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <BrandHeader />

        <div className="auth-heading">
          <p className="eyebrow">Account recovery</p>
          <h1>Forgot your password?</h1>
          <p>Enter your admin email address and Pioneer will send a one-time reset link.</p>
        </div>

        {accepted ? (
          <>
            <p className="form-success auth-message">
              If an active Pioneer account exists for that address, a reset link has been sent. The link expires in 30 minutes.
            </p>
            <Link className="secondary-button auth-button-link" to="/">Return to sign in</Link>
          </>
        ) : (
          <>
            <label className="field-label" htmlFor="recovery-email">Email</label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            {error && <p className="form-error">{error}</p>}

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <Link className="auth-link auth-link-centered" to="/">Back to sign in</Link>
          </>
        )}
      </form>
    </div>
  );
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its security token. Request a new password reset email.');
      return;
    }
    if (newPassword.length < 12) {
      setError('Your new password must be at least 12 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setNewPassword('');
      setConfirmPassword('');
      setComplete(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset the password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <BrandHeader />

        <div className="auth-heading">
          <p className="eyebrow">Account recovery</p>
          <h1>Set a new password</h1>
          <p>Choose a new password for your Pioneer administrator account.</p>
        </div>

        {complete ? (
          <>
            <p className="form-success auth-message">
              Your password has been reset. Existing admin sessions were signed out for security.
            </p>
            <Link className="primary-button auth-button-link" to="/">Sign in with new password</Link>
          </>
        ) : (
          <>
            {!token && (
              <p className="form-error auth-message">
                This reset link is incomplete. Request a new reset email below.
              </p>
            )}

            <label className="field-label" htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={!token}
            />
            <small className="auth-requirement">Use at least 12 characters.</small>

            <label className="field-label" htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={!token}
            />

            {error && <p className="form-error">{error}</p>}

            <button className="primary-button" type="submit" disabled={submitting || !token}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
            <div className="auth-recovery-footer">
              <Link className="auth-link" to="/forgot-password">Request a new link</Link>
              <Link className="auth-link" to="/">Back to sign in</Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default function AuthRecoveryRoot() {
  const { status } = useAuth();
  const location = useLocation();

  if (location.pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (location.pathname === '/reset-password') return <ResetPasswordPage />;
  if (status === 'anonymous') return <RecoveryLoginPage />;

  return <App />;
}
