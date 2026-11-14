'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';
import { Stock } from '@/lib/types';
import {
  BrokerLedgerSnapshot,
  TeamPurseRecord,
  TradeLedgerRow,
  INITIAL_PURSE_PER_TEAM,
  ROUND_0_MIN_DEPLOYMENT_RATIO,
  POST_ROUND_MIN_CASH_RATIO,
} from '@/lib/broker-types';

export default function BrokerDeskPage() {
  const [snapshot, setSnapshot] = useState<BrokerLedgerSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'purses' | 'ledger' | 'matrix'>('purses');

  // Form State for Jogger / Broker Slip Entry
  const [buyerTeam, setBuyerTeam] = useState<string>('');
  const [sellerTeam, setSellerTeam] = useState<string>('Central Primary Pool');
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('100');
  const [agreedPrice, setAgreedPrice] = useState<string>('');
  const [allowCircuitBypass, setAllowCircuitBypass] = useState<boolean>(false);

  // Search & Filter
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Alerts & Notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Audio Beep for Trade Settlement (Web Audio API)
  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  // Fetch Snapshot from Backend
  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/broker/ledger');
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) {
          setSnapshot(data.snapshot);
          // Set initial stock if unset
          if (!selectedStockId && data.snapshot.stocks && data.snapshot.stocks.length > 0) {
            setSelectedStockId(data.snapshot.stocks[0].id);
            setAgreedPrice(String(data.snapshot.stocks[0].current_price));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load broker ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    const interval = setInterval(fetchLedger, 4000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime Listener for Instant Floor Sync
  useEffect(() => {
    const channel = supabaseClient
      .channel('broker-desk-sync')
      .on('broadcast', { event: 'TRADE_EXECUTED' }, () => {
        fetchLedger();
      })
      .on('broadcast', { event: 'STOCK_PRICE_UPDATED' }, () => {
        fetchLedger();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  // Selected Stock Details
  const selectedStock = (snapshot?.stocks || []).find(
    (s) => s.id === selectedStockId || s.ticker.toUpperCase() === selectedStockId.toUpperCase()
  );

  // Update agreed price when stock selection changes
  const handleStockChange = (stockId: string) => {
    setSelectedStockId(stockId);
    const stock = (snapshot?.stocks || []).find((s) => s.id === stockId);
    if (stock) {
      setAgreedPrice(String(stock.current_price));
    }
  };

  // Calculation Metrics for the Active Slip
  const currentRoundId = snapshot?.currentRoundId || 'round-0';
  const isRound0 = currentRoundId === 'round-0';
  const isPrimaryPool =
    sellerTeam === 'Central Primary Pool' ||
    sellerTeam.toLowerCase().includes('primary pool') ||
    sellerTeam.toLowerCase().includes('central primary');

  const parsedQty = parseInt(quantity, 10) || 0;
  const parsedPrice = parseFloat(agreedPrice) || (selectedStock ? selectedStock.current_price : 0);
  const grossDealValue = Number((parsedQty * parsedPrice).toFixed(2));

  // 0th Round Exemption: Brokerage is waived (0%) when trading with Central Primary Pool in Round 0
  const isBrokerageWaived = isRound0 || isPrimaryPool;
  const buyerBrokerage = isBrokerageWaived ? 0 : Number((grossDealValue * 0.05).toFixed(2));
  const sellerBrokerage = isBrokerageWaived ? 0 : Number((grossDealValue * 0.05).toFixed(2));
  const totalBuyerDebit = Number((grossDealValue + buyerBrokerage).toFixed(2));
  const totalSellerCredit = Number((grossDealValue - sellerBrokerage).toFixed(2));
  const totalDeskFee = Number((buyerBrokerage + sellerBrokerage).toFixed(2));

  // Circuit Breaker Bounds Check (±10%)
  const isCircuitBreached =
    !isPrimaryPool &&
    selectedStock &&
    ((selectedStock.upper_circuit && parsedPrice > selectedStock.upper_circuit) ||
      (selectedStock.lower_circuit && parsedPrice < selectedStock.lower_circuit));

  // Buyer Team Details & Compliance Pre-Flight
  const buyerRecord = (snapshot?.teamsPurse || []).find(
    (t) =>
      t.teamName.toLowerCase() === buyerTeam.trim().toLowerCase() ||
      t.teamCode.toLowerCase() === buyerTeam.trim().toLowerCase()
  );

  const buyerCurrentCash = buyerRecord?.currentCash ?? INITIAL_PURSE_PER_TEAM;
  const buyerPostTradeCash = Number((buyerCurrentCash - totalBuyerDebit).toFixed(2));
  const buyerProjectedR0Spent = (buyerRecord?.round0Spent || 0) + (isRound0 ? grossDealValue : 0);
  const buyerProjectedR0Percent = Number(((buyerProjectedR0Spent / INITIAL_PURSE_PER_TEAM) * 100).toFixed(1));
  const targetR0Amount = INITIAL_PURSE_PER_TEAM * ROUND_0_MIN_DEPLOYMENT_RATIO; // 60 Lakhs
  const minCashFloor = INITIAL_PURSE_PER_TEAM * POST_ROUND_MIN_CASH_RATIO; // 10 Lakhs
  const isCashFloorBreached = buyerPostTradeCash < minCashFloor;

  // Handle Trade Slip Submission
  const handleSettleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!buyerTeam.trim()) {
      setFeedback({ type: 'error', message: 'Please enter or select the Buyer Team from the physical slip.' });
      return;
    }
    if (!sellerTeam.trim()) {
      setFeedback({ type: 'error', message: 'Please enter or select the Seller Team from the physical slip.' });
      return;
    }
    if (buyerTeam.trim().toLowerCase() === sellerTeam.trim().toLowerCase()) {
      setFeedback({ type: 'error', message: 'Buyer and Seller team cannot be identical!' });
      return;
    }
    if (!selectedStockId) {
      setFeedback({ type: 'error', message: 'Please select the traded security.' });
      return;
    }
    if (parsedQty <= 0) {
      setFeedback({ type: 'error', message: 'Quantity must be at least 1 share.' });
      return;
    }
    if (parsedPrice <= 0) {
      setFeedback({ type: 'error', message: 'Price per share must be positive.' });
      return;
    }
    if (isCircuitBreached && !allowCircuitBypass) {
      setFeedback({
        type: 'error',
        message: `Agreed price ₹${parsedPrice} breaches circuit collar (LC: ₹${selectedStock?.lower_circuit?.toFixed(2)} - UC: ₹${selectedStock?.upper_circuit?.toFixed(2)}). Check "Bypass Collar" if approved for floor auction.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/broker/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerTeamName: buyerTeam.trim(),
          sellerTeamName: sellerTeam.trim(),
          stockId: selectedStockId,
          quantity: parsedQty,
          agreedPrice: parsedPrice,
          allowCircuitBypass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to settle slip trade.');
      }

      playSuccessChime();
      setFeedback({
        type: 'success',
        message: `✅ SLIP APPROVED & BROADCAST! ${parsedQty} shares of ${selectedStock?.ticker} settled between "${buyerTeam}" & "${sellerTeam}" at ₹${parsedPrice.toFixed(2)}. Visible on participant terminal for 10s!`,
      });

      if (data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        fetchLedger();
      }

      // Reset form quantity, keep round context
      setQuantity('100');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error executing trade.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick helper to fill form from table
  const selectTeamAsBuyer = (teamName: string) => {
    setBuyerTeam(teamName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const selectTeamAsSeller = (teamName: string) => {
    setSellerTeam(teamName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtered Teams
  const filteredTeams = (snapshot?.teamsPurse || []).filter((t) => {
    const q = teamSearch.toLowerCase().trim();
    return (
      !q ||
      t.teamName.toLowerCase().includes(q) ||
      t.teamCode.toLowerCase().includes(q) ||
      t.leaderName.toLowerCase().includes(q)
    );
  });

  // Filtered Trades
  const filteredTrades = (snapshot?.tradesLedger || []).filter((tr) => {
    const q = ledgerSearch.toLowerCase().trim();
    return (
      !q ||
      tr.buyerTeam.toLowerCase().includes(q) ||
      tr.sellerTeam.toLowerCase().includes(q) ||
      tr.ticker.toLowerCase().includes(q) ||
      tr.slipId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0c1015] text-slate-100 font-sans flex flex-col selection:bg-emerald-500/30">
      {/* ========================================================================= */}
      {/* 1. UNIVERSAL TOP BAR: 3-PORTAL NAVIGATION & LIVE FLOOR TELEMETRY */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#121820]/95 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Floor Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-white text-base shadow-lg shadow-emerald-950/40">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base tracking-tight text-white uppercase">
                  Wolf of Dalal Street
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  PORTAL 2: EVENT DESK
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Floor Broker Slip Settlement Console &amp; Live Excel Ledger
              </p>
            </div>
          </div>

          {/* Three Portals Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-[#0a0d12] p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
              title="Portal 1: Public Live Terminal for Participants"
            >
              <span>📈</span>
              <span className="hidden md:inline">1. Participant</span>
              <span>Terminal</span>
            </Link>

            <div className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold shadow-xs flex items-center gap-1.5 cursor-default">
              <span>📋</span>
              <span className="hidden md:inline">2. Event Floor &amp;</span>
              <span>Broker Desk</span>
            </div>

            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
              title="Portal 3: Market Operations, News Catalysts & Formulas"
            >
              <span>⚙️</span>
              <span className="hidden md:inline">3. Admin Market</span>
              <span>Ops</span>
            </Link>
          </nav>

          {/* Floor Status & Telemetry Strip */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/70 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-emerald-400 uppercase">
                {snapshot?.currentRoundName || 'ROUND 0'}
              </span>
            </div>
            <button
              onClick={fetchLedger}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
              title="Refresh Live Ledger"
            >
              🔄
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. LIVE METRICS KPI STRIP */}
      {/* ========================================================================= */}
      <section className="bg-[#0f141c] border-b border-slate-800/80 py-2.5 px-4 sm:px-6">
        <div className="max-w-[1720px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider text-[11px]">Deals Settled</span>
            <span className="font-black text-white text-sm">{snapshot?.totalDealsSettled ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider text-[11px]">Shares Traded</span>
            <span className="font-black text-emerald-400 text-sm">
              {(snapshot?.totalVolumeShares ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider text-[11px]">Gross Consideration</span>
            <span className="font-black text-amber-300 text-sm">
              ₹{(snapshot?.totalGrossConsideration ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider text-[11px]">Desk Commission</span>
            <span className="font-black text-teal-400 text-sm">
              ₹{(snapshot?.totalDeskCommission ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE: PHYSICAL SLIP ENTRY (LEFT) + LIVE EXCEL SHEET (RIGHT) */}
      {/* ========================================================================= */}
      <main className="max-w-[1720px] mx-auto px-4 sm:px-6 py-5 flex-1 w-full space-y-6">
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{feedback.type === 'success' ? '⚡' : '⚠️'}</span>
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs px-2 py-0.5 rounded bg-black/30 hover:bg-black/60 transition"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ===================================================================== */}
          {/* LEFT COLUMN (5 COLS): PHYSICAL SLIP ENTRY & INSTANT VOUCHER */}
          {/* ===================================================================== */}
          <div className="lg:col-span-5 bg-[#121822] rounded-2xl border border-slate-800 shadow-xl overflow-hidden sticky top-20">
            {/* Form Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-[#16202c] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-black text-white text-sm sm:text-base flex items-center gap-2 uppercase tracking-wide">
                  <span className="text-emerald-400">🏃</span>
                  <span>Physical Broker Slip Entry</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Type slip details brought by floor runners/joggers
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                {isRound0 ? 'Round 0 Exemption Active' : 'Dual 5% Brokerage'}
              </span>
            </div>

            {/* Slip Form */}
            <form onSubmit={handleSettleTrade} className="p-5 space-y-4">
              {/* Buyer & Seller Teams Grid */}
              <div className="space-y-3">
                {/* 1. Buying Team */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📥 1. Buying Team (Purchaser)</span>
                    </label>
                    {buyerRecord && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Cash: ₹{(buyerRecord.currentCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    list="broker-team-list"
                    value={buyerTeam}
                    onChange={(e) => setBuyerTeam(e.target.value)}
                    placeholder="Type or select Buyer (e.g. Team 14, Apex Alpha)..."
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* 2. Selling Team */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📤 2. Selling Team (Seller)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSellerTeam('Central Primary Pool')}
                      className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/70 hover:bg-amber-900/90 border border-amber-500/40 px-2 py-0.5 rounded transition"
                      title="Set Central Primary Pool as seller for Round 0 allocations"
                    >
                      🏛️ Round 0 Primary Pool
                    </button>
                  </div>
                  <input
                    type="text"
                    list="broker-team-list"
                    value={sellerTeam}
                    onChange={(e) => setSellerTeam(e.target.value)}
                    placeholder="Type or select Seller (e.g. Central Primary Pool, Team 8)..."
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    required
                  />
                </div>
              </div>

              {/* Datalist for autocomplete team selection */}
              <datalist id="broker-team-list">
                <option value="Central Primary Pool">🏛️ Central Primary Pool (Round 0 Unlimited Issuance)</option>
                {(snapshot?.teamsPurse || []).map((t) => (
                  <option key={t.teamId} value={t.teamName}>
                    {t.teamCode} — Cash: ₹{t.currentCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </option>
                ))}
              </datalist>

              {/* 3. Traded Security (Stock) */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  🏢 3. Security (Stock)
                </label>
                <select
                  value={selectedStockId}
                  onChange={(e) => handleStockChange(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                >
                  {(snapshot?.stocks || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ticker} — {s.name} [LTP: ₹{s.current_price.toFixed(2)}]
                    </option>
                  ))}
                </select>
                {selectedStock && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                    <span>
                      LTP: <strong className="text-white">₹{selectedStock.current_price.toFixed(2)}</strong>
                    </span>
                    <span>
                      Collar: LC ₹{selectedStock.lower_circuit?.toFixed(1)} - UC ₹{selectedStock.upper_circuit?.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* 4 & 5. Quantity & Agreed Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    📊 4. Quantity (Shares)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      💵 5. Agreed Price (₹)
                    </label>
                    {selectedStock && (
                      <button
                        type="button"
                        onClick={() => setAgreedPrice(String(selectedStock.current_price))}
                        className="text-[10px] text-teal-400 hover:underline cursor-pointer"
                      >
                        Reset to LTP
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={agreedPrice}
                    onChange={(e) => setAgreedPrice(e.target.value)}
                    placeholder="Price per share"
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Circuit Limit Warning & Bypass */}
              {isCircuitBreached && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>⚠️</span>
                    <span>Circuit Collar Limit Breached!</span>
                  </div>
                  <p className="text-[11px] text-amber-300 leading-snug">
                    Price ₹{parsedPrice.toFixed(2)} exceeds 10% bounds (LC: ₹{selectedStock?.lower_circuit?.toFixed(2)} / UC: ₹{selectedStock?.upper_circuit?.toFixed(2)}).
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowCircuitBypass}
                      onChange={(e) => setAllowCircuitBypass(e.target.checked)}
                      className="rounded border-amber-600 text-amber-500 focus:ring-0"
                    />
                    <span className="text-[11px] font-bold text-amber-100">
                      Bypass Circuit (Official Physical Auction Deal)
                    </span>
                  </label>
                </div>
              )}

              {/* ================================================================= */}
              {/* REAL-TIME DEAL SETTLEMENT VOUCHER WITH FORMULAS */}
              {/* ================================================================= */}
              <div className="p-4 rounded-xl bg-[#090d12] border border-slate-800 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span className="font-bold uppercase tracking-wider text-white">Deal Settlement Voucher</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                    {isBrokerageWaived ? '0% Brok (0th Round Exemption)' : 'Dual 5% Brokerage'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span>Gross Consideration:</span>
                  <span className="font-bold text-white text-sm">
                    ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-emerald-400">
                  <span>Buyer 5% Brokerage:</span>
                  <span>{isBrokerageWaived ? '₹0.00 (Waived)' : `+₹${buyerBrokerage.toLocaleString('en-IN')}`}</span>
                </div>

                <div className="flex items-center justify-between font-bold text-emerald-300 border-t border-slate-800/80 pt-1">
                  <span>Total Buyer Outflow:</span>
                  <span>₹{totalBuyerDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center justify-between text-rose-400 text-[11px]">
                  <span>Seller 5% Brokerage:</span>
                  <span>{isBrokerageWaived ? '₹0.00 (Waived)' : `-₹${sellerBrokerage.toLocaleString('en-IN')}`}</span>
                </div>

                <div className="flex items-center justify-between font-bold text-rose-300">
                  <span>Total Seller Net Proceeds:</span>
                  <span>₹{totalSellerCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-teal-400 border-t border-slate-800/80 pt-1">
                  <span>Econ Desk Total Commission:</span>
                  <span>₹{totalDeskFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* ================================================================= */}
              {/* TEAM BUDGET & COMPLIANCE GUARDRAIL (60% R0 & 10% CASH FLOOR) */}
              {/* ================================================================= */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Buyer Cash Remaining:</span>
                  <span
                    className={`font-black ${
                      isCashFloorBreached ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    ₹{buyerPostTradeCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* 10% Cash Floor Warning */}
                {isCashFloorBreached && (
                  <div className="p-2 rounded bg-rose-950/70 border border-rose-500/40 text-rose-200 text-[11px] flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>
                      <strong>Warning:</strong> Buyer cash will drop below ₹10 Lakhs (10% post-round floor reserve)!
                    </span>
                  </div>
                )}

                {/* Round 0 60% Budget Deployment Progress */}
                {isRound0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-800 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Round 0 Budget Deployed:</span>
                      <span className="font-bold text-amber-300">
                        {buyerProjectedR0Percent}% (Target: 60%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          buyerProjectedR0Percent >= 60 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, buyerProjectedR0Percent)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Spent: ₹{(buyerProjectedR0Spent / 100000).toFixed(1)}L / ₹60.0L</span>
                      <span>
                        {buyerProjectedR0Percent >= 60
                          ? '✅ Target Met'
                          : `Needs ₹${((targetR0Amount - buyerProjectedR0Spent) / 100000).toFixed(1)}L more`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/50 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Broadcasting &amp; Settling Trade...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Approve &amp; Settle Trade Slip</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ===================================================================== */}
          {/* RIGHT COLUMN (7 COLS): LIVE EVENT EXCEL SPREADSHEET & ELIMINATION */}
          {/* ===================================================================== */}
          <div className="lg:col-span-7 bg-[#121822] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col min-h-[720px]">
            {/* Sheet Tabs & Excel Actions Toolbar */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-[#16202c] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Tab Buttons */}
              <div className="flex items-center gap-1 bg-[#090d12] p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('purses')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'purses'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>💰</span>
                  <span>Team Purses &amp; Elimination</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'ledger'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>📋</span>
                  <span>Trades Master Ledger ({snapshot?.tradesLedger?.length ?? 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'matrix'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>🏢</span>
                  <span>Holdings Matrix</span>
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <a
                  href="/api/broker/export-excel"
                  download
                  className="px-3 py-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition border border-emerald-500/40 shadow-xs"
                  title="Download genuine multi-tab Excel Workbook (.xlsx)"
                >
                  <span>📗</span>
                  <span className="hidden sm:inline">Download</span>
                  <span>Excel (.xlsx)</span>
                </a>

                <a
                  href="/api/admin/export-ledger"
                  download
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1 transition border border-slate-700"
                  title="Download raw CSV Ledger"
                >
                  <span>📄</span>
                  <span>CSV</span>
                </a>
              </div>
            </div>

            {/* TAB 1: TEAM PURSES, BUDGET AUDIT & ELIMINATION TRACKER */}
            {activeTab === 'purses' && (
              <div className="p-4 flex-1 flex flex-col space-y-3">
                {/* Search Bar & Rule Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <input
                      type="text"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Search team name or code..."
                      className="w-full py-2 pl-8 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute left-2.5 top-2.5 text-xs text-slate-500">🔍</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Qualified
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span> Low Cash (&lt;10L)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span> Eliminate (&lt;60% R0)
                    </span>
                  </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-x-auto border border-slate-800 rounded-xl bg-[#090d12]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#141b24] text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3">Cash Balance</th>
                        <th className="py-2.5 px-3">R0 Spent</th>
                        <th className="py-2.5 px-3">R0 Deployed %</th>
                        <th className="py-2.5 px-3">60% Rule</th>
                        <th className="py-2.5 px-3">10% Cash Rule</th>
                        <th className="py-2.5 px-3">Holdings Value</th>
                        <th className="py-2.5 px-3">Net Worth</th>
                        <th className="py-2.5 px-3 text-right">Quick Fill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredTeams.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-slate-500">
                            No matching teams found.
                          </td>
                        </tr>
                      ) : (
                        filteredTeams.map((tp) => {
                          const isEliminateRisk = !tp.round0Met60Percent;
                          const isLowCash = !tp.cashMet10PercentFloor;

                          return (
                            <tr
                              key={tp.teamId}
                              className={`hover:bg-slate-800/40 transition ${
                                isEliminateRisk ? 'bg-rose-950/10' : isLowCash ? 'bg-amber-950/10' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-sans">
                                <div className="font-bold text-white text-xs">{tp.teamName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{tp.teamCode}</div>
                              </td>

                              <td className="py-2.5 px-3 font-bold text-emerald-400">
                                ₹{(tp.currentCash / 100000).toFixed(2)}L
                              </td>

                              <td className="py-2.5 px-3 text-amber-300">
                                ₹{(tp.round0Spent / 100000).toFixed(2)}L
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        tp.round0DeployedPercent >= 60 ? 'bg-emerald-400' : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(100, tp.round0DeployedPercent)}%` }}
                                    ></div>
                                  </div>
                                  <span
                                    className={`font-bold ${
                                      tp.round0DeployedPercent >= 60 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {tp.round0DeployedPercent}%
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                {tp.round0Met60Percent ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                                    ✅ PASS
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-500/40 font-bold">
                                    ❌ ELIMINATE
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                {tp.cashMet10PercentFloor ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 font-semibold">
                                    ✅ &ge;10L
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/70 text-amber-300 border border-amber-500/40 font-bold">
                                    ⚠️ &lt;10L
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-slate-300">
                                ₹{(tp.totalHoldingsValue / 100000).toFixed(2)}L
                              </td>

                              <td className="py-2.5 px-3 font-bold text-white">
                                ₹{(tp.totalNetWorth / 100000).toFixed(2)}L
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1 font-sans">
                                  <button
                                    type="button"
                                    onClick={() => selectTeamAsBuyer(tp.teamName)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 transition"
                                    title="Set as Buyer on active slip"
                                  >
                                    +Buy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => selectTeamAsSeller(tp.teamName)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900/60 hover:bg-rose-800 text-rose-200 transition"
                                    title="Set as Seller on active slip"
                                  >
                                    +Sell
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: TRADES MASTER LEDGER */}
            {activeTab === 'ledger' && (
              <div className="p-4 flex-1 flex flex-col space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search slip ID, team, or stock ticker..."
                    className="w-full py-2 pl-8 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs text-slate-500">🔍</span>
                </div>

                <div className="flex-1 overflow-x-auto border border-slate-800 rounded-xl bg-[#090d12]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#141b24] text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Slip ID</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Buyer</th>
                        <th className="py-2.5 px-3">Seller</th>
                        <th className="py-2.5 px-3">Stock</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Gross</th>
                        <th className="py-2.5 px-3">Buyer Brok</th>
                        <th className="py-2.5 px-3">Buyer Debit</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredTrades.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center py-8 text-slate-500">
                            No trades recorded yet.
                          </td>
                        </tr>
                      ) : (
                        filteredTrades.map((t) => (
                          <tr key={t.slipId} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 font-bold text-teal-400">{t.slipId}</td>
                            <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                              {new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-400 font-sans">{t.buyerTeam}</td>
                            <td className="py-2.5 px-3 font-bold text-rose-400 font-sans">{t.sellerTeam}</td>
                            <td className="py-2.5 px-3 font-black text-white">{t.ticker}</td>
                            <td className="py-2.5 px-3 text-slate-200">{t.quantity}</td>
                            <td className="py-2.5 px-3 text-emerald-300">₹{t.price.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              ₹{t.grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2.5 px-3 text-amber-400">
                              {t.isRound0Exempt ? '₹0 (Waived)' : `₹${t.buyerBrokerage.toFixed(0)}`}
                            </td>
                            <td className="py-2.5 px-3 font-black text-emerald-300">
                              ₹{t.buyerTotalDebit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30">
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: TEAM STOCK HOLDINGS MATRIX */}
            {activeTab === 'matrix' && (
              <div className="p-4 flex-1 flex flex-col space-y-3">
                <div className="text-xs text-slate-400 font-medium">
                  Showing physical share counts allocated across all participant syndicates:
                </div>
                <div className="flex-1 overflow-x-auto border border-slate-800 rounded-xl bg-[#090d12]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#141b24] text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 sticky left-0 bg-[#141b24] z-10">Team</th>
                        {(snapshot?.holdingsMatrix.stocks || []).map((s) => (
                          <th key={s.id} className="py-2.5 px-3 text-center">
                            <div>{s.ticker}</div>
                            <div className="text-[10px] text-slate-500 font-normal">₹{s.current_price.toFixed(1)}</div>
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right">Portfolio Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {(snapshot?.holdingsMatrix.teams || []).map((team) => (
                        <tr key={team.teamId} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-sans font-bold text-white sticky left-0 bg-[#090d12] z-10 border-r border-slate-800">
                            {team.teamName}
                          </td>
                          {(snapshot?.holdingsMatrix.stocks || []).map((s) => {
                            const count = team.holdings[s.ticker] || 0;
                            return (
                              <td
                                key={s.id}
                                className={`py-2.5 px-3 text-center ${
                                  count > 0 ? 'text-emerald-400 font-bold bg-emerald-950/20' : 'text-slate-600'
                                }`}
                              >
                                {count > 0 ? count : '—'}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 font-bold text-amber-300 text-right">
                            ₹{(team.totalValue / 100000).toFixed(2)}L
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
