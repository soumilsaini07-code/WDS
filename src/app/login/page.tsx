'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, Lock, Mail, UserPlus, CheckCircle2, ShieldCheck, User } from 'lucide-react';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign Up State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let finalEmail = email.trim();
      if (!finalEmail.includes('@') && finalEmail.toLowerCase() !== 'admin') {
        finalEmail = `${finalEmail}@thapar.edu`;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        try {
          localStorage.setItem('econ_token', data.token);
          document.cookie = `econ_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        } catch {}
      }

      // If user is Admin or Superadmin, route directly to Admin Command Center
      if (data.user?.role === 'admin' || data.user?.role === 'superadmin') {
        window.location.href = '/admin';
      } else if (data.redirectTo) {
        window.location.href = data.redirectTo;
      } else {
        window.location.href = '/dashboard?onboarding=true';
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    let finalEmail = regEmail.trim();
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@thapar.edu`;
    }

    if (
      !finalEmail.toLowerCase().endsWith('@thapar.edu') &&
      !finalEmail.toLowerCase().endsWith('@thapar.ed') &&
      !finalEmail.toLowerCase().endsWith('@thapar.com')
    ) {
      setError('Registration is restricted to Thapar University members. Please enter a valid @thapar.edu email or roll number.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: finalEmail,
          password: regPassword,
          fullName: regFullName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      if (data.token) {
        try {
          localStorage.setItem('econ_token', data.token);
          document.cookie = `econ_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        } catch {}
      }

      setSuccessMsg('Account created successfully! Setting up your official trading profile...');
      setTimeout(() => {
        window.location.href = '/onboarding/profile';
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9f6] text-[#18211b] flex flex-col justify-between selection:bg-[#3d6849] selection:text-white font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="border-b border-[#e1e4da] bg-white px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-xs w-full max-w-full">
        <Link href="/" className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-md bg-[#3d6849] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-base text-[#18211b] tracking-tight">
              Wolf of Dalal Street
            </span>
            <span className="text-[10px] block text-[#5c685f] -mt-1 font-mono uppercase tracking-wider">
              ECON Club TIET • Intra-Club Terminal
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#edf5ef] text-[#295236] border border-[#d8dbd0]">
            <span className="w-2 h-2 rounded-full bg-[#3d6849] animate-pulse"></span>
            Simulation Live
          </span>
        </div>
      </header>

      {/* Main Form Centerpiece */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-md bg-white border border-[#e1e4da] rounded-2xl shadow-card overflow-hidden">
          {/* Card Title Header */}
          <div className="p-6 pb-4 border-b border-[#e1e4da] text-center bg-[#fbfbfa]">
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#18211b] tracking-tight">
              Unified Access Portal
            </h1>
            <p className="text-xs text-[#5c685f] mt-1">
              Dalal Street Arena &amp; Institutional Syndicate Terminal
            </p>

            {/* Tab Switcher: Sign In vs Sign Up */}
            <div className="grid grid-cols-2 gap-1 bg-[#f4f5f1] p-1 rounded-xl border border-[#e1e4da] mt-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'signin'
                    ? 'bg-white text-[#242826] shadow-xs'
                    : 'text-[#686e66] hover:text-[#242826]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-white text-[#3d6849] shadow-xs'
                    : 'text-[#686e66] hover:text-[#242826]'
                }`}
              >
                Create Account (Sign Up)
              </button>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-[#fdf2f2] border border-[#f5c6c6] text-[#be3835] rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-[#edf5ef] border border-[#cbe4d1] text-[#295236] rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#3d6849]" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#18211b] uppercase tracking-wider mb-1.5">
                    Roll Number or Thapar Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-[#8a948e]" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. 102203001 or email@thapar.edu"
                      className="w-full pl-9 pr-3 py-2 bg-[#f8f9f6] border border-[#d0d4c6] rounded-lg text-sm text-[#18211b] placeholder-[#8a948e] focus:outline-none focus:border-[#3d6849] focus:bg-white transition"
                    />
                  </div>
                  <div className="text-[11px] text-[#5c685f] mt-1">
                    Enter your roll number or <span className="text-[#18211b] font-medium">@thapar.edu</span> email address.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#18211b] uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#8a948e]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-9 pr-3 py-2 bg-[#f8f9f6] border border-[#d0d4c6] rounded-lg text-sm text-[#18211b] placeholder-[#8a948e] focus:outline-none focus:border-[#3d6849] focus:bg-white transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 mt-2 bg-[#3d6849] hover:bg-[#33583e] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      Sign In to Terminal <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setError(null);
                    }}
                    className="text-xs text-[#3d6849] hover:underline font-semibold cursor-pointer"
                  >
                    New student? Click here to register your account
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: SIGN UP */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#18211b] uppercase tracking-wider mb-1">
                    Student Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-[#8a948e]" />
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Kabir Mehta"
                      className="w-full pl-9 pr-3 py-2 bg-[#f8f9f6] border border-[#d0d4c6] rounded-lg text-sm text-[#18211b] placeholder-[#8a948e] focus:outline-none focus:border-[#3d6849] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#18211b] uppercase tracking-wider mb-1">
                    Roll Number or Thapar Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-[#8a948e]" />
                    <input
                      type="text"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. 102203042 or student@thapar.edu"
                      className="w-full pl-9 pr-3 py-2 bg-[#f8f9f6] border border-[#d0d4c6] rounded-lg text-sm text-[#18211b] placeholder-[#8a948e] focus:outline-none focus:border-[#3d6849] focus:bg-white transition"
                    />
                  </div>
                  <div className="text-[11px] text-[#5c685f] mt-0.5">
                    Must be your official <span className="text-[#18211b] font-medium">@thapar.edu</span> address or roll number.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#18211b] uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-[#8a948e]" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-9 pr-3 py-2 bg-[#f8f9f6] border border-[#d0d4c6] rounded-lg text-sm text-[#18211b] placeholder-[#8a948e] focus:outline-none focus:border-[#3d6849] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#18211b] uppercase tracking-wider mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-[#8a948e]" />
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-9 pr-3 py-2 bg-[#f8f9f6] border border-[#d0d4c6] rounded-lg text-sm text-[#18211b] placeholder-[#8a948e] focus:outline-none focus:border-[#3d6849] focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Corpus Callout */}
                <div className="bg-[#edf5ef] border border-[#cbe4d1] rounded-xl p-3 text-xs text-[#295236] flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#3d6849] shrink-0" />
                  <div>
                    <span className="font-bold">₹10,00,000 Starting Cash Corpus</span>
                    <p className="text-[11px] text-[#5c685f]">
                      Automatically allocated upon registration for Dalal Street Arena and Syndicate operations.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 mt-2 bg-[#3d6849] hover:bg-[#33583e] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Registering Account...
                    </span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> Create Student Account
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setError(null);
                    }}
                    className="text-xs text-[#5c685f] hover:text-[#18211b] font-medium cursor-pointer"
                  >
                    Already have an account? <span className="text-[#3d6849] font-bold">Sign In here</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-[#e1e4da] bg-white py-3 px-4 text-center text-[11px] sm:text-xs text-[#5c685f] leading-relaxed">
        ECON Club • Thapar Institute of Engineering &amp; Technology • Educational Trading Simulation
      </footer>
    </div>
  );
}
