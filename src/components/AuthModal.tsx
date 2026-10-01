import React, { useState, useEffect } from 'react';
import { useAuth, AuthModalTab } from '../context/AuthContext.tsx';
import { motion } from 'motion/react';
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Compass,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalTab,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    activateDemoMode,
    errorDetails,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthModalTab>(authModalTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sync tab with context
  useEffect(() => {
    setActiveTab(authModalTab);
    setLocalError(null);
    setSuccessNotice(null);
  }, [authModalTab, authModalOpen]);

  if (!authModalOpen) return null;

  const validateForm = (): boolean => {
    setLocalError(null);
    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return false;
    }

    if (activeTab === 'forgot_password') {
      return true;
    }

    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return false;
    }

    if (activeTab === 'register') {
      if (!displayName.trim()) {
        setLocalError('Please enter your full name.');
        return false;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please re-enter.');
        return false;
      }
    }

    return true;
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setLocalError(null);
    setSuccessNotice(null);
    try {
      const res = await signInWithGoogle();
      if (!res.success && res.error) {
        setLocalError(res.error);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in encountered an issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setLocalError(null);
    setSuccessNotice(null);

    try {
      if (activeTab === 'signin') {
        const res = await signInWithEmail(email, password);
        if (!res.success && res.error) {
          setLocalError(res.error);
        }
      } else if (activeTab === 'register') {
        const res = await registerWithEmail(email, password, displayName);
        if (res.success) {
          setSuccessNotice('Account successfully created! Welcome to FamilyGraph.');
        } else if (res.error) {
          setLocalError(res.error);
        }
      } else if (activeTab === 'forgot_password') {
        const res = await sendPasswordReset(email);
        if (res.success) {
          setSuccessNotice(
            `Password reset link sent to ${email}. Please check your email inbox and spam folder.`
          );
        } else if (res.error) {
          setLocalError(res.error);
        }
      }
    } catch (err: any) {
      setLocalError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoMode = () => {
    activateDemoMode('alice');
    closeAuthModal();
  };

  const displayError = localError || errorDetails?.message;
  const isConsoleNotice = errorDetails?.isFirebaseConsoleNotice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg bg-[#0C1017] border-2 border-[#C5A059]/60 shadow-[0_0_50px_rgba(197,160,89,0.2)] overflow-hidden my-8"
      >
        {/* Top Gold Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#9E782F] via-[#F5DE98] to-[#9E782F]" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#C5A059]/30 bg-[#090D13] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#C5A059] bg-[#121924] flex items-center justify-center text-[#F5DE98] rotate-45 shadow-sm">
              <span className="font-display text-sm font-black -rotate-45">❖</span>
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-[0.25em] text-[#C5A059] uppercase">
                ACCOUNT ACCESS
              </div>
              <h2 className="text-lg font-deco font-bold text-[#F5DE98] tracking-wider leading-none mt-0.5">
                {activeTab === 'signin' && 'Sign In to Your Account'}
                {activeTab === 'register' && 'Create Your Account'}
                {activeTab === 'forgot_password' && 'Reset Your Password'}
              </h2>
            </div>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-1.5 text-[#8C8275] hover:text-[#F5DE98] hover:bg-[#151D2A] border border-transparent hover:border-[#C5A059]/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs (Sign In / Register) */}
        {activeTab !== 'forgot_password' && (
          <div className="grid grid-cols-2 border-b border-[#C5A059]/25 bg-[#080B10]">
            <button
              id="tab-auth-signin"
              onClick={() => {
                setActiveTab('signin');
                setLocalError(null);
                setSuccessNotice(null);
              }}
              className={`py-3 text-xs font-deco font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 border-b-2 ${
                activeTab === 'signin'
                  ? 'border-[#C5A059] text-[#F5DE98] bg-[#101622]/80'
                  : 'border-transparent text-[#8C8275] hover:text-[#E8DFD0] hover:bg-[#0D121A]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              id="tab-auth-register"
              onClick={() => {
                setActiveTab('register');
                setLocalError(null);
                setSuccessNotice(null);
              }}
              className={`py-3 text-xs font-deco font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 border-b-2 ${
                activeTab === 'register'
                  ? 'border-[#C5A059] text-[#F5DE98] bg-[#101622]/80'
                  : 'border-transparent text-[#8C8275] hover:text-[#E8DFD0] hover:bg-[#0D121A]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Quick Notice */}
          <div className="px-3.5 py-2.5 bg-[#090D13] border border-[#C5A059]/30 text-[11px] font-reading text-[#D4C8B8] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#F5DE98] font-deco tracking-wide">Single Account Access:</strong> Sign in with Google or your email. Once registered, your family trees and records are safely saved and accessible anytime without creating another account.
            </div>
          </div>

          {/* Google Sign-In Button */}
          {activeTab !== 'forgot_password' && (
            <div className="space-y-3">
              <button
                type="button"
                id="btn-google-auth"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#141B26] hover:bg-[#1A2433] text-[#EDE7DF] border border-[#C5A059]/50 hover:border-[#C5A059] transition-all font-deco font-semibold text-xs tracking-wider group shadow-sm disabled:opacity-50"
              >
                {/* Google Multi-Color SVG Icon */}
                <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>
                  {activeTab === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
                </span>
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#C5A059]/20" />
                </div>
                <div className="relative px-3 bg-[#0C1017] text-[10px] font-mono tracking-widest text-[#8C8275] uppercase">
                  or continue with email
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {displayError && (
            <div className="p-3.5 bg-[#2B1113] border border-[#E05252]/60 text-[#FFA8A8] text-xs font-reading space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#E05252] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{displayError}</p>
                </div>
              </div>

              {/* Special Guide when Firebase Email/Password provider is disabled in Firebase Console */}
              {isConsoleNotice && (
                <div className="mt-2 pt-2 border-t border-[#E05252]/30 text-[11px] text-[#EDE7DF] space-y-1.5">
                  <div className="font-deco font-bold text-[#F5DE98] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>How to enable Email/Password in Firebase:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[#C5BBAE] font-reading pl-1">
                    <li>Open Firebase Console: <a href="https://console.firebase.google.com/project/crafty-text-n9brs/authentication/providers" target="_blank" rel="noopener noreferrer" className="text-[#F5DE98] underline font-mono">Authentication &gt; Sign-in method</a></li>
                    <li>Under &ldquo;Sign-in providers&rdquo;, click <strong className="text-white">Email/Password</strong></li>
                    <li>Turn ON the <strong className="text-white">Enable</strong> toggle and click <strong className="text-white">Save</strong></li>
                  </ol>
                  <p className="text-[10px] text-[#A89F91] italic pt-1">
                    Note: Google Sign-In is already active above and works right away!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Success Banner */}
          {successNotice && (
            <div className="p-3.5 bg-[#0B221B] border border-[#52B395]/60 text-[#A2E6D1] text-xs font-reading flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#52B395] shrink-0 mt-0.5" />
              <div>{successNotice}</div>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name field (Register Tab Only) */}
            {activeTab === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-widest text-[#C5A059] uppercase flex items-center justify-between">
                  <span>Full Name</span>
                  <span className="text-[#8C8275]">Required</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-[#8C8275]" />
                  <input
                    type="text"
                    id="input-auth-name"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Anurag Singh"
                    className="w-full bg-[#080B10] border border-[#C5A059]/40 focus:border-[#F5DE98] text-[#EDE7DF] pl-9 pr-3 py-2 text-xs font-sans focus:outline-none placeholder:text-[#5A6472]"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-widest text-[#C5A059] uppercase flex items-center justify-between">
                <span>Email Address</span>
                <span className="text-[#8C8275]">Required</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#8C8275]" />
                <input
                  type="email"
                  id="input-auth-email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#080B10] border border-[#C5A059]/40 focus:border-[#F5DE98] text-[#EDE7DF] pl-9 pr-3 py-2 text-xs font-sans focus:outline-none placeholder:text-[#5A6472]"
                />
              </div>
            </div>

            {/* Password Field (For Sign In and Register) */}
            {activeTab !== 'forgot_password' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono tracking-widest text-[#C5A059] uppercase">
                    Password
                  </label>
                  {activeTab === 'signin' && (
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => {
                        setActiveTab('forgot_password');
                        setLocalError(null);
                        setSuccessNotice(null);
                      }}
                      className="text-[10px] font-mono text-[#C5A059] hover:text-[#F5DE98] underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#8C8275]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="input-auth-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    minLength={6}
                    className="w-full bg-[#080B10] border border-[#C5A059]/40 focus:border-[#F5DE98] text-[#EDE7DF] pl-9 pr-10 py-2 text-xs font-sans focus:outline-none placeholder:text-[#5A6472]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#8C8275] hover:text-[#EDE7DF]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {activeTab === 'register' && (
                  <p className="text-[9px] text-[#8C8275] font-mono">
                    Must be at least 6 characters.
                  </p>
                )}
              </div>
            )}

            {/* Confirm Password Field (Register Only) */}
            {activeTab === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-widest text-[#C5A059] uppercase">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#8C8275]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="input-auth-confirm-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    minLength={6}
                    className="w-full bg-[#080B10] border border-[#C5A059]/40 focus:border-[#F5DE98] text-[#EDE7DF] pl-9 pr-3 py-2 text-xs font-sans focus:outline-none placeholder:text-[#5A6472]"
                  />
                </div>
              </div>
            )}

            {/* Remember Me Option (Sign In Only) */}
            {activeTab === 'signin' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#C5A059]/40 bg-[#080B10] text-[#C5A059] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <label htmlFor="chk-remember-me" className="text-xs text-[#A89F91] cursor-pointer select-none">
                  Keep me signed in on this device
                </label>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="btn-auth-submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#C5A059] via-[#E2BA6E] to-[#9E782F] hover:from-[#F5DE98] hover:to-[#C5A059] text-[#07090D] font-deco font-bold text-xs tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)] active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#07090D] border-t-transparent animate-spin rounded-full" />
                    <span>PLEASE WAIT...</span>
                  </div>
                ) : activeTab === 'signin' ? (
                  <>
                    <LogIn className="w-4 h-4 text-[#07090D]" />
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4 text-[#07090D]" />
                  </>
                ) : activeTab === 'register' ? (
                  <>
                    <UserPlus className="w-4 h-4 text-[#07090D]" />
                    <span>CREATE ACCOUNT</span>
                    <ArrowRight className="w-4 h-4 text-[#07090D]" />
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 text-[#07090D]" />
                    <span>SEND PASSWORD RESET LINK</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Forgot Password: Back to Sign In Link */}
          {activeTab === 'forgot_password' && (
            <div className="text-center pt-2">
              <button
                type="button"
                id="btn-back-to-signin"
                onClick={() => {
                  setActiveTab('signin');
                  setLocalError(null);
                  setSuccessNotice(null);
                }}
                className="text-xs text-[#C5A059] hover:text-[#F5DE98] font-deco tracking-wide inline-flex items-center gap-1.5"
              >
                <span>← Back to Sign In</span>
              </button>
            </div>
          )}

          {/* Switch Tab Helper */}
          {activeTab !== 'forgot_password' && (
            <div className="text-center pt-1 text-xs text-[#8C8275]">
              {activeTab === 'signin' ? (
                <div>
                  Don&apos;t have an account yet?{' '}
                  <button
                    type="button"
                    id="btn-switch-to-register"
                    onClick={() => {
                      setActiveTab('register');
                      setLocalError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-[#F5DE98] font-semibold hover:underline font-deco tracking-wide ml-1"
                  >
                    Register now
                  </button>
                </div>
              ) : (
                <div>
                  Already have an account?{' '}
                  <button
                    type="button"
                    id="btn-switch-to-signin"
                    onClick={() => {
                      setActiveTab('signin');
                      setLocalError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-[#F5DE98] font-semibold hover:underline font-deco tracking-wide ml-1"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bottom Demo Explorer Option */}
          <div className="pt-4 border-t border-[#C5A059]/20 flex items-center justify-between text-[11px] text-[#8C8275]">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Want to preview first?</span>
            </span>
            <button
              type="button"
              id="btn-demo-mode"
              onClick={handleDemoMode}
              className="text-[#C5A059] hover:text-[#F5DE98] underline font-mono tracking-wider"
            >
              Explore Sample Family Tree &rarr;
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
