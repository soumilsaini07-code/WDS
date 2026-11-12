'use client';

import React, { useState } from 'react';
import { IPOListing, IPOSubscription, Team } from '@/lib/types';

interface IPOSubscriptionDeskProps {
  listings: IPOListing[];
  subscriptions: IPOSubscription[];
  onAllotIPO: (ipoId: string) => Promise<any> | void;
  allottingIpoId: string | null;
  onRefreshIPO?: () => void;
  showToast?: (msg: string) => void;
  currentRoundId?: string;
  teams?: Team[];
}

export function IPOSubscriptionDesk({
  listings,
  subscriptions,
  onAllotIPO,
  allottingIpoId,
  onRefreshIPO,
  showToast,
  currentRoundId = 'round-1',
  teams = [],
}: IPOSubscriptionDeskProps) {
  // Launch Custom / Surprise IPO Modal State
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [ticker, setTicker] = useState('');
  const [sector, setSector] = useState('Emerging Technology');
  const [issuePrice, setIssuePrice] = useState('250.00');
  const [lotSize, setLotSize] = useState('12');
  const [totalLots, setTotalLots] = useState('100');
  const [roundId, setRoundId] = useState(currentRoundId);
  const [description, setDescription] = useState('');

  // Offline Paper Slip Entry State
  const activeOpenListing = listings.find((i) => i.status === 'SUBSCRIPTION_OPEN') || listings[0];
  const [bidIpoId, setBidIpoId] = useState(activeOpenListing?.id || '');
  const [bidTeamName, setBidTeamName] = useState('');
  const [bidLots, setBidLots] = useState<number>(5);
  const [submittingBid, setSubmittingBid] = useState(false);

  // Offline Floor Announcement Modal State
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementData, setAnnouncementData] = useState<{
    ipo: IPOListing;
    listingPrice: number;
    subscriptionRatio: number;
    isOversubscribed: boolean;
    totalDemandedLots: number;
    totalOfferedLots: number;
    allotmentList: Array<{
      subId: string;
      teamId: string;
      teamName: string;
      lotsRequested: number;
      lotsAllotted: number;
      sharesAllotted: number;
      totalCost: number;
      status: string;
    }>;
  } | null>(null);

  // Find currently selected IPO for the paper slip form
  const selectedPaperIpo = listings.find((i) => i.id === bidIpoId) || activeOpenListing;

  // Handle Offline Paper Bid Submission
  const handleRegisterPaperBid = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIpoId = bidIpoId || selectedPaperIpo?.id;
    if (!targetIpoId) {
      showToast?.('Please select an active IPO listing.');
      return;
    }
    if (!bidTeamName.trim()) {
      showToast?.('Please enter or select a team name.');
      return;
    }

    setSubmittingBid(true);
    try {
      const res = await fetch('/api/ipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBSCRIBE',
          ipo_id: targetIpoId,
          team_id: bidTeamName.trim(),
          lots: Number(bidLots) || 1,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast?.(data.error || 'Failed to record paper slip bid.');
        return;
      }

      showToast?.(`📝 Offline paper bid recorded: ${bidLots} lots for "${bidTeamName.trim()}"!`);
      setBidTeamName('');
      onRefreshIPO?.();
    } catch (err: any) {
      showToast?.(err.message || 'Error recording offline bid.');
    } finally {
      setSubmittingBid(false);
    }
  };

  // Handle 1-Click Allotment & Auto-Open Offline Announcement Modal
  const handleExecuteAllotment = async (ipoId: string) => {
    try {
      const res: any = await onAllotIPO(ipoId);
      const ipo = listings.find((i) => i.id === ipoId);
      if (res && res.allotmentList && ipo) {
        setAnnouncementData({
          ipo,
          listingPrice: res.listingPrice || ipo.issue_price,
          subscriptionRatio: res.subscriptionRatio || ipo.subscription_ratio || 1.0,
          isOversubscribed: !!res.isOversubscribed,
          totalDemandedLots: res.totalLotsDemanded || ipo.total_demanded_lots || 0,
          totalOfferedLots: res.totalLotsOffered || ipo.total_issue_lots || 100,
          allotmentList: res.allotmentList,
        });
        setAnnouncementModalOpen(true);
      }
    } catch (err: any) {
      showToast?.(err.message || 'Error executing allotment');
    }
  };

  // Re-open announcement modal from an already allotted card
  const handleOpenPastAnnouncement = (ipo: IPOListing) => {
    const subsForThis = subscriptions.filter((s) => s.ipo_id === ipo.id);
    const allotmentList = subsForThis.map((sub) => ({
      subId: sub.id,
      teamId: sub.team_id,
      teamName: sub.team_name,
      lotsRequested: sub.lots_requested,
      lotsAllotted: sub.lots_allotted,
      sharesAllotted: sub.share_quantity,
      totalCost: sub.total_amount,
      status: sub.status,
    }));

    setAnnouncementData({
      ipo,
      listingPrice: ipo.issue_price || ipo.reference_price,
      subscriptionRatio: ipo.subscription_ratio || (ipo.total_demanded_lots ? ipo.total_demanded_lots / ipo.total_issue_lots : 1.0),
      isOversubscribed: (ipo.subscription_ratio || 0) > 1.0,
      totalDemandedLots: ipo.total_demanded_lots || subsForThis.reduce((acc, s) => acc + s.lots_requested, 0),
      totalOfferedLots: ipo.total_issue_lots || 100,
      allotmentList,
    });
    setAnnouncementModalOpen(true);
  };

  // Copy spoken microphone announcement script
  const copyAnnouncementScript = () => {
    if (!announcementData) return;
    const { ipo, listingPrice, subscriptionRatio, isOversubscribed, allotmentList } = announcementData;
    const allottedTeams = allotmentList.filter((a) => a.lotsAllotted > 0);
    const unallottedTeams = allotmentList.filter((a) => a.lotsAllotted === 0);

    const script = `📢 ATTENTION DALAL STREET TRADING FLOOR!
The Primary Book-Building offering for ${ipo.company_name} (${ipo.ticker}) has officially closed!
• Total Demand Received: ${subscriptionRatio.toFixed(2)}x (${announcementData.totalDemandedLots} lots requested for ${announcementData.totalOfferedLots} lots offered)
${isOversubscribed ? '• Fair Randomized Computerized Lottery Draw has been executed across all bids.' : '• 100% Full Allotment has been executed for all bidding teams.'}
• Official Floor Listing Price: ₹${listingPrice.toFixed(2)} per share.

🎉 ALLOTMENT RESULTS:
${allottedTeams.map((t) => `• ${t.teamName}: WON ${t.lotsAllotted} LOTS (${t.sharesAllotted} shares)`).join('\n')}
${unallottedTeams.length > 0 ? `\n❌ UNALLOTTED TEAMS (Lottery Non-Draw):\n${unallottedTeams.map((t) => `• ${t.teamName}`).join(', ')}` : ''}

Shares have been credited directly to portfolios. Trading for ${ipo.ticker} is now OPEN on Dalal Street!`;

    navigator.clipboard.writeText(script);
    showToast?.('🎙️ Floor Announcement Script copied to clipboard for mic!');
  };

  // Handle Surprise IPO Launch
  const handleLaunchIPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !ticker.trim()) {
      showToast?.('Company Name and Ticker Symbol are required.');
      return;
    }
    const priceNum = parseFloat(issuePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast?.('Enter a valid positive issue price.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/ipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          company_name: companyName.trim(),
          ticker: ticker.trim().toUpperCase(),
          sector: sector.trim(),
          issue_price: priceNum,
          lot_size: parseInt(lotSize, 10) || 12,
          total_issue_lots: parseInt(totalLots, 10) || 100,
          round_id: roundId || currentRoundId,
          description: description.trim() || `Primary Book-Building Offering for ${companyName.trim()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast?.(data.error || 'Failed to create IPO listing.');
        return;
      }

      showToast?.(`⚡ Surprise IPO for ${ticker.toUpperCase()} launched! Broadcasting on floor for 10 seconds.`);
      setShowModal(false);
      setCompanyName('');
      setTicker('');
      setDescription('');
      onRefreshIPO?.();
    } catch (err: any) {
      showToast?.(err.message || 'Error creating custom IPO.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[26px] text-amber-600">
              verified
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-on-surface">
              IPO Primary Book-Building &amp; Offline Floor Allotment Desk
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Participants submit physical paper slips on the floor. Record slips here, run the computerized lottery draw if oversubscribed, and announce winners via microphone!
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setRoundId(currentRoundId);
              setShowModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>+ Launch Surprise IPO</span>
          </button>
          <span className="px-3 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold font-mono shrink-0">
            {listings.length} IPOs
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. OFFLINE PAPER SLIP RECORDING CONSOLE (ADMIN FLOOR DESK) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border-2 border-amber-500/30 shadow-md p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500/10 border-b border-l border-amber-500/30 rounded-bl-xl text-[10px] font-mono font-bold text-amber-700 uppercase flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>Offline Floor Slip Mode Active</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-amber-600 text-[22px]">description</span>
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
            Record Physical Bid Slip (Floor Mode)
          </h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Type or select the applicant team name from the physical slip. New/unregistered teams are auto-created on the spot.
        </p>

        <form onSubmit={handleRegisterPaperBid} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
          {/* Target IPO Selection */}
          <div className="sm:col-span-4 flex flex-col">
            <label className="text-[10px] font-bold uppercase font-mono text-zinc-600 mb-1">
              Target IPO Offering
            </label>
            <select
              value={bidIpoId || selectedPaperIpo?.id || ''}
              onChange={(e) => setBidIpoId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-zinc-50 text-zinc-900 text-xs font-semibold focus:outline-none focus:border-amber-600 cursor-pointer"
            >
              {listings.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.ticker} — {ipo.company_name} (₹{ipo.reference_price} • {ipo.status})
                </option>
              ))}
            </select>
          </div>

          {/* Applicant Team Name (with Datalist & Free-type support) */}
          <div className="sm:col-span-4 flex flex-col">
            <label className="text-[10px] font-bold uppercase font-mono text-zinc-600 mb-1">
              Applicant Team Name *
            </label>
            <input
              type="text"
              required
              list="registered-teams-list"
              placeholder="e.g. Zeta Holdings or Team 14"
              value={bidTeamName}
              onChange={(e) => setBidTeamName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs font-bold focus:outline-none focus:border-amber-600"
            />
            <datalist id="registered-teams-list">
              {teams.map((t) => (
                <option key={t.id} value={t.name}>
                  ₹{t.balance?.toLocaleString('en-IN')} Cash
                </option>
              ))}
            </datalist>
          </div>

          {/* Requested Lots (1-30) */}
          <div className="sm:col-span-2 flex flex-col">
            <label className="text-[10px] font-bold uppercase font-mono text-zinc-600 mb-1">
              Lots (1-30)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              required
              value={bidLots}
              onChange={(e) => setBidLots(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs font-mono font-bold text-center focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Submit Action */}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submittingBid || !selectedPaperIpo || selectedPaperIpo.status !== 'SUBSCRIPTION_OPEN'}
              className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>{submittingBid ? 'Recording...' : 'Register Bid'}</span>
            </button>
          </div>
        </form>

        {/* Live Calculation Preview Banner */}
        {selectedPaperIpo && (
          <div className="mt-3.5 pt-3 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-zinc-600">
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                Ref Price: <strong className="text-zinc-900">₹{selectedPaperIpo.reference_price}</strong>
              </span>
              <span>•</span>
              <span>
                Lot Size: <strong className="text-zinc-900">{selectedPaperIpo.lot_size} shares/lot</strong>
              </span>
              <span>•</span>
              <span>
                Total Shares: <strong className="text-zinc-900">{bidLots * selectedPaperIpo.lot_size} shares</strong>
              </span>
            </div>
            <div className="bg-amber-50 text-amber-900 px-3 py-1 rounded-lg border border-amber-200 font-bold">
              Gross Outflow: ₹{(bidLots * selectedPaperIpo.lot_size * selectedPaperIpo.reference_price).toLocaleString('en-IN')} (0% Brokerage)
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. IPO LISTINGS CARDS & ACTIONS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map((ipo) => {
          const subsForThis = subscriptions.filter((s) => s.ipo_id === ipo.id);
          const totalLotsRequested = subsForThis.reduce((acc, s) => acc + s.lots_requested, 0);
          const totalCapitalBid = subsForThis.reduce((acc, s) => acc + s.total_amount, 0);
          const subscriptionRatio = ipo.total_issue_lots > 0 ? totalLotsRequested / ipo.total_issue_lots : 0;
          const isPendingAllotment = subsForThis.some((s) => s.status === 'BID_PLACED');

          return (
            <div key={ipo.id} className="bg-white rounded-2xl border border-outline-variant/70 shadow-sm p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono">
                      {ipo.round_id.toUpperCase()}
                    </span>
                    <h3 className="text-base font-extrabold text-on-surface mt-1.5">
                      {ipo.company_name} ({ipo.ticker})
                    </h3>
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
                      {ipo.description}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      ipo.status === 'ALLOTTED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : ipo.status === 'SUBSCRIPTION_OPEN'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {ipo.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-y border-outline-variant/40 mt-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans">Reference P0</span>
                    <span className="font-bold text-on-surface text-sm">₹{(ipo.reference_price || ipo.issue_price).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans">Lot Size</span>
                    <span className="font-bold text-on-surface text-sm">{ipo.lot_size} shares</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans">Smooth Price</span>
                    <span className="font-bold text-emerald-800 text-sm">₹{ipo.issue_price.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-mono text-on-surface-variant">
                  <span>Subscription Demand:</span>
                  <span className="font-bold text-on-surface">
                    {totalLotsRequested} / {ipo.total_issue_lots} lots ({subscriptionRatio.toFixed(2)}x Subscribed)
                  </span>
                </div>

                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mt-1.5 border border-zinc-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      subscriptionRatio >= 1 ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, subscriptionRatio * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold text-zinc-600">
                  Total Bid: ₹{totalCapitalBid.toLocaleString('en-IN')}
                </span>

                <div className="flex items-center gap-2">
                  {ipo.status === 'ALLOTTED' && (
                    <button
                      type="button"
                      onClick={() => handleOpenPastAnnouncement(ipo)}
                      className="px-3 py-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">campaign</span>
                      <span>Announcement Script</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleExecuteAllotment(ipo.id)}
                    disabled={!isPendingAllotment || allottingIpoId === ipo.id}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">casino</span>
                    <span>
                      {allottingIpoId === ipo.id
                        ? 'Drawing Lots...'
                        : subscriptionRatio > 1.0
                        ? 'Execute Lottery Allotment'
                        : '1-Click Allot Lots'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. PHYSICAL APPLICATION ROSTER TABLE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-outline-variant/40 flex items-center justify-between">
          <h3 className="font-bold text-sm sm:text-base text-on-surface">
            Team Subscription Applications ({subscriptions.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f5f1ea] border-b border-outline-variant/60 text-[11px] font-bold text-on-surface uppercase tracking-wider">
                <th className="py-3 px-3.5">Team</th>
                <th className="py-3 px-3">IPO Target</th>
                <th className="py-3 px-3 text-center">Lots Applied</th>
                <th className="py-3 px-3 text-center">Total Shares</th>
                <th className="py-3 px-3 text-right">Debit Amount</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Submission Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40 font-mono">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 font-sans">
                    No IPO bids submitted yet by participants.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#faf8f4] transition">
                    <td className="py-3 px-3.5 font-bold text-on-surface">
                      {sub.team_name}
                      <span className="text-[10px] text-zinc-500 block font-normal font-sans">
                        By {sub.user_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-800">
                      {sub.round_id.toUpperCase()}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {sub.lots_requested} lots
                    </td>
                    <td className="py-3 px-3 text-center">
                      {sub.share_quantity} shares
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-on-surface">
                      ₹{sub.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.status === 'ALLOTTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.status === 'NOT_ALLOTTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800 animate-pulse'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right text-zinc-500 text-[11px]">
                      {new Date(sub.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. OFFLINE PERSON MODE ANNOUNCEMENT MODAL */}
      {/* ========================================================================= */}
      {announcementModalOpen && announcementData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[26px] text-amber-600">campaign</span>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-zinc-900">
                    Floor Announcement: {announcementData.ipo.company_name} ({announcementData.ipo.ticker})
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Offline Person Mode • Ready for live mic reading
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnnouncementModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-sans">Listing Price</span>
                <span className="text-base font-black text-emerald-800">
                  ₹{announcementData.listingPrice.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-sans">Subscription</span>
                <span className="text-base font-black text-amber-800">
                  {announcementData.subscriptionRatio.toFixed(2)}x
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-sans">Lots Demanded</span>
                <span className="text-base font-black text-zinc-800">
                  {announcementData.totalDemandedLots} / {announcementData.totalOfferedLots}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-sans">Allotment Mode</span>
                <span className="text-xs font-bold text-zinc-800 block mt-1">
                  {announcementData.isOversubscribed ? '🎲 Random Lottery' : '✅ 100% Full Allotment'}
                </span>
              </div>
            </div>

            {/* Mic Speech Script Box */}
            <div className="bg-zinc-900 text-zinc-100 p-4 rounded-xl border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">mic</span>
                  <span>Microphone Reading Script (Floor Announcer)</span>
                </span>
                <button
                  type="button"
                  onClick={copyAnnouncementScript}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-[11px] font-mono transition flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Copy Script</span>
                </button>
              </div>
              <p className="text-xs font-mono leading-relaxed text-zinc-300 bg-black/40 p-3 rounded-lg border border-zinc-800 select-all">
                &ldquo;Attention Dalal Street Trading Floor! The IPO offering for{' '}
                <strong className="text-white">{announcementData.ipo.company_name}</strong> is closed.
                Total demand was{' '}
                <strong className="text-amber-300">{announcementData.subscriptionRatio.toFixed(2)}x</strong>.{' '}
                {announcementData.isOversubscribed
                  ? 'Due to heavy oversubscription, fair randomized computerized lottery draw has taken place.'
                  : 'All applications have been fully allotted.'}{' '}
                The official listing price is{' '}
                <strong className="text-emerald-400">₹{announcementData.listingPrice.toFixed(2)}</strong>!
                Winning teams:{' '}
                {announcementData.allotmentList
                  .filter((a) => a.lotsAllotted > 0)
                  .map((a) => `${a.teamName} (${a.lotsAllotted} lots)`)
                  .join(', ')}
                . Shares are credited! Trading starts now!&rdquo;
              </p>
            </div>

            {/* Breakdown Roster Table */}
            <div>
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                Allotment Roster
              </h4>
              <div className="border border-outline-variant/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold text-[11px]">
                    <tr>
                      <th className="p-2.5">Team</th>
                      <th className="p-2.5 text-center">Applied</th>
                      <th className="p-2.5 text-center">Allotted</th>
                      <th className="p-2.5 text-center">Shares</th>
                      <th className="p-2.5 text-right">Debit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {announcementData.allotmentList.map((team, idx) => (
                      <tr key={team.subId || idx} className={team.lotsAllotted > 0 ? 'bg-emerald-50/50' : 'bg-rose-50/30'}>
                        <td className="p-2.5 font-bold text-zinc-900">
                          {team.teamName}
                        </td>
                        <td className="p-2.5 text-center text-zinc-600">
                          {team.lotsRequested} lots
                        </td>
                        <td className="p-2.5 text-center">
                          {team.lotsAllotted > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              🎉 Won {team.lotsAllotted} Lots
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              ❌ Not Allotted
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold text-zinc-800">
                          {team.sharesAllotted} shares
                        </td>
                        <td className="p-2.5 text-right font-bold text-zinc-900">
                          ₹{team.totalCost.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setAnnouncementModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800 transition cursor-pointer"
              >
                Close Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LAUNCH SURPRISE IPO MODAL DIALOG */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-amber-600">rocket_launch</span>
                <h3 className="font-extrabold text-base sm:text-lg text-on-surface">
                  Launch Surprise IPO Listing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Introduce a new, unannounced company into Dalal Street. This listing will immediately open book-building and broadcast an alert banner across all floor screens for 10 seconds.
            </p>

            <form onSubmit={handleLaunchIPO} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swiggy India Ltd."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none font-semibold text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Stock Ticker Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SWIGGY"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none font-mono font-bold text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Sector
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. E-Commerce / Quick Commerce"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Issue Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    placeholder="390.00"
                    value={issuePrice}
                    onChange={(e) => setIssuePrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Round Open In
                  </label>
                  <input
                    type="text"
                    value={roundId}
                    onChange={(e) => setRoundId(e.target.value)}
                    placeholder="e.g. round-1, ipo-1"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Lot Size (Shares/Lot)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                    Total Lots Offered (L)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalLots}
                    onChange={(e) => setTotalLots(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block uppercase text-[10px] tracking-wider mb-1">
                  Market Thesis / Story Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Leading hyperlocal delivery network with strong operating EBITDA turnaround..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/70 focus:border-amber-600 focus:outline-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant/70 text-zinc-700 font-bold hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {creating ? 'sync' : 'rocket_launch'}
                  </span>
                  <span>{creating ? 'Broadcasting IPO...' : 'Launch & Broadcast IPO'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
