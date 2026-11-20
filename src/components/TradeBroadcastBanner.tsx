'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';

export interface LatestTrade {
  id: string;
  seller_team: string;
  buyer_team: string;
  ticker: string;
  stock_name: string;
  quantity: number;
  price: number;
  total_amount: number;
  timestamp: number;
}

function playTradeChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch { }
}

export function TradeBroadcastBanner({ enableSound = false }: { enableSound?: boolean } = {}) {
  const [latestTrade, setLatestTrade] = useState<LatestTrade | null>(null);
  const [msRemaining, setMsRemaining] = useState<number>(0);
  const expireAtRef = useRef<number>(0);
  const lastTradeIdRef = useRef<string | null>(null);

  // High-precision countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (expireAtRef.current > 0) {
        const diff = expireAtRef.current - Date.now();
        if (diff > 0) {
          setMsRemaining(diff);
        } else {
          expireAtRef.current = 0;
          setMsRemaining(0);
          setLatestTrade(null);
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const triggerBanner = (trade: LatestTrade, forceDurationMs = 10000) => {
    if (!trade || !trade.id) return;
    lastTradeIdRef.current = trade.id;
    setLatestTrade(trade);
    expireAtRef.current = Date.now() + forceDurationMs;
    setMsRemaining(forceDurationMs);
    if (enableSound) {
      playTradeChime();
    }
  };

  // 1. Supabase Realtime Telemetry (<50ms instantaneous push)
  useEffect(() => {
    const channel = supabaseClient
      .channel('trading-floor')
      .on('broadcast', { event: 'TRADE_EXECUTED' }, (payload) => {
        const trade = payload.payload as LatestTrade;
        if (trade && trade.id && lastTradeIdRef.current !== trade.id) {
          triggerBanner(trade, 10000);
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  // 2. Fallback polling loop (checks every 2 seconds)
  useEffect(() => {
    let isMounted = true;
    const checkLatestTrade = async () => {
      try {
        const res = await fetch('/api/trades/latest?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (data?.latestTrade) {
          const trade = data.latestTrade as LatestTrade;
          if (trade.id && lastTradeIdRef.current !== trade.id) {
            const ageMs = Date.now() - (trade.timestamp || 0);
            if (ageMs < 30000) {
              const remaining = Math.max(3000, 10000 - Math.max(0, ageMs));
              triggerBanner(trade, remaining);
            } else {
              lastTradeIdRef.current = trade.id;
            }
          }
        }
      } catch { }
    };

    checkLatestTrade();
    const interval = setInterval(checkLatestTrade, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!latestTrade || msRemaining <= 0) return null;

  const isPrimary =
    latestTrade.seller_team === 'Central Primary Pool' ||
    latestTrade.seller_team.includes('Primary') ||
    latestTrade.seller_team.includes('Issuer') ||
    latestTrade.seller_team.includes('Exchange') ||
    latestTrade.buyer_team === 'Central Primary Pool';

  return (
    <div
      className={`w-full relative z-50 transition-all duration-300 ${isPrimary
        ? 'bg-[#120F09]/95 border-b border-amber-500/30 shadow-[0_4px_24px_-4px_rgba(245,158,11,0.2)]'
        : 'bg-[#0B1015]/95 border-b border-emerald-500/30 shadow-[0_4px_24px_-4px_rgba(16,185,129,0.2)]'
        } backdrop-blur-xl text-white animate-in slide-in-from-top-2 duration-300`}
    >
      {/* Top accent hairline */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] ${isPrimary
          ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent'
          : 'bg-gradient-to-r from-transparent via-emerald-400 to-transparent'
          }`}
      />

      <div className="max-w-[1780px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Column: Settlement Signal & Counterparty Route */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Pulse Beacon Badge */}
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.16em] uppercase shrink-0 ${isPrimary
              ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
              : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
              }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPrimary ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${isPrimary ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
              />
            </span>
            <span>{isPrimary ? '⚡ TRADE APPROVED // PRIMARY ALLOTMENT' : '⚡ TRADE APPROVED // FLOOR DEAL'}</span>
          </div>

          {/* Transfer Route */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 text-zinc-200">
              <span className="text-[10px] uppercase font-mono text-zinc-400">SELLER</span>
              <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                {latestTrade.seller_team}
              </span>
            </div>

            <span className={`text-xs font-mono font-bold ${isPrimary ? 'text-amber-400' : 'text-emerald-400'}`}>
              →
            </span>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 text-zinc-200">
              <span className="text-[10px] uppercase font-mono text-zinc-400">BUYER</span>
              <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                {latestTrade.buyer_team}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Transaction Details & Countdown */}
        <div className="flex items-center gap-3 justify-between md:justify-end flex-wrap">
          {/* Stock & Volume Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/50 border border-white/10 text-xs font-mono">
            <span className="px-1.5 py-0.5 rounded bg-white/15 font-sans font-black text-white tracking-wider text-[11px]">
              {latestTrade.ticker}
            </span>
            <span className="text-zinc-300">
              {latestTrade.quantity.toLocaleString('en-IN')}{' '}
              <span className="text-zinc-400 text-[10px]">SH</span>
            </span>
            <span className="text-zinc-400">@</span>
            <span className="text-white font-semibold">
              ₹{latestTrade.price.toFixed(2)}
            </span>
            <span className="text-zinc-400 mx-0.5">/</span>
            <span className={`font-bold ${isPrimary ? 'text-amber-400' : 'text-emerald-400'}`}>
              ₹{latestTrade.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* 10s Timer & Dismiss */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/10 font-mono text-[11px] text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isPrimary ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
              <span className="tabular-nums font-medium text-zinc-200">
                {(msRemaining / 1000).toFixed(1)}s
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                expireAtRef.current = 0;
                setMsRemaining(0);
                setLatestTrade(null);
              }}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Dismiss Notification Banner"
            >
              <span className="material-symbols-outlined text-[16px] block">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
