'use client';

import React, { useState, useEffect, useRef } from 'react';
import { realtimeHub } from '@/lib/realtime-hub';
import { TradeBroadcastBanner } from '@/components/TradeBroadcastBanner';
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

  // Theme State: 'dark' (Institutional Terminal) or 'light' (Financial Paper)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wds_theme') as 'dark' | 'light';
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('wds_theme', next);
    } catch {}
  };

  const isDark = theme === 'dark';

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

  // Stock Search & Combobox State
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState<boolean>(false);
  const stockComboboxRef = useRef<HTMLDivElement>(null);

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
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLedger();
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // 1-second live countdown for broker console clock
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setSnapshot((prev) => {
        if (!prev || !prev.roundClock) return prev;
        if (prev.roundClock.is_paused || prev.roundClock.remaining_seconds <= 0) return prev;
        return {
          ...prev,
          roundClock: {
            ...prev.roundClock,
            remaining_seconds: prev.roundClock.remaining_seconds - 1,
          },
        };
      });
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Supabase Realtime Listener via Singleton Hub
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const handleLedgerRefresh = () => fetchLedger();

    unsubs.push(
      realtimeHub.onBroadcast('TRADE_EXECUTED', handleLedgerRefresh),
      realtimeHub.onBroadcast('TRADE_SAVED_TO_CLOUD', handleLedgerRefresh),
      realtimeHub.onBroadcast('BROKER_LEDGER_UPDATED', handleLedgerRefresh),
      realtimeHub.onBroadcast('TEAMS_SYNCED', handleLedgerRefresh),
      realtimeHub.onBroadcast('PORTFOLIO_UPDATED', handleLedgerRefresh),
      realtimeHub.onBroadcast('SLIP_SUBMITTED', handleLedgerRefresh),
      realtimeHub.onBroadcast('SLIP_EXECUTED', handleLedgerRefresh),
      realtimeHub.onBroadcast('STOCK_PRICE_UPDATED', handleLedgerRefresh),
      realtimeHub.onBroadcast('ROUND_ADVANCED', handleLedgerRefresh),
      realtimeHub.onBroadcast('CLOCK_UPDATED', handleLedgerRefresh),
      realtimeHub.onBroadcast('IPO_ALLOTTED', handleLedgerRefresh),
      realtimeHub.onBroadcast('IPO_STATUS_UPDATED', handleLedgerRefresh),
      realtimeHub.onBroadcast('IPO_SUBSCRIPTION_UPDATED', handleLedgerRefresh),
      realtimeHub.onBroadcast('NEWS_PUBLISHED', (payload: any) => {
        const item = payload?.news || payload?.payload?.news;
        if (item?.headline) {
          setFeedback({
            type: 'error',
            message: `🚨 BREAKING NEWS WIRE // ${item.headline.replace(/^BREAKING:\s*/i, '')}`,
          });
        }
      }),
      realtimeHub.onPostgresChange('round_clock', handleLedgerRefresh),
      realtimeHub.onPostgresChange('ipo_subscriptions', handleLedgerRefresh),
      realtimeHub.onPostgresChange('ipo_listings', handleLedgerRefresh),
      realtimeHub.onPostgresChange('order_slips', handleLedgerRefresh),
      realtimeHub.onPostgresChange('transactions', handleLedgerRefresh)
    );

    return () => {
      unsubs.forEach((u) => u());
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

  // Close stock search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stockComboboxRef.current && !stockComboboxRef.current.contains(event.target as Node)) {
        setIsStockDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered stock list for search combobox
  const filteredStocks = (snapshot?.stocks || []).filter((s) => {
    if (!stockSearchQuery.trim()) return true;
    const q = stockSearchQuery.toLowerCase().trim();
    return (
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.sector && s.sector.toLowerCase().includes(q))
    );
  });

  const handleStockSelect = (stockId: string) => {
    handleStockChange(stockId);
    setIsStockDropdownOpen(false);
    setStockSearchQuery('');
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
  const buyerBrokerage = isBrokerageWaived ? 0 : Number((grossDealValue * 0.01).toFixed(2));
  const sellerBrokerage = isBrokerageWaived ? 0 : Number((grossDealValue * 0.01).toFixed(2));
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

    // Pre-flight check 1: Buyer must have sufficient available cash
    if (buyerRecord && totalBuyerDebit > buyerCurrentCash) {
      setFeedback({
        type: 'error',
        message: `INSUFFICIENT FUNDS // ${buyerRecord.teamName} has only ₹${buyerCurrentCash.toLocaleString('en-IN')} available cash. Deal consideration requires ₹${totalBuyerDebit.toLocaleString('en-IN')}. Cannot exceed team purse.`,
      });
      return;
    }

    // Pre-flight check 2: Strict Round 0 Budget Cap (₹10,00,000 max total spend)
    if (isRound0 && buyerRecord && (buyerRecord.round0Spent + grossDealValue > 1000000)) {
      const remainingAllowance = Math.max(0, 1000000 - buyerRecord.round0Spent);
      setFeedback({
        type: 'error',
        message: `ROUND 0 PURSE EXCEEDED // ${buyerRecord.teamName} has already spent ₹${buyerRecord.round0Spent.toLocaleString('en-IN')} in Round 0. Maximum allowed purse is ₹10,00,000 (Remaining allowance: ₹${remainingAllowance.toLocaleString('en-IN')}). Order of ₹${grossDealValue.toLocaleString('en-IN')} is not permitted.`,
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
    <div className={`min-h-screen font-sans antialiased selection:bg-[#0052CC] selection:text-white transition-colors duration-300 relative ${
      isDark ? 'bg-[#080d0a] text-[#e2e8e3]' : 'bg-[#FFFFFF] text-[#000000]'
    }`}>

      {/* ========================================================================= */}
      {/* 2. EDITORIAL TOP TICKER & METADATA BAR */}
      {/* ========================================================================= */}
      <header className={`px-6 sm:px-12 py-6 flex flex-wrap items-center justify-between gap-6 border-b transition-colors ${
        isDark ? 'border-[#1b261f] bg-[#0b110e]/95' : 'border-black/10 bg-white'
      }`}>
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block mb-1">
            THAPAR ECONOMICS DESK // CONSOLE 02
          </span>
          <div className="flex items-baseline gap-4">
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-[#000000]'
            }`}>
              FLOOR DESK
            </h1>
            <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
              isDark
                ? 'border-[#233327] bg-[#121c15] text-emerald-300'
                : 'border-black/10 bg-[#F8F9FA] text-[#000000]'
            }`}>
              {snapshot?.currentRoundName || 'ROUND 0 // PRE-MARKET'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 font-mono text-xs">
          {snapshot?.roundClock && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono font-bold text-xs ${
              isDark
                ? snapshot.roundClock.is_paused
                  ? 'border-amber-700/60 bg-amber-950/50 text-amber-300'
                  : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-300'
                : snapshot.roundClock.is_paused
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900'
            }`}>
              <span>⏱️</span>
              <span>
                {Math.floor(snapshot.roundClock.remaining_seconds / 60)}:
                {(snapshot.roundClock.remaining_seconds % 60).toString().padStart(2, '0')}
              </span>
              {snapshot.roundClock.is_paused && (
                <span className="text-[10px] uppercase font-semibold text-amber-500">(PAUSED)</span>
              )}
            </div>
          )}

          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
            isDark
              ? 'border-[#233327] bg-[#121c15] text-[#e2e8e3]'
              : 'border-black/10 bg-[#F8F9FA] text-[#000000]'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className={`text-[11px] tracking-[0.1em] uppercase ${isDark ? 'text-zinc-200' : 'text-[#000000]'}`}>
              TELEMETRY LIVE
            </span>
          </div>

          <button
            onClick={fetchLedger}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
              isDark
                ? 'border-[#233327] text-zinc-300 hover:border-emerald-500 hover:text-white bg-[#121c15]'
                : 'border-black/10 hover:border-black/30'
            }`}
            title="Refresh Ledger"
          >
            ↻
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3.5 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all duration-300 cursor-pointer ${
              isDark
                ? 'bg-[#16221a] text-emerald-300 border-[#2a3d2e] hover:bg-[#1e2f24]'
                : 'bg-[#F8F9FA] text-[#000000] border-black/10 hover:border-black/30'
            }`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span className="font-bold uppercase tracking-wider">{isDark ? 'LIGHT' : 'DARK'}</span>
          </button>

          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono ${
            isDark
              ? 'bg-[#152219] border-emerald-800 text-emerald-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
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

      {/* 10-Second Real-Time Trade Broadcast Banner */}
      <TradeBroadcastBanner />

      {/* ========================================================================= */}
      {/* 3. STREAMLINED METRICS BAR (LESS ELEMENTS // ULTRA-FOCUSED FLOOR CONSOLE) */}
      {/* ========================================================================= */}
      <section className={`px-6 sm:px-12 py-5 border-b transition-colors ${
        isDark ? 'border-[#1b261f] bg-[#090e0b]' : 'border-black/10 bg-[#FAFAFA]'
      }`}>
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className={`font-mono text-[11px] uppercase tracking-[0.2em] block mb-1 ${
                isDark ? 'text-zinc-500' : 'text-[#737373]'
              }`}>
                SLIPS SETTLED
              </span>
              <span className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                {snapshot?.totalDealsSettled ?? 0}
              </span>
            </div>
            <div>
              <span className={`font-mono text-[11px] uppercase tracking-[0.2em] block mb-1 ${
                isDark ? 'text-zinc-500' : 'text-[#737373]'
              }`}>
                SHARES CLEARED
              </span>
              <span className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                {(snapshot?.totalVolumeShares ?? 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className={`font-mono text-[11px] uppercase tracking-[0.2em] block mb-1 ${
                isDark ? 'text-zinc-500' : 'text-[#737373]'
              }`}>
                GROSS VALUE
              </span>
              <span className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                ₹{(snapshot?.totalGrossConsideration ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div>
              <span className={`font-mono text-[11px] uppercase tracking-[0.2em] block mb-1 ${
                isDark ? 'text-zinc-500' : 'text-[#737373]'
              }`}>
                DESK COMM (FEE)
              </span>
              <span className={`text-3xl font-bold tracking-tight ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>
                ₹{(snapshot?.totalDeskCommission ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. MAIN WORKSPACE: 7-COLUMN CONTAINER WITH 2X2 INPUT CARDS GRID */}
      {/* ========================================================================= */}
      <main className="px-6 sm:px-12 py-8 max-w-[1400px] mx-auto space-y-12">
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
          <div className={`flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b ${
            isDark ? 'border-[#1b261f]' : 'border-black/10'
          }`}>
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
                      ? isDark
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'bg-[#000000] text-white font-bold shadow-sm'
                      : isDark
                      ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
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
                      : isDark
                      ? 'bg-[#101712] text-zinc-400 hover:text-blue-400 border border-[#1e2b20]'
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
                : '1% DUAL BROKERAGE'}
            </span>
          </div>

          {slipMode === 'ipo' ? (
            <form onSubmit={handleSettleIPOSlip} className="space-y-6">
              {/* 2X2 GRID FOR IPO APPLICATION SLIP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CARD 01: IPO LISTING */}
                <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                      01 // IPO LISTING
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>
                      {activeIpoListing?.lot_size || 12} SHARES/LOT
                    </span>
                  </div>

                  <select
                    value={ipoSelectedId}
                    onChange={(e) => { ipoSelectedIdRef.current = e.target.value; setIpoSelectedId(e.target.value); }}
                    className={`w-full text-base sm:text-lg font-bold pb-1 outline-none cursor-pointer border-b ${
                      isDark
                        ? 'text-white bg-[#0d1410] border-zinc-700 focus:border-emerald-500'
                        : 'text-[#000000] bg-transparent border-black/10'
                    }`}
                  >
                    {(snapshot?.ipoListings || []).map((ipo) => (
                      <option key={ipo.id} value={ipo.id} className={isDark ? 'bg-[#101712] text-white' : 'bg-white text-black'}>
                        {ipo.ticker} — {ipo.company_name} (₹{ipo.issue_price.toFixed(2)}/sh)
                      </option>
                    ))}
                  </select>

                  <div className={`pt-2 border-t text-[11px] font-mono flex justify-between ${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }`}>
                    <span>ISSUE PRICE: ₹{activeIpoListing?.issue_price?.toFixed(2) || '0.00'}</span>
                    <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>0% BROKERAGE ON PRIMARY</span>
                  </div>
                </div>

                {/* CARD 02: SUBSCRIBING TEAM */}
                <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                      02 // SUBSCRIBING TEAM
                    </span>
                    {ipoApplyingTeamRecord && (
                      <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
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
                      className={`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 ${
                        isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                      }`}
                      required
                    />
                  </div>

                  <div className={`pt-2 border-t text-[11px] font-mono ${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }`}>
                    {ipoApplyingTeamRecord ? (
                      <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        ✓ REGISTERED TEAM — STATUS: {ipoApplyingTeamRecord.status}
                      </span>
                    ) : (
                      <span>Select or enter registered participant team</span>
                    )}
                  </div>
                </div>

                {/* CARD 03: LOTS APPLIED */}
                <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                      03 // LOT QUANTITY
                    </span>
                    <span className={`font-mono text-[11px] ${isDark ? 'text-zinc-500' : 'text-[#737373]'}`}>
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
                      className={`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 ${
                        isDark ? 'text-white' : 'text-[#000000]'
                      }`}
                      required
                    />
                    <span className={`font-mono text-xs ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>LOTS</span>
                  </div>

                  <div className={`pt-2 border-t text-[11px] font-mono flex justify-between ${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }`}>
                    <span>TOTAL SHARES: {ipoTotalShares.toLocaleString('en-IN')}</span>
                    <span>1 LOT = {activeIpoListing?.lot_size || 12} SHARES</span>
                  </div>
                </div>

                {/* CARD 04: TOTAL APPLICATION OUTFLOW */}
                <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                      04 // GROSS BID OUTFLOW
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      FIXED ISSUE PRICE
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                      ₹{ipoGrossOutflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className={`pt-2 border-t text-[11px] font-mono flex justify-between ${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }`}>
                    <span>{ipoTotalShares} SH × ₹{activeIpoListing?.issue_price?.toFixed(2) || '0.00'}</span>
                    <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>0% BROKERAGE</span>
                  </div>
                </div>
              </div>

              {/* LIVE IPO AUDIT VOUCHER */}
              <div className={`p-6 rounded-[24px] border space-y-4 ${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-white border-black/10 shadow-sm'
              }`}>
                <div className={`flex items-center justify-between border-b pb-3 ${
                  isDark ? 'border-[#1b271e]' : 'border-black/10'
                }`}>
                  <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    FINANCIAL AUDIT // IPO BID SLIP
                  </span>
                  <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>
                    PRIMARY SUBSCRIPTION
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                  <div>
                    <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>TOTAL OUTFLOW</span>
                    <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                      ₹{ipoGrossOutflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>CURRENT CASH</span>
                    <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                      ₹{ipoCurrentCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>POST-BID CASH</span>
                    <span className={`text-base font-bold ${ipoPostCash < 0 ? 'text-rose-500' : isDark ? 'text-white' : 'text-[#000000]'}`}>
                      ₹{ipoPostCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>10% CASH FLOOR (₹1.0L)</span>
                    <span className={`text-base font-bold ${
                      ipoMeetsReserveFloor
                        ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                        : isDark ? 'text-amber-400' : 'text-amber-600'
                    }`}>
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
              <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    01 // BUYING TEAM (PURCHASER)
                  </span>
                  {buyerRecord && (
                    <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
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


                    className={`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 ${
                      isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                    }`}
                    required
                  />
                  <span className={`font-mono text-[11px] uppercase tracking-[0.2em] shrink-0 ${
                    isDark ? 'text-zinc-500' : 'text-[#737373]'
                  }`}>
                    BUYER
                  </span>
                </div>

                <div className={`pt-2 border-t text-[11px] font-mono flex items-center justify-between ${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }`}>
                  <span>
                    {isRound0
                      ? `R0 SPENT: ₹${(buyerRecord?.round0Spent || 0).toLocaleString('en-IN')} / ₹10,00,000`
                      : 'PURSE: ₹10,00,000'}
                  </span>
                  {isRound0 && buyerRecord && (
                    <span className={buyerRecord.round0Spent + grossDealValue > 1000000 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                      {buyerRecord.round0Spent + grossDealValue > 1000000
                        ? '⚠️ EXCEEDS 10L MAX'
                        : `REM: ₹${Math.max(0, 1000000 - buyerRecord.round0Spent).toLocaleString('en-IN')}`}
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 02: SELLER TEAM */}
              <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">
                    02 // SELLING TEAM (OR CENTRAL PRIMARY POOL)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSellerTeam('Central Primary Pool')}


                    className={`font-mono text-[11px] uppercase tracking-[0.1em] font-bold hover:underline cursor-pointer ${
                      isDark ? 'text-blue-400' : 'text-[#0052CC]'
                    }`}
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


                    className={`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 ${
                      isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                    }`}
                    required
                  />
                  <span className={`font-mono text-[11px] uppercase tracking-[0.2em] shrink-0 ${
                    isDark ? 'text-zinc-500' : 'text-[#737373]'
                  }`}>
                    SELLER
                  </span>
                </div>

                <div className={`pt-2 border-t text-[11px] font-mono ${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }`}>
                  0% FEE ON CENTRAL PRIMARY POOL • 1% DUAL ON INTER-TEAM
                </div>
              </div>

              {/* CARD 03: TRADED SECURITY & PRICE */}
              <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }`}>
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

                <div className="space-y-3 relative" ref={stockComboboxRef}>
                  {/* SEARCHABLE COMBOBOX INPUT */}
                  <div className="relative">
                    <div className={`flex items-center gap-2 border-b-2 transition-colors pb-1 ${
                        isDark ? 'border-[#233327] focus-within:border-emerald-500' : 'border-black/20 focus-within:border-[#0052CC]'
                      }`}>
                      <span className="text-black/40 text-sm">🔍</span>
                      <input
                        type="text"
                        value={stockSearchQuery}
                        onChange={(e) => {
                          setStockSearchQuery(e.target.value);
                          setIsStockDropdownOpen(true);
                        }}
                        onFocus={() => setIsStockDropdownOpen(true)}
                        placeholder={
                          selectedStock
                            ? `${selectedStock.ticker} — ${selectedStock.name} (Type to search...)`
                            : "Search 78 stocks by ticker, company, or sector..."
                        }
                        className={`w-full text-base font-bold bg-transparent outline-none placeholder:font-normal ${
                          isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/35'
                        }`}
                      />
                      {stockSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setStockSearchQuery('')}
                          className="text-xs text-black/40 hover:text-black px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsStockDropdownOpen(!isStockDropdownOpen)}
                        className="text-xs font-mono text-black/50 hover:text-black shrink-0 px-1 cursor-pointer"
                        title="Toggle stock list"
                      >
                        {isStockDropdownOpen ? '▲' : '▼'}
                      </button>
                    </div>

                    {/* SELECTED STOCK BADGE */}
                    {selectedStock && (
                      <div className={`mt-1.5 flex items-center justify-between text-xs font-mono px-2.5 py-1.5 rounded-xl border shadow-xs ${
                        isDark ? 'bg-[#152219] border-[#1e2c21] text-white' : 'bg-white border-black/10 text-black'
                      }`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className={`font-bold px-2 py-0.5 rounded text-[11px] shrink-0 ${
                            isDark ? 'bg-zinc-800 text-white' : 'bg-black/5 text-black'
                          }`}>
                            {selectedStock.ticker}
                          </span>
                          <span className={`truncate font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                            {selectedStock.name}
                          </span>
                        </div>
                        <span className={`font-bold shrink-0 ml-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          LTP: ₹{selectedStock.current_price.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* FLOATING DROPDOWN LIST */}
                    {isStockDropdownOpen && (
                      <div className={`absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border shadow-2xl overflow-hidden max-h-72 flex flex-col ${
                        isDark ? 'bg-[#0d1410] border-[#1e2c21] shadow-black/80' : 'bg-white border-black/15'
                      }`}>
                        <div className={`px-3.5 py-2 border-b text-[10px] font-mono uppercase flex items-center justify-between ${
                          isDark ? 'bg-[#101712] border-[#1e2c21] text-zinc-400' : 'bg-gray-50 border-black/5 text-gray-500'
                        }`}>
                          <span>Security Master Universe ({filteredStocks.length} matching)</span>
                          <span className="text-[9px] text-[#0052CC] font-bold">Click to select</span>
                        </div>
                        <div className={`overflow-y-auto divide-y flex-1 ${
                          isDark ? 'divide-[#18231c]' : 'divide-gray-100'
                        }`}>
                          {filteredStocks.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-500 font-mono">
                              No stocks match &quot;{stockSearchQuery}&quot;.
                            </div>
                          ) : (
                            filteredStocks.map((s) => {
                              const isSelected = s.id === selectedStockId;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleStockSelect(s.id)}
                                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? isDark ? 'bg-[#152219] border-l-4 border-emerald-500' : 'bg-blue-50/90 border-l-4 border-blue-600'
                                      : isDark ? 'hover:bg-[#152219]' : 'hover:bg-blue-50/80'
                                  }`}
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-mono font-bold text-xs shrink-0 ${isDark ? 'text-white' : 'text-black'}`}>
                                        {s.ticker}
                                      </span>
                                      <span className={`text-xs font-medium truncate ${isDark ? 'text-zinc-300' : 'text-gray-800'}`}>
                                        {s.name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-mono truncate">
                                      {s.sector || 'Equities'} • LC ₹{s.lower_circuit?.toFixed(1)} / UC ₹{s.upper_circuit?.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-mono font-bold text-xs text-emerald-700">
                                      ₹{s.current_price.toFixed(2)}
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={agreedPrice}
                      onChange={(e) => setAgreedPrice(e.target.value)}
                      placeholder="AGREED PRICE"


                      className={`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 font-mono ${
                        isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                      }`}
                      required
                    />
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                      INR / SHARE
                    </span>
                  </div>
                </div>

                <div className={`pt-2 border-t text-[11px] font-mono flex items-center justify-between ${
                  isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                }`}>
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
              <div className={`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 ${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    04 // SHARE QUANTITY (VOLUME)
                  </span>
                  <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
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


                    className={`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 font-mono ${
                      isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                    }`}
                    required
                  />
                  <span className={`font-mono text-[11px] uppercase tracking-[0.2em] shrink-0 ${
                    isDark ? 'text-zinc-500' : 'text-[#737373]'
                  }`}>
                    SHARES
                  </span>
                </div>

                <div className={`pt-2 border-t text-[11px] font-mono flex items-center justify-between ${
                  isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                }`}>
                  <span>DEAL CONSIDERATION</span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                    {parsedQty} × ₹{parsedPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Datalist */}
            <datalist id="editorial-team-list">
              <option value="Central Primary Pool">🏛️ Central Primary Pool (Round 0 Unlimited Issuance)</option>
              {(snapshot?.teamsPurse || [])
                .filter((t) => t.teamName !== 'Central Primary Pool')
                .map((t) => (
                  <option key={t.teamId} value={t.teamName}>
                    {t.teamCode} — Cash: ₹{t.currentCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </option>
                ))}
            </datalist>

            {/* EDITORIAL VOUCHER BREAKDOWN STRIP */}
            <div className={`p-6 rounded-[24px] border space-y-4 ${
              isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#FFFFFF] border-black/10'
            }`}>
              <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b font-mono text-xs ${
                isDark ? 'border-[#1b271e]' : 'border-black/10'
              }`}>
                <div>
                  <span className={`uppercase tracking-[0.15em] block text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    GROSS DEAL VALUE
                  </span>
                  <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                    ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className={`uppercase tracking-[0.15em] block text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    BROKERAGE (1%)
                  </span>
                  <span className={`text-xl font-bold ${isDark ? 'text-emerald-400' : 'text-[#000000]'}`}>
                    {isBrokerageWaived ? '₹0.00 (WAIVED)' : `+₹${buyerBrokerage.toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div>
                  <span className={`uppercase tracking-[0.15em] block text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    BUYER OUTFLOW (DEBIT)
                  </span>
                  <span className="text-xl font-bold text-emerald-500">
                    ₹{totalBuyerDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className={`uppercase tracking-[0.15em] block text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    SELLER INFLOW (CREDIT)
                  </span>
                  <span className="text-xl font-bold text-rose-500">
                    ₹{totalSellerCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className={`uppercase tracking-[0.15em] block text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                    DESK COMMISSION
                  </span>
                  <span className={`text-xl font-bold ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>
                    ₹{totalDeskFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Compliance Pre-Flight Status */}
              <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs pt-1">
                <div className="flex items-center gap-3">
                  <span className={`uppercase tracking-[0.1em] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>BUYER IN-HAND CASH:</span>
                  <span className={`font-bold ${isCashFloorBreached ? 'text-rose-500' : isDark ? 'text-white' : 'text-[#000000]'}`}>
                    ₹{buyerPostTradeCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  {isCashFloorBreached && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isDark ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-red-100 text-red-800'
                    }`}>
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
        <section className={`space-y-6 pt-12 border-t ${isDark ? 'border-[#1b261f]' : 'border-black/10'}`}>
          <div className={`flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b ${isDark ? 'border-[#1b261f]' : 'border-black/10'}`}>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] block">
                002 // EVENT RECORDS
              </span>
              <h3 className={`text-3xl font-bold tracking-[-0.04em] mt-1 ${isDark ? 'text-white' : 'text-[#000000]'}`}>
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
                    ? isDark
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#000000] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
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
                    ? isDark
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#000000] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
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
                    ? isDark
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#000000] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
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
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-blue-400 border border-[#1e2b20]'
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
                  className={`py-2 px-4 rounded-full border text-xs outline-none w-72 uppercase tracking-[0.1em] ${
                    isDark
                      ? 'bg-[#101712] border-[#1e2c21] text-white placeholder:text-zinc-600'
                      : 'bg-[#F8F9FA] border-black/10 text-[#000000]'
                  }`}
                />
                <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.15em] text-[#737373]">
                  <span>TOTAL: {snapshot?.teamsPurse?.length ?? 0}</span>
                  <span className="text-emerald-600 font-bold">QUALIFIED: {qualifiedCount}</span>
                  <span className="text-red-600 font-bold">ELIMINATED: {eliminatedCount}</span>
                </div>
              </div>

              <div className={`overflow-x-auto border rounded-[24px] ${
                isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
              }`}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className={`text-[11px] uppercase tracking-[0.2em] border-b ${
                    isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                  }`}>
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
                  <tbody className={`divide-y ${
                    isDark ? 'divide-[#18231c] text-zinc-200' : 'divide-black/5 text-[#000000]'
                  }`}>
                    {filteredTeams.map((tp) => {
                      const isEliminated = tp.status === 'ELIMINATED';
                      return (
                        <tr
                          key={tp.teamId}
                          className={`transition-colors duration-150 ${
                            isEliminated
                              ? isDark ? 'bg-rose-950/30 hover:bg-rose-950/50' : 'bg-red-50/40 hover:bg-red-50/70'
                              : isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'
                          }`}
                        >
                          <td className="py-3 px-4 font-sans">
                            <div className={`font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>{tp.teamName}</div>
                            <div className="text-[10px] text-[#737373] font-mono">{tp.teamCode}</div>
                          </td>

                          <td className={`py-3 px-4 font-bold ${tp.cashMet10PercentFloor ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-red-600')}`}>
                            ₹{(tp.currentCash / 100000).toFixed(2)}L
                          </td>

                          <td className={`py-3 px-4 ${isDark ? 'text-zinc-300' : 'text-[#000000]'}`}>
                            ₹{(tp.round0Spent / 100000).toFixed(2)}L
                          </td>

                          <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                            {tp.round0DeployedPercent}%
                          </td>

                          <td className="py-3 px-4">
                            {tp.round0Met60Percent ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDark ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                PASS
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDark ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-red-100 text-red-800'
                              }`} title={`Shortfall: ₹${(tp.round0Shortfall / 100000).toFixed(2)}L`}>
                                FAIL
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {tp.cashMet10PercentFloor ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isDark ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                PASS
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDark ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-red-100 text-red-800'
                              }`}>
                                FAIL
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isEliminated ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-black tracking-wide">
                                ELIMINATED
                              </span>
                            ) : (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                                isDark ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'bg-black text-white'
                              }`}>
                                QUALIFIED
                              </span>
                            )}
                          </td>

                          <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                            ₹{(tp.totalNetWorth / 100000).toFixed(2)}L
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => selectTeamAsBuyer(tp.teamName)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                                  isDark ? 'border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500' : 'border-black/20 hover:border-black'
                                }`}
                              >
                                +BUY
                              </button>
                              <button
                                type="button"
                                onClick={() => selectTeamAsSeller(tp.teamName)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                                  isDark ? 'border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500' : 'border-black/20 hover:border-black'
                                }`}
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
                className={`py-2 px-4 rounded-full border text-xs outline-none w-80 uppercase tracking-[0.1em] font-mono ${
                  isDark
                    ? 'bg-[#101712] border-[#1e2c21] text-white placeholder:text-zinc-600'
                    : 'bg-[#F8F9FA] border-black/10 text-[#000000]'
                }`}
              />

              <div className={`overflow-x-auto border rounded-[24px] ${
                isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
              }`}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className={`text-[11px] uppercase tracking-[0.2em] border-b ${
                    isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                  }`}>
                    <tr>
                      <th className="py-3 px-4">SLIP ID</th>
                      <th className="py-3 px-4">EXECUTION TIME</th>
                      <th className="py-3 px-4">BUYING TEAM</th>
                      <th className="py-3 px-4">SELLING TEAM</th>
                      <th className="py-3 px-4">STOCK (TICKER)</th>
                      <th className="py-3 px-4">SHARES (QTY)</th>
                      <th className="py-3 px-4">PRICE / SHARE (₹)</th>
                      <th className="py-3 px-4">GROSS DEAL VALUE (₹)</th>
                      <th className="py-3 px-4">1% BROKERAGE (₹)</th>
                      <th className="py-3 px-4">BUYER TOTAL PAID (₹)</th>
                      <th className="py-3 px-4">SETTLEMENT STATUS</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1e2c21] text-zinc-200' : 'divide-black/5 text-[#000000]'}`}>
                    {filteredTrades.map((t) => (
                      <tr key={t.slipId} className={`transition ${isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'}`}>
                        <td className={`py-3 px-4 font-bold ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>{t.slipId}</td>
                        <td className={`py-3 px-4 text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                          {new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className={`py-3 px-4 font-bold font-sans ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{t.buyerTeam}</td>
                        <td className={`py-3 px-4 font-bold font-sans ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>{t.sellerTeam}</td>
                        <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>{t.ticker}</td>
                        <td className={`py-3 px-4 ${isDark ? 'text-zinc-300' : ''}`}>{t.quantity}</td>
                        <td className={`py-3 px-4 ${isDark ? 'text-zinc-300' : ''}`}>₹{t.price.toFixed(2)}</td>
                        <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                          ₹{t.grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`py-3 px-4 ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                          {t.isRound0Exempt ? '₹0' : `₹${t.buyerBrokerage.toFixed(0)}`}
                        </td>
                        <td className={`py-3 px-4 font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          ₹{t.buyerTotalDebit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDark ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'bg-black text-white'
                          }`}>
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
            <div className={`overflow-x-auto border rounded-[24px] ${
              isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
            }`}>
              <table className="w-full text-left text-xs font-mono">
                <thead className={`text-[11px] uppercase tracking-[0.2em] border-b ${
                  isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                }`}>
                  <tr>
                    <th className={`py-3 px-4 sticky left-0 z-10 ${isDark ? 'bg-[#101712]' : 'bg-[#F8F9FA]'}`}>TEAM</th>
                    {(snapshot?.holdingsMatrix.stocks || []).map((s) => (
                      <th key={s.id} className="py-3 px-4 text-center">
                        <div>{s.ticker}</div>
                        <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>₹{s.current_price.toFixed(1)}</div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right">TOTAL PORTFOLIO VALUE (₹)</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#1e2c21] text-zinc-200' : 'divide-black/5 text-[#000000]'}`}>
                  {(snapshot?.holdingsMatrix.teams || []).map((team) => (
                    <tr key={team.teamId} className={`transition ${isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'}`}>
                      <td className={`py-3 px-4 font-sans font-bold sticky left-0 z-10 border-r ${
                        isDark ? 'bg-[#0d1410] text-white border-[#1e2c21]' : 'bg-white text-[#000000] border-black/10'
                      }`}>
                        {team.teamName}
                      </td>
                      {(snapshot?.holdingsMatrix.stocks || []).map((s) => {
                        const count = team.holdings[s.ticker] || 0;
                        return (
                          <td
                            key={s.id}
                            className={`py-3 px-4 text-center ${
                              count > 0 ? (isDark ? 'text-blue-400 font-bold' : 'text-[#0052CC] font-bold') : (isDark ? 'text-zinc-700' : 'text-slate-300')
                            }`}
                          >
                            {count > 0 ? count : '—'}
                          </td>
                        );
                      })}
                      <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#000000]'} text-right`}>
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
                <span className={isDark ? 'text-zinc-400' : 'text-[#737373]'}>
                  PRIMARY ISSUE AUDIT // TOTAL APPLICATIONS: {snapshot?.ipoSubscriptions?.length ?? 0}
                </span>
                <span className={`font-bold ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>
                  AUTONOMOUS FIFO DESK // ALLOTMENT VIA ADMIN
                </span>
              </div>

              <div className={`overflow-x-auto border rounded-[24px] ${
                isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
              }`}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className={`text-[11px] uppercase tracking-[0.2em] border-b ${
                    isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                  }`}>
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
                  <tbody className={`divide-y ${isDark ? 'divide-[#1e2c21] text-zinc-200' : 'divide-black/5 text-[#000000]'}`}>
                    {(snapshot?.ipoSubscriptions || []).map((sub) => {
                      const listing = (snapshot?.ipoListings || []).find((l) => l.id === sub.ipo_id);
                      return (
                        <tr key={sub.id} className={`transition ${isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'}`}>
                          <td className={`py-3 px-4 font-bold ${isDark ? 'text-blue-400' : 'text-[#0052CC]'}`}>{sub.id.slice(-8).toUpperCase()}</td>
                          <td className={`py-3 px-4 ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>
                            {new Date(sub.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className={`py-3 px-4 font-sans font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>{sub.team_name}</td>
                          <td className="py-3 px-4">
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>{listing?.ticker || sub.ipo_id}</span>
                            <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-[#737373]'}`}>{listing?.company_name || 'Primary Offering'}</span>
                          </td>
                          <td className={`py-3 px-4 text-center font-bold ${isDark ? 'text-white' : 'text-[#000000]'}`}>{sub.lots_requested}</td>
                          <td className={`py-3 px-4 text-center ${isDark ? 'text-zinc-300' : 'text-[#000000]'}`}>{sub.share_quantity}</td>
                          <td className={`py-3 px-4 text-right font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            ₹{sub.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'ALLOTTED'
                                ? isDark ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                                : isDark ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-amber-100 text-amber-900'
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
