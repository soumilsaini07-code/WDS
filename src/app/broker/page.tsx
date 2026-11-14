'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import {
  FileText,
  DollarSign,
  Layers,
  Download,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Building,
  Hash,
  Coins,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import {
  BrokerLedgerSnapshot,
  INITIAL_PURSE_PER_TEAM,
  ROUND_0_MIN_DEPLOYMENT_RATIO,
  POST_ROUND_MIN_CASH_RATIO,
} from '@/lib/broker-types';

export default function CorporateBrokerDeskPage() {
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

  // Search
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Toast Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Play subtle audio chime for settled trades
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
    setSelectedStockId(stockId);
    const stock = (snapshot?.stocks || []).find((s) => s.id === stockId);
    if (stock) {
      setAgreedPrice(String(stock.current_price));
    }
  };

  // Calculation Metrics
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
  const targetR0Amount = INITIAL_PURSE_PER_TEAM * ROUND_0_MIN_DEPLOYMENT_RATIO;
  const minCashFloor = INITIAL_PURSE_PER_TEAM * POST_ROUND_MIN_CASH_RATIO;
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
      setFeedback({ type: 'error', message: 'Buyer and Seller team cannot be the same!' });
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
        message: `Slip Approved! ${parsedQty} shares of ${selectedStock?.ticker} settled between "${buyerTeam}" & "${sellerTeam}" @ ₹${parsedPrice.toFixed(2)}. Broadcast to all participant screens!`,
      });

      if (data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        fetchLedger();
      }

      setQuantity('100');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error executing trade.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick fill helper from table
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

  // Quick Stats for Secondary Digest
  const qualifiedCount = (snapshot?.teamsPurse || []).filter((t) => t.round0Met60Percent).length;
  const atRiskCount = (snapshot?.teamsPurse || []).filter((t) => !t.round0Met60Percent).length;
  const lowCashCount = (snapshot?.teamsPurse || []).filter((t) => !t.cashMet10PercentFloor).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans flex antialiased selection:bg-red-500/20 selection:text-red-600">
      {/* ========================================================================= */}
      {/* 1. FIXED 256PX SIDEBAR NAVIGATION (WHITE / SLATE-200 / RED-500) */}
      {/* ========================================================================= */}
      <aside className="w-64 fixed inset-y-0 left-0 bg-[#FFFFFF] border-r border-[#E2E8F0] z-40 flex flex-col justify-between">
        {/* Top: Brand Logo */}
        <div>
          <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#EF4444] flex items-center justify-center text-white shadow-xs">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#0F172A] leading-tight tracking-tight">
                Floor Desk
              </h2>
              <span className="text-xs text-[#64748B] font-medium block">
                Slip Settlement Portal
              </span>
            </div>
          </div>

          {/* Navigation List */}
          <nav className="p-4 space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('purses')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer ${
                activeTab === 'purses'
                  ? 'bg-[#F1F5F9] text-[#EF4444] border-r-4 border-[#EF4444]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Team Purses &amp; Elimination</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-[#F1F5F9] text-[#EF4444] border-r-4 border-[#EF4444]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Trades Master Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-[#F1F5F9] text-[#EF4444] border-r-4 border-[#EF4444]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Stock Holdings Matrix</span>
            </button>

            <div className="pt-4 border-t border-[#E2E8F0]/70 mt-4">
              <a
                href="/api/broker/export-excel"
                download
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel (.xlsx)</span>
              </a>
            </div>
          </nav>
        </div>

        {/* Bottom: Desk Operator Profile Card */}
        <div className="p-4 border-t border-[#E2E8F0] m-4 rounded-[16px] bg-[#F8FAFC] border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs">
            FD
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[#0F172A] truncate">Floor Desk Officer</h4>
            <p className="text-[11px] text-[#64748B] truncate">Event Organizing Team</p>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. FLUID MAIN CONTENT AREA (MARGIN-LEFT: 256PX) */}
      {/* ========================================================================= */}
      <div className="ml-64 flex-1 flex flex-col min-w-0">
        {/* Header Section (Top Row with 32px padding-bottom) */}
        <header className="px-8 pt-8 pb-6 bg-[#FFFFFF] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Slip Settlement &amp; Live Ledger
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Record paper slips, apply automated 5% brokerage, and monitor team budget compliance in real time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Pulse Badge */}
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Realtime Broadcast Active</span>
            </div>

            {/* Current Round Indicator */}
            <div className="px-3 py-1.5 rounded-[12px] bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold font-mono text-[#0F172A]">
              {snapshot?.currentRoundName || 'ROUND 0'}
            </div>

            <button
              onClick={fetchLedger}
              className="p-2 rounded-[12px] bg-[#FFFFFF] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition"
              title="Refresh Live Ledger"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <a
              href="/api/broker/export-excel"
              download
              className="px-4 py-2 rounded-[12px] bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel</span>
            </a>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="p-8 space-y-8">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-[16px] border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs px-2 py-1 rounded-[8px] bg-black/5 hover:bg-black/10 transition"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ===================================================================== */}
          {/* 3. STATISTICS GRID (4-COLUMN RESPONSIVE WITH 24PX GAPS) */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Stat Card 1: Slips Settled */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-6 rounded-[16px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-[12px] bg-red-500/10 flex items-center justify-center text-[#EF4444]">
                  <FileText className="w-5 h-5 text-[#EF4444]" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  +100% Floor
                </span>
              </div>
              <div className="mt-4">
                <span className="text-sm text-[#64748B] block font-medium">Slips Settled</span>
                <span className="text-2xl font-bold text-[#0F172A] mt-1 block">
                  {snapshot?.totalDealsSettled ?? 0}
                </span>
              </div>
            </div>

            {/* Stat Card 2: Volume Traded */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-6 rounded-[16px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-[12px] bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Shares
                </span>
              </div>
              <div className="mt-4">
                <span className="text-sm text-[#64748B] block font-medium">Total Shares Traded</span>
                <span className="text-2xl font-bold text-[#0F172A] mt-1 block">
                  {(snapshot?.totalVolumeShares ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Stat Card 3: Gross Consideration */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-6 rounded-[16px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-[12px] bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Coins className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  Gross Value
                </span>
              </div>
              <div className="mt-4">
                <span className="text-sm text-[#64748B] block font-medium">Gross Consideration</span>
                <span className="text-2xl font-bold text-[#0F172A] mt-1 block">
                  ₹{(snapshot?.totalGrossConsideration ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Stat Card 4: Desk Commission */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-6 rounded-[16px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-[12px] bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  5% Brokerage
                </span>
              </div>
              <div className="mt-4">
                <span className="text-sm text-[#64748B] block font-medium">Desk Commission (Fee)</span>
                <span className="text-2xl font-bold text-[#0F172A] mt-1 block">
                  ₹{(snapshot?.totalDeskCommission ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 4. MAIN ACTIVITY AREA (2/3 PRIMARY + 1/3 SECONDARY WIDGETS) */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* 2/3 COLUMN (8 COLS): PHYSICAL SLIP ENTRY & INTERACTIVE SPREADSHEET */}
            <div className="lg:col-span-8 space-y-8">
              {/* SLIP ENTRY FORM CARD */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[16px] p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">Physical Jogger Slip Entry</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Type counterparty and price details. Formulas and live voucher compute automatically.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-[12px] bg-slate-100 text-slate-700 border border-slate-200">
                    {isRound0 ? 'Round 0 Exemption Active' : 'Dual 5% Brokerage'}
                  </span>
                </div>

                <form onSubmit={handleSettleTrade} className="space-y-5">
                  {/* Row 1: Buying & Selling Teams */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Buyer */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                          <span>1. Buying Team (Purchaser)</span>
                        </label>
                        {buyerRecord && (
                          <span className="text-[11px] font-mono text-[#64748B]">
                            Cash: ₹{(buyerRecord.currentCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        list="corporate-broker-team-list"
                        value={buyerTeam}
                        onChange={(e) => setBuyerTeam(e.target.value)}
                        placeholder="Type or select Buyer team..."
                        className="w-full py-2.5 px-3.5 rounded-[12px] bg-[#FFFFFF] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                        required
                      />
                    </div>

                    {/* Seller */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                          <span>2. Selling Team (Seller)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setSellerTeam('Central Primary Pool')}
                          className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-[8px] transition cursor-pointer"
                          title="Preset seller to Central Primary Pool"
                        >
                          🏛️ Round 0 Primary Pool
                        </button>
                      </div>
                      <input
                        type="text"
                        list="corporate-broker-team-list"
                        value={sellerTeam}
                        onChange={(e) => setSellerTeam(e.target.value)}
                        placeholder="Type or select Seller team..."
                        className="w-full py-2.5 px-3.5 rounded-[12px] bg-[#FFFFFF] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                        required
                      />
                    </div>
                  </div>

                  {/* Datalist for team autocomplete */}
                  <datalist id="corporate-broker-team-list">
                    <option value="Central Primary Pool">🏛️ Central Primary Pool (Round 0 Unlimited Issuance)</option>
                    {(snapshot?.teamsPurse || []).map((t) => (
                      <option key={t.teamId} value={t.teamName}>
                        {t.teamCode} — Cash: ₹{t.currentCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </option>
                    ))}
                  </datalist>

                  {/* Row 2: Security, Qty & Agreed Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Stock Select */}
                    <div>
                      <label className="text-xs font-bold text-[#0F172A] block mb-1.5">
                        3. Traded Security (Stock)
                      </label>
                      <select
                        value={selectedStockId}
                        onChange={(e) => handleStockChange(e.target.value)}
                        className="w-full py-2.5 px-3.5 rounded-[12px] bg-[#FFFFFF] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#EF4444]"
                      >
                        {(snapshot?.stocks || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.ticker} — {s.name} [₹{s.current_price.toFixed(2)}]
                          </option>
                        ))}
                      </select>
                      {selectedStock && (
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[#64748B]">
                          <span>LTP: <strong className="text-[#0F172A]">₹{selectedStock.current_price.toFixed(2)}</strong></span>
                          <span>LC: ₹{selectedStock.lower_circuit?.toFixed(1)} / UC: ₹{selectedStock.upper_circuit?.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="text-xs font-bold text-[#0F172A] block mb-1.5">
                        4. Quantity (Shares)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full py-2.5 px-3.5 rounded-[12px] bg-[#FFFFFF] border border-[#E2E8F0] text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#EF4444]"
                        required
                      />
                    </div>

                    {/* Price */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#0F172A] block">
                          5. Agreed Price (₹)
                        </label>
                        {selectedStock && (
                          <button
                            type="button"
                            onClick={() => setAgreedPrice(String(selectedStock.current_price))}
                            className="text-[11px] text-[#EF4444] font-semibold hover:underline cursor-pointer"
                          >
                            Reset LTP
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
                        className="w-full py-2.5 px-3.5 rounded-[12px] bg-[#FFFFFF] border border-[#E2E8F0] text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#EF4444]"
                        required
                      />
                    </div>
                  </div>

                  {/* Circuit Collar Warning */}
                  {isCircuitBreached && (
                    <div className="p-3.5 rounded-[12px] bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Price Breaches Circuit Collar (±10%)</span>
                      </div>
                      <p className="text-[11px] leading-snug">
                        Agreed price ₹{parsedPrice.toFixed(2)} is outside collar (LC: ₹{selectedStock?.lower_circuit?.toFixed(2)} - UC: ₹{selectedStock?.upper_circuit?.toFixed(2)}).
                      </p>
                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowCircuitBypass}
                          onChange={(e) => setAllowCircuitBypass(e.target.checked)}
                          className="rounded border-amber-400 text-amber-600 focus:ring-0"
                        />
                        <span className="text-xs font-bold text-amber-900">
                          Bypass Circuit (Official Physical Floor Deal)
                        </span>
                      </label>
                    </div>
                  )}

                  {/* AUTOMATED DEAL SETTLEMENT VOUCHER */}
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                    <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#E2E8F0]">
                      <span className="font-bold text-[#0F172A] uppercase tracking-wider">
                        Settlement Voucher Breakdown
                      </span>
                      <span className="px-2 py-0.5 rounded-[8px] bg-white border border-[#E2E8F0] text-[11px] font-semibold text-[#64748B]">
                        {isBrokerageWaived ? '0% Brokerage (0th Round Exemption)' : 'Dual 5% Brokerage'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#64748B]">
                      <span>Gross Deal Value ({parsedQty} × ₹{parsedPrice.toFixed(2)}):</span>
                      <span className="font-bold text-[#0F172A]">
                        ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Buyer 5% Brokerage:</span>
                      <span>{isBrokerageWaived ? '₹0.00 (Waived)' : `+₹${buyerBrokerage.toLocaleString('en-IN')}`}</span>
                    </div>

                    <div className="flex items-center justify-between font-bold text-[#0F172A] border-t border-[#E2E8F0] pt-1.5">
                      <span>Total Buyer Outflow (Debit):</span>
                      <span className="text-sm text-emerald-600">
                        ₹{totalBuyerDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-rose-700 text-[11px]">
                      <span>Seller 5% Brokerage:</span>
                      <span>{isBrokerageWaived ? '₹0.00 (Waived)' : `-₹${sellerBrokerage.toLocaleString('en-IN')}`}</span>
                    </div>

                    <div className="flex items-center justify-between font-bold text-[#0F172A]">
                      <span>Total Seller Net Proceeds:</span>
                      <span className="text-sm text-rose-600">
                        ₹{totalSellerCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-teal-700 border-t border-[#E2E8F0] pt-1">
                      <span>Econ Desk Total Commission:</span>
                      <span>₹{totalDeskFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* TEAM BUDGET COMPLIANCE & ELIMINATION CHECKS */}
                  <div className="p-4 rounded-[12px] bg-white border border-[#E2E8F0] space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#64748B]">Buyer Remaining Cash:</span>
                      <span className={`font-bold font-mono ${isCashFloorBreached ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₹{buyerPostTradeCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    {isCashFloorBreached && (
                      <div className="p-2 rounded-[8px] bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>
                          <strong>Low Cash Warning:</strong> Cash drops below ₹10L (10% post-round floor reserve)!
                        </span>
                      </div>
                    )}

                    {isRound0 && (
                      <div className="space-y-1.5 pt-1 border-t border-[#E2E8F0]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B]">Round 0 Budget Deployed:</span>
                          <span className="font-bold text-[#0F172A]">
                            {buyerProjectedR0Percent}% (Target: &ge;60%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              buyerProjectedR0Percent >= 60 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, buyerProjectedR0Percent)}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#64748B]">
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

                  {/* Primary Action Button in RED-500 */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-[12px] bg-[#EF4444] hover:bg-red-600 text-white font-bold text-sm tracking-wide shadow-xs transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Broadcasting &amp; Settling Trade...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 text-white" />
                        <span>Approve &amp; Settle Trade Slip</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* INTERACTIVE SPREADSHEET TABLE CARD */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[16px] p-6 space-y-4">
                {/* Header & Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('purses')}
                      className={`px-3 py-1.5 rounded-[12px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'purses'
                          ? 'bg-[#F1F5F9] text-[#EF4444]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Team Purses &amp; Elimination
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ledger')}
                      className={`px-3 py-1.5 rounded-[12px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'ledger'
                          ? 'bg-[#F1F5F9] text-[#EF4444]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Trades Master Ledger ({snapshot?.tradesLedger?.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('matrix')}
                      className={`px-3 py-1.5 rounded-[12px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'matrix'
                          ? 'bg-[#F1F5F9] text-[#EF4444]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Holdings Matrix
                    </button>
                  </div>

                  <a
                    href="/api/broker/export-excel"
                    download
                    className="text-xs font-semibold text-[#EF4444] hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Workbook (.xlsx)</span>
                  </a>
                </div>

                {/* TAB 1: TEAM PURSES & ELIMINATION AUDIT */}
                {activeTab === 'purses' && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                      <input
                        type="text"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Search team name or code..."
                        className="w-full py-2 pl-9 pr-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#EF4444]"
                      />
                    </div>

                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-[12px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0]">
                          <tr>
                            <th className="py-2.5 px-3">Team</th>
                            <th className="py-2.5 px-3 font-mono">Cash Balance</th>
                            <th className="py-2.5 px-3 font-mono">R0 Spent</th>
                            <th className="py-2.5 px-3">R0 Deployed %</th>
                            <th className="py-2.5 px-3">60% Rule</th>
                            <th className="py-2.5 px-3">10% Cash Rule</th>
                            <th className="py-2.5 px-3 font-mono">Net Worth</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
                          {filteredTeams.map((tp) => {
                            const isEliminateRisk = !tp.round0Met60Percent;
                            return (
                              <tr
                                key={tp.teamId}
                                className={`hover:bg-[#F8FAFC] transition ${
                                  isEliminateRisk ? 'bg-red-50/40' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-[#0F172A]">{tp.teamName}</div>
                                  <div className="text-[10px] text-[#64748B] font-mono">{tp.teamCode}</div>
                                </td>

                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                                  ₹{(tp.currentCash / 100000).toFixed(2)}L
                                </td>

                                <td className="py-2.5 px-3 font-mono text-amber-700">
                                  ₹{(tp.round0Spent / 100000).toFixed(2)}L
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${
                                          tp.round0DeployedPercent >= 60 ? 'bg-emerald-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(100, tp.round0DeployedPercent)}%` }}
                                      ></div>
                                    </div>
                                    <span
                                      className={`font-mono font-bold ${
                                        tp.round0DeployedPercent >= 60 ? 'text-emerald-700' : 'text-red-600'
                                      }`}
                                    >
                                      {tp.round0DeployedPercent}%
                                    </span>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3">
                                  {tp.round0Met60Percent ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                      PASS
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-700 border border-red-200 font-bold">
                                      ELIMINATE
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3">
                                  {tp.cashMet10PercentFloor ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-semibold">
                                      &ge;10L
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                                      &lt;10L
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 font-mono font-bold text-[#0F172A]">
                                  ₹{(tp.totalNetWorth / 100000).toFixed(2)}L
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => selectTeamAsBuyer(tp.teamName)}
                                      className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                    >
                                      +Buy
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => selectTeamAsSeller(tp.teamName)}
                                      className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                                    >
                                      +Sell
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
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                      <input
                        type="text"
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        placeholder="Search slip ID, buyer, seller, or stock ticker..."
                        className="w-full py-2 pl-9 pr-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#EF4444]"
                      />
                    </div>

                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-[12px]">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0]">
                          <tr>
                            <th className="py-2.5 px-3">Slip ID</th>
                            <th className="py-2.5 px-3">Time</th>
                            <th className="py-2.5 px-3">Buyer</th>
                            <th className="py-2.5 px-3">Seller</th>
                            <th className="py-2.5 px-3">Stock</th>
                            <th className="py-2.5 px-3">Qty</th>
                            <th className="py-2.5 px-3">Price</th>
                            <th className="py-2.5 px-3">Gross</th>
                            <th className="py-2.5 px-3">Brok</th>
                            <th className="py-2.5 px-3">Debit</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
                          {filteredTrades.map((t) => (
                            <tr key={t.slipId} className="hover:bg-[#F8FAFC] transition">
                              <td className="py-2.5 px-3 font-bold text-[#0F172A]">{t.slipId}</td>
                              <td className="py-2.5 px-3 text-[#64748B] text-[10px]">
                                {new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="py-2.5 px-3 font-sans font-bold text-emerald-700">{t.buyerTeam}</td>
                              <td className="py-2.5 px-3 font-sans font-bold text-rose-700">{t.sellerTeam}</td>
                              <td className="py-2.5 px-3 font-bold text-[#0F172A]">{t.ticker}</td>
                              <td className="py-2.5 px-3 text-[#64748B]">{t.quantity}</td>
                              <td className="py-2.5 px-3 text-[#0F172A]">₹{t.price.toFixed(2)}</td>
                              <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                                ₹{t.grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2.5 px-3 text-amber-700">
                                {t.isRound0Exempt ? '₹0' : `₹${t.buyerBrokerage.toFixed(0)}`}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-emerald-700">
                                ₹{t.buyerTotalDebit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
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
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-[12px]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E2E8F0]">
                        <tr>
                          <th className="py-2.5 px-3 sticky left-0 bg-[#F8FAFC] z-10">Team</th>
                          {(snapshot?.holdingsMatrix.stocks || []).map((s) => (
                            <th key={s.id} className="py-2.5 px-3 text-center">
                              <div>{s.ticker}</div>
                              <div className="text-[10px] text-[#64748B] font-normal">₹{s.current_price.toFixed(1)}</div>
                            </th>
                          ))}
                          <th className="py-2.5 px-3 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
                        {(snapshot?.holdingsMatrix.teams || []).map((team) => (
                          <tr key={team.teamId} className="hover:bg-[#F8FAFC] transition">
                            <td className="py-2.5 px-3 font-sans font-bold text-[#0F172A] sticky left-0 bg-white z-10 border-r border-[#E2E8F0]">
                              {team.teamName}
                            </td>
                            {(snapshot?.holdingsMatrix.stocks || []).map((s) => {
                              const count = team.holdings[s.ticker] || 0;
                              return (
                                <td
                                  key={s.id}
                                  className={`py-2.5 px-3 text-center ${
                                    count > 0 ? 'text-emerald-700 font-bold bg-emerald-50/40' : 'text-slate-400'
                                  }`}
                                >
                                  {count > 0 ? count : '—'}
                                </td>
                              );
                            })}
                            <td className="py-2.5 px-3 font-bold text-[#0F172A] text-right">
                              ₹{(team.totalValue / 100000).toFixed(2)}L
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* =================================================================== */}
            {/* 1/3 COLUMN (4 COLS): SECONDARY WIDGETS STACK */}
            {/* =================================================================== */}
            <div className="lg:col-span-4 space-y-6">
              {/* DARK ACTION CARD (Promotions / Critical Event Rules) */}
              <div className="bg-[#0F172A] text-white p-6 rounded-[16px] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <h3 className="font-bold text-sm text-white">Event Rules Engine</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Automatic compliance validation runs on every slip before approval.
                </p>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="p-2.5 rounded-[12px] bg-slate-800/80 border border-slate-700/60">
                    <strong className="text-white block font-semibold mb-0.5">Round 0 60% Budget Rule:</strong>
                    Teams must deploy at least ₹60 Lakhs (60%) of initial ₹1 Crore budget in Round 0 or face elimination.
                  </div>
                  <div className="p-2.5 rounded-[12px] bg-slate-800/80 border border-slate-700/60">
                    <strong className="text-white block font-semibold mb-0.5">10% Post-Round Cash Floor:</strong>
                    Every team must retain &ge; ₹10 Lakhs (10%) cash reserve at all times.
                  </div>
                  <div className="p-2.5 rounded-[12px] bg-slate-800/80 border border-slate-700/60">
                    <strong className="text-white block font-semibold mb-0.5">Brokerage Fee:</strong>
                    0% waived on Round 0 Primary Pool issuance; 5% dual fee applies on all secondary rounds.
                  </div>
                </div>

                <a
                  href="/api/broker/export-excel"
                  download
                  className="w-full block text-center py-2.5 px-4 rounded-[12px] text-xs font-bold border border-white/20 text-white hover:bg-white hover:text-[#0F172A] transition duration-200"
                >
                  Download Official Excel Workbook
                </a>
              </div>

              {/* CARD 2: ROUND & TIMER STATUS */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-6 rounded-[16px] space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <h3 className="font-bold text-sm text-[#0F172A]">Round Telemetry</h3>
                  <span className="text-xs font-mono font-bold text-[#EF4444]">
                    {snapshot?.currentRoundName}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#64748B]">
                    <span>Trading Phase:</span>
                    <span className="font-bold text-[#0F172A]">
                      {isRound0 ? 'Primary Desk (R0)' : 'Secondary Inter-Team'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748B]">
                    <span>Brokerage Rate:</span>
                    <span className="font-bold text-emerald-700">
                      {isRound0 ? '0% (Exempt)' : '5% Dual (+5% / -5%)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748B]">
                    <span>Broadcast Target:</span>
                    <span className="font-bold text-[#0F172A]">All Participant Screens (10s)</span>
                  </div>
                </div>
              </div>

              {/* CARD 3: TEAM ELIMINATION DIGEST */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-6 rounded-[16px] space-y-3">
                <h3 className="font-bold text-sm text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
                  Elimination &amp; Purse Health
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B]">Total Teams:</span>
                    <span className="font-bold text-[#0F172A]">{snapshot?.teamsPurse?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-[12px] bg-emerald-50 border border-emerald-100 text-emerald-800">
                    <span>Qualified (&ge;60% R0):</span>
                    <span className="font-bold">{qualifiedCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-[12px] bg-red-50 border border-red-100 text-red-800">
                    <span>Elimination Risk (&lt;60%):</span>
                    <span className="font-bold">{atRiskCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-[12px] bg-amber-50 border border-amber-100 text-amber-800">
                    <span>Low Cash Violations (&lt;10L):</span>
                    <span className="font-bold">{lowCashCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
