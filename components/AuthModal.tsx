import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';
import Logo from './Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup' | 'verify-email';
}

type AuthMode = 'signin' | 'signup' | 'verify-email' | 'reset-password';

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin'
}) => {
  const {
    currentUser,
    isFirebaseConfigured,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendVerificationEmail,
    reloadUser,
    sendPasswordReset,
    logout
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync mode when modal opens or user auth state changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setInfoMessage(null);
      if (currentUser && !currentUser.emailVerified) {
        setMode('verify-email');
      } else {
        setMode(initialMode);
      }
    }
  }, [isOpen, initialMode, currentUser]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-detect email verification when candidate returns to this tab or window
  useEffect(() => {
    if (!isOpen || mode !== 'verify-email') return;

    let isMounted = true;

    const checkVerificationSilently = async () => {
      if (!isMounted) return;
      try {
        const isVerified = await reloadUser();
        if (isVerified && isMounted) {
          setInfoMessage('Email verified successfully! Entering practice...');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 800);
        }
      } catch (err) {
        // Silently ignore background polling errors
      }
    };

    const handleFocus = () => {
      checkVerificationSilently();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVerificationSilently();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also periodic poll every 3.5 seconds while verification screen is open
    const pollInterval = setInterval(checkVerificationSilently, 3500);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [isOpen, mode, reloadUser, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[Auth Error]', err);
      setError(formatAuthError(err.code || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const cred = await signInWithEmail(email, password);
      // Require email verification for password sign-ins
      if (cred.user && !cred.user.emailVerified) {
        setMode('verify-email');
        setInfoMessage('Please verify your email address before continuing.');
      } else {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('[Auth Error]', err);
      setError(formatAuthError(err.code || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      // Immediately switch to verification screen
      setMode('verify-email');
      setResendCooldown(60);
      setInfoMessage(`A verification link was sent to ${email.trim()}.`);
    } catch (err: any) {
      console.error('[Auth Error]', err);
      setError(formatAuthError(err.code || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const isVerified = await reloadUser();
      if (isVerified) {
        setInfoMessage('Email verified successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 800);
      } else {
        setError('Email is not verified yet. Please click the link in the email sent to you.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check verification status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await sendVerificationEmail();
      setResendCooldown(60);
      setInfoMessage('Verification email resent! Please check your inbox and spam folder.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      setInfoMessage(`Password reset link sent to ${email}.`);
    } catch (err: any) {
      setError(formatAuthError(err.code || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    setMode('signin');
    setError(null);
    setInfoMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#0a0c10] border border-white/10 rounded-3xl p-8 shadow-2xl shadow-blue-950/40 z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-500 hover:text-white p-1 rounded-full transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size="sm" />
          <h2 className="text-xl font-black text-white tracking-tight mt-3">
            {mode === 'signin' && 'Sign in to ClutchAI'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'verify-email' && 'Verify your email'}
            {mode === 'reset-password' && 'Reset your password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'signin' && 'Practice under realistic pressure & sync your history.'}
            {mode === 'signup' && 'Get started with AI-driven interview simulation.'}
            {mode === 'verify-email' && 'Email confirmation required before entering simulation.'}
            {mode === 'reset-password' && "Enter your email and we'll send a recovery link."}
          </p>
        </div>

        {/* Missing Firebase Config Notice */}
        {!isFirebaseConfigured && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-2">
            <div className="font-bold flex items-center">
              <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse" />
              Firebase Config Required
            </div>
            <p className="text-slate-300">
              Set <code className="text-amber-200">VITE_FIREBASE_API_KEY</code> and <code className="text-amber-200">VITE_FIREBASE_PROJECT_ID</code> in <code className="text-amber-200">.env.local</code> to activate live login.
            </p>
          </div>
        )}

        {/* Alert Banners */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start space-x-2">
            <svg className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-start space-x-2">
            <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="leading-tight">{infoMessage}</span>
          </div>
        )}

        {/* VIEW 1 & 2: SIGN IN / SIGN UP */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="space-y-4">
            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || !isFirebaseConfigured}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#0a0c10] px-3 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                or
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>

            {/* Email Form */}
            <form onSubmit={mode === 'signin' ? handleEmailSignIn : handleEmailSignUp} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setMode('reset-password'); setError(null); }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !isFirebaseConfigured}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                {isSubmitting
                  ? 'Processing...'
                  : mode === 'signin'
                  ? 'Sign In with Email'
                  : 'Create Account & Verify Email'}
              </button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <div className="text-center pt-2 text-xs text-slate-400">
              {mode === 'signin' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(null); }}
                    className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('signin'); setError(null); }}
                    className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: EMAIL VERIFICATION REQUIRED */}
        {mode === 'verify-email' && (
          <div className="space-y-5 text-center">
            <div className="relative w-16 h-16 mx-auto rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="absolute top-0 right-0 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Verification link sent to:
              </p>
              <p className="text-sm font-bold text-blue-300 font-mono break-all px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 inline-block max-w-full">
                {currentUser?.email || email}
              </p>
            </div>

            {/* Steps box */}
            <div className="text-left bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-start space-x-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Open your inbox (check spam/junk if not received in 60s).</span>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Click the verification link from Firebase / ClutchAI.</span>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Return here — this tab unlocks automatically once verified.</span>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>Checking verification in real time...</span>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleCheckVerification}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 disabled:opacity-40"
              >
                {isSubmitting ? 'Checking...' : "I've Verified My Email (Continue)"}
              </button>

              <button
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-xs font-semibold transition-all disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend Verification Email'}
              </button>

              <button
                onClick={handleSwitchAccount}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors pt-2 block mx-auto"
              >
                Sign in with another account
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: RESET PASSWORD */}
        {mode === 'reset-password' && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? 'Sending...' : 'Send Recovery Link'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

function formatAuthError(codeOrMsg: string): string {
  if (codeOrMsg.includes('auth/invalid-credential') || codeOrMsg.includes('auth/wrong-password') || codeOrMsg.includes('auth/user-not-found')) {
    return 'Invalid email or password.';
  }
  if (codeOrMsg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists.';
  }
  if (codeOrMsg.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (codeOrMsg.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (codeOrMsg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was cancelled.';
  }
  if (codeOrMsg.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please try again later.';
  }
  return codeOrMsg || 'An error occurred during authentication.';
}

export default AuthModal;
