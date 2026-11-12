'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Building2,
  BadgeCheck,
} from 'lucide-react';

export default function ProfileSetupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [hasManuallyEditedUsername, setHasManuallyEditedUsername] = useState(false);
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check auth session on load
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = localStorage.getItem('econ_token');
        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setEmail(data.user.email);
            if (data.user.first_name) setFirstName(data.user.first_name);
            if (data.user.last_name) setLastName(data.user.last_name);
            if (data.user.username) {
              setUsername(data.user.username);
              setHasManuallyEditedUsername(true);
            } else if (data.user.email) {
              const defaultName = data.user.email.split('@')[0];
              setUsername(`Trader_${defaultName}`);
            }
          }
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
    }

    checkAuth();
  }, [router]);

  // Auto-generate username from first and last name if user hasn't typed custom handle
  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    if (!hasManuallyEditedUsername) {
      const full = `${val} ${lastName}`.trim();
      setUsername(full || (email ? `Trader_${email.split('@')[0]}` : ''));
    }
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    if (!hasManuallyEditedUsername) {
      const full = `${firstName} ${val}`.trim();
      setUsername(full || (email ? `Trader_${email.split('@')[0]}` : ''));
    }
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    setHasManuallyEditedUsername(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }

    const finalUsername = (username || `${firstName} ${lastName}`.trim()).trim();
    if (!finalUsername) {
      setError('Please choose a display username.');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('econ_token');
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: finalUsername,
          team_code: teamCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile.');
      }

      // Mark profile setup completed and redirect to dashboard with tutorial
      localStorage.setItem('wds_user_profile_set', 'true');
      router.push('/dashboard?onboarding=true');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  const displayHandle = username || (firstName ? `${firstName} ${lastName}`.trim() : 'Your Trading Handle');

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-[#242826] flex flex-col justify-between selection:bg-[#4a7c59] selection:text-white relative overflow-hidden w-full max-w-full overflow-x-hidden">
      {/* Decorative gradient accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-b from-[#edf5ef]/80 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-gradient-to-t from-[#f6f6f2] to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-6xl w-full max-w-full mx-auto px-4 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#141b16] flex items-center justify-center shadow-xs">
            <span className="font-bold text-white text-sm">W</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#242826]">
              Wolf of Dalal Street
            </h1>
            <p className="text-[10px] text-[#686e66] font-mono">
              Official Participant Onboarding • ECON Club TIET
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#686e66] bg-white border border-[#e2e4dc] px-3 py-1.5 rounded-lg shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#4a7c59] animate-pulse" />
          <span className="font-mono text-[11px] truncate max-w-[140px] sm:max-w-none">
            {email || 'Signed in'}
          </span>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="max-w-xl w-full mx-auto px-4 py-6 relative z-10 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-[#e2e4dc] rounded-2xl p-6 sm:p-8 shadow-card space-y-6">
          {/* Header Title */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#edf5ef] text-[#295236] border border-[#cbe4d1] mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4a7c59]" />
              <span>Step 2 of 2 • Official Trader Identity</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#242826]">
              Set Up Your Public Username
            </h2>
            <p className="text-xs text-[#686e66] mt-1 leading-relaxed">
              Enter your real name. This will create your official username visible across the Live Leaderboard, order books, and the Fund Syndicate.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-[#fdf2f2] border border-[#f5c6c6] text-[#be3835] text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#686e66] mb-1.5">
                  First Name <span className="text-[#be3835]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                  placeholder="e.g. Soumil"
                  className="w-full bg-[#fbfbfa] border border-[#e2e4dc] rounded-xl px-3.5 py-2.5 text-xs text-[#242826] focus:outline-none focus:border-[#4a7c59] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#686e66] mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                  placeholder="e.g. Saini"
                  className="w-full bg-[#fbfbfa] border border-[#e2e4dc] rounded-xl px-3.5 py-2.5 text-xs text-[#242826] focus:outline-none focus:border-[#4a7c59] focus:bg-white transition"
                />
              </div>
            </div>

            {/* Username / Display Handle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#686e66]">
                  Public Trading Username <span className="text-[#be3835]">*</span>
                </label>
                <span className="text-[10px] text-[#8a9087]">
                  Appears on the Live Leaderboard
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="e.g. Soumil Saini"
                  className="w-full bg-[#fbfbfa] border border-[#e2e4dc] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#242826] font-semibold focus:outline-none focus:border-[#4a7c59] focus:bg-white transition"
                />
                <User className="w-4 h-4 text-[#8a9087] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Team Code Entry Form (Join Team Squad) */}
            <div className="pt-2 border-t border-[#e2e4dc]/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#242826] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-[#4a7c59]">groups</span>
                  <span>Team Entry Code (Squad Joining)</span>
                </label>
                <span className="text-[10px] text-[#4a7c59] font-mono font-bold bg-[#edf5ef] px-2 py-0.5 rounded">
                  Max 6 / Squad
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  placeholder="Enter Squad Code (e.g. APEX-01, TITAN-02)"
                  className="w-full bg-[#fbfbfa] border border-[#e2e4dc] rounded-xl px-3.5 py-2.5 text-xs text-[#242826] font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-[#4a7c59] focus:bg-white transition"
                />
              </div>
              <p className="text-[11px] text-[#686e66] leading-relaxed">
                Got an official code from your Team Leader? Enter it here to join your squad&apos;s shared portfolio. If you don&apos;t have a squad yet, leave blank and join anytime from your dashboard!
              </p>
            </div>

            {/* Live Visual Preview Card */}
            <div className="bg-[#f6f6f2] border border-[#e2e4dc] rounded-xl p-3.5 space-y-2 mt-2">
              <span className="text-[10px] font-mono font-bold uppercase text-[#7b6332] tracking-wider block">
                Live Preview Across Dalal Street
              </span>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-[#e2e4dc]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#edf5ef] border border-[#cbe4d1] flex items-center justify-center font-bold text-xs text-[#295236]">
                    {firstName ? firstName[0].toUpperCase() : 'T'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#242826] flex items-center gap-1">
                      <span>{displayHandle}</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-[#4a7c59]" />
                    </div>
                    <span className="text-[10px] text-[#8a9087]">
                      {email || 'student@thapar.edu'}
                    </span>
                  </div>
                </div>

                <div className="text-right flex items-center sm:flex-col justify-between sm:justify-center">
                  <span className="text-[9px] text-[#686e66] font-mono block">Rank #1 • +18.4%</span>
                  <span className="text-[10px] font-bold text-[#4a7c59] font-mono">₹11,84,250</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#141b16] hover:bg-[#242826] text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Saving Profile...' : 'Save Profile & Enter Terminal'}</span>
                <ArrowRight className="w-4 h-4 text-[#8eb69b]" />
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-[#8a9087] relative z-10">
        Economics Club TIET • Wolf of Dalal Street 2026
      </footer>
    </div>
  );
}
