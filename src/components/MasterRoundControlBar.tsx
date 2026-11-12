'use client';

import React from 'react';
import { CompetitionRound, CompetitionRoundId } from '@/lib/types';

interface MasterRoundControlBarProps {
  rounds: CompetitionRound[];
  currentRound: CompetitionRound | null;
  clock: { remaining_seconds: number; is_paused: boolean; is_orders_locked: boolean };
  onAdvanceRound: (targetId?: CompetitionRoundId) => void;
  onUpdateClock: (updates: { remaining_seconds?: number; is_paused?: boolean; is_orders_locked?: boolean }) => void;
  onOpenPricingConsole: () => void;
  onOpenIPODesk: () => void;
  loading?: boolean;
}

export function MasterRoundControlBar({
  rounds,
  currentRound,
  clock,
  onAdvanceRound,
  onUpdateClock,
  onOpenPricingConsole,
  onOpenIPODesk,
  loading = false,
}: MasterRoundControlBarProps) {
  const mins = Math.floor(clock.remaining_seconds / 60);
  const secs = clock.remaining_seconds % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  const isIPOActive = currentRound?.type === 'IPO';
  const currentIndex = currentRound ? currentRound.index : 0;
  const nextRound = rounds[currentIndex + 1];
  const prevRound = currentIndex > 0 ? rounds[currentIndex - 1] : null;

  // Failsafe Modal State
  const [pendingRoundTarget, setPendingRoundTarget] = React.useState<CompetitionRound | null>(null);

  return (
    <div className="w-full bg-[#111713] text-white border-b border-[#253328] px-3 sm:px-6 py-2.5 sm:py-3 shadow-md">
      <div className="max-w-[1536px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        {/* Left: Round Stage Info & Mode Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {currentRound?.type === 'IPO' ? (
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/70 flex items-center gap-1.5 shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                IPO SUBSCRIPTION
              </span>
            ) : currentRound?.type === 'PRIMARY_DESK' ? (
              <span className="text-[11px] font-mono uppercase tracking-wider text-sky-300 font-bold px-2.5 py-0.5 rounded-full bg-sky-950/80 border border-sky-700/60 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                PRIMARY DESK ALLOCATION
              </span>
            ) : (
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                P2P FLOOR TRADING
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {currentRound?.name || 'Round 0: Initial Purchase Session'}
              </h2>
              <span className="text-[10px] text-[#c8a45e] font-mono font-bold bg-[#262013] px-2 py-0.5 rounded border border-[#4d3f23]">
                Stage {currentRound ? currentRound.index + 1 : 1} of {rounds.length || 8}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-xl">
              {currentRound?.rules_note || currentRound?.description}
            </p>
          </div>
        </div>

        {/* Center / Right: Live Clock & Master Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between xl:justify-end">
          {/* Synchronized High-Contrast Digital Countdown Clock */}
          <div className="flex items-center gap-2.5 bg-[#0a0f0b] border border-[#2d3a31] px-3.5 py-1.5 rounded-xl shadow-inner">
            <span className={`material-symbols-outlined text-[20px] ${clock.is_paused ? 'text-amber-400' : 'text-emerald-400'}`}>
              timer
            </span>
            <div className="text-right">
              <span className="text-[9px] uppercase font-bold text-zinc-400 block leading-none">
                Floor Clock
              </span>
              <span className={`font-mono text-lg sm:text-xl font-black tracking-wider ${
                clock.is_paused 
                  ? 'text-amber-400' 
                  : clock.remaining_seconds <= 120 
                  ? 'text-rose-400 animate-pulse' 
                  : 'text-emerald-400'
              }`}>
                {timeFormatted}
                {clock.is_paused && <span className="text-[10px] text-amber-400 ml-1.5 font-bold tracking-normal">(PAUSED)</span>}
              </span>
            </div>
          </div>

          {/* Clock Buttons */}
          <div className="flex items-center gap-1 bg-[#0a0f0b] p-1 rounded-xl border border-[#2d3a31]">
            <button
              type="button"
              onClick={() => onUpdateClock({ is_paused: !clock.is_paused })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                clock.is_paused
                  ? 'bg-amber-500 hover:bg-amber-400 text-black font-extrabold'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
              title={clock.is_paused ? 'Resume Floor Timer' : 'Pause Floor Timer'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {clock.is_paused ? 'play_arrow' : 'pause'}
              </span>
              <span>{clock.is_paused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateClock({ remaining_seconds: clock.remaining_seconds + 120 })}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              title="Add 2 Minutes"
            >
              +2m
            </button>
            <button
              type="button"
              onClick={() => onUpdateClock({ remaining_seconds: Math.max(0, clock.remaining_seconds - 120) })}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              title="Subtract 2 Minutes"
            >
              -2m
            </button>

            {/* Reset to Round Starting Duration */}
            <button
              type="button"
              onClick={() => {
                const fullSecs = (currentRound?.duration_minutes || 20) * 60;
                onUpdateClock({ remaining_seconds: fullSecs, is_paused: true });
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 transition flex items-center gap-1 cursor-pointer border-l border-zinc-800"
              title={`Reset Clock to ${currentRound?.duration_minutes || 20}m and Pause`}
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Lock Orders Toggle */}
          <button
            type="button"
            onClick={() => onUpdateClock({ is_orders_locked: !clock.is_orders_locked })}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              clock.is_orders_locked
                ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            }`}
            title="Lock participant trade slip submissions during news delivery or pricing"
          >
            <span className="material-symbols-outlined text-[15px]">
              {clock.is_orders_locked ? 'lock' : 'lock_open'}
            </span>
            <span>{clock.is_orders_locked ? 'Orders Locked' : 'Orders Open'}</span>
          </button>

          {/* IPO Desk button (if active) */}
          {isIPOActive && (
            <button
              type="button"
              onClick={onOpenIPODesk}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer animate-pulse"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>IPO Desk</span>
            </button>
          )}

          {/* Pricing Settlement Button */}
          <button
            type="button"
            onClick={onOpenPricingConsole}
            className="px-3.5 py-1.5 rounded-xl bg-[#1e3424] hover:bg-[#284832] text-emerald-300 border border-emerald-600/50 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Open Dynamic Inter-Round Pricing Terminal"
          >
            <span className="material-symbols-outlined text-[16px]">auto_graph</span>
            <span>Pricing Engine</span>
          </button>

          {/* Revert to Previous Round Button (if not on round 0) */}
          {prevRound && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setPendingRoundTarget(prevRound)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-amber-300 border border-amber-600/40 text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              title={`Revert to ${prevRound.name}`}
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
              <span>Revert: Stage {currentIndex}</span>
            </button>
          )}

          {/* Advance Round Button (Triggers Fail-Safe Modal) */}
          <button
            type="button"
            disabled={loading}
            onClick={() => setPendingRoundTarget(nextRound || rounds[0])}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
            title={nextRound ? `Advance to ${nextRound.name}` : 'Advance to next round'}
          >
            <span>{nextRound ? `Next: Stage ${currentIndex + 2}` : 'Next Round'}</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>

          {/* Jump to dropdown (Triggers Fail-Safe Modal) */}
          <select
            value={currentRound?.id || ''}
            onChange={(e) => {
              const target = rounds.find((r) => r.id === e.target.value);
              if (target && target.id !== currentRound?.id) {
                setPendingRoundTarget(target);
              }
            }}
            className="bg-[#0a0f0b] text-xs font-mono font-semibold text-zinc-300 border border-[#2d3a31] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                Stage {r.index + 1}: {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FAIL-SAFE ROUND TRANSITION CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {pendingRoundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#0e1711] border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl text-white space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#253328]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">warning</span>
                </div>
                <div>
                  <h3 className="font-mono text-base font-black tracking-tight text-white">
                    CONFIRM ROUND TRANSITION
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Fail-safe verification before shifting live floor stage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingRoundTarget(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Transition Path */}
            <div className="p-4 rounded-2xl bg-[#080d09] border border-[#1e2a20] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Current Active Stage:</span>
                <span className="font-bold text-amber-400">{currentRound?.name}</span>
              </div>
              <div className="flex items-center justify-center py-1 text-emerald-400">
                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">New Target Stage:</span>
                <span className="font-black text-emerald-400">{pendingRoundTarget.name}</span>
              </div>
            </div>

            {/* Safety Guarantees */}
            <div className="space-y-2 text-xs font-sans">
              <div className="flex items-start gap-2 text-emerald-300">
                <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">check_circle</span>
                <span><strong>No Data Reset:</strong> All team balances, portfolios, and historical trade logs will remain 100% intact.</span>
              </div>
              <div className="flex items-start gap-2 text-emerald-300">
                <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">backup</span>
                <span><strong>Auto-Snapshot:</strong> An automatic point-in-time database snapshot is archived before switching.</span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <span className="material-symbols-outlined text-[18px] text-sky-400 shrink-0">timer</span>
                <span><strong>Floor Clock:</strong> Timer will initialize to {pendingRoundTarget.duration_minutes} minutes for this stage.</span>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#253328]">
              <button
                type="button"
                onClick={() => setPendingRoundTarget(null)}
                className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel / Keep Current Stage
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  const target = pendingRoundTarget;
                  setPendingRoundTarget(null);
                  onAdvanceRound(target.id);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/60 cursor-pointer active:scale-95"
              >
                <span>Confirm &amp; Transition Stage</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

