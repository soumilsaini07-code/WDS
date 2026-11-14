'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import {
  BrokerLedgerSnapshot,
  INITIAL_PURSE_PER_TEAM,
  ROUND_0_MIN_DEPLOYMENT_RATIO,
  POST_ROUND_MIN_CASH_RATIO,
} from '@/lib/broker-types';

export default function EditorialBrokerDeskPage() {
  const [snapshot, setSnapshot] = useState<BrokerLedgerSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'purses' | 'ledger' | 'matrix' | 'ipo'>('purses');
  const [slipMode, setSlipMode] = useState<'trade' | 'ipo'>('trade');

  // Form State for IPO Slip Entry
  const [ipoSelectedId, setIpoSelectedId] = useState<string>('');
  const [ipoTeamName, setIpoTeamName] = useState<string>('');
  const [ipoLots, setIpoLots] = useState<string>('5');
  const [isIpoSubmitting, setIsIpoSubmitting] = useState<boolean>(false);

  // Persistent stock and IPO refs to prevent closure polling resets
  const selectedStockIdRef = useRef<string>('');
  const ipoSelectedIdRef = useRef<string>('');

  // Form State for Jogger / Broker Slip Entry
  const [buyerTeam, setBuyerTeam] = useState<string>('');
  const [sellerTeam, setSellerTeam] = useState<string>('Central Primary Pool');
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('100');
  const [agreedPrice, setAgreedPrice] = useState<string>('');
  const [allowCircuitBypass, setAllowCircuitBypass] = useState<boolean>(false);

  // Search
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Toast / Status Message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Web Audio chime
  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
          if (!selectedStockIdRef.current && data.snapshot.stocks && data.snapshot.stocks.length > 0) {
            const firstStock = data.snapshot.stocks[0];
            selectedStockIdRef.current = firstStock.id;
            setSelectedStockId(firstStock.id);
            setAgreedPrice(String(firstStock.current_price));
          }
          if (!ipoSelectedIdRef.current && data.snapshot.ipoListings && data.snapshot.ipoListings.length > 0) {
            const firstIpo = data.snapshot.ipoListings[0];
            ipoSelectedIdRef.current = firstIpo.id;
            setIpoSelectedId(firstIpo.id);
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

  // Supabase Realtime Listener
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

  const handleStockChange = (stockId: string) => {
    selectedStockIdRef.current = stockId;
    setSelectedStockId(stockId);
    const stock = (snapshot?.stocks || []).find((s) => s.id === stockId);
    if (stock) {
      setAgreedPrice(String(stock.current_price));
    }
  };

  // Calculations
  const currentRoundId = snapshot?.currentRoundId || 'round-0';
  const isRound0 = currentRoundId === 'round-0';
  const isPrimaryPool =
    sellerTeam === 'Central Primary Pool' ||
    sellerTeam.toLowerCase().includes('primary pool') ||
    sellerTeam.toLowerCase().includes('central primary');

  const parsedQty = parseInt(quantity, 10) || 0;
  const parsedPrice = parseFloat(agreedPrice) || (selectedStock ? selectedStock.current_price : 0);
  const grossDealValue = Number((parsedQty * parsedPrice).toFixed(2));

  // 0th Round Exemption: Brokerage is waived (0%) on Round 0 / Primary Pool
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
  const targetR0Amount = INITIAL_PURSE_PER_TEAM * ROUND_0_MIN_DEPLOYMENT_RATIO; // ₹6,00,000 (6 Lakhs)
  const minCashFloor = INITIAL_PURSE_PER_TEAM * POST_ROUND_MIN_CASH_RATIO; // ₹1,00,00,0 (1 Lakh)
  const isCashFloorBreached = buyerPostTradeCash < minCashFloor;

  // Active IPO calculation helpers
  const activeIpoListing = snapshot?.ipoListings?.find((l) => l.id === ipoSelectedId) || snapshot?.ipoListings?.[0];
  const ipoApplyingTeamRecord = snapshot?.teamsPurse?.find(
    (t) => t.teamName.toLowerCase() === ipoTeamName.trim().toLowerCase() || t.teamCode.toLowerCase() === ipoTeamName.trim().toLowerCase()
  );
  const parsedIpoLots = parseInt(ipoLots, 10) || 0;
  const ipoTotalShares = parsedIpoLots * (activeIpoListing?.lot_size || 12);
  const ipoGrossOutflow = Number((ipoTotalShares * (activeIpoListing?.issue_price || 0)).toFixed(2));
  const ipoCurrentCash = ipoApplyingTeamRecord?.currentCash ?? INITIAL_PURSE_PER_TEAM;
  const ipoPostCash = Number((ipoCurrentCash - ipoGrossOutflow).toFixed(2));
  const ipoMeetsReserveFloor = ipoPostCash >= (INITIAL_PURSE_PER_TEAM * POST_ROUND_MIN_CASH_RATIO);

  // Handle IPO Slip Submission
  const handleSettleIPOSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!ipoTeamName.trim()) {
      setFeedback({ type: 'error', message: 'APPLYING TEAM NAME IS REQUIRED ON THE PHYSICAL SLIP.' });
      return;
    }
    if (!activeIpoListing) {
      setFeedback({ type: 'error', message: 'NO ACTIVE IPO LISTING SELECTED.' });
      return;
    }
    if (parsedIpoLots <= 0) {
      setFeedback({ type: 'error', message: 'APPLIED LOTS MUST BE GREATER THAN ZERO.' });
      return;
    }
    if (ipoGrossOutflow > ipoCurrentCash) {
      setFeedback({
        type: 'error',
        message: `INSUFFICIENT FUNDS // ${ipoTeamName} HAS ₹${ipoCurrentCash.toLocaleString('en-IN')}, REQUIRED: ₹${ipoGrossOutflow.toLocaleString('en-IN')}.`
      });
      return;
    }

    setIsIpoSubmitting(true);
    try {
      const res = await fetch('/api/ipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBSCRIBE',
          ipo_id: activeIpoListing.id,
          team_id: ipoTeamName.trim(),
          lots: parsedIpoLots,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit IPO application slip.');
      }

      playSuccessChime();
      setFeedback({
        type: 'success',
        message: `✓ IPO APPLICATION REGISTERED // ${ipoTeamName} BID FOR ${parsedIpoLots} LOTS (${ipoTotalShares} SHARES) OF ${activeIpoListing.ticker} @ ₹${activeIpoListing.issue_price.toFixed(2)} (TOTAL: ₹${ipoGrossOutflow.toLocaleString('en-IN')}).`,
      });

      await fetchLedger();
      setIpoLots('5');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'IPO BID SUBMISSION FAILED.' });
    } finally {
      setIsIpoSubmitting(false);
    }
  };

  // Handle Trade Slip Submission
  const handleSettleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!buyerTeam.trim()) {
      setFeedback({ type: 'error', message: 'BUYING TEAM REQUIRED ON THE PHYSICAL SLIP.' });
      return;
    }
    if (!sellerTeam.trim()) {
      setFeedback({ type: 'error', message: 'SELLING TEAM REQUIRED ON THE PHYSICAL SLIP.' });
      return;
    }
    if (buyerTeam.trim().toLowerCase() === sellerTeam.trim().toLowerCase()) {
      setFeedback({ type: 'error', message: 'BUYER AND SELLER CANNOT BE THE SAME ENTITY.' });
      return;
    }
    if (!selectedStockId) {
      setFeedback({ type: 'error', message: 'SECURITY SPECIFICATION REQUIRED.' });
      return;
    }
    if (parsedQty <= 0) {
      setFeedback({ type: 'error', message: 'QUANTITY MUST BE GREATER THAN ZERO.' });
      return;
    }
    if (parsedPrice <= 0) {
      setFeedback({ type: 'error', message: 'AGREED PRICE MUST BE POSITIVE.' });
      return;
    }
    if (isCircuitBreached && !allowCircuitBypass) {
      setFeedback({
        type: 'error',
        message: `COLLAR BREACH: ₹${parsedPrice} EXCEEDS CIRCUIT LIMITS (LC: ₹${selectedStock?.lower_circuit?.toFixed(2)} - UC: ₹${selectedStock?.upper_circuit?.toFixed(2)}).`,
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
        message: `SLIP EXECUTED // ${parsedQty} SHARES OF ${selectedStock?.ticker} TRANSFERRED @ ₹${parsedPrice.toFixed(2)}. BROADCAST LIVE FOR 10 SECONDS.`,
      });

      if (data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        fetchLedger();
      }

      setQuantity('100');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'TRANSACTION FAILED.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick fill helper
  const selectTeamAsBuyer = (teamName: string) => {
    setBuyerTeam(teamName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const selectTeamAsSeller = (teamName: string) => {
    setSellerTeam(teamName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtered
  const filteredTeams = (snapshot?.teamsPurse || []).filter((t) => {
    const q = teamSearch.toLowerCase().trim();
    return !q || t.teamName.toLowerCase().includes(q) || t.teamCode.toLowerCase().includes(q);
  });

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

  const qualifiedCount = (snapshot?.teamsPurse || []).filter((t) => t.status === 'QUALIFIED').length;
  const eliminatedCount = (snapshot?.teamsPurse || []).filter((t) => t.status === 'ELIMINATED').length;

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#000000] font-sans antialiased selection:bg-[#0052CC] selection:text-white transition-colors duration-500 relative">

      {/* ========================================================================= */}
      {/* 2. EDITORIAL TOP TICKER & METADATA BAR */}
      {/* ========================================================================= */}
      <header className="border-b border-black/10 px-6 sm:px-12 py-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-1">
            THAPAR ECONOMICS DESK // CONSOLE 02
          </span>
          <div className="flex items-baseline gap-4">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#000000]">
              FLOOR DESK
            </h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full border border-black/10 bg-[#F8F9FA] text-[#000000] font-semibold">
              {snapshot?.currentRoundName || 'ROUND 0 // PRE-MARKET'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-[#F8F9FA]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] tracking-[0.1em] uppercase text-[#000000]">
              TELEMETRY LIVE
            </span>
          </div>

          <button
            onClick={fetchLedger}


            className="p-2 rounded-full border border-black/10 hover:border-black/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            title="Refresh Ledger"
          >
            ↻
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold tracking-tight">SHEET AUTO-SYNC ACTIVE</span>
          </div>

          <a
            href="/api/broker/export-excel"
            download


            className="px-5 py-2 rounded-full bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold text-xs uppercase tracking-[0.15em] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            EXPORT .XLSX
          </a>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. HERO TYPOGRAPHY: EDITORIAL HEADLINE WITH EXTREME WEIGHT */}
      {/* ========================================================================= */}
      <section className="px-6 sm:px-12 pt-12 pb-8 border-b border-black/10">
        <div className="max-w-[1400px] mx-auto">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-3">
            001 // TRANSACTION CLEARING &amp; COMPLIANCE
          </span>
          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.05em] leading-[0.9] text-[#000000]">
            PHYSICAL SLIP<br />
            SETTLEMENT.
          </h2>
          <p className="mt-4 text-base sm:text-lg font-normal text-[#525252] max-w-2xl leading-relaxed">
            Record physical trading slips brought by floor runners. Enforce 60% Round 0 deployment and 10% in-hand cash floor rules.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 pt-8 border-t border-black/10">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-1">
                SLIPS SETTLED
              </span>
              <span className="text-3xl font-bold tracking-tight text-[#000000]">
                {snapshot?.totalDealsSettled ?? 0}
              </span>
            </div>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-1">
                SHARES CLEARED
              </span>
              <span className="text-3xl font-bold tracking-tight text-[#000000]">
                {(snapshot?.totalVolumeShares ?? 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-1">
                GROSS VALUE
              </span>
              <span className="text-3xl font-bold tracking-tight text-[#000000]">
                ₹{(snapshot?.totalGrossConsideration ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-1">
                DESK COMM (FEE)
              </span>
              <span className="text-3xl font-bold tracking-tight text-[#0052CC]">
                ₹{(snapshot?.totalDeskCommission ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. MAIN WORKSPACE: 7-COLUMN CONTAINER WITH 2X2 INPUT CARDS GRID */}
      {/* ========================================================================= */}
      <main className="px-6 sm:px-12 py-12 max-w-[1400px] mx-auto space-y-16">
        {feedback && (
          <div
            className={`p-5 rounded-[24px] border font-mono text-xs uppercase tracking-[0.1em] flex items-center justify-between gap-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              feedback.type === 'success'
                ? 'bg-[#F8F9FA] border-black/20 text-[#000000]'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              [DISMISS]
            </button>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-black/10">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block">
                INPUT MATRIX // PHYSICAL SLIP ENTRY
              </span>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSlipMode('trade')}
                  className={`px-4 py-1.5 rounded-full font-mono text-xs uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer ${
                    slipMode === 'trade'
                      ? 'bg-[#000000] text-white font-bold shadow-sm'
                      : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000] border border-black/10'
                  }`}
                >
                  📄 Secondary Trade Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSlipMode('ipo')}
                  className={`px-4 py-1.5 rounded-full font-mono text-xs uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                    slipMode === 'ipo'
                      ? 'bg-[#0052CC] text-white font-bold shadow-sm'
                      : 'bg-[#F8F9FA] text-[#737373] hover:text-[#0052CC] border border-black/10'
                  }`}
                >
                  <span>🏛️ IPO Application Slip</span>
                  {(snapshot?.ipoListings && snapshot.ipoListings.length > 0) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                </button>
              </div>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0052CC] font-semibold">
              {slipMode === 'ipo'
                ? 'PRIMARY ALLOTMENT // 0% BROKERAGE'
                : isRound0
                ? '0% BROKERAGE // R0 EXEMPT'
                : '5% DUAL BROKERAGE'}
            </span>
          </div>

          {slipMode === 'ipo' ? (
            <form onSubmit={handleSettleIPOSlip} className="space-y-6">
              {/* 2X2 GRID FOR IPO APPLICATION SLIP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CARD 01: IPO LISTING */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                      01 // IPO LISTING
                    </span>
                    <span className="font-mono text-[11px] text-[#0052CC] font-bold">
                      {activeIpoListing?.lot_size || 12} SHARES/LOT
                    </span>
                  </div>

                  <select
                    value={ipoSelectedId}
                    onChange={(e) => { ipoSelectedIdRef.current = e.target.value; setIpoSelectedId(e.target.value); }}
                    className="w-full text-base sm:text-lg font-bold text-[#000000] bg-transparent border-b border-black/10 pb-1 outline-none cursor-pointer"
                  >
                    {(snapshot?.ipoListings || []).map((ipo) => (
                      <option key={ipo.id} value={ipo.id}>
                        {ipo.ticker} — {ipo.company_name} (₹{ipo.issue_price.toFixed(2)}/sh)
                      </option>
                    ))}
                  </select>

                  <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373] flex justify-between">
                    <span>ISSUE PRICE: ₹{activeIpoListing?.issue_price?.toFixed(2) || '0.00'}</span>
                    <span className="text-emerald-600 font-bold">0% BROKERAGE ON PRIMARY</span>
                  </div>
                </div>

                {/* CARD 02: SUBSCRIBING TEAM */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                      02 // SUBSCRIBING TEAM
                    </span>
                    {ipoApplyingTeamRecord && (
                      <span className="font-mono text-[11px] text-[#000000] font-bold">
                        CASH: ₹{(ipoApplyingTeamRecord.currentCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      list="editorial-team-list"
                      value={ipoTeamName}
                      onChange={(e) => setIpoTeamName(e.target.value)}
                      placeholder="ENTER APPLYING TEAM..."
                      className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none placeholder:text-black/20 focus:ring-0"
                      required
                    />
                  </div>

                  <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373]">
                    {ipoApplyingTeamRecord ? (
                      <span className="text-emerald-600 font-bold">
                        ✓ REGISTERED TEAM — STATUS: {ipoApplyingTeamRecord.status}
                      </span>
                    ) : (
                      <span>Select or enter registered participant team</span>
                    )}
                  </div>
                </div>

                {/* CARD 03: LOTS APPLIED */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                      03 // LOT QUANTITY
                    </span>
                    <span className="font-mono text-[11px] text-[#737373]">
                      PHYSICAL RUNNER SLIP
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={ipoLots}
                      onChange={(e) => setIpoLots(e.target.value)}
                      className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none focus:ring-0"
                      required
                    />
                    <span className="font-mono text-xs text-[#737373]">LOTS</span>
                  </div>

                  <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373] flex justify-between">
                    <span>TOTAL SHARES: {ipoTotalShares.toLocaleString('en-IN')}</span>
                    <span>1 LOT = {activeIpoListing?.lot_size || 12} SHARES</span>
                  </div>
                </div>

                {/* CARD 04: TOTAL APPLICATION OUTFLOW */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                      04 // GROSS BID OUTFLOW
                    </span>
                    <span className="font-mono text-[11px] text-emerald-600 font-bold">
                      FIXED ISSUE PRICE
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#000000]">
                      ₹{ipoGrossOutflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373] flex justify-between">
                    <span>{ipoTotalShares} SH × ₹{activeIpoListing?.issue_price?.toFixed(2) || '0.00'}</span>
                    <span className="text-emerald-600 font-bold">0% BROKERAGE</span>
                  </div>
                </div>
              </div>

              {/* LIVE IPO AUDIT VOUCHER */}
              <div className="p-6 rounded-[24px] bg-white border border-black/10 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-black/10 pb-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    FINANCIAL AUDIT // IPO BID SLIP
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#0052CC]">
                    PRIMARY SUBSCRIPTION
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-[#737373] block">TOTAL OUTFLOW</span>
                    <span className="text-base font-bold text-[#000000]">
                      ₹{ipoGrossOutflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#737373] block">CURRENT CASH</span>
                    <span className="text-base font-bold text-[#000000]">
                      ₹{ipoCurrentCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#737373] block">POST-BID CASH</span>
                    <span className={`text-base font-bold ${ipoPostCash < 0 ? 'text-rose-600' : 'text-[#000000]'}`}>
                      ₹{ipoPostCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#737373] block">10% CASH FLOOR (₹1.0L)</span>
                    <span className={`text-base font-bold ${ipoMeetsReserveFloor ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {ipoMeetsReserveFloor ? '✓ COMPLIANT' : '⚠️ BELOW FLOOR'}
                    </span>
                  </div>
                </div>
              </div>

              {/* EXECUTE IPO BUTTON */}
              <button
                type="submit"
                disabled={isIpoSubmitting}
                className="w-full py-4 rounded-[20px] bg-[#0052CC] hover:bg-[#0747A6] text-white font-mono text-sm uppercase tracking-[0.2em] font-bold shadow-lg shadow-[#0052CC]/20 transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isIpoSubmitting ? (
                  <span>RECORDING IPO APPLICATION SLIP...</span>
                ) : (
                  <>
                    <span>REGISTER IPO BID SLIP</span>
                    <span className="text-xs opacity-75 font-normal">[EXCEL + ALLOTMENT DESK]</span>
                  </>
                )}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSettleTrade} className="space-y-6">
            {/* 2X2 GRID OF INPUT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CARD 01: BUYER TEAM */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    01 // BUYING TEAM (PURCHASER)
                  </span>
                  {buyerRecord && (
                    <span className="font-mono text-[11px] text-[#000000] font-bold">
                      CASH: ₹{(buyerRecord.currentCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    list="editorial-team-list"
                    value={buyerTeam}
                    onChange={(e) => setBuyerTeam(e.target.value)}
                    placeholder="ENTER BUYER TEAM..."


                    className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none placeholder:text-black/20 focus:ring-0"
                    required
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                    BUYER
                  </span>
                </div>

                <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373]">
                  TOTAL BUDGET: ₹10,00,000 • TARGET: &ge;₹6,00,000 IN R0
                </div>
              </div>

              {/* CARD 02: SELLER TEAM */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    02 // SELLING TEAM (OR CENTRAL PRIMARY POOL)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSellerTeam('Central Primary Pool')}


                    className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0052CC] font-bold hover:underline cursor-pointer"
                  >
                    [SET PRIMARY POOL]
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    list="editorial-team-list"
                    value={sellerTeam}
                    onChange={(e) => setSellerTeam(e.target.value)}
                    placeholder="ENTER SELLER TEAM..."


                    className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none placeholder:text-black/20 focus:ring-0"
                    required
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                    SELLER
                  </span>
                </div>

                <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373]">
                  0% FEE ON CENTRAL PRIMARY POOL • 5% DUAL ON INTER-TEAM
                </div>
              </div>

              {/* CARD 03: TRADED SECURITY & PRICE */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    03 // STOCK &amp; AGREED PRICE
                  </span>
                  {selectedStock && (
                    <button
                      type="button"
                      onClick={() => setAgreedPrice(String(selectedStock.current_price))}


                      className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0052CC] font-bold hover:underline cursor-pointer"
                    >
                      [RESET LTP: ₹{selectedStock.current_price.toFixed(2)}]
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <select
                    value={selectedStockId}
                    onChange={(e) => handleStockChange(e.target.value)}


                    className="w-full text-base font-bold text-[#000000] bg-transparent border-b border-black/10 pb-1 outline-none cursor-pointer"
                  >
                    {(snapshot?.stocks || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ticker} — {s.name} [₹{s.current_price.toFixed(2)}]
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={agreedPrice}
                      onChange={(e) => setAgreedPrice(e.target.value)}
                      placeholder="AGREED PRICE"


                      className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none focus:ring-0 font-mono"
                      required
                    />
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                      INR / SHARE
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373] flex items-center justify-between">
                  <span>COLLAR: LC ₹{selectedStock?.lower_circuit?.toFixed(1)} / UC ₹{selectedStock?.upper_circuit?.toFixed(1)}</span>
                  {isCircuitBreached && (
                    <label className="text-red-600 font-bold flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowCircuitBypass}
                        onChange={(e) => setAllowCircuitBypass(e.target.checked)}
                      />
                      <span>BYPASS COLLAR</span>
                    </label>
                  )}
                </div>
              </div>

              {/* CARD 04: QUANTITY & EXECUTION */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    04 // SHARE QUANTITY (VOLUME)
                  </span>
                  <span className="font-mono text-[11px] text-[#000000] font-bold">
                    GROSS: ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="QUANTITY"


                    className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none focus:ring-0 font-mono"
                    required
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                    SHARES
                  </span>
                </div>

                <div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373] flex items-center justify-between">
                  <span>DEAL CONSIDERATION</span>
                  <span className="font-bold text-[#000000]">
                    {parsedQty} × ₹{parsedPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Datalist */}
            <datalist id="editorial-team-list">
              <option value="Central Primary Pool">🏛️ Central Primary Pool (Round 0 Unlimited Issuance)</option>
              {(snapshot?.teamsPurse || []).map((t) => (
                <option key={t.teamId} value={t.teamName}>
                  {t.teamCode} — Cash: ₹{t.currentCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </option>
              ))}
            </datalist>

            {/* EDITORIAL VOUCHER BREAKDOWN STRIP */}
            <div className="p-6 rounded-[24px] border border-black/10 bg-[#FFFFFF] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/10 font-mono text-xs">
                <div>
                  <span className="text-[#737373] uppercase tracking-[0.15em] block text-[10px]">
                    GROSS DEAL VALUE
                  </span>
                  <span className="text-xl font-bold text-[#000000]">
                    ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] uppercase tracking-[0.15em] block text-[10px]">
                    BROKERAGE (5%)
                  </span>
                  <span className="text-xl font-bold text-[#000000]">
                    {isBrokerageWaived ? '₹0.00 (WAIVED)' : `+₹${buyerBrokerage.toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] uppercase tracking-[0.15em] block text-[10px]">
                    BUYER OUTFLOW (DEBIT)
                  </span>
                  <span className="text-xl font-bold text-emerald-600">
                    ₹{totalBuyerDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] uppercase tracking-[0.15em] block text-[10px]">
                    SELLER INFLOW (CREDIT)
                  </span>
                  <span className="text-xl font-bold text-rose-600">
                    ₹{totalSellerCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] uppercase tracking-[0.15em] block text-[10px]">
                    DESK COMMISSION
                  </span>
                  <span className="text-xl font-bold text-[#0052CC]">
                    ₹{totalDeskFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Compliance Pre-Flight Status */}
              <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[#737373] uppercase tracking-[0.1em]">BUYER IN-HAND CASH:</span>
                  <span className={`font-bold ${isCashFloorBreached ? 'text-red-600' : 'text-[#000000]'}`}>
                    ₹{buyerPostTradeCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  {isCashFloorBreached && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                      [VIOLATION: &lt;₹1L FLOOR]
                    </span>
                  )}
                </div>

                {isRound0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[#737373] uppercase tracking-[0.1em]">R0 DEPLOYED:</span>
                    <span className={`font-bold ${buyerProjectedR0Percent >= 60 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {buyerProjectedR0Percent}% (TARGET: &ge;60% = ₹6,00,000)
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      buyerProjectedR0Percent >= 60 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {buyerProjectedR0Percent >= 60 ? 'PASS' : 'ELIMINATE'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* PRIMARY ACTION BUTTON IN DEEP BLUE #0052CC */}
            <button
              type="submit"
              disabled={isSubmitting}


              className="w-full py-5 rounded-[24px] bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold text-sm tracking-[0.2em] uppercase transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>EXECUTING TRANSACTION &amp; BROADCASTING...</span>
                </>
              ) : (
                <>
                  <span>APPROVE &amp; BROADCAST SLIP</span>
                  <span className="text-xs font-mono font-normal tracking-normal">[10S TELEMETRY]</span>
                </>
              )}
            </button>
          </form>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 5. MASTER EVENT SPREADSHEET LEDGER & ELIMINATION AUDIT */}
        {/* ===================================================================== */}
        <section className="space-y-6 pt-12 border-t border-black/10">
          <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/10">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block">
                002 // EVENT RECORDS
              </span>
              <h3 className="text-3xl font-bold tracking-[-0.04em] text-[#000000] mt-1">
                MASTER LEDGER.
              </h3>
            </div>

            {/* Tab Selectors */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('purses')}


                className={`px-4 py-2 rounded-full uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer ${
                  activeTab === 'purses'
                    ? 'bg-[#000000] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'
                }`}
              >
                [01] PURSES &amp; ELIMINATION
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ledger')}


                className={`px-4 py-2 rounded-full uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-[#000000] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'
                }`}
              >
                [02] TRADES ({snapshot?.tradesLedger?.length ?? 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('matrix')}


                className={`px-4 py-2 rounded-full uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-[#000000] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'
                }`}
              >
                [03] HOLDINGS MATRIX
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ipo')}
                className={`px-4 py-2 rounded-full uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'ipo'
                    ? 'bg-[#0052CC] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#0052CC]'
                }`}
              >
                <span>[04] IPO BIDS</span>
                <span className="text-[10px] opacity-75">({snapshot?.ipoSubscriptions?.length ?? 0})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: TEAM PURSES & ELIMINATION AUDIT */}
          {activeTab === 'purses' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="SEARCH TEAM OR CODE..."
                  className="py-2 px-4 rounded-full bg-[#F8F9FA] border border-black/10 text-xs text-[#000000] outline-none w-72 uppercase tracking-[0.1em]"
                />
                <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.15em] text-[#737373]">
                  <span>TOTAL: {snapshot?.teamsPurse?.length ?? 0}</span>
                  <span className="text-emerald-600 font-bold">QUALIFIED: {qualifiedCount}</span>
                  <span className="text-red-600 font-bold">ELIMINATED: {eliminatedCount}</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-black/10 rounded-[24px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                    <tr>
                      <th className="py-3 px-4">PARTICIPANT TEAM</th>
                      <th className="py-3 px-4">CURRENT CASH IN-HAND</th>
                      <th className="py-3 px-4">ROUND 0 PURCHASED</th>
                      <th className="py-3 px-4">% BUDGET USED</th>
                      <th className="py-3 px-4">60% RULE (MIN ₹6.0L)</th>
                      <th className="py-3 px-4">10% CASH FLOOR (MIN ₹1.0L)</th>
                      <th className="py-3 px-4">COMPLIANCE STATUS</th>
                      <th className="py-3 px-4">TOTAL PORTFOLIO VALUE</th>
                      <th className="py-3 px-4 text-right">QUICK SLIP FILL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-[#000000]">
                    {filteredTeams.map((tp) => {
                      const isEliminated = tp.status === 'ELIMINATED';
                      return (
                        <tr
                          key={tp.teamId}
                          className={`hover:bg-[#F8F9FA] transition-colors duration-150 ${
                            isEliminated ? 'bg-red-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-sans">
                            <div className="font-bold text-[#000000]">{tp.teamName}</div>
                            <div className="text-[10px] text-[#737373] font-mono">{tp.teamCode}</div>
                          </td>

                          <td className={`py-3 px-4 font-bold ${tp.cashMet10PercentFloor ? 'text-emerald-600' : 'text-red-600'}`}>
                            ₹{(tp.currentCash / 100000).toFixed(2)}L
                          </td>

                          <td className="py-3 px-4 text-[#000000]">
                            ₹{(tp.round0Spent / 100000).toFixed(2)}L
                          </td>

                          <td className="py-3 px-4 font-bold">
                            {tp.round0DeployedPercent}%
                          </td>

                          <td className="py-3 px-4">
                            {tp.round0Met60Percent ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                                PASS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-800 font-bold" title={`Shortfall: ₹${(tp.round0Shortfall / 100000).toFixed(2)}L`}>
                                FAIL
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {tp.cashMet10PercentFloor ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                                PASS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-800 font-bold">
                                FAIL
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isEliminated ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-red-600 text-white font-black tracking-wide">
                                ELIMINATED
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-black text-white font-black tracking-wide">
                                QUALIFIED
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-bold text-[#000000]">
                            ₹{(tp.totalNetWorth / 100000).toFixed(2)}L
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => selectTeamAsBuyer(tp.teamName)}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-black/20 hover:border-black transition"
                              >
                                +BUY
                              </button>
                              <button
                                type="button"
                                onClick={() => selectTeamAsSeller(tp.teamName)}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-black/20 hover:border-black transition"
                              >
                                +SELL
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TRADES MASTER LEDGER */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="SEARCH SLIP ID, BUYER, SELLER, TICKER..."
                className="py-2 px-4 rounded-full bg-[#F8F9FA] border border-black/10 text-xs text-[#000000] outline-none w-80 uppercase tracking-[0.1em] font-mono"
              />

              <div className="overflow-x-auto border border-black/10 rounded-[24px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                    <tr>
                      <th className="py-3 px-4">SLIP ID</th>
                      <th className="py-3 px-4">EXECUTION TIME</th>
                      <th className="py-3 px-4">BUYING TEAM</th>
                      <th className="py-3 px-4">SELLING TEAM</th>
                      <th className="py-3 px-4">STOCK (TICKER)</th>
                      <th className="py-3 px-4">SHARES (QTY)</th>
                      <th className="py-3 px-4">PRICE / SHARE (₹)</th>
                      <th className="py-3 px-4">GROSS DEAL VALUE (₹)</th>
                      <th className="py-3 px-4">5% BROKERAGE (₹)</th>
                      <th className="py-3 px-4">BUYER TOTAL PAID (₹)</th>
                      <th className="py-3 px-4">SETTLEMENT STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-[#000000]">
                    {filteredTrades.map((t) => (
                      <tr key={t.slipId} className="hover:bg-[#F8F9FA] transition">
                        <td className="py-3 px-4 font-bold text-[#0052CC]">{t.slipId}</td>
                        <td className="py-3 px-4 text-[#737373] text-[10px]">
                          {new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-bold font-sans text-emerald-700">{t.buyerTeam}</td>
                        <td className="py-3 px-4 font-bold font-sans text-rose-700">{t.sellerTeam}</td>
                        <td className="py-3 px-4 font-bold text-[#000000]">{t.ticker}</td>
                        <td className="py-3 px-4">{t.quantity}</td>
                        <td className="py-3 px-4">₹{t.price.toFixed(2)}</td>
                        <td className="py-3 px-4 font-bold text-[#000000]">
                          ₹{t.grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4 text-[#737373]">
                          {t.isRound0Exempt ? '₹0' : `₹${t.buyerBrokerage.toFixed(0)}`}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600">
                          ₹{t.buyerTotalDebit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-black text-white font-bold">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: HOLDINGS MATRIX */}
          {activeTab === 'matrix' && (
            <div className="overflow-x-auto border border-black/10 rounded-[24px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                  <tr>
                    <th className="py-3 px-4 sticky left-0 bg-[#F8F9FA] z-10">TEAM</th>
                    {(snapshot?.holdingsMatrix.stocks || []).map((s) => (
                      <th key={s.id} className="py-3 px-4 text-center">
                        <div>{s.ticker}</div>
                        <div className="text-[10px] text-[#737373]">₹{s.current_price.toFixed(1)}</div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right">TOTAL PORTFOLIO VALUE (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-[#000000]">
                  {(snapshot?.holdingsMatrix.teams || []).map((team) => (
                    <tr key={team.teamId} className="hover:bg-[#F8F9FA] transition">
                      <td className="py-3 px-4 font-sans font-bold text-[#000000] sticky left-0 bg-white z-10 border-r border-black/10">
                        {team.teamName}
                      </td>
                      {(snapshot?.holdingsMatrix.stocks || []).map((s) => {
                        const count = team.holdings[s.ticker] || 0;
                        return (
                          <td
                            key={s.id}
                            className={`py-3 px-4 text-center ${
                              count > 0 ? 'text-[#0052CC] font-bold' : 'text-slate-300'
                            }`}
                          >
                            {count > 0 ? count : '—'}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 font-bold text-[#000000] text-right">
                        ₹{(team.totalValue / 100000).toFixed(2)}L
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: IPO APPLICATIONS & ALLOTMENT STATUS */}
          {activeTab === 'ipo' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <span className="text-[#737373]">
                  PRIMARY ISSUE AUDIT // TOTAL APPLICATIONS: {snapshot?.ipoSubscriptions?.length ?? 0}
                </span>
                <span className="text-[#0052CC] font-bold">
                  AUTONOMOUS FIFO DESK // ALLOTMENT VIA ADMIN
                </span>
              </div>

              <div className="overflow-x-auto border border-black/10 rounded-[24px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                    <tr>
                      <th className="py-3 px-4">APPLICATION SLIP ID</th>
                      <th className="py-3 px-4">TIMESTAMP</th>
                      <th className="py-3 px-4">APPLYING TEAM</th>
                      <th className="py-3 px-4">IPO COMPANY &amp; TICKER</th>
                      <th className="py-3 px-4 text-center">LOTS APPLIED</th>
                      <th className="py-3 px-4 text-center">TOTAL SHARES</th>
                      <th className="py-3 px-4 text-right">GROSS BID OUTFLOW (₹)</th>
                      <th className="py-3 px-4">ALLOTMENT STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-[#000000]">
                    {(snapshot?.ipoSubscriptions || []).map((sub) => {
                      const listing = (snapshot?.ipoListings || []).find((l) => l.id === sub.ipo_id);
                      return (
                        <tr key={sub.id} className="hover:bg-[#F8F9FA] transition">
                          <td className="py-3 px-4 font-bold text-[#0052CC]">{sub.id.slice(-8).toUpperCase()}</td>
                          <td className="py-3 px-4 text-[#737373]">
                            {new Date(sub.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-sans font-bold">{sub.team_name}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold">{listing?.ticker || sub.ipo_id}</span>
                            <span className="text-[10px] text-[#737373] block">{listing?.company_name || 'Primary Offering'}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold">{sub.lots_requested}</td>
                          <td className="py-3 px-4 text-center">{sub.share_quantity}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            ₹{sub.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'ALLOTTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(!snapshot?.ipoSubscriptions || snapshot.ipoSubscriptions.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[#737373]">
                          No IPO applications placed yet. Use the IPO Application Slip entry to register bids.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
