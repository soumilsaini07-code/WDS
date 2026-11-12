'use client';

import React, { useState } from 'react';
import { IPOListing, IPOSubscription } from '@/lib/types';

interface ParticipantIPOCardProps {
  ipo: IPOListing;
  teamSubscription: IPOSubscription | null;
  teamBalance: number;
  onSubscribe: (lots: number) => Promise<void>;
  submitting: boolean;
}

export function ParticipantIPOCard({
  ipo,
  teamSubscription,
  teamBalance,
  onSubscribe,
  submitting,
}: ParticipantIPOCardProps) {
  const [lots, setLots] = useState<number>(ipo.min_lots || 1);

  const shareQty = lots * ipo.lot_size;
  const totalAmount = shareQty * ipo.issue_price;
  const remainingBalance = teamBalance - totalAmount;
  const isBreachingReserve = remainingBalance < 100000;
  const hasEnoughCash = teamBalance >= totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBreachingReserve || !hasEnoughCash) return;
    await onSubscribe(lots);
  };

  return (
    <div className="bg-gradient-to-br from-[#1c261e] to-[#121813] text-white rounded-2xl border border-emerald-800/60 shadow-lg p-4 sm:p-6 overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Info */}
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30 font-mono">
              ★ PRIMARY MARKET IPO SUBSCRIPTION OPEN
            </span>
            <span className="text-xs text-amber-400 font-bold font-mono">
              Round: {ipo.round_id.toUpperCase()}
            </span>
          </div>

          <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {ipo.company_name} ({ipo.ticker})
          </h3>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            {ipo.description}
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
            <div className="bg-white/5 p-2 rounded-xl border border-white/10">
              <span className="text-[10px] text-zinc-400 block font-sans uppercase">Issue Price</span>
              <span className="text-sm font-bold text-emerald-300">₹{ipo.issue_price.toFixed(2)}</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/10">
              <span className="text-[10px] text-zinc-400 block font-sans uppercase">Lot Size</span>
              <span className="text-sm font-bold text-white">{ipo.lot_size} shares</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/10">
              <span className="text-[10px] text-zinc-400 block font-sans uppercase">Cost Per Lot</span>
              <span className="text-sm font-bold text-amber-300">₹{(ipo.lot_size * ipo.issue_price).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Right: Interactive Application or Status */}
        <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 w-full lg:w-96 shrink-0 space-y-4">
          {teamSubscription ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">Your Team&apos;s Bid:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  teamSubscription.status === 'ALLOTTED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400'
                }`}>
                  {teamSubscription.status === 'ALLOTTED' ? '✓ SHARES ALLOTTED' : '⏳ BID SUBMITTED'}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-xs bg-black/20 p-3 rounded-xl border border-white/10">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Lots Requested:</span>
                  <span className="font-bold text-white">{teamSubscription.lots_requested} lots</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Shares:</span>
                  <span className="font-bold text-white">{teamSubscription.share_quantity} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Investment:</span>
                  <span className="font-bold text-emerald-400">₹{teamSubscription.total_amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 text-center">
                Allotment will be executed by Exchange Administrators upon round completion. Allotted shares become immediately tradable in subsequent rounds.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200">Subscription Bidding</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Min: {ipo.min_lots} | Max: {ipo.max_lots} lots
                </span>
              </div>

              {/* Lot Selector */}
              <div>
                <label className="text-[11px] text-zinc-300 block mb-1">
                  Select Lots to Apply:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLots((prev) => Math.max(ipo.min_lots, prev - 1))}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-base flex items-center justify-center transition cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={ipo.min_lots}
                    max={ipo.max_lots}
                    value={lots}
                    onChange={(e) => setLots(Math.max(ipo.min_lots, Math.min(ipo.max_lots, parseInt(e.target.value) || ipo.min_lots)))}
                    className="flex-1 text-center py-2 px-3 rounded-xl bg-black/30 border border-white/20 text-white font-mono font-bold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setLots((prev) => Math.min(ipo.max_lots, prev + 1))}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-base flex items-center justify-center transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Cost Summary & Liquidity Floor Check */}
              <div className="space-y-1.5 font-mono text-xs bg-black/20 p-3 rounded-xl border border-white/10">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Shares:</span>
                  <span className="font-bold text-white">{shareQty} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Amount:</span>
                  <span className="font-bold text-emerald-400">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/10">
                  <span className="text-zinc-400">Remaining Cash:</span>
                  <span className={`font-bold ${isBreachingReserve ? 'text-rose-400' : 'text-zinc-200'}`}>
                    ₹{remainingBalance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {isBreachingReserve && (
                <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-500/70 text-[10px] text-rose-200">
                  ⚠️ <strong>Liquidity Reserve Violation:</strong> Must maintain at least ₹1,00,000 cash reserve floor at all times. Reduce lot count.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || isBreachingReserve || !hasEnoughCash}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition shadow-md disabled:opacity-40 cursor-pointer"
              >
                {submitting ? 'Submitting Application...' : `Apply for ${lots} Lots (₹${totalAmount.toLocaleString('en-IN')})`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

