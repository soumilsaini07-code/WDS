'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Stock,
  MarketEvent,
  Transaction,
  CompetitionRound,
  CompetitionRoundId,
  StockPriceSettlement,
  IPOListing,
  IPOSubscription,
} from '@/lib/types';
import { MasterRoundControlBar } from '@/components/MasterRoundControlBar';
import { DynamicPricingSettlementConsole } from '@/components/DynamicPricingSettlementConsole';
import { IPOSubscriptionDesk } from '@/components/IPOSubscriptionDesk';
import { supabaseClient } from '@/lib/supabase-client';

export default function AdminPage() {
  const router = useRouter();

  // Active Tab: Desk (Assisted Execution), Teams (Participant Roster), Command (Macro Shocks), Leaderboard, Users, Audit, Pricing (4-Branch Formula), IPO (Primary Allotment)
  const [activeTab, setActiveTab] = useState<'desk' | 'teams' | 'command' | 'leaderboard' | 'users' | 'audit' | 'pricing' | 'ipo'>('desk');

  // Competition Rounds, Dynamic Pricing & IPO State
  const [competitionRounds, setCompetitionRounds] = useState<CompetitionRound[]>([]);
  const [currentRound, setCurrentRound] = useState<CompetitionRound | null>(null);
  const [roundClock, setRoundClock] = useState<{ remaining_seconds: number; is_paused: boolean; is_orders_locked: boolean }>({
    remaining_seconds: 600,
    is_paused: false,
    is_orders_locked: false,
  });
  const [roundActionLoading, setRoundActionLoading] = useState(false);
  const [rFormulaStats, setRFormulaStats] = useState<any>(null);
  const [overrideR, setOverrideR] = useState<string>('0.0');
  const [stockNewsDeltas, setStockNewsDeltas] = useState<Record<string, string>>({});
  const [stockRDeltas, setStockRDeltas] = useState<Record<string, string>>({});
  const [previewSettlements, setPreviewSettlements] = useState<StockPriceSettlement[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applyingSettlement, setApplyingSettlement] = useState(false);
  const [ipoListings, setIpoListings] = useState<IPOListing[]>([]);
  const [ipoSubscriptions, setIpoSubscriptions] = useState<IPOSubscription[]>([]);
  const [allottingIpoId, setAllottingIpoId] = useState<string | null>(null);

  // Backend Data
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<Transaction[]>([]);
  const [recentEvents, setRecentEvents] = useState<MarketEvent[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  // Order Slips Queue & Instant Lookup State
  const [pendingSlips, setPendingSlips] = useState<any[]>([]);
  const [allSlips, setAllSlips] = useState<any[]>([]);
  const [lookupSlipId, setLookupSlipId] = useState('');
  const [activeSlip, setActiveSlip] = useState<any | null>(null);
  const [slipActionLoading, setSlipActionLoading] = useState(false);
  const [slipFilter, setSlipFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  // Teams Management State
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Superadmin 2-Step Verification Modal State
  const [twoStepModalOpen, setTwoStepModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: 'REMOVE_MEMBER' | 'EDIT_MEMBER' | 'ADD_MEMBER' | 'SET_LEADER';
    teamId: string;
    userId?: string;
    newName?: string;
    newEmail?: string;
    detailsText: string;
  } | null>(null);
  const [verifyEmail, setVerifyEmail] = useState('soumilsaini07@gmail.com');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Trading Desk Assisted Execution State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [deskStockId, setDeskStockId] = useState<string>('s-reliance');
  const [deskType, setDeskType] = useState<'BUY' | 'SELL'>('BUY');
  const [deskQty, setDeskQty] = useState<number>(50);
  const [deskExecuting, setDeskExecuting] = useState(false);

  // Trading Desk Sub-Navigation & Inter-Team P2P / SEC State
  const [deskSubMode, setDeskSubMode] = useState<'slips' | 'p2p' | 'disciplinary'>('slips');

  // Inter-Team P2P Trading Desk State
  const [p2pSellerTeamId, setP2pSellerTeamId] = useState<string>('');
  const [p2pBuyerTeamId, setP2pBuyerTeamId] = useState<string>('');
  const [p2pStockId, setP2pStockId] = useState<string>('s-reliance');
  const [p2pQty, setP2pQty] = useState<number>(20);
  const [p2pAgreedPrice, setP2pAgreedPrice] = useState<string>('');
  const [p2pBypassCircuit, setP2pBypassCircuit] = useState<boolean>(false);
  const [p2pExecuting, setP2pExecuting] = useState<boolean>(false);

  // SEC Disciplinary Penalties State
  const [penaltyTeamId, setPenaltyTeamId] = useState<string>('');
  const [penaltyReason, setPenaltyReason] = useState<'INSIDER_TRADING_10' | 'FALSE_REPORT_15' | 'KHABRI_FEE_10K' | 'CUSTOM'>('INSIDER_TRADING_10');
  const [penaltyCustomAmount, setPenaltyCustomAmount] = useState<string>('25000');
  const [penaltyExecuting, setPenaltyExecuting] = useState<boolean>(false);

  // Exclusive Admin Leaderboard State
  const [adminLeaderboard, setAdminLeaderboard] = useState<any[]>([]);
  const [adminFilter, setAdminFilter] = useState<string>('ALL');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Telemetry & Halts
  const [globalHalt, setGlobalHalt] = useState(false);

  // Shock Injector Form
  const [newsHeadline, setNewsHeadline] = useState(
    'Middle East diplomatic breakthrough reduces crude import duties by 15%'
  );
  const [eventCategory, setEventCategory] = useState('macro');
  const [execTiming, setExecTiming] = useState<'immediate' | 'delay'>('immediate');
  const [shockAssets, setShockAssets] = useState<{ ticker: string; delta: string; vol: string }[]>([
    { ticker: 'TATASTEEL', delta: '+3.5%', vol: '1.2x' },
    { ticker: 'RELIANCE', delta: '-2.0%', vol: '1.5x' },
    { ticker: 'HDFCBANK', delta: '+1.5%', vol: '1.0x' },
  ]);

  // Asset Table State
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState('');

  // Floating Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  // Live round clock countdown - decrements in real-time only when NOT paused
  useEffect(() => {
    const timer = setInterval(() => {
      setRoundClock((prev) => {
        if (prev.is_paused || prev.remaining_seconds <= 0) return prev;
        return { ...prev, remaining_seconds: prev.remaining_seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('econ_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Data Fetching
  const fetchAdminData = useCallback(async () => {
    try {
      const stocksRes = await fetch('/api/admin/stocks', {
        headers: { ...getAuthHeaders() },
      });
      if (stocksRes.status === 403 || stocksRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (stocksRes.ok) {
        const data = await stocksRes.json();
        const fetchedStocks: Stock[] = data.stocks || [];
        setStocks(fetchedStocks);

        // Initialize override inputs with current LTPs if not present
        setPriceOverrides((prev) => {
          const updated = { ...prev };
          fetchedStocks.forEach((s) => {
            if (!updated[s.id]) {
              updated[s.id] = s.current_price.toFixed(2);
            }
          });
          return updated;
        });
      }

      const usersRes = await fetch('/api/admin/users', {
        headers: { ...getAuthHeaders() },
      });
      if (usersRes.ok) {
        const data = await usersRes.json();
        const studentList = data.users || [];
        setUsers(studentList);
        setAuditLogs(data.auditLogs || []);
        setAdmins(data.admins || []);
        setIsSuperAdmin(Boolean(data.isSuperAdmin));
        setCurrentAdmin(data.currentAdmin || null);

        setSelectedStudentId((prev) => {
          if (prev && studentList.some((s: any) => s.id === prev)) return prev;
          return studentList.length > 0 ? studentList[0].id : '';
        });
      }

      const eventsRes = await fetch('/api/events', {
        headers: { ...getAuthHeaders() },
      });
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setRecentEvents(data.events || []);
      }
    } catch (e) {
      console.error('Error fetching admin data:', e);
    }
  }, [router]);

  // Fetch Slips Queue
  const fetchAdminSlips = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/slips', {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingSlips(data.pendingSlips || []);
        setAllSlips(data.allSlips || []);
      }
    } catch (err) {
      console.error('Error fetching slips queue:', err);
    }
  }, []);

  // Fetch Teams
  const fetchAdminTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const res = await fetch('/api/admin/teams', {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        const loadedTeams = data.teams || [];
        setTeams(loadedTeams);
        if (loadedTeams.length > 0) {
          setP2pSellerTeamId((prev) => prev || loadedTeams[0].id);
          setP2pBuyerTeamId((prev) => prev || (loadedTeams.length > 1 ? loadedTeams[1].id : loadedTeams[0].id));
          setPenaltyTeamId((prev) => prev || loadedTeams[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  // Lookup Slip by ID
  const handleLookupSlip = async (idToLookup = lookupSlipId) => {
    const cleanId = idToLookup.trim();
    if (!cleanId) {
      showToast('Please enter a valid Slip ID');
      return;
    }
    setSlipActionLoading(true);
    try {
      const res = await fetch('/api/admin/slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'LOOKUP', slipId: cleanId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Slip ID not found in system.');
        setActiveSlip(null);
        return;
      }
      setActiveSlip(data.slip);
      showToast(`Order slip ${data.slip.slip_id} loaded for ${data.slip.team_name}`);
    } catch (err: any) {
      showToast(err.message || 'Lookup failed');
    } finally {
      setSlipActionLoading(false);
    }
  };

  // Approve & Execute or Reject Slip
  const handleExecuteSlip = async (slipId: string, action: 'APPROVE' | 'REJECT') => {
    setSlipActionLoading(true);
    try {
      const res = await fetch('/api/admin/slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action, slipId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || `Failed to ${action.toLowerCase()} slip`);
        return;
      }

      if (action === 'APPROVE') {
        showToast(`Trade approved & executed! Live Excel ledger updated for Slip ${slipId}.`);
      } else {
        showToast(`Slip ${slipId} has been marked as REJECTED.`);
      }

      await fetchAdminSlips();
      await fetchAdminData();
      if (activeSlip && activeSlip.slip_id === slipId) {
        setActiveSlip(data.slip);
      }
    } catch (err: any) {
      showToast(err.message || 'Execution error');
    } finally {
      setSlipActionLoading(false);
    }
  };

  // Helper to compute live equity holdings valuation for a team
  const getTeamHoldingsValue = (team: any) => {
    if (!team) return 0;
    const portfolio = team.portfolio || team.members?.[0]?.portfolios || [];
    return portfolio.reduce((sum: number, pos: any) => {
      const s = stocks.find((item) => item.id === pos.stock_id);
      const ltp = s ? s.current_price : (pos.average_buy_price || 0);
      return sum + (pos.shares_count * ltp);
    }, 0);
  };

  // Regulatory & Disciplinary Sanction (Rulebook §4 & §5: Insider Penalties & Khabri Fee)
  const handleApplyPenalty = async (targetTeamId: string, reason: string, customAmount?: number) => {
    if (!targetTeamId) {
      showToast('Please select a target team.');
      return;
    }
    setPenaltyExecuting(true);
    try {
      const res = await fetch('/api/admin/penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          teamId: targetTeamId,
          reason,
          customAmount: customAmount !== undefined ? customAmount : parseFloat(penaltyCustomAmount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to apply disciplinary penalty.');
        return;
      }
      showToast(`Sanction Applied: ₹${data.penaltyAmount?.toLocaleString('en-IN')} debited from ${data.team?.name} (${data.reasonLabel}). Logged to ledger.`);
      await fetchAdminTeams();
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Penalty execution error');
    } finally {
      setPenaltyExecuting(false);
    }
  };

  // Inter-Team P2P Execution Handler (Rulebook §2: Rounds 2-7 with Dual 5% Brokerage)
  const handleExecuteP2P = async () => {
    if (!p2pSellerTeamId.trim() || !p2pBuyerTeamId.trim()) {
      showToast('Both Seller and Buyer teams must be entered.');
      return;
    }
    if (p2pSellerTeamId.trim().toLowerCase() === p2pBuyerTeamId.trim().toLowerCase()) {
      showToast('Seller and Buyer must be distinct teams.');
      return;
    }
    const qty = parseInt(String(p2pQty), 10);
    const isPrimaryPool =
      p2pSellerTeamId.trim().toLowerCase() === 'central primary pool' ||
      p2pSellerTeamId.trim().toLowerCase().includes('primary pool') ||
      p2pSellerTeamId.trim().toLowerCase().includes('issuance pool') ||
      currentRound?.type === 'PRIMARY_DESK' ||
      currentRound?.id === 'round-0' ||
      currentRound?.index === 0;

    const currentSelectedStock = stocks.find((s) => s.id === p2pStockId) || stocks[0];
    const price = isPrimaryPool
      ? (currentSelectedStock ? currentSelectedStock.current_price : parseFloat(p2pAgreedPrice))
      : parseFloat(p2pAgreedPrice);

    if (isNaN(qty) || qty <= 0) {
      showToast('Enter a valid share quantity.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      showToast('Enter a valid trade price.');
      return;
    }

    setP2pExecuting(true);
    try {
      const res = await fetch('/api/admin/p2p', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          sellerTeamId: p2pSellerTeamId.trim(),
          buyerTeamId: p2pBuyerTeamId.trim(),
          stockId: p2pStockId,
          quantity: qty,
          agreedPrice: price,
          allowCircuitBypass: isPrimaryPool ? true : p2pBypassCircuit,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Transaction rejected.');
        return;
      }
      const s = data.summary;
      if (isPrimaryPool) {
        showToast(`🏛️ Primary Allocation Executed! ${qty} ${currentSelectedStock?.ticker || 'shares'} issued to ${p2pBuyerTeamId} at fixed base price ₹${price.toFixed(2)} (0% brokerage).`);
      } else {
        const progressMsg = s?.priceUpdated
          ? `⭐ Rolling 3-Deal VWAP Updated! Live price is ₹${s.currentStockPrice}.`
          : `Deal ${s?.batchProgress || '1/3'} registered. Rolling price activates on 3rd deal.`;
        showToast(`P2P Trade Executed! ${s?.quantity} ${s?.ticker} (${s?.sellerTeam} ➔ ${s?.buyerTeam}). ${progressMsg}`);
      }
      await fetchAdminTeams();
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Execution error');
    } finally {
      setP2pExecuting(false);
    }
  };

  // Confirm Superadmin 2-Step Action
  const handleConfirmTwoStepAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    if (!verifyPassword) {
      showToast('Superadmin password is required.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          adminEmail: verifyEmail,
          adminPassword: verifyPassword,
          action: pendingAction.action,
          teamId: pendingAction.teamId,
          userId: pendingAction.userId,
          newName: pendingAction.newName,
          newEmail: pendingAction.newEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Verification failed: invalid credentials');
        return;
      }

      showToast(data.message || 'Team updated successfully!');
      setTwoStepModalOpen(false);
      setPendingAction(null);
      setVerifyPassword('');
      await fetchAdminTeams();
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Verification error');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Fetch Competition Rounds, Current Clock & R Formula
  const fetchAdminRounds = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rounds', {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCompetitionRounds(data.rounds || []);
          setCurrentRound(data.currentRound || null);
          if (data.clock) {
            setRoundClock((prev) => {
              if (data.clock.is_paused) return data.clock;
              const diff = Math.abs(prev.remaining_seconds - data.clock.remaining_seconds);
              if (
                prev.is_paused !== data.clock.is_paused ||
                prev.is_orders_locked !== data.clock.is_orders_locked ||
                diff > 2
              ) {
                return data.clock;
              }
              return prev;
            });
          }
          if (data.rStats) {
            setRFormulaStats(data.rStats);
            setOverrideR(data.rStats.calculated_r.toFixed(2));
          }
        }
      }
    } catch (e) {
      console.error('Error fetching admin rounds:', e);
    }
  }, []);

  // Fetch IPO Listings and Subscriptions
  const fetchIPOData = useCallback(async () => {
    try {
      const res = await fetch('/api/ipo', {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIpoListings(data.listings || []);
          setIpoSubscriptions(data.subscriptions || []);
        }
      }
    } catch (e) {
      console.error('Error fetching IPO data:', e);
    }
  }, []);

  // Advance Competition Round
  const handleAdvanceRound = async (customTargetId?: CompetitionRoundId) => {
    setRoundActionLoading(true);
    try {
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'ADVANCE',
          targetRoundId: customTargetId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to advance round.');
        return;
      }
      showToast(`Competition Advanced! Active: ${data.currentRound?.name}`);
      await fetchAdminRounds();
      await fetchIPOData();
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Round transition error');
    } finally {
      setRoundActionLoading(false);
    }
  };

  // Update Round Clock & Order Locking
  const handleUpdateClock = async (updates: { remaining_seconds?: number; is_paused?: boolean; is_orders_locked?: boolean }) => {
    try {
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'UPDATE_CLOCK',
          ...updates,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRoundClock(data.clock);
        if (typeof updates.remaining_seconds === 'number' && updates.is_paused === true) {
          const m = Math.floor(updates.remaining_seconds / 60);
          const s = updates.remaining_seconds % 60;
          showToast(`Clock Reset to ${m}:${s < 10 ? '0' : ''}${s} (Paused)`);
        } else if (typeof updates.is_paused === 'boolean') {
          showToast(updates.is_paused ? 'Simulation Clock Paused' : 'Simulation Clock Resumed');
        }
        if (typeof updates.is_orders_locked === 'boolean') {
          showToast(updates.is_orders_locked ? 'Floor Order Slips Locked' : 'Floor Order Slips Open');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update clock');
    }
  };

  // Generate Dynamic 4-Branch Pricing Preview
  const handleGeneratePreview = async () => {
    setLoadingPreview(true);
    try {
      const parsedR = parseFloat(overrideR);
      const stockNewsParsed: Record<string, number> = {};
      Object.entries(stockNewsDeltas).forEach(([k, v]) => {
        const val = parseFloat(v);
        if (!isNaN(val)) stockNewsParsed[k] = val;
      });

      const stockRParsed: Record<string, number> = {};
      Object.entries(stockRDeltas).forEach(([k, v]) => {
        const val = parseFloat(v);
        if (!isNaN(val)) stockRParsed[k] = val;
      });

      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'PREVIEW_PRICING',
          roundId: currentRound?.id,
          overrideR: !isNaN(parsedR) ? parsedR : undefined,
          stockNewsOverrides: stockNewsParsed,
          stockROverrides: stockRParsed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to calculate settlement preview');
        return;
      }
      setPreviewSettlements(data.preview?.settlements || []);
      if (data.preview?.settlements) {
        const newRDeltas: Record<string, string> = {};
        data.preview.settlements.forEach((s: any) => {
          newRDeltas[s.ticker] = s.market_drift_percent.toString();
        });
        setStockRDeltas((prev) => ({ ...newRDeltas, ...prev }));
      }
      if (data.preview?.r_formula_details) {
        setRFormulaStats({
          calculated_r: data.preview.market_r_percent,
          average_traded_stock_shift: data.preview.r_formula_details.average_traded_stock_shift,
          total_round_buy_volume: data.preview.r_formula_details.total_round_buy_volume,
          total_round_sell_volume: data.preview.r_formula_details.total_round_sell_volume,
          traded_stocks_count: data.preview.settlements.filter((s: any) => s.order_count > 0).length,
          formula_breakdown: `Avg R% = ${data.preview.market_r_percent}% (each stock assigned random 1% to 10% drift)`,
        });
      }
      showToast('Dynamic 4-Branch Pricing Settlement Preview Generated!');
    } catch (err: any) {
      showToast(err.message || 'Calculation error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Re-roll random R% (between 1% and 10%) automatically for each stock
  const handleRandomizeAllR = async () => {
    setLoadingPreview(true);
    try {
      const stockNewsParsed: Record<string, number> = {};
      Object.entries(stockNewsDeltas).forEach(([k, v]) => {
        const val = parseFloat(v);
        if (!isNaN(val)) stockNewsParsed[k] = val;
      });

      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'PREVIEW_PRICING',
          roundId: currentRound?.id,
          stockNewsOverrides: stockNewsParsed,
          randomizeR: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to randomize R%');
        return;
      }
      setPreviewSettlements(data.preview?.settlements || []);
      if (data.preview?.settlements) {
        const newRDeltas: Record<string, string> = {};
        data.preview.settlements.forEach((s: any) => {
          newRDeltas[s.ticker] = s.market_drift_percent.toString();
        });
        setStockRDeltas(newRDeltas);
      }
      if (data.preview?.r_formula_details) {
        setRFormulaStats({
          calculated_r: data.preview.market_r_percent,
          average_traded_stock_shift: data.preview.r_formula_details.average_traded_stock_shift,
          total_round_buy_volume: data.preview.r_formula_details.total_round_buy_volume,
          total_round_sell_volume: data.preview.r_formula_details.total_round_sell_volume,
          traded_stocks_count: data.preview.settlements.filter((s: any) => s.order_count > 0).length,
          formula_breakdown: `Avg R% = ${data.preview.market_r_percent}% (random 1% to 10% assigned)`,
        });
      }
      showToast('🎲 Random R% (between 1% and 10%) assigned automatically to each stock!');
    } catch (err: any) {
      showToast(err.message || 'Randomize error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Apply Settlement Prices & Broadcast to Dalal Street
  const handleApplySettlement = async () => {
    if (previewSettlements.length === 0) {
      showToast('Please generate price preview first before broadcasting.');
      return;
    }
    setApplyingSettlement(true);
    try {
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'APPLY_PRICING',
          roundId: currentRound?.id,
          settlements: previewSettlements,
          adminEmail: currentAdmin?.email || 'admin.econ@thapar.edu',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to broadcast settlement prices.');
        return;
      }
      showToast(data.message || 'Settlement prices broadcasted to Dalal Street!');
      await fetchAdminData();
      await fetchAdminRounds();
    } catch (err: any) {
      showToast(err.message || 'Broadcast error');
    } finally {
      setApplyingSettlement(false);
    }
  };

  // 1-Click Allot IPO Lots
  const handleAllotIPO = async (ipoId: string) => {
    setAllottingIpoId(ipoId);
    try {
      const res = await fetch('/api/ipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'ALLOT',
          ipo_id: ipoId,
          admin_email: currentAdmin?.email || 'admin.econ@thapar.edu',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || data.message || 'Failed to allot IPO lots.');
        return;
      }
      showToast(data.message || 'IPO Lots Successfully Allotted & Credited to Portfolios!');
      await fetchIPOData();
      await fetchAdminTeams();
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Allotment error');
    } finally {
      setAllottingIpoId(null);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchAdminSlips();
    fetchAdminTeams();
    fetchAdminRounds();
    fetchIPOData();
    const interval = setInterval(() => {
      fetchAdminSlips();
      fetchAdminRounds();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchAdminData, fetchAdminSlips, fetchAdminTeams, fetchAdminRounds, fetchIPOData]);

  // Realtime Supabase WebSockets for Instant Desk Synchronization
  useEffect(() => {
    const channel = supabaseClient
      .channel('trading-floor-admin')
      .on('broadcast', { event: 'TRADE_EXECUTED' }, () => {
        fetchAdminData();
        fetchAdminTeams();
      })
      .on('broadcast', { event: 'SLIP_STATUS_UPDATED' }, () => {
        fetchAdminSlips();
      })
      .on('broadcast', { event: 'SLIP_SUBMITTED' }, () => {
        fetchAdminSlips();
      })
      .on('broadcast', { event: 'ROUND_ADVANCED' }, () => {
        fetchAdminRounds();
        fetchIPOData();
      })
      .on('broadcast', { event: 'IPO_ALLOTTED' }, () => {
        fetchIPOData();
        fetchAdminData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_slips' }, () => {
        fetchAdminSlips();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [fetchAdminData, fetchAdminSlips, fetchAdminTeams, fetchAdminRounds, fetchIPOData]);

  // Exclusive Admin Leaderboard Fetch
  const fetchLeaderboard = useCallback(async (filter = adminFilter) => {
    setLeaderboardLoading(true);
    try {
      const url =
        filter && filter !== 'ALL'
          ? `/api/leaderboard?adminId=${encodeURIComponent(filter)}`
          : '/api/leaderboard';
      const res = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (res.ok) {
        const data = await res.json();
        setAdminLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [adminFilter]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard(adminFilter);
    }
  }, [activeTab, adminFilter, fetchLeaderboard]);

  // Execute Trade on Behalf of Student at Trading Desk
  const executeDeskTrade = async () => {
    if (!selectedStudentId) {
      showToast('Please select a student participant first.');
      return;
    }
    const student = users.find((u) => u.id === selectedStudentId);
    if (!student) {
      showToast('Selected student not found in cohort roster.');
      return;
    }

    const stock = stocks.find((s) => s.id === deskStockId);
    if (!stock) {
      showToast('Selected security not found.');
      return;
    }

    if (stock.is_frozen) {
      showToast(`Trading circuit breaker active for ${stock.ticker}. Cannot execute order.`);
      return;
    }

    const totalCost = deskQty * stock.current_price;
    if (deskType === 'BUY' && student.balance < totalCost) {
      showToast(
        `Insufficient student balance. Required: ₹${totalCost.toLocaleString('en-IN')}, Available: ₹${student.balance.toLocaleString('en-IN')}`
      );
      return;
    }

    if (deskType === 'SELL') {
      const userPos = student.portfolios?.find((p: any) => p.stock_id === stock.id);
      const held = userPos ? userPos.shares_count : 0;
      if (held < deskQty) {
        showToast(`Student holds ${held} shares of ${stock.ticker}. Cannot sell ${deskQty}.`);
        return;
      }
    }

    setDeskExecuting(true);
    try {
      const res = await fetch('/api/admin/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          studentId: student.id,
          stockId: stock.id,
          type: deskType,
          quantity: deskQty,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Desk trade execution failed');
        return;
      }

      showToast(
        `Recorded ${deskType} ${deskQty} ${stock.ticker} for ${student.username || student.email}. Portfolio updated.`
      );
      await fetchAdminData();
      if (activeTab === 'leaderboard') {
        await fetchLeaderboard(adminFilter);
      }
    } catch (err: any) {
      showToast(err.message || 'Execution error');
    } finally {
      setDeskExecuting(false);
    }
  };

  // Superadmin Reassign Student to Admin Desk
  const handleReassignStudent = async (studentId: string, targetAdminId: string, groupName?: string) => {
    try {
      const res = await fetch('/api/admin/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          studentId,
          adminId: targetAdminId,
          groupName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Reassignment failed');
        return;
      }

      showToast(data.message || 'Student desk reassigned successfully');
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reassign');
    }
  };

  // Emergency Pause Toggle - keeps round clock, floor matching, and UI in sync
  const togglePauseSimulation = () => {
    handleUpdateClock({ is_paused: !roundClock.is_paused });
  };

  // Emergency Global Halt Toggle
  const triggerGlobalHalt = async () => {
    const nextHalt = !globalHalt;
    setGlobalHalt(nextHalt);
    try {
      await Promise.all(
        stocks.map((s) =>
          fetch('/api/admin/stocks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ stockId: s.id, isFrozen: nextHalt }),
          })
        )
      );
      if (nextHalt) {
        showToast('Global market halt triggered. All order books frozen.');
      } else {
        showToast('Global halt lifted. Standard trading parameters restored.');
      }
      await fetchAdminData();
    } catch (e: any) {
      showToast(e.message || 'Error updating halt state');
    }
  };

  // Add Asset Row to Shock Matrix
  const addAssetRow = () => {
    const available = stocks.find((s) => !shockAssets.some((a) => a.ticker === s.ticker));
    const nextTicker = available ? available.ticker : (stocks[0]?.ticker || 'TCS');
    setShockAssets([...shockAssets, { ticker: nextTicker, delta: '+2.0%', vol: '1.0x' }]);
  };

  const removeAssetRow = (index: number) => {
    setShockAssets(shockAssets.filter((_, i) => i !== index));
  };

  const updateAssetRow = (index: number, field: 'ticker' | 'delta' | 'vol', value: string) => {
    const updated = [...shockAssets];
    updated[index] = { ...updated[index], [field]: value };
    setShockAssets(updated);
  };

  // Inject Custom Shock
  const injectCustomShock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsHeadline || shockAssets.length === 0) {
      showToast('Please enter a news headline and at least one asset.');
      return;
    }

    setLoading(true);
    const impactMap: Record<string, number> = {};
    shockAssets.forEach((a) => {
      const numVal = parseFloat(a.delta.replace('%', '').replace('+', '').trim());
      if (!isNaN(numVal) && a.ticker) {
        impactMap[a.ticker.toUpperCase()] = numVal;
      }
    });

    try {
      const categoryLabels: Record<string, string> = {
        macro: 'Macro Economic',
        regulatory: 'Regulatory & RBI',
        geopolitical: 'Geopolitical Event',
        corporate: 'Corporate Earnings',
      };

      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          headline: `[${categoryLabels[eventCategory] || 'Market Shock'}] ${newsHeadline}`,
          description: `Admin-injected shock (${execTiming === 'immediate' ? 'Immediate Execution' : '30s Lag'}). Volatility parameters updated.`,
          impactMap,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to inject shock');

      showToast('Market news broadcasted & asset shock applied live.');
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Shock broadcast failed');
    } finally {
      setLoading(false);
    }
  };

  // Execute Macro Preset
  const executeMacroPreset = async (presetName: string) => {
    try {
      const res = await fetch('/api/admin/crisis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ presetId: presetName }),
      });

      if (!res.ok) throw new Error('Preset shock execution failed');
      showToast(`Crisis Scenario: "${presetName}" triggered successfully.`);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Preset trigger failed');
    }
  };

  // Apply Single Price Override
  const applySinglePrice = async (stock: Stock) => {
    const rawVal = priceOverrides[stock.id];
    const val = parseFloat(rawVal);
    if (isNaN(val) || val <= 0) {
      showToast('Invalid price entered');
      return;
    }

    try {
      const res = await fetch('/api/admin/stocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          stockId: stock.id,
          currentPrice: val,
        }),
      });

      if (!res.ok) throw new Error('Failed to override price');
      showToast(`Price for ${stock.ticker} updated to ₹${val.toFixed(2)}.`);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Price override failed');
    }
  };

  // Reset Stock to Base Price
  const resetStockPrice = async (stock: Stock) => {
    try {
      const res = await fetch('/api/admin/stocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          stockId: stock.id,
          currentPrice: stock.previous_close,
          isFrozen: false,
        }),
      });

      if (!res.ok) throw new Error('Failed to reset stock');
      setPriceOverrides((prev) => ({
        ...prev,
        [stock.id]: stock.previous_close.toFixed(2),
      }));
      showToast(`${stock.ticker} restored to base ₹${stock.previous_close.toFixed(2)}.`);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Reset failed');
    }
  };

  // Toggle Single Stock Status / Halt
  const toggleStockStatus = async (stock: Stock) => {
    const nextHalt = !stock.is_frozen;
    try {
      const res = await fetch('/api/admin/stocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          stockId: stock.id,
          isFrozen: nextHalt,
        }),
      });

      if (!res.ok) throw new Error('Failed to toggle status');
      showToast(`${stock.ticker} trading status: ${nextHalt ? 'HALTED' : 'ACTIVE'}.`);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Toggle failed');
    }
  };

  // Bulk Apply All Price Overrides
  const bulkApplyPrices = async () => {
    try {
      await Promise.all(
        stocks.map((stock) => {
          const val = parseFloat(priceOverrides[stock.id]);
          if (!isNaN(val) && val > 0 && val !== stock.current_price) {
            return fetch('/api/admin/stocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stockId: stock.id,
                currentPrice: val,
              }),
            });
          }
          return Promise.resolve();
        })
      );
      showToast('Bulk prices applied across active securities.');
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Bulk apply failed');
    }
  };

  // Reset All Assets to Baselines
  const resetAllAssets = async () => {
    try {
      await Promise.all(
        stocks.map((stock) =>
          fetch('/api/admin/stocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stockId: stock.id,
              currentPrice: stock.previous_close,
              isFrozen: false,
            }),
          })
        )
      );
      setGlobalHalt(false);
      showToast('All securities restored to initial round baseline prices.');
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Reset all failed');
    }
  };

  // User Cash Adjust
  const handleAdjustUserCash = async (userId: string, isCredit: boolean) => {
    const delta = isCredit ? 50000 : -50000;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountDelta: delta }),
      });

      if (!res.ok) throw new Error('Failed to adjust cash');
      showToast(`Adjusted user balance by ${isCredit ? '+' : '-'}₹50,000.`);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Balance adjustment failed');
    }
  };

  // User Role Update
  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user role');
      showToast(`User role updated to ${newRole.toUpperCase()}`);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Role change failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('econ_token');
    window.location.href = '/login';
  };

  // Filtered Stocks
  const filteredStocks = stocks.filter((s) => {
    const matchesSearch =
      s.ticker.toLowerCase().includes(assetSearch.toLowerCase()) ||
      s.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
      s.sector.toLowerCase().includes(assetSearch.toLowerCase());
    const matchesSector =
      selectedSector === 'ALL' || s.sector.toUpperCase() === selectedSector.toUpperCase();
    return matchesSearch && matchesSector;
  });

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Auto-align Trading Desk sub-mode with active competition round type
  useEffect(() => {
    if (currentRound?.type === 'PRIMARY_DESK') {
      setDeskSubMode('slips');
    } else if (currentRound?.type === 'P2P_TRADING') {
      setDeskSubMode('p2p');
    }
  }, [currentRound?.type]);

  // Dynamic metrics computed for Admin header & floor telemetry
  const totalLiquidityValue = teams.length > 0
    ? teams.reduce((acc, t) => acc + (t.balance ?? 1000000), 0)
    : (users.length || 1) * 1000000;
  const formattedLiquidity = totalLiquidityValue >= 10000000
    ? `₹${(totalLiquidityValue / 10000000).toFixed(2)} Cr`
    : `₹${(totalLiquidityValue / 100000).toFixed(1)} L`;
  const totalTradeCount = auditLogs.length > 0 
    ? auditLogs.length 
    : allSlips.filter((s: any) => s.status === 'EXECUTED').length;

  return (
    <div className="bg-background font-body text-on-surface antialiased min-h-screen flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed w-full max-w-full overflow-x-hidden">
      {/* TOP APP BAR */}
      <header className="bg-white border-b border-outline-variant/60 sticky top-0 z-40 px-3 sm:px-6 lg:px-8 py-2 sm:py-0 sm:min-h-16 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 shadow-xs w-full max-w-full">
        <div className="flex items-center justify-between xl:justify-start gap-3 sm:gap-6 w-full xl:w-auto">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group">
            <div className="h-9 sm:h-10 px-2 sm:px-3 py-1 rounded-xl bg-[#141b16] border border-[#2d3a31] flex items-center gap-1.5 sm:gap-2.5 shadow-sm group-hover:border-[#4a7c59] transition-all shrink-0">
              <img
                src="/wds-logo-clean.png"
                alt="Wolf of Dalal Street"
                className="h-5 sm:h-7 w-auto object-contain shrink-0"
              />
              <span className="font-bold text-xs text-white whitespace-nowrap sm:hidden">
                WDS Admin
              </span>
              <div className="hidden sm:flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold tracking-tight text-white whitespace-nowrap">
                    Wolf of Dalal Street
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2e3b32] text-[#a4d4b3] font-semibold border border-[#3e5043]">
                    Admin
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-medium text-[#c8a45e] uppercase tracking-wider hidden xs:block mt-0.5">
                  Command Center
                </span>
              </div>
            </div>
          </Link>

          <div className="h-5 w-px bg-outline-variant/50 hidden xl:block"></div>

          {/* Quick Session Indicator - Live Synchronized to Active Round and Clock */}
          <div className="hidden md:flex items-center gap-2.5 text-xs shrink-0">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                roundClock.is_paused
                  ? 'bg-amber-500/10 text-amber-900 border-amber-400/60 shadow-xs'
                  : 'bg-emerald-500/10 text-emerald-900 border-emerald-400/60 shadow-xs'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  roundClock.is_paused ? 'bg-amber-600' : 'bg-emerald-600 animate-pulse'
                }`}
              ></span>
              <span className="font-bold">
                {currentRound?.name || 'Simulation'}
              </span>
              <span className="font-mono text-xs">
                {roundClock.is_paused ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-200/90 text-amber-950 font-black text-[11px]">
                    PAUSED ({Math.floor(roundClock.remaining_seconds / 60)}:
                    {(roundClock.remaining_seconds % 60).toString().padStart(2, '0')})
                  </span>
                ) : (
                  <span className="font-bold text-emerald-800">
                    {Math.floor(roundClock.remaining_seconds / 60)}:
                    {(roundClock.remaining_seconds % 60).toString().padStart(2, '0')} rem
                  </span>
                )}
              </span>
              <span className="text-on-surface-variant/40">•</span>
              <span className="text-on-surface-variant font-mono">
                {teams.length > 0 ? `${teams.length} Teams (${users.length} Terminals)` : `${users.length} Terminals`}
              </span>
            </span>
          </div>
        </div>

        {/* Right Emergency Controls & Session Metrics */}
        <div className="flex items-center justify-between xl:justify-end gap-2 sm:gap-3 flex-wrap w-full xl:w-auto">
          <div className="hidden 2xl:flex items-center gap-4 mr-1 text-xs text-on-surface-variant">
            <div>
              <span className="text-on-surface-variant/70">Liquidity: </span>
              <span className="font-mono font-bold text-on-surface num-tabular">{formattedLiquidity}</span>
            </div>
            <div>
              <span className="text-on-surface-variant/70">Trades: </span>
              <span className="font-mono font-bold text-on-surface num-tabular">
                {totalTradeCount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full xl:w-auto justify-between xl:justify-end flex-wrap sm:flex-nowrap">
            <button
              onClick={togglePauseSimulation}
              className={`flex-1 sm:flex-initial h-8.5 sm:h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95 cursor-pointer ${
                roundClock.is_paused
                  ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400 font-bold shadow-xs'
                  : 'border-outline-variant/80 hover:bg-surface-container-high text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {roundClock.is_paused ? 'play_arrow' : 'pause'}
              </span>
              <span>{roundClock.is_paused ? 'Resume Sim' : 'Pause Sim'}</span>
            </button>

            <button
              onClick={() => {
                const fullSecs = (currentRound?.duration_minutes || 20) * 60;
                handleUpdateClock({ remaining_seconds: fullSecs, is_paused: true });
              }}
              className="h-8.5 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-outline-variant/80 hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center justify-center gap-1 transition-colors active:scale-95 cursor-pointer"
              title={`Reset Clock to full duration (${currentRound?.duration_minutes || 20}m)`}
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              onClick={triggerGlobalHalt}
              className={`flex-1 sm:flex-initial h-8.5 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95 ${
                globalHalt
                  ? 'bg-error text-on-error border-error'
                  : 'bg-error-container hover:bg-error/15 text-error border border-error/30'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">pan_tool</span>
              <span>{globalHalt ? 'Lift Halt' : 'Halt Market'}</span>
            </button>

            <div className="h-5 w-px bg-outline-variant/50 hidden sm:block"></div>

            <Link
              href="/dashboard"
              className="h-8.5 sm:h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs"
              title="Access Normal Participant / Syndicate Terminal"
            >
              <span className="material-symbols-outlined text-[17px]">trending_up</span>
              <span className="hidden xs:inline">Normal Trading Mode</span>
              <span className="xs:hidden">Terminal</span>
            </Link>

            <button
              onClick={fetchAdminData}
              className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors shrink-0"
              title="Refresh Data"
            >
              <span className="material-symbols-outlined text-[17px]">refresh</span>
            </button>

            <button
              onClick={handleLogout}
              className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container flex items-center justify-center transition-colors shrink-0"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SESSION BANNER */}
      <div className="md:hidden bg-surface-container-low/80 border-b border-outline-variant/50 px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-mono w-full max-w-full">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              roundClock.is_paused ? 'bg-amber-600' : 'bg-emerald-600 animate-pulse'
            }`}
          ></span>
          <span className="font-semibold text-on-surface truncate max-w-[140px]">
            {currentRound?.name || 'Simulation'}
          </span>
          <span className="text-on-surface-variant num-tabular text-[11px]">
            •{' '}
            {roundClock.is_paused
              ? `PAUSED (${Math.floor(roundClock.remaining_seconds / 60)}:${(
                  roundClock.remaining_seconds % 60
                )
                  .toString()
                  .padStart(2, '0')})`
              : `${Math.floor(roundClock.remaining_seconds / 60)}:${(
                  roundClock.remaining_seconds % 60
                )
                  .toString()
                  .padStart(2, '0')} rem`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-on-surface-variant text-[11px] num-tabular">
          <span>{teams.length > 0 ? `${teams.length} Teams` : `${users.length} Terminals`}</span>
          <span>Liq: {formattedLiquidity}</span>
        </div>
      </div>

      {/* MASTER ROUND CONTROL BAR */}
      <MasterRoundControlBar
        rounds={competitionRounds}
        currentRound={currentRound}
        clock={roundClock}
        onAdvanceRound={handleAdvanceRound}
        onUpdateClock={handleUpdateClock}
        onOpenPricingConsole={() => {
          setActiveTab('pricing');
          handleGeneratePreview();
        }}
        onOpenIPODesk={() => setActiveTab('ipo')}
        loading={roundActionLoading}
      />

      {/* VIEW TABS BAR */}
      <div className="bg-[#f5f1ea] border-b border-outline-variant/40 px-3 sm:px-8 sticky top-16 z-30 w-full max-w-full overflow-x-auto no-scrollbar">
        <div className="max-w-[1536px] mx-auto flex items-center gap-2 sm:gap-4 text-xs font-semibold whitespace-nowrap min-w-max">
          <button
            onClick={() => setActiveTab('desk')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'desk'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">point_of_sale</span>
            Trading Desk Station
          </button>
          <button
            onClick={() => {
              setActiveTab('pricing');
              handleGeneratePreview();
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'pricing'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">candlestick_chart</span>
            Dynamic Pricing Engine
          </button>
          <button
            onClick={() => setActiveTab('ipo')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'ipo'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">receipt_long</span>
            IPO Desk
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'teams'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">groups</span>
            Teams &amp; Participants ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">leaderboard</span>
            Leaderboard ({isSuperAdmin ? 'Global' : 'Cohort'})
          </button>
          <button
            onClick={() => setActiveTab('command')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'command'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">speed</span>
            Macro &amp; Shocks
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">group</span>
            Participants &amp; Wallets ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'audit'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">receipt_long</span>
            Audit &amp; Events
          </button>
        </div>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-[1536px] w-full mx-auto p-3 sm:p-6 lg:p-8 flex flex-col gap-5 sm:gap-6 lg:gap-8 overflow-x-hidden">
        {/* ===================================================================== */}
        {/* DYNAMIC 4-BRANCH PRICING SETTLEMENT ENGINE TAB */}
        {/* ===================================================================== */}
        {activeTab === 'pricing' && (
          <DynamicPricingSettlementConsole
            currentRound={currentRound}
            rFormulaStats={rFormulaStats}
            overrideR={overrideR}
            onOverrideRChange={(val) => setOverrideR(val)}
            stockNewsDeltas={stockNewsDeltas}
            onStockNewsDeltaChange={(ticker, val) =>
              setStockNewsDeltas((prev) => ({ ...prev, [ticker]: val }))
            }
            stockRDeltas={stockRDeltas}
            onStockRDeltaChange={(ticker, val) =>
              setStockRDeltas((prev) => ({ ...prev, [ticker]: val }))
            }
            onRandomizeAllR={handleRandomizeAllR}
            previewSettlements={previewSettlements}
            onGeneratePreview={handleGeneratePreview}
            onApplySettlement={handleApplySettlement}
            loadingPreview={loadingPreview}
            applyingSettlement={applyingSettlement}
          />
        )}

        {/* ===================================================================== */}
        {/* IPO PRIMARY ALLOTMENT DESK TAB */}
        {/* ===================================================================== */}
        {activeTab === 'ipo' && (
          <IPOSubscriptionDesk
            listings={ipoListings}
            subscriptions={ipoSubscriptions}
            onAllotIPO={handleAllotIPO}
            allottingIpoId={allottingIpoId}
            onRefreshIPO={fetchIPOData}
            showToast={showToast}
            currentRoundId={currentRound?.id}
          />
        )}

        {/* ===================================================================== */}
        {/* 1. TRADING DESK (ASSISTED EXECUTION STATION) */}
        {/* ===================================================================== */}
        {activeTab === 'desk' && (
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-primary">point_of_sale</span>
                  <h1 className="text-base sm:text-xl font-bold text-on-surface">
                    Assisted Trading Desk &amp; Execution Console
                  </h1>
                </div>
                <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1">
                  Students cannot trade directly. When a participant presents an order slip based on live news, select their account, review their portfolio &amp; cash, and execute on Dalal Street.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  {isSuperAdmin ? 'Master Superadmin Desk' : `${currentAdmin?.email || 'Desk Lead'}`}
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 bg-[#f5f1ea] border border-outline-variant/60 rounded-full text-on-surface-variant">
                  {users.length} {users.length === 1 ? 'Student' : 'Students'} in Cohort
                </span>
              </div>
            </div>

            {/* 10% LIQUIDITY RESERVE FLOOR RADAR (Rulebook §3: Min ₹1,00,000 cash at all times) */}
            {(() => {
              const breached = teams.filter((t) => (t.balance ?? 1000000) < 100000);
              const warning = teams.filter((t) => (t.balance ?? 1000000) >= 100000 && (t.balance ?? 1000000) < 150000);

              if (breached.length === 0 && warning.length === 0) return null;

              return (
                <div className="space-y-2.5">
                  {breached.length > 0 && (
                    <div className="p-4 rounded-xl sm:rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[24px] text-rose-700 shrink-0 mt-0.5 animate-bounce">
                          warning
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[10px] uppercase tracking-wider bg-rose-700 text-white px-2 py-0.5 rounded">
                              ROUND DISQUALIFICATION RISK
                            </span>
                            <h4 className="font-bold text-sm text-rose-950">
                              {breached.length} Team(s) Breached Mandatory 10% Cash Reserve (&lt; ₹1,00,000)
                            </h4>
                          </div>
                          <p className="text-xs text-rose-800 mt-1">
                            Rulebook §3: Teams must maintain at least 10% of their ₹10L initial virtual money (₹1,00,000 cash on hand) at all times; otherwise disqualified for the round.
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {breached.map((bt) => (
                              <span
                                key={bt.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-rose-300 font-mono text-xs font-bold text-rose-900 shadow-xs"
                              >
                                <span>{bt.name} ({bt.code}):</span>
                                <span className="text-rose-600 font-black">
                                  ₹{(bt.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {warning.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="material-symbols-outlined text-[19px] text-amber-700 shrink-0">speed</span>
                        <span className="font-bold">Liquidity Warning (Near ₹1L Cash Floor):</span>
                        {warning.map((wt) => (
                          <span key={wt.id} className="font-mono bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-800">
                            {wt.name}: ₹{(wt.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TRADING DESK SUB-NAVIGATION TABS */}
            <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setDeskSubMode('p2p')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  deskSubMode === 'p2p'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">swap_horiz</span>
                <span>Inter-Team P2P Trade Desk</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  deskSubMode === 'p2p' ? 'bg-white text-primary' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  5% Dual Fee
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDeskSubMode('slips')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  deskSubMode === 'slips'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">receipt_long</span>
                <span>Primary Desk &amp; Slips (Round 0)</span>
                {pendingSlips.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    deskSubMode === 'slips' ? 'bg-white text-primary' : 'bg-primary text-white'
                  }`}>
                    {pendingSlips.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDeskSubMode('disciplinary')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  deskSubMode === 'disciplinary'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">gavel</span>
                <span>SEC Enforcement &amp; Penalties</span>
              </button>
            </div>

            {deskSubMode === 'slips' && (
              <>
            {/* 1. FAST SLIP ID LOOKUP & INCOMING ORDER QUEUE (Real-Time Excel Sync) */}
            <div className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-4 sm:space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[24px] text-primary">receipt_long</span>
                    <h2 className="text-base sm:text-lg font-bold text-on-surface">
                      Order Slip Queue &amp; Instant Slip ID Lookup
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono">
                      {pendingSlips.length} Pending at Desk
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Enter the participant&apos;s Slip ID to inspect their stock request. Approving an order immediately executes the trade and updates the live Excel sheet in real time.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <a
                    href="/api/admin/export-ledger"
                    download="dalal_street_live_trades.csv"
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Export real-time trade logs with Slip ID, Team Name, and Stock Details"
                  >
                    <span className="material-symbols-outlined text-[17px]">table_view</span>
                    <span>Download Live Excel Sheet</span>
                  </a>
                  <button
                    onClick={fetchAdminSlips}
                    className="p-2 rounded-xl border border-outline-variant/70 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
                    title="Refresh Slips"
                  >
                    <span className="material-symbols-outlined text-[17px]">refresh</span>
                  </button>
                </div>
              </div>

              {/* Instant Slip ID Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant/70">
                    search
                  </span>
                  <input
                    type="text"
                    value={lookupSlipId}
                    onChange={(e) => setLookupSlipId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLookupSlip();
                    }}
                    placeholder="Slip ID (e.g. SLIP-6026)..."
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono font-semibold bg-surface border border-outline-variant/70 rounded-xl focus:border-primary focus:outline-none uppercase"
                  />
                </div>
                <button
                  onClick={() => handleLookupSlip()}
                  disabled={slipActionLoading}
                  className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">search</span>
                  <span className="hidden xs:inline">Lookup</span>
                  <span className="xs:hidden">Find</span>
                </button>
                {activeSlip && (
                  <button
                    onClick={() => setActiveSlip(null)}
                    className="px-3 py-2 rounded-xl border border-outline-variant/70 text-xs text-on-surface-variant hover:text-on-surface transition cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Active Inspected Slip Card */}
              {activeSlip && (
                <div className="p-3.5 sm:p-5 rounded-xl bg-surface-container-low border-2 border-primary/30 space-y-3 sm:space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-outline-variant/40">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary text-on-primary font-mono font-bold text-xs">
                        {activeSlip.slip_id}
                      </span>
                      <span className="text-xs font-bold text-on-surface">
                        Team: {activeSlip.team_name}
                      </span>
                      {(activeSlip.student_name || activeSlip.user_name) && (
                        <span className="text-xs text-on-surface-variant">
                          • {activeSlip.student_name || activeSlip.user_name}
                          {(activeSlip.student_email || activeSlip.user_email) ? ` (${activeSlip.student_email || activeSlip.user_email})` : ''}
                        </span>
                      )}
                    </div>
                    <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      activeSlip.status === 'EXECUTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeSlip.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800 animate-pulse'
                    }`}>
                      Status: {activeSlip.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                    <div className="p-2 sm:p-2.5 bg-surface rounded-lg border border-outline-variant/40">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Security</span>
                      <span className="font-bold text-sm text-on-surface font-mono">{activeSlip.ticker}</span>
                      <span className="text-[10px] text-on-surface-variant block truncate">{activeSlip.stock_name}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 bg-surface rounded-lg border border-outline-variant/40">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Order Side &amp; Qty</span>
                      <span className={`font-bold text-sm font-mono ${activeSlip.order_type === 'BUY' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {activeSlip.order_type} {activeSlip.quantity} Shares
                      </span>
                    </div>
                    <div className="p-2 sm:p-2.5 bg-surface rounded-lg border border-outline-variant/40">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Unit LTP</span>
                      <span className="font-bold text-sm text-on-surface font-mono">₹{activeSlip.price.toFixed(2)}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 bg-surface rounded-lg border border-outline-variant/40">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Total Value</span>
                      <span className="font-bold text-sm text-on-surface font-mono">
                        ₹{activeSlip.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {activeSlip.status === 'PENDING' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <button
                        onClick={() => handleExecuteSlip(activeSlip.slip_id, 'APPROVE')}
                        disabled={slipActionLoading}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Approve &amp; Execute Trade (Sync to Excel)</span>
                      </button>
                      <button
                        onClick={() => handleExecuteSlip(activeSlip.slip_id, 'REJECT')}
                        disabled={slipActionLoading}
                        className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                        <span>Reject Request</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Queue Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface">Live Desk Slips Queue</span>
                    <button
                      onClick={() => setSlipFilter('PENDING')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                        slipFilter === 'PENDING'
                          ? 'bg-amber-100 text-amber-900 font-bold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Pending ({pendingSlips.length})
                    </button>
                    <button
                      onClick={() => setSlipFilter('ALL')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                        slipFilter === 'ALL'
                          ? 'bg-[#f5f1ea] text-on-surface font-bold border border-outline-variant/60'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      All Slips ({allSlips.length})
                    </button>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-on-surface-variant hidden sm:inline">Click any slip row to inspect</span>
                </div>

                {/* Mobile Touch Cards View (visible on mobile only) */}
                <div className="sm:hidden space-y-2">
                  {(slipFilter === 'PENDING' ? pendingSlips : allSlips).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setActiveSlip(s)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        activeSlip?.slip_id === s.slip_id
                          ? 'border-primary bg-primary/5 shadow-xs'
                          : 'border-outline-variant/60 bg-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-primary/10 text-primary border border-primary/20">
                            {s.slip_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === 'EXECUTED'
                              ? 'bg-emerald-50 text-emerald-800'
                              : s.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-mono">
                          {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-on-surface mb-1">
                        <span className="truncate pr-2">{s.team_name}</span>
                        <span className={`shrink-0 font-bold font-mono ${s.order_type === 'BUY' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {s.order_type} {s.quantity} {s.ticker}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span className="truncate pr-2">{s.student_name || s.user_name || 'Participant'}</span>
                        <span className="font-mono font-bold text-on-surface shrink-0">₹{s.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>

                      {s.status === 'PENDING' && (
                        <div className="flex items-center gap-2 pt-2 mt-2 border-t border-outline-variant/30" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleExecuteSlip(s.slip_id, 'APPROVE')}
                            disabled={slipActionLoading}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleExecuteSlip(s.slip_id, 'REJECT')}
                            disabled={slipActionLoading}
                            className="py-1.5 px-3 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {(slipFilter === 'PENDING' ? pendingSlips : allSlips).length === 0 && (
                    <div className="p-4 text-center text-xs text-on-surface-variant bg-surface rounded-xl border border-outline-variant/40">
                      No order slips in this queue.
                    </div>
                  )}
                </div>

                {/* Desktop Table View (hidden on mobile) */}
                <div className="hidden sm:block overflow-x-auto border border-outline-variant/50 rounded-xl bg-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container-low border-b border-outline-variant/50 text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Slip ID</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3">Participant</th>
                        <th className="py-2.5 px-3">Security</th>
                        <th className="py-2.5 px-3 text-center">Type</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 font-mono-numbers">
                      {(slipFilter === 'PENDING' ? pendingSlips : allSlips).map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-surface-container-low transition text-[11px] cursor-pointer"
                          onClick={() => setActiveSlip(s)}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-primary">{s.slip_id}</td>
                          <td className="py-2.5 px-3 text-on-surface-variant">
                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-bold text-on-surface">{s.team_name}</td>
                          <td className="py-2.5 px-3 font-sans text-on-surface">{s.student_name || s.user_name}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-on-surface">{s.ticker}</td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.order_type === 'BUY' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                            }`}>
                              {s.order_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-on-surface">{s.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-on-surface">
                            ₹{s.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              s.status === 'EXECUTED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                : s.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border border-rose-300'
                                : 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {s.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleExecuteSlip(s.slip_id, 'APPROVE')}
                                  disabled={slipActionLoading}
                                  className="px-2 py-1 rounded bg-emerald-700 text-white text-[10px] font-bold hover:bg-emerald-800 transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleExecuteSlip(s.slip_id, 'REJECT')}
                                  disabled={slipActionLoading}
                                  className="px-2 py-1 rounded border border-rose-300 bg-rose-50 text-rose-800 text-[10px] font-bold hover:bg-rose-100 transition"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-on-surface-variant">Archived</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {(slipFilter === 'PENDING' ? pendingSlips : allSlips).length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center py-8 text-on-surface-variant font-sans text-xs">
                            {slipFilter === 'PENDING'
                              ? 'No order slips currently waiting in queue. As participants generate slips on their terminal, they will populate here.'
                              : 'No order slips have been recorded yet.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Student Selector & Live Portfolio Profile (5 Cols) */}
              <div className="lg:col-span-5 space-y-5">
                {/* Search & Pick Student */}
                <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Select Participant
                    </label>
                    <span className="text-[11px] text-primary font-semibold">
                      {users.length} Enrolled
                    </span>
                  </div>

                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by name, roll, or email..."
                    className="w-full py-2 px-3 text-xs bg-surface border border-outline-variant/70 rounded-xl focus:border-primary focus:outline-none"
                  />

                  {/* Student list dropdown / scroller */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-outline-variant/20">
                    {users
                      .filter((u) => {
                        const term = studentSearch.toLowerCase();
                        return (
                          u.email.toLowerCase().includes(term) ||
                          (u.username && u.username.toLowerCase().includes(term)) ||
                          (u.first_name && u.first_name.toLowerCase().includes(term))
                        );
                      })
                      .map((u) => {
                        const isSelected = u.id === selectedStudentId;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedStudentId(u.id)}
                            className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-primary/10 border border-primary/40 text-primary font-bold shadow-xs'
                                : 'hover:bg-surface-container-low text-on-surface'
                            }`}
                          >
                            <div className="truncate">
                              <div className="text-xs font-semibold truncate">
                                {u.username || (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email.split('@')[0])}
                              </div>
                              <div className="text-[10px] text-on-surface-variant/80 truncate">
                                {u.email} • {u.group_name || 'General Cohort'}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-mono text-xs font-bold block">
                                ₹{u.netWorth ? (u.netWorth / 100000).toFixed(2) : (u.balance / 100000).toFixed(2)}L
                              </span>
                              <span
                                className={`text-[10px] font-mono ${
                                  (u.totalReturnPercent || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {(u.totalReturnPercent || 0) >= 0 ? '+' : ''}
                                {(u.totalReturnPercent || 0).toFixed(1)}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Selected Student Summary Card */}
                {(() => {
                  const currentStudent = users.find((u) => u.id === selectedStudentId);
                  if (!currentStudent) {
                    return (
                      <div className="p-8 text-center text-on-surface-variant text-xs bg-surface-container-lowest rounded-2xl border border-outline-variant/70">
                        No student selected. Pick a student from the cohort above.
                      </div>
                    );
                  }

                  const studentHoldings = currentStudent.portfolios || [];

                  return (
                    <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                        <div>
                          <h3 className="font-bold text-sm text-on-surface">
                            {currentStudent.username || currentStudent.first_name || currentStudent.email.split('@')[0]}
                          </h3>
                          <p className="text-[11px] text-on-surface-variant font-mono">{currentStudent.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f5f1ea] border border-outline-variant/60 text-primary">
                          {currentStudent.group_name || 'Assigned Student'}
                        </span>
                      </div>

                      {/* Financial KPI stats */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40">
                          <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Available Cash</span>
                          <span className="text-sm font-bold text-on-surface font-mono">
                            ₹{currentStudent.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40">
                          <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Net Worth</span>
                          <span className="text-sm font-bold text-on-surface font-mono">
                            ₹{(currentStudent.netWorth || currentStudent.balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      {/* Current Positions */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-on-surface">Portfolio Holdings ({studentHoldings.length})</span>
                          <span className="text-[10px] text-on-surface-variant">LTP Live</span>
                        </div>

                        {studentHoldings.length === 0 ? (
                          <div className="p-4 text-center text-xs text-on-surface-variant/70 bg-surface rounded-xl border border-outline-variant/30">
                            100% Cash Portfolio (No equities held yet)
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {studentHoldings.map((pos: any) => {
                              const stock = stocks.find((s) => s.id === pos.stock_id);
                              const ltp = stock ? stock.current_price : pos.avg_buy_price;
                              const pnl = (ltp - pos.avg_buy_price) * pos.shares_count;
                              return (
                                <div
                                  key={pos.id}
                                  className="p-2.5 rounded-xl bg-surface border border-outline-variant/50 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-bold font-mono text-on-surface">{stock?.ticker || 'ASSET'}</span>
                                    <span className="text-[10px] text-on-surface-variant block">
                                      {pos.shares_count} sh @ ₹{pos.avg_buy_price.toFixed(0)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <span className="font-mono font-bold block">
                                        ₹{(pos.shares_count * ltp).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                      </span>
                                      <span className={`text-[10px] font-mono ${pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeskStockId(pos.stock_id);
                                        setDeskType('SELL');
                                        setDeskQty(pos.shares_count);
                                      }}
                                      className="px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold hover:bg-rose-100 transition cursor-pointer"
                                      title="Load into Sell Order"
                                    >
                                      Sell
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Order Execution Console (7 Cols) */}
              <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-4 sm:space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 sm:pb-3 border-b border-outline-variant/40">
                    <div>
                      <h2 className="font-bold text-sm sm:text-base text-on-surface flex items-center gap-1.5">
                        <span>Order Placement Form</span>
                      </h2>
                      <p className="text-[11px] sm:text-xs text-on-surface-variant">
                        Execute buy or sell order directly on the participant&apos;s Dalal Street portfolio
                      </p>
                    </div>
                    <span className="self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#edf5ef] text-[#295236] border border-[#4a7c59]/30">
                      Real-time Engine
                    </span>
                  </div>

                  {/* Buy / Sell Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-container-low border border-outline-variant/40">
                    <button
                      type="button"
                      onClick={() => setDeskType('BUY')}
                      className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        deskType === 'BUY'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">add_circle</span>
                      <span>BUY (Long Asset)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeskType('SELL')}
                      className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        deskType === 'SELL'
                          ? 'bg-rose-700 text-white shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">do_not_disturb_on</span>
                      <span>SELL (Square Off)</span>
                    </button>
                  </div>

                  {/* Stock Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Target Security (Stock)
                    </label>
                    <select
                      value={deskStockId}
                      onChange={(e) => setDeskStockId(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none cursor-pointer truncate"
                    >
                      {stocks.map((stock) => (
                        <option key={stock.id} value={stock.id}>
                          {stock.ticker} — ₹{stock.current_price.toFixed(2)} ({stock.name}) {stock.is_frozen ? '⛔ HALTED' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Stock Live Snapshot */}
                  {(() => {
                    const stock = stocks.find((s) => s.id === deskStockId) || stocks[0];
                    if (!stock) return null;
                    const change = stock.current_price - stock.previous_close;
                    const changePct = (change / stock.previous_close) * 100;
                    const isUp = change >= 0;

                    return (
                      <div className="p-3 rounded-xl bg-[#f5f1ea] border border-outline-variant/50 flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sm text-on-surface">{stock.ticker}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-on-surface-variant border border-outline-variant/40">
                              {stock.sector}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant truncate block">{stock.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm block">₹{stock.current_price.toFixed(2)}</span>
                          <span className={`text-[11px] font-mono font-semibold ${isUp ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isUp ? '+' : ''}{changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quantity Stepper */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        Share Quantity
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        {[10, 25, 50, 100, 250].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDeskQty(preset)}
                            className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-surface border border-outline-variant/50 hover:bg-surface-container transition cursor-pointer"
                          >
                            +{preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeskQty((q) => Math.max(1, q - 10))}
                        className="w-9 h-9 rounded-lg border border-outline-variant/70 bg-surface flex items-center justify-center font-bold text-sm hover:bg-surface-container active:scale-95 transition cursor-pointer"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={deskQty}
                        onChange={(e) => setDeskQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 h-9 text-center font-mono font-bold text-xs sm:text-sm bg-surface rounded-lg border border-outline-variant/70 focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setDeskQty((q) => q + 10)}
                        className="w-9 h-9 rounded-lg border border-outline-variant/70 bg-surface flex items-center justify-center font-bold text-sm hover:bg-surface-container active:scale-95 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Calculation Breakdown */}
                  {(() => {
                    const currentStudent = users.find((u) => u.id === selectedStudentId);
                    const stock = stocks.find((s) => s.id === deskStockId) || stocks[0];
                    const price = stock ? stock.current_price : 0;
                    const orderTotal = deskQty * price;
                    const currentBal = currentStudent ? currentStudent.balance : 0;
                    const resultingBal = deskType === 'BUY' ? currentBal - orderTotal : currentBal + orderTotal;

                    return (
                      <div className="p-3 sm:p-4 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-1.5 text-xs">
                        <div className="flex justify-between text-on-surface-variant">
                          <span>Unit Price (LTP):</span>
                          <span className="font-mono font-bold text-on-surface">₹{price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-on-surface-variant">
                          <span>Total Consideration:</span>
                          <span className="font-mono font-bold text-sm text-on-surface">
                            ₹{orderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-on-surface-variant pt-1.5 border-t border-outline-variant/30">
                          <span>Resulting Cash Balance:</span>
                          <span
                            className={`font-mono font-bold ${
                              resultingBal < 0 ? 'text-rose-700' : 'text-on-surface'
                            }`}
                          >
                            ₹{resultingBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Execute Button */}
                  <button
                    type="button"
                    onClick={executeDeskTrade}
                    disabled={deskExecuting || !selectedStudentId}
                    className={`w-full py-2.5 sm:py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                      deskType === 'BUY'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-rose-700 hover:bg-rose-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {deskExecuting ? 'sync' : 'check_circle'}
                    </span>
                    <span>
                      {deskExecuting
                        ? 'Updating Team Portfolio...'
                        : `Execute ${deskType} (${deskQty} Shares) for Team`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            </>
            )}

            {deskSubMode === 'p2p' && (
              <div className="flex flex-col gap-5">
                {/* Header Card */}
                <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[24px] text-primary">swap_horiz</span>
                      <h2 className="text-base sm:text-lg font-bold text-on-surface">
                        Inter-Team P2P Trade Desk
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono">
                        Dual 5% Brokerage
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Rulebook §2: Teams trade stocks amongst themselves. When both teams mutually agree on a deal, the Econ Desk executes the transfer, validates the ±10% circuit limits, debits buyer (gross + 5%), credits seller (gross - 5%), and collects 10% total commission.
                    </p>
                  </div>
                  <a
                    href="/api/admin/export-ledger"
                    download="dalal_street_live_trades.csv"
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">table_view</span>
                    <span>Download Ledger</span>
                  </a>
                </div>

                {/* Form & Settlement Calculation Grid */}
                {(() => {
                  const seller = teams.find((t) => t.id === p2pSellerTeamId || t.name.toLowerCase() === p2pSellerTeamId.toLowerCase()) || null;
                  const buyer = teams.find((t) => t.id === p2pBuyerTeamId || t.name.toLowerCase() === p2pBuyerTeamId.toLowerCase()) || null;
                  const stock = stocks.find((s) => s.id === p2pStockId) || stocks[0];
                  const sellerPortfolio = seller?.portfolio || seller?.members?.[0]?.portfolios || [];
                  const sellerPos = sellerPortfolio.find((p: any) => p.stock_id === stock?.id);
                  const sellerShares = sellerPos ? sellerPos.shares_count : 0;

                  const isPrimaryPool =
                    p2pSellerTeamId.trim().toLowerCase() === 'central primary pool' ||
                    p2pSellerTeamId.trim().toLowerCase().includes('primary pool') ||
                    p2pSellerTeamId.trim().toLowerCase().includes('issuance pool') ||
                    currentRound?.type === 'PRIMARY_DESK' ||
                    currentRound?.id === 'round-0' ||
                    currentRound?.index === 0;

                  const price = isPrimaryPool
                    ? (stock ? stock.current_price : 0)
                    : (parseFloat(p2pAgreedPrice) || (stock ? stock.current_price : 0));
                  const qty = Number(p2pQty) || 0;
                  const gross = price * qty;
                  const buyerBrok = isPrimaryPool ? 0 : gross * 0.05;
                  const buyerDebit = gross + buyerBrok;
                  const sellerBrok = isPrimaryPool ? 0 : gross * 0.05;
                  const sellerCredit = gross - sellerBrok;
                  const econRevenue = buyerBrok + sellerBrok;
                  const buyerCash = buyer?.balance ?? 1000000;
                  const buyerPostCash = buyerCash - buyerDebit;
                  const lowerCircuit = stock?.lower_circuit || (stock ? stock.current_price * 0.9 : 0);
                  const upperCircuit = stock?.upper_circuit || (stock ? stock.current_price * 1.1 : 0);
                  const isRawCircuitBreached = !isPrimaryPool && (price < lowerCircuit || price > upperCircuit);
                  const isCircuitBreached = !isPrimaryPool && !p2pBypassCircuit && isRawCircuitBreached;
                  const isSameTeam = p2pSellerTeamId && p2pBuyerTeamId && p2pSellerTeamId.trim().toLowerCase() === p2pBuyerTeamId.trim().toLowerCase();
                  const canExecute = p2pSellerTeamId.trim().length > 0 && p2pBuyerTeamId.trim().length > 0 && !isSameTeam && qty > 0 && price > 0 && !isCircuitBreached;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* Datalist for fast on-the-spot team suggestions */}
                      <datalist id="admin-team-suggestions">
                        <option value="Central Primary Pool">🏛️ Central Primary Pool (Round 0 Unlimited Issuance)</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.code} — Cash: ₹{(t.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </option>
                        ))}
                      </datalist>

                      {/* Left: Input Form (7 cols) */}
                      <div className="lg:col-span-7 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-4">
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-emerald-700">bolt</span>
                            <span className="font-bold">Fast Event Floor Mode:</span>
                            <span className="text-emerald-800 hidden sm:inline">Type any on-the-spot team name. Trades execute &amp; broadcast in 10s without DB blocks!</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-mono font-bold text-[10px] uppercase">
                            Active
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Seller Team */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">call_made</span>
                                <span>1. Seller Team</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setP2pSellerTeamId('Central Primary Pool')}
                                className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                                title="Set Central Primary Pool as the seller for Round 0 initial portfolio allocations"
                              >
                                🏛️ Round 0 Primary Pool
                              </button>
                            </div>
                            <input
                              type="text"
                              list="admin-team-suggestions"
                              value={p2pSellerTeamId}
                              onChange={(e) => setP2pSellerTeamId(e.target.value)}
                              placeholder="Type or select Seller (e.g. Team 14, Bulls)..."
                              className="w-full py-2 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none"
                            />
                            {seller ? (
                              <div className="text-[10px] text-on-surface-variant flex items-center justify-between pt-0.5">
                                <span>Leader: {seller.leader_name}</span>
                                <span className="font-mono font-semibold">Cash: ₹{(seller.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                            ) : p2pSellerTeamId.trim() ? (
                              <p className="text-[10px] text-emerald-700 font-semibold pt-0.5">
                                ⚡ New on-spot team: &quot;{p2pSellerTeamId}&quot; (auto-created on submit)
                              </p>
                            ) : null}
                          </div>

                          {/* Buyer Team */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">call_received</span>
                              <span>2. Buyer Team (Purchasing Shares)</span>
                            </label>
                            <input
                              type="text"
                              list="admin-team-suggestions"
                              value={p2pBuyerTeamId}
                              onChange={(e) => setP2pBuyerTeamId(e.target.value)}
                              placeholder="Type or select Buyer (e.g. Team 8, Wolves)..."
                              className="w-full py-2 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none"
                            />
                            {buyer ? (
                              <div className="text-[10px] text-on-surface-variant flex items-center justify-between pt-0.5">
                                <span>Leader: {buyer.leader_name}</span>
                                <span className="font-mono font-semibold">Cash: ₹{(buyer.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                            ) : p2pBuyerTeamId.trim() ? (
                              <p className="text-[10px] text-emerald-700 font-semibold pt-0.5">
                                ⚡ New on-spot team: &quot;{p2pBuyerTeamId}&quot; (auto-created on submit)
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {isSameTeam && (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">error</span>
                            <span>Seller and Buyer must be two different teams!</span>
                          </div>
                        )}

                        {/* Security Selection */}
                        <div className="space-y-1 pt-2 border-t border-outline-variant/30">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                              3. Traded Security (Stock)
                            </label>
                            {sellerShares > 0 ? (
                              <span className="text-[11px] font-bold font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                Seller holds: {sellerShares} shares
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold font-mono text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                Seller holds: 0 shares
                              </span>
                            )}
                          </div>
                          <select
                            value={p2pStockId}
                            onChange={(e) => {
                              setP2pStockId(e.target.value);
                              const s = stocks.find((st) => st.id === e.target.value);
                              if (s) setP2pAgreedPrice(s.current_price.toFixed(2));
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none cursor-pointer"
                          >
                            {stocks.map((stock) => {
                              const pos = sellerPortfolio.find((p: any) => p.stock_id === stock.id);
                              const count = pos ? pos.shares_count : 0;
                              return (
                                <option key={stock.id} value={stock.id}>
                                  {stock.ticker} — LTP: ₹{stock.current_price.toFixed(2)} [{stock.sector}] {count > 0 ? `(Seller owns ${count})` : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Circuit Breaker Display Banner */}
                        {stock && (
                          <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-bold text-on-surface">{stock.ticker}</span>
                              <span className="text-on-surface-variant">LTP: ₹{stock.current_price.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                                LC (-10%): ₹{lowerCircuit.toFixed(2)}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                                UC (+10%): ₹{upperCircuit.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {/* Quantity */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                                4. Share Quantity
                              </label>
                              {sellerShares > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setP2pQty(sellerShares)}
                                  className="text-[10px] text-primary font-bold hover:underline"
                                >
                                  Max ({sellerShares})
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={p2pQty}
                                onChange={(e) => setP2pQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full py-2 px-3 text-xs font-mono font-bold bg-surface rounded-xl border border-outline-variant/70 focus:border-primary focus:outline-none"
                              />
                            </div>
                            {sellerShares > 0 ? (
                              <p className="text-[10px] text-zinc-500 font-medium pt-0.5">
                                Seller recorded in DB: {sellerShares} shares
                              </p>
                            ) : (
                              <p className="text-[10px] text-amber-800 font-semibold pt-0.5">
                                ⚡ Floor Mode: Verified on physical jobber slip &amp; team Excel
                              </p>
                            )}
                          </div>

                          {/* Agreed Price / Official Fixed Price */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                                {isPrimaryPool ? '5. Official Fixed Base Price (₹)' : '5. Agreed Price per Share (₹)'}
                              </label>
                              {isPrimaryPool ? (
                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  Round 0 Fixed Base Price
                                </span>
                              ) : stock ? (
                                <button
                                  type="button"
                                  onClick={() => setP2pAgreedPrice(stock.current_price.toFixed(2))}
                                  className="text-[10px] text-primary font-bold hover:underline"
                                >
                                  Reset to LTP
                                </button>
                              ) : null}
                            </div>
                            <input
                              type="number"
                              step="0.05"
                              value={isPrimaryPool ? (stock ? stock.current_price.toFixed(2) : '0.00') : p2pAgreedPrice}
                              onChange={(e) => {
                                if (!isPrimaryPool) setP2pAgreedPrice(e.target.value);
                              }}
                              readOnly={isPrimaryPool}
                              className={`w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border focus:outline-none ${
                                isPrimaryPool
                                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-not-allowed border-outline-variant/50'
                                  : isRawCircuitBreached && !p2pBypassCircuit
                                  ? 'border-rose-500 text-rose-700 bg-rose-50/50'
                                  : 'bg-surface border-outline-variant/70 focus:border-primary'
                              }`}
                            />
                            {isPrimaryPool ? (
                              <p className="text-[10px] text-amber-800 font-semibold pt-0.5">
                                🏛️ Round 0 Rule: Stocks purchased from the Econ Desk are issued at fixed official base prices. No price bargaining permitted.
                              </p>
                            ) : isRawCircuitBreached ? (
                              <div className="pt-1 space-y-1">
                                <p className="text-[10px] text-rose-700 font-bold">
                                  ⚠️ Circuit limit: ₹{lowerCircuit.toFixed(2)} - ₹{upperCircuit.toFixed(2)}.
                                </p>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-900 bg-amber-50 p-1 rounded-md border border-amber-200">
                                  <input
                                    type="checkbox"
                                    checked={p2pBypassCircuit}
                                    onChange={(e) => setP2pBypassCircuit(e.target.checked)}
                                    className="rounded text-primary cursor-pointer"
                                  />
                                  <span>Bypass Circuit Collar (Special Floor Auction Deal)</span>
                                </label>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Live Financial Breakdown & Execution Card (5 cols) */}
                      <div className="lg:col-span-5 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-surface-container-lowest border-2 border-primary/30 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                          <h3 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-primary">receipt</span>
                            <span>Deal Settlement Voucher</span>
                          </h3>
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                            isPrimaryPool
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isPrimaryPool ? '🏛️ Round 0 Primary Desk' : 'Dual 5% Fee'}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between text-on-surface-variant">
                            <span>Gross Deal Consideration:</span>
                            <span className="font-mono font-bold text-on-surface">
                              ₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className={`p-2.5 rounded-xl border space-y-1 ${
                            isPrimaryPool ? 'bg-amber-50/50 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'
                          }`}>
                            <div className="flex justify-between font-medium text-emerald-900">
                              <span>Buyer Brokerage:</span>
                              <span className="font-mono font-bold">
                                {isPrimaryPool ? (
                                  <span className="text-emerald-700">₹0.00 (Round 0 Waived)</span>
                                ) : (
                                  `+₹${buyerBrok.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-950 font-bold border-t border-emerald-200/50 pt-1">
                              <span>Total Buyer Outflow:</span>
                              <span className="font-mono font-extrabold text-sm">
                                ₹{buyerDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-emerald-800">
                              <span>Buyer Post-Trade Cash:</span>
                              <span className={`font-mono font-bold ${buyerPostCash < 100000 ? 'text-rose-700 font-black' : ''}`}>
                                ₹{buyerPostCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            {buyer && buyerPostCash < 100000 && (
                              <p className="text-[10px] text-amber-800 font-bold pt-1">
                                ⚠️ Buyer Cash Floor Advisory: In-app balance drops below ₹1,00,000 reserve. (Physical Excel ledger takes precedence).
                              </p>
                            )}
                          </div>

                          <div className={`p-2.5 rounded-xl border space-y-1 ${
                            isPrimaryPool ? 'bg-zinc-50 border-zinc-200' : 'bg-rose-50/60 border-rose-200'
                          }`}>
                            <div className="flex justify-between font-medium text-zinc-700">
                              <span>Seller Brokerage:</span>
                              <span className="font-mono font-bold">
                                {isPrimaryPool ? (
                                  <span className="text-zinc-500">₹0.00 (Central Primary Pool)</span>
                                ) : (
                                  `-₹${sellerBrok.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-200/50 pt-1">
                              <span>Total Seller Net Proceeds:</span>
                              <span className="font-mono font-extrabold text-sm">
                                {isPrimaryPool ? (
                                  <span className="text-zinc-500 font-normal">N/A (Central Inventory Outflow)</span>
                                ) : (
                                  `₹${sellerCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/40 flex justify-between text-[11px] text-on-surface-variant font-mono">
                            <span>Econ Desk Commission:</span>
                            <span className="font-bold text-emerald-800">
                              {isPrimaryPool ? '₹0.00 (Round 0 Desk)' : `₹${econRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleExecuteP2P}
                          disabled={!canExecute || p2pExecuting}
                          className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {p2pExecuting ? 'sync' : isPrimaryPool ? 'account_balance' : 'handshake'}
                          </span>
                          <span>
                            {p2pExecuting
                              ? 'Executing Deal...'
                              : isPrimaryPool
                              ? '🏛️ Execute Primary Allocation (Round 0)'
                              : 'Execute Mutual Inter-Team Trade (P2P)'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {deskSubMode === 'disciplinary' && (
              <div className="flex flex-col gap-5">
                {/* Header Card */}
                <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[24px] text-rose-700">gavel</span>
                      <h2 className="text-base sm:text-lg font-bold text-on-surface">
                        Wolf of Dalal Street Regulatory &amp; SEC Enforcement Desk
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300 font-mono">
                        Rulebook §4 &amp; §5
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Enforce penalties for room actions: ₹10,000 Khabri news fee, 10% penalty on total holdings for guilty insider trading, and 15% penalty on total holdings for false whistleblower accusations.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono self-start sm:self-auto">
                    Physical Room Sync
                  </span>
                </div>

                {/* Target Team Selector & Live Financial Profile */}
                {(() => {
                  const targetTeam = teams.find((t) => t.id === penaltyTeamId) || teams[0];
                  const targetHoldings = getTeamHoldingsValue(targetTeam);
                  const targetCash = targetTeam?.balance ?? 1000000;
                  const targetNetWorth = targetCash + targetHoldings;
                  const insiderFine = Math.max(10000, targetHoldings * 0.10);
                  const falseReportFine = Math.max(15000, targetHoldings * 0.15);

                  return (
                    <div className="space-y-5">
                      {/* Team Selector & Live Stat Bar */}
                      <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 flex-1 max-w-md">
                            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                              Select Target Team for Enforcement Action
                            </label>
                            <select
                              value={penaltyTeamId}
                              onChange={(e) => setPenaltyTeamId(e.target.value)}
                              className="w-full py-2 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs font-bold text-on-surface focus:border-primary focus:outline-none cursor-pointer"
                            >
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.code}) — Leader: {t.leader_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {targetTeam && (
                            <div className="flex items-center gap-3 text-xs flex-wrap">
                              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-center min-w-[110px]">
                                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Cash Balance</span>
                                <span className="font-mono font-black text-sm text-on-surface">
                                  ₹{targetCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-center min-w-[110px]">
                                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Equity Holdings</span>
                                <span className="font-mono font-black text-sm text-primary">
                                  ₹{targetHoldings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-center min-w-[110px]">
                                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Total Net Worth</span>
                                <span className="font-mono font-black text-sm text-on-surface">
                                  ₹{targetNetWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4 SEC Enforcement Action Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* 1. KHABRI FEE */}
                        <div className="p-4 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-amber-300 shadow-xs flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                                Informant Fee
                              </span>
                              <span className="font-mono font-black text-sm text-amber-900">₹10,000</span>
                            </div>
                            <h4 className="font-bold text-sm text-on-surface">Khabri News Access Fee</h4>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              Rulebook: Any team that wants access to insider information will be charged a fixed fee of ₹10,000 per news.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(targetTeam.id, 'KHABRI_FEE_10K')}
                            disabled={penaltyExecuting}
                            className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[15px]">currency_rupee</span>
                            <span>Deduct ₹10,000 Khabri Fee</span>
                          </button>
                        </div>

                        {/* 2. INSIDER TRADING FINE 10% */}
                        <div className="p-4 rounded-xl sm:rounded-2xl bg-surface-container-lowest border-2 border-rose-300 shadow-xs flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 uppercase">
                                Rule Violation
                              </span>
                              <span className="font-mono font-black text-sm text-rose-700">
                                10% Holdings
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-rose-950">Guilty Insider Trading</h4>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              Rulebook: In case a team has been correctly reported for insider trading, they incur a fine of 10% of their current holdings.
                            </p>
                            <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono font-bold text-rose-900 flex justify-between">
                              <span>Fine Amount:</span>
                              <span>₹{insiderFine.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(targetTeam.id, 'INSIDER_TRADING_10')}
                            disabled={penaltyExecuting}
                            className="w-full py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[15px]">gavel</span>
                            <span>Apply 10% Insider Fine</span>
                          </button>
                        </div>

                        {/* 3. FALSE REPORT PENALTY 15% */}
                        <div className="p-4 rounded-xl sm:rounded-2xl bg-surface-container-lowest border-2 border-orange-300 shadow-xs flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 uppercase">
                                False Snitch
                              </span>
                              <span className="font-mono font-black text-sm text-orange-800">
                                15% Holdings
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-orange-950">False Whistleblower Fine</h4>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              Rulebook: In a case that a team has wrongly reported another team for insider trading, the reporting team incurs a fine of 15% of current holdings.
                            </p>
                            <div className="mt-2 p-2 rounded-lg bg-orange-50 border border-orange-200 text-xs font-mono font-bold text-orange-900 flex justify-between">
                              <span>Fine Amount:</span>
                              <span>₹{falseReportFine.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(targetTeam.id, 'FALSE_REPORT_15')}
                            disabled={penaltyExecuting}
                            className="w-full py-2 px-3 rounded-xl bg-orange-700 hover:bg-orange-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[15px]">report_off</span>
                            <span>Apply 15% False Report Fine</span>
                          </button>
                        </div>

                        {/* 4. CUSTOM DISCIPLINARY PENALTY */}
                        <div className="p-4 rounded-xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-surface-container text-on-surface-variant border border-outline-variant/60 uppercase">
                                Discretionary
                              </span>
                              <span className="font-mono font-semibold text-xs text-on-surface-variant">Custom</span>
                            </div>
                            <h4 className="font-bold text-sm text-on-surface">Custom Sanction Fine</h4>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              Enter a manual penalty amount to deduct from the team cash reserve.
                            </p>
                            <div className="mt-2">
                              <input
                                type="number"
                                value={penaltyCustomAmount}
                                onChange={(e) => setPenaltyCustomAmount(e.target.value)}
                                placeholder="Amount in INR..."
                                className="w-full py-1.5 px-2.5 text-xs font-mono font-bold bg-surface rounded-lg border border-outline-variant/70 focus:border-primary focus:outline-none"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(targetTeam.id, 'CUSTOM', parseFloat(penaltyCustomAmount) || 0)}
                            disabled={penaltyExecuting || !penaltyCustomAmount}
                            className="w-full py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-outline-variant/80"
                          >
                            <span className="material-symbols-outlined text-[15px]">remove_circle</span>
                            <span>Apply Custom Sanction</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* 1.5. TEAMS MANAGEMENT & PARTICIPANTS ROSTER (MAX 6 MEMBERS) */}
        {/* ===================================================================== */}
        {activeTab === 'teams' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px] text-primary">groups</span>
                  <h1 className="text-lg sm:text-xl font-bold text-on-surface">
                    Trading Teams &amp; Participant Roster
                  </h1>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Students play in teams of max 6 members. Superadmin can edit, remove, or reassign team leaders using secure two-step password verification.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#edf5ef] text-[#295236] border border-[#4a7c59]/30 flex items-center gap-1.5 font-mono">
                  {teams.length} Active Teams
                </span>
                <button
                  onClick={fetchAdminTeams}
                  className="p-2 rounded-xl border border-outline-variant/70 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
                  title="Refresh Teams"
                >
                  <span className="material-symbols-outlined text-[17px]">refresh</span>
                </button>
              </div>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {teams.map((t) => (
                <div key={t.id} className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/70 shadow-xs space-y-4">
                  {/* Team Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#242826] text-white font-mono font-bold text-xs">
                          {t.code}
                        </span>
                        <h3 className="font-bold text-base text-on-surface">{t.name}</h3>
                      </div>
                      <span className="text-[11px] text-primary font-semibold flex items-center gap-1 mt-0.5">
                        <span>⭐ Team Leader:</span>
                        <span>{t.leader_name}</span>
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                      t.members.length >= 6
                        ? 'bg-rose-50 text-rose-800 border border-rose-300'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    }`}>
                      {t.members.length}/6 Members {t.members.length >= 6 ? '(FULL)' : ''}
                    </span>
                  </div>

                  {/* Financial & Reserve Status Strip */}
                  {(() => {
                    const cash = t.balance ?? 1000000;
                    const holdings = getTeamHoldingsValue(t);
                    const isBreach = cash < 100000;
                    const isWarning = cash >= 100000 && cash < 150000;

                    return (
                      <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Liquid Cash</span>
                            <span className={`font-black text-sm ${isBreach ? 'text-rose-700' : 'text-on-surface'}`}>
                              ₹{cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Holdings</span>
                            <span className="font-bold text-sm text-primary">
                              ₹{holdings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Reserve Status</span>
                            {isBreach ? (
                              <span className="px-2 py-0.5 rounded font-sans text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                ⛔ 10% FLOOR BREACH
                              </span>
                            ) : isWarning ? (
                              <span className="px-2 py-0.5 rounded font-sans text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠️ LOW CASH (&lt; ₹1.5L)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-sans text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ RESERVE MET
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick SEC Action Pills */}
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-outline-variant/30 flex-wrap">
                          <span className="text-[10px] text-on-surface-variant font-bold uppercase mr-1">SEC Actions:</span>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(t.id, 'KHABRI_FEE_10K')}
                            disabled={penaltyExecuting}
                            className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold transition cursor-pointer"
                            title="Deduct ₹10,000 Khabri news fee"
                          >
                            -₹10K Khabri
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(t.id, 'INSIDER_TRADING_10')}
                            disabled={penaltyExecuting}
                            className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold transition cursor-pointer"
                            title="Apply 10% holdings fine for insider trading"
                          >
                            -10% Insider
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPenalty(t.id, 'FALSE_REPORT_15')}
                            disabled={penaltyExecuting}
                            className="px-2 py-0.5 rounded bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 text-[10px] font-bold transition cursor-pointer"
                            title="Apply 15% holdings fine for false accusation"
                          >
                            -15% False Report
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Members List */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                      Roster Members (Max 6)
                    </span>
                    <div className="divide-y divide-outline-variant/30 border border-outline-variant/50 rounded-xl bg-surface overflow-hidden">
                      {t.members.map((m: any, mIdx: number) => (
                        <div key={m.id || mIdx} className="p-3 flex items-center justify-between text-xs hover:bg-surface-container-low transition">
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/60 text-[10px] font-bold text-on-surface-variant flex items-center justify-center shrink-0">
                              {mIdx + 1}
                            </span>
                            <div className="truncate">
                              <div className="font-bold text-on-surface truncate flex items-center gap-1.5">
                                <span>{m.name}</span>
                                {m.is_leader && (
                                  <span className="text-[9px] font-bold uppercase text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                                    Leader
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-on-surface-variant font-mono truncate block">{m.email}</span>
                            </div>
                          </div>

                          {/* Superadmin Actions with 2-Step Verification */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {!m.is_leader && (
                              <button
                                onClick={() => {
                                  setPendingAction({
                                    action: 'SET_LEADER',
                                    teamId: t.id,
                                    userId: m.id,
                                    detailsText: `Designate ${m.name} (${m.email}) as Team Leader for ${t.name}`,
                                  });
                                  setTwoStepModalOpen(true);
                                }}
                                className="px-2 py-1 rounded bg-[#edf5ef] hover:bg-[#dfeee2] text-emerald-800 border border-emerald-300 text-[10px] font-semibold transition cursor-pointer"
                                title="Set as Team Leader"
                              >
                                Set Leader
                              </button>
                            )}

                            <button
                              onClick={() => {
                                const newName = prompt(`Enter new display name for ${m.name}:`, m.name);
                                if (!newName || newName.trim() === m.name) return;
                                setPendingAction({
                                  action: 'EDIT_MEMBER',
                                  teamId: t.id,
                                  userId: m.id,
                                  newName: newName.trim(),
                                  detailsText: `Rename participant to "${newName.trim()}" in ${t.name}`,
                                });
                                setTwoStepModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 text-[10px] font-semibold transition cursor-pointer"
                              title="Edit Member Name"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => {
                                setPendingAction({
                                  action: 'REMOVE_MEMBER',
                                  teamId: t.id,
                                  userId: m.id,
                                  detailsText: `Remove participant ${m.name} (${m.email}) from ${t.name}`,
                                });
                                setTwoStepModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-semibold transition cursor-pointer"
                              title="Remove Participant from Team"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}

                      {t.members.length === 0 && (
                        <div className="p-4 text-center text-xs text-on-surface-variant">
                          No members in this team.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Member button if under 6 members */}
                  {t.members.length < 6 && (
                    <button
                      onClick={() => {
                        const email = prompt(`Enter registered student email to add to ${t.name} (max 6 members):`);
                        if (!email || !email.trim()) return;
                        setPendingAction({
                          action: 'ADD_MEMBER',
                          teamId: t.id,
                          newEmail: email.trim().toLowerCase(),
                          detailsText: `Enroll student ${email.trim().toLowerCase()} into ${t.name}`,
                        });
                        setTwoStepModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-outline-variant hover:border-primary/50 text-xs font-semibold text-primary hover:bg-primary/5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      <span>Add Participant to Team ({6 - t.members.length} seats available)</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. ADMIN-EXCLUSIVE LEADERBOARD (GLOBAL & COHORT) */}
        {/* ===================================================================== */}
        {activeTab === 'leaderboard' && (
          <div className="flex flex-col gap-5 bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px] text-primary">leaderboard</span>
                  <h1 className="text-lg sm:text-xl font-bold text-on-surface">
                    {isSuperAdmin ? 'Global Dalal Street Leaderboard' : 'Cohort Desk Leaderboard'}
                  </h1>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Confidential rankings exclusively visible to faculty administrators. Participant views are locked to individual progress only.
                </p>
              </div>

              {/* Filters & Export */}
              <div className="flex items-center gap-3 flex-wrap">
                {isSuperAdmin && admins.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-on-surface-variant">Desk Filter:</span>
                    <select
                      value={adminFilter}
                      onChange={(e) => {
                        setAdminFilter(e.target.value);
                        fetchLeaderboard(e.target.value);
                      }}
                      className="py-1.5 px-3 bg-surface border border-outline-variant/70 rounded-xl text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Cohort Desks (Global)</option>
                      {admins.map((adm) => (
                        <option key={adm.id} value={adm.id}>
                          {adm.username || adm.email} ({adm.group_name || 'Desk Lead'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const csv = [
                      'Rank,Name,Email,NetWorth,ReturnPercent,LiquidCash,HoldingsValue,AssignedDesk',
                      ...adminLeaderboard.map(
                        (item) =>
                          `${item.rank},"${item.name}",${item.email},${item.netWorth},${item.returnPct},${item.balance},${item.holdingsValue},"${item.group_name}"`
                      ),
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `dalal_street_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-outline-variant/70 hover:bg-surface-container text-xs font-bold text-on-surface flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchLeaderboard(adminFilter)}
                  className="p-1.5 rounded-xl border border-outline-variant/70 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                  title="Refresh Leaderboard"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            {leaderboardLoading ? (
              <div className="py-16 text-center text-xs text-on-surface-variant font-mono">
                Calculating Mark-to-Market cohort net worth standings...
              </div>
            ) : adminLeaderboard.length === 0 ? (
              <div className="py-16 text-center text-xs text-on-surface-variant">
                No participant records found in this cohort.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-outline-variant/50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f5f1ea] border-b border-outline-variant/50 text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Rank</th>
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">Desk Allotment</th>
                      <th className="py-3 px-4 text-right">Net Worth (₹)</th>
                      <th className="py-3 px-4 text-right">Total Return</th>
                      <th className="py-3 px-4 text-right">Liquid Cash</th>
                      <th className="py-3 px-4 text-right">Equities</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 bg-surface-container-lowest">
                    {adminLeaderboard.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-center text-on-surface">
                          {item.rank}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-on-surface">{item.name}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono">{item.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-primary block">{item.group_name}</span>
                          <span className="text-[10px] text-on-surface-variant">{item.assigned_admin_name}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                          ₹{item.netWorth?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            item.rawReturn >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {item.returnPct}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-on-surface-variant">
                          ₹{item.balance?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-on-surface-variant">
                          ₹{item.holdingsValue?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          <span className="text-[10px] text-on-surface-variant/70 block">
                            ({item.holdingsCount} assets)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(item.id);
                              setActiveTab('desk');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] transition cursor-pointer"
                          >
                            Open Desk
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. MACRO SHOCK & CRISIS INJECTOR (COMMAND) */}
        {/* ===================================================================== */}
        {activeTab === 'command' && (
          <>
            {/* PAGE HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-outline-variant/40">
              <div>
                <h1 className="text-xl sm:text-2xl font-headline font-semibold tracking-tight text-on-surface">
                  Simulation Command Center
                </h1>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl">
                  Broadcast economic news bulletins, trigger systemic market shocks, and manually moderate stock trading prices and halts in real time.
                </p>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
                <span className="text-xs text-on-surface-variant font-mono bg-surface-container-high/70 px-2.5 py-1.5 rounded-lg border border-outline-variant/40 num-tabular">
                  Latency: <strong className="font-semibold text-primary">12ms</strong>
                </span>
                <button
                  onClick={resetAllAssets}
                  className="text-xs text-on-surface-variant hover:text-on-surface font-semibold px-3 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-high transition-colors flex items-center gap-1.5 active:scale-95 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  Reset Baselines
                </button>
              </div>
            </div>

            {/* UPPER SPLIT SECTION: INJECT SHOCK vs PRESETS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* INJECT MARKET NEWS & PRICE SHOCK (7 Cols on desktop) */}
              <section className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4 sm:mb-5 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[19px]">campaign</span>
                      </div>
                      <div>
                        <h2 className="font-headline font-semibold text-sm sm:text-base text-on-surface">
                          Inject Market News &amp; Vector Shock
                        </h2>
                        <p className="text-[11px] sm:text-xs text-on-surface-variant">
                          Pushes breaking announcement ticker directly to all participant terminals
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/50 shrink-0">
                      Live Feed
                    </span>
                  </div>

                  <form onSubmit={injectCustomShock} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        News Headline &amp; Flash Bulletin
                      </label>
                      <textarea
                        value={newsHeadline}
                        onChange={(e) => setNewsHeadline(e.target.value)}
                        className="w-full text-xs sm:text-sm bg-surface rounded-lg border border-outline-variant/80 p-3 text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition resize-none"
                        rows={2}
                        placeholder="Type breaking headline broadcast..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                          Category &amp; Event Nature
                        </label>
                        <select
                          value={eventCategory}
                          onChange={(e) => setEventCategory(e.target.value)}
                          className="w-full text-xs sm:text-sm bg-surface rounded-lg border border-outline-variant/80 px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="macro">Macro Economic (High Beta)</option>
                          <option value="regulatory">Regulatory &amp; RBI Circular</option>
                          <option value="geopolitical">Geopolitical Event</option>
                          <option value="corporate">Corporate Earnings Shock</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                          Execution Delay
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setExecTiming('immediate')}
                            className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                              execTiming === 'immediate'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-outline-variant/70 text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Immediate
                          </button>
                          <button
                            type="button"
                            onClick={() => setExecTiming('delay')}
                            className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                              execTiming === 'delay'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-outline-variant/70 text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            30s Delay
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Affected Equities Vector */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                          Asset Delta Multipliers
                        </span>
                        <button
                          type="button"
                          onClick={addAssetRow}
                          className="text-xs font-semibold text-primary hover:text-primary-container flex items-center gap-1 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[15px]">add_circle</span> Add Asset
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {shockAssets.map((asset, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-2.5 rounded-lg bg-surface-container-low/70 border border-outline-variant/50"
                          >
                            <div className="w-full sm:w-44 shrink-0 flex items-center justify-between">
                              <select
                                value={asset.ticker}
                                onChange={(e) => updateAssetRow(idx, 'ticker', e.target.value)}
                                className="w-full bg-white font-mono font-bold text-xs text-on-surface rounded-md border border-outline-variant/70 py-1.5 px-2 focus:border-primary focus:outline-none cursor-pointer"
                              >
                                {stocks.map((s) => (
                                  <option key={s.id} value={s.ticker}>
                                    {s.ticker} ({s.sector.split(' ')[0]})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeAssetRow(idx)}
                                className="sm:hidden text-on-surface-variant/60 hover:text-error p-1 ml-1"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">Price Δ</span>
                              <input
                                type="text"
                                value={asset.delta}
                                onChange={(e) => updateAssetRow(idx, 'delta', e.target.value)}
                                className={`w-20 bg-white text-xs font-mono font-medium text-right rounded-md border border-outline-variant/70 py-1.5 px-2 focus:border-primary focus:outline-none num-tabular ${
                                  asset.delta.startsWith('-') ? 'text-error' : 'text-primary'
                                }`}
                              />
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">Target Vol</span>
                              <input
                                type="text"
                                value={asset.vol}
                                onChange={(e) => updateAssetRow(idx, 'vol', e.target.value)}
                                className="w-16 bg-white text-xs font-mono text-on-surface text-center rounded-md border border-outline-variant/70 py-1.5 px-2 focus:border-primary focus:outline-none num-tabular"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeAssetRow(idx)}
                              className="hidden sm:inline-flex text-on-surface-variant/60 hover:text-error p-1 transition-colors shrink-0 ml-auto"
                              title="Remove asset row"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-outline-variant/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <span className="text-xs text-on-surface-variant text-center sm:text-left">
                        Order-book slippage estimate:{' '}
                        <strong className="font-mono font-semibold text-on-surface num-tabular">~1.4%</strong>
                      </span>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 active:scale-98 text-on-primary font-semibold text-xs tracking-wide uppercase transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[17px]">send</span>
                        Broadcast &amp; Apply Shock
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* ONE-CLICK CRISIS PRESETS (5 Cols on desktop) */}
              <section className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4 sm:mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[19px]">bolt</span>
                      </div>
                      <div>
                        <h2 className="font-headline font-semibold text-sm sm:text-base text-on-surface">
                          One-Click Crisis Presets
                        </h2>
                        <p className="text-[11px] sm:text-xs text-on-surface-variant">
                          Pre-calibrated systemic scenarios
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-on-surface-variant num-tabular">
                      4 Ready
                    </span>
                  </div>

                  {/* Crisis Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Preset 1 */}
                    <div className="p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low/40 hover:border-outline/80 transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-on-surface">Recessionary Shock</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-mono bg-error/10 text-error font-semibold num-tabular">
                            -3.2%
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant leading-snug">
                          Global interest rate hike &amp; GDP contraction print.
                        </p>
                        <div className="text-[10px] font-mono text-on-surface-variant/85 mt-2.5 num-tabular">
                          IT: -4.5% | GOLD: +5%
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeMacroPreset('Recessionary Shock')}
                        className="mt-3 w-full py-2 px-2 text-xs font-semibold rounded-lg border border-outline-variant/80 hover:bg-surface-container hover:border-outline text-on-surface flex items-center justify-center gap-1.5 transition active:scale-98"
                      >
                        <span className="material-symbols-outlined text-[15px] text-secondary">play_arrow</span>
                        Trigger
                      </button>
                    </div>

                    {/* Preset 2 */}
                    <div className="p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low/40 hover:border-outline/80 transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-on-surface">Tech Sector Drop</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-mono bg-error/10 text-error font-semibold num-tabular">
                            -6.0%
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant leading-snug">
                          Valuation markdown in offshore IT and AI stocks.
                        </p>
                        <div className="text-[10px] font-mono text-on-surface-variant/85 mt-2.5 num-tabular">
                          INFY: -6.0% | ZOMATO: -8%
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeMacroPreset('Tech Sector Drop')}
                        className="mt-3 w-full py-2 px-2 text-xs font-semibold rounded-lg border border-outline-variant/80 hover:bg-surface-container hover:border-outline text-on-surface flex items-center justify-center gap-1.5 transition active:scale-98"
                      >
                        <span className="material-symbols-outlined text-[15px] text-secondary">play_arrow</span>
                        Trigger
                      </button>
                    </div>

                    {/* Preset 3 */}
                    <div className="p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low/40 hover:border-outline/80 transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-on-surface">Crude Oil Spike</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-mono bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50 num-tabular">
                            +2.8%
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant leading-snug">
                          OPEC surprise production freeze of 2.2M bpd.
                        </p>
                        <div className="text-[10px] font-mono text-on-surface-variant/85 mt-2.5 num-tabular">
                          RELIANCE: +2.8% | AUTO: -3.5%
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeMacroPreset('Crude Oil Spike')}
                        className="mt-3 w-full py-2 px-2 text-xs font-semibold rounded-lg border border-outline-variant/80 hover:bg-surface-container hover:border-outline text-on-surface flex items-center justify-center gap-1.5 transition active:scale-98"
                      >
                        <span className="material-symbols-outlined text-[15px] text-secondary">play_arrow</span>
                        Trigger
                      </button>
                    </div>

                    {/* Preset 4 */}
                    <div className="p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low/40 hover:border-outline/80 transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-on-surface">Liquidity Squeeze</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-mono bg-error/10 text-error font-semibold num-tabular">
                            -9.0%
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant leading-snug">
                          Overnight call money rate spike &amp; margin locks.
                        </p>
                        <div className="text-[10px] font-mono text-on-surface-variant/85 mt-2.5 num-tabular">
                          SMALLCAP: -9% | VOLATILE
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeMacroPreset('Liquidity Squeeze')}
                        className="mt-3 w-full py-2 px-2 text-xs font-semibold rounded-lg border border-outline-variant/80 hover:bg-surface-container hover:border-outline text-on-surface flex items-center justify-center gap-1.5 transition active:scale-98"
                      >
                        <span className="material-symbols-outlined text-[15px] text-secondary">play_arrow</span>
                        Trigger
                      </button>
                    </div>
                  </div>
                </div>

                {/* Macro Indicators Mini-bar */}
                <div className="mt-5 pt-3.5 border-t border-outline-variant/40 flex items-center justify-between text-xs text-on-surface-variant font-medium">
                  <div>
                    CPI: <span className="font-mono font-bold text-error num-tabular">6.2%</span>
                  </div>
                  <div className="h-3.5 w-px bg-outline-variant/50"></div>
                  <div>
                    Repo: <span className="font-mono font-bold text-primary num-tabular">6.50%</span>
                  </div>
                  <div className="h-3.5 w-px bg-outline-variant/50"></div>
                  <div>
                    Sentiment: <span className="font-mono font-bold text-on-surface num-tabular">48/100</span>
                  </div>
                </div>
              </section>
            </div>

            {/* EQUITIES MANAGEMENT SECTION */}
            <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl shadow-xs overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="p-4 sm:p-5 border-b border-outline-variant/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="font-headline font-semibold text-base text-on-surface">
                    Simulated Equities Management
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Live LTP midpoints, circuit limit collars, manual overrides, and single-stock halts.
                  </p>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative w-full sm:w-56">
                    <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[16px] text-on-surface-variant">
                      search
                    </span>
                    <input
                      type="text"
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      placeholder="Filter ticker or sector..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface rounded-lg border border-outline-variant/70 text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="inline-flex overflow-x-auto rounded-lg border border-outline-variant/60 bg-surface-container-low p-0.5 text-xs font-medium scrollbar-none">
                    {['ALL', 'ENERGY', 'METALS', 'FINANCIALS', 'IT', 'AUTO'].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setSelectedSector(sec)}
                        className={`category-pill px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                          selectedSector === sec
                            ? 'bg-surface text-on-surface font-semibold shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {sec === 'ALL' ? 'All' : sec.charAt(0) + sec.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* DESKTOP / TABLET HORIZONTAL SCROLL TABLE (md screens and up) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[840px]">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/40">
                      <th className="py-3 px-5">Ticker &amp; Company</th>
                      <th className="py-3 px-4">Sector</th>
                      <th className="py-3 px-4 text-right">Base Price</th>
                      <th className="py-3 px-4 text-right">Current LTP</th>
                      <th className="py-3 px-4 text-right">Day Δ</th>
                      <th className="py-3 px-5">Manual Price Override</th>
                      <th className="py-3 px-4 text-center">Circuit (L / U)</th>
                      <th className="py-3 px-4 text-center">Trading Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 text-xs">
                    {filteredStocks.map((stock) => {
                      const dayChange =
                        stock.previous_close > 0
                          ? ((stock.current_price - stock.previous_close) / stock.previous_close) * 100
                          : 0;
                      const isUp = dayChange >= 0;
                      const lowerCircuit = stock.previous_close * 0.9;
                      const upperCircuit = stock.previous_close * 1.1;

                      return (
                        <tr
                          key={stock.id}
                          className="asset-row hover:bg-surface-container-low/30 transition-colors"
                        >
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-on-surface font-mono text-sm num-tabular">
                              {stock.ticker}
                            </div>
                            <div className="text-[11px] text-on-surface-variant">{stock.name}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant/40">
                              {stock.sector}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-on-surface-variant num-tabular">
                            ₹{stock.previous_close.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-on-surface num-tabular">
                            ₹{stock.current_price.toFixed(2)}
                          </td>

                          <td
                            className={`py-3.5 px-4 text-right font-mono font-medium num-tabular ${
                              isUp ? 'text-primary' : 'text-error'
                            }`}
                          >
                            {isUp ? '+' : ''}
                            {dayChange.toFixed(2)}%
                          </td>

                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-1.5 max-w-[150px]">
                              <input
                                type="text"
                                value={priceOverrides[stock.id] ?? stock.current_price.toFixed(2)}
                                onChange={(e) =>
                                  setPriceOverrides({
                                    ...priceOverrides,
                                    [stock.id]: e.target.value,
                                  })
                                }
                                className="override-input w-24 bg-surface text-xs font-mono text-right rounded border border-outline-variant/70 py-1.5 px-2 focus:border-primary focus:outline-none num-tabular"
                              />
                              <button
                                type="button"
                                onClick={() => applySinglePrice(stock)}
                                className="h-7 w-7 rounded-md text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 flex items-center justify-center transition"
                                title="Apply price"
                              >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-on-surface-variant/80 text-[11px] num-tabular">
                            ₹{lowerCircuit.toFixed(0)} – ₹{upperCircuit.toFixed(0)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleStockStatus(stock)}
                              className={`status-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border active:scale-95 transition-all ${
                                stock.is_frozen || globalHalt
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  stock.is_frozen || globalHalt ? 'bg-error' : 'bg-emerald-600'
                                }`}
                              ></span>
                              {stock.is_frozen || globalHalt ? 'HALTED' : 'ACTIVE'}
                            </button>
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => resetStockPrice(stock)}
                                className="px-2.5 py-1 rounded text-[11px] font-medium border border-outline-variant/60 hover:bg-surface-container text-on-surface transition active:scale-95"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStockStatus(stock)}
                                className="px-2.5 py-1 rounded text-[11px] font-medium border border-outline-variant/60 hover:border-error hover:text-error text-on-surface-variant transition active:scale-95"
                              >
                                {stock.is_frozen || globalHalt ? 'Resume' : 'Halt'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE TOUCH-FRIENDLY CARD VIEW (< 768px) */}
              <div className="md:hidden divide-y divide-outline-variant/40">
                {filteredStocks.map((stock) => {
                  const dayChange =
                    stock.previous_close > 0
                      ? ((stock.current_price - stock.previous_close) / stock.previous_close) * 100
                      : 0;
                  const isUp = dayChange >= 0;
                  const lowerCircuit = stock.previous_close * 0.9;
                  const upperCircuit = stock.previous_close * 1.1;

                  return (
                    <div key={stock.id} className="mobile-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm font-mono text-on-surface">
                              {stock.ticker}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant/40">
                              {stock.sector}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant">{stock.name}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleStockStatus(stock)}
                          className={`status-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border active:scale-95 ${
                            stock.is_frozen || globalHalt
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              stock.is_frozen || globalHalt ? 'bg-error' : 'bg-emerald-600'
                            }`}
                          ></span>
                          {stock.is_frozen || globalHalt ? 'HALTED' : 'ACTIVE'}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/40 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-on-surface-variant block uppercase font-medium">
                            Base
                          </span>
                          <span className="font-mono text-on-surface-variant num-tabular">
                            ₹{stock.previous_close.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant block uppercase font-medium">
                            LTP
                          </span>
                          <span className="font-mono font-bold text-on-surface num-tabular">
                            ₹{stock.current_price.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant block uppercase font-medium">
                            Day Δ
                          </span>
                          <span
                            className={`font-mono font-semibold num-tabular ${
                              isUp ? 'text-primary' : 'text-error'
                            }`}
                          >
                            {isUp ? '+' : ''}
                            {dayChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant px-1 font-mono">
                        <span>Circuit Collars:</span>
                        <span className="num-tabular">
                          ₹{lowerCircuit.toFixed(0)} – ₹{upperCircuit.toFixed(0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={priceOverrides[stock.id] ?? stock.current_price.toFixed(2)}
                            onChange={(e) =>
                              setPriceOverrides({
                                ...priceOverrides,
                                [stock.id]: e.target.value,
                              })
                            }
                            className="override-input w-full bg-surface text-xs font-mono text-right rounded-lg border border-outline-variant/70 py-2 px-2.5 focus:border-primary focus:outline-none num-tabular"
                          />
                          <button
                            type="button"
                            onClick={() => applySinglePrice(stock)}
                            className="h-9 px-3 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 flex items-center justify-center font-semibold text-xs shrink-0 active:scale-95"
                          >
                            Set
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => resetStockPrice(stock)}
                          className="h-9 px-3 rounded-lg text-xs font-medium border border-outline-variant/60 hover:bg-surface-container text-on-surface shrink-0 active:scale-95"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStockStatus(stock)}
                          className="h-9 px-3 rounded-lg text-xs font-medium border border-outline-variant/60 hover:border-error hover:text-error text-on-surface-variant shrink-0 active:scale-95"
                        >
                          {stock.is_frozen || globalHalt ? 'Resume' : 'Halt'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table Footer Actions */}
              <div className="p-3.5 sm:p-4 bg-surface-container-low/50 border-t border-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-on-surface-variant flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span>
                    Matching Engine: <strong className="font-medium text-on-surface">v4.8 Active</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={bulkApplyPrices}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-semibold transition flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">done_all</span> Bulk Apply
                  </button>
                  <button
                    type="button"
                    onClick={resetAllAssets}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg border border-outline-variant/70 hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-semibold transition flex items-center justify-center active:scale-95"
                  >
                    Restore All
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* PARTICIPANTS & WALLETS TAB */}
        {activeTab === 'users' && (
          <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/40">
              <div>
                <h2 className="font-headline font-semibold text-lg text-on-surface">
                  Participant Wallet &amp; Registration Moderation
                </h2>
                <p className="text-xs text-on-surface-variant">
                  View enrolled @thapar.edu participants, oversee team cohorts, or credit/debit simulation capital.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[16px] text-on-surface-variant">
                  search
                </span>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user email or name..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface rounded-lg border border-outline-variant/70 text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Role Governance & Architecture Card */}
            <div className="p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant/60 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
                <span>Role Distribution &amp; Platform Governance</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-white border border-outline-variant/50">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[15px]">security</span>
                    <span>Executive Board &amp; Desk Admins</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Exclusive to authorized platform faculty and desk administrators. Review order slips, trigger macro vector shocks, manage circuits, and oversee cohorts.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-outline-variant/50">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[15px]">groups</span>
                    <span>Student Participants</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Enrolled students competing in teams of max 6 members. Generate verified order slips with Slip IDs for desk approval and track individual portfolio metrics.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-surface-container-low/50 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/40">
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Desk Admin &amp; Cohort</th>
                    <th className="py-3 px-4 text-right">Cash Balance</th>
                    <th className="py-3 px-4 text-right">Portfolio Value</th>
                    <th className="py-3 px-4 text-right">Net Worth</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 text-xs">
                  {filteredUsers.map((u) => {
                    const cash = u.balance !== undefined ? u.balance : (u.cash_balance || 0);
                    const stockVal = u.holdingsValue !== undefined ? u.holdingsValue : (u.portfolio_value || 0);
                    const totalWorth = u.netWorth !== undefined ? u.netWorth : (cash + stockVal);

                    return (
                      <tr key={u.id} className="hover:bg-surface-container-low/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-on-surface font-mono">{u.email}</div>
                          <div className="text-[11px] text-on-surface-variant">
                            {u.username || (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : 'Participant')}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {u.role === 'admin' || u.role === 'superadmin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              <span className="material-symbols-outlined text-[13px]">shield</span>
                              {u.role.toUpperCase()}
                            </span>
                          ) : isSuperAdmin ? (
                            <select
                              value={u.role || 'participant'}
                              onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-outline-variant/80 text-on-surface hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition shadow-xs"
                            >
                              <option value="participant">Participant</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#edf5ef] text-[#295236] border border-[#cbe4d1]">
                              <span className="material-symbols-outlined text-[13px]">person</span>
                              PARTICIPANT
                            </span>
                          )}
                        </td>

                        {/* Assigned Desk Lead & Group */}
                        <td className="py-3 px-4">
                          {isSuperAdmin && admins.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={u.assigned_admin_id || ''}
                                onChange={(e) => {
                                  const targetAdmin = admins.find((a) => a.id === e.target.value);
                                  handleReassignStudent(
                                    u.id,
                                    e.target.value,
                                    targetAdmin?.group_name || u.group_name
                                  );
                                }}
                                className="py-1 px-2 rounded-lg bg-surface border border-outline-variant/70 text-[11px] font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                              >
                                <option value="">Select Desk Admin</option>
                                {admins.map((adm) => (
                                  <option key={adm.id} value={adm.id}>
                                    {adm.username || adm.email} ({adm.group_name || 'Desk Lead'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-primary block">{u.group_name || 'General Cohort'}</span>
                              <span className="text-[10px] text-on-surface-variant font-mono">{u.assigned_admin_name || 'Desk Lead'}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-medium text-on-surface num-tabular">
                          ₹{cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-on-surface-variant num-tabular">
                          ₹{stockVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-primary num-tabular">
                          ₹{totalWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(u.id);
                                setActiveTab('desk');
                              }}
                              className="px-2.5 py-1 rounded text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition cursor-pointer"
                              title="Open Trading Desk for Student"
                            >
                              Trade
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustUserCash(u.id, true)}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition active:scale-95 cursor-pointer"
                              title="Add ₹50,000"
                            >
                              +₹50k
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustUserCash(u.id, false)}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 transition active:scale-95 cursor-pointer"
                              title="Deduct ₹50,000"
                            >
                              -₹50k
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* AUDIT & EVENTS TAB */}
        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-xs flex flex-col">
              <h2 className="font-headline font-semibold text-base text-on-surface pb-3 border-b border-outline-variant/40 mb-3 flex items-center justify-between">
                <span>Recent System &amp; Macro Injections</span>
                <span className="text-xs font-mono text-on-surface-variant num-tabular">
                  {recentEvents.length} events
                </span>
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                {recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-lg bg-surface-container-low/50 border border-outline-variant/40 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
                      <span className="text-primary font-semibold">
                        {Object.keys(evt.impact_map || {}).length > 0 ? 'VECTOR SHOCK' : 'SYSTEM EVENT'}
                      </span>
                      <span>{new Date(evt.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-bold text-on-surface text-sm">{evt.headline}</div>
                    <div className="text-on-surface-variant">{evt.description}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-xl p-5 shadow-xs flex flex-col">
              <h2 className="font-headline font-semibold text-base text-on-surface pb-3 border-b border-outline-variant/40 mb-3 flex items-center justify-between">
                <span>Live Matching Order Audit Log</span>
                <span className="text-xs font-mono text-on-surface-variant num-tabular">
                  {auditLogs.length} trades
                </span>
              </h2>
              <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
                {auditLogs.map((tx) => {
                  const stockTicker = tx.stock?.ticker || 'EQUITY';
                  const totalAmt = tx.quantity * tx.price_at_trade;
                  return (
                    <div
                      key={tx.id}
                      className="p-2.5 rounded-lg bg-surface-container-low/40 border border-outline-variant/30 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === 'BUY'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          {tx.type}
                        </span>
                        <span className="font-bold text-on-surface">{stockTicker}</span>
                        <span className="text-on-surface-variant">x{tx.quantity}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-on-surface font-semibold num-tabular">
                          ₹{totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-on-surface-variant">
                          @ ₹{tx.price_at_trade.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
        {/* In-flow Brand Badge: visible, elegant, never covers content on any screen size */}
        <div className="flex items-center justify-center py-6 select-none border-t border-outline-variant/30 mt-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-lowest border border-[#d8dbd0] shadow-xs hover:shadow-sm transition-all">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#4a4e4a]">
              Organized by
            </span>
            <img
              src="/econ-logo-clean.png"
              alt="ECON Club"
              className="h-5 sm:h-6 w-auto object-contain shrink-0"
            />
          </div>
        </div>
      </main>

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-14 sm:bottom-16 right-4 sm:right-6 z-50 bg-surface-container-lowest border border-outline-variant/80 text-on-surface px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-xs max-w-sm transition-all animate-in fade-in slide-in-from-bottom-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[16px]">info</span>
          </div>
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TWO-STEP SUPERADMIN VERIFICATION MODAL */}
      {twoStepModalOpen && pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmTwoStepAction}
            className="bg-white w-full max-w-md rounded-2xl border border-outline-variant/70 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-[#242826] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-[26px]">security</span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Two-Step Superadmin Verification</h3>
                  <p className="text-[10px] text-white/60 font-mono">Restricted Participant Management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTwoStepModalOpen(false);
                  setPendingAction(null);
                  setVerifyPassword('');
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <span className="material-symbols-outlined text-[15px]">lock</span>
                  Sensitive Operation:
                </span>
                <p className="text-xs leading-relaxed">{pendingAction.detailsText}</p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">
                    Superadmin Email
                  </label>
                  <input
                    type="email"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    required
                    className="w-full py-2.5 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">
                    Superadmin Password
                  </label>
                  <input
                    type="password"
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="Enter superadmin password to confirm..."
                    className="w-full py-2.5 px-3 rounded-xl bg-surface border border-outline-variant/70 text-xs text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTwoStepModalOpen(false);
                    setPendingAction(null);
                    setVerifyPassword('');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-outline-variant/70 text-xs font-bold text-on-surface hover:bg-surface-container transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  <span>{verifyLoading ? 'Verifying...' : 'Verify & Execute'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
