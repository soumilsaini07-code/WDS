'use client';

import React, { useState } from 'react';
import { IPOListing, IPOSubscription } from '@/lib/types';

interface IPOSubscriptionDeskProps {
  listings: IPOListing[];
  subscriptions: IPOSubscription[];
  onAllotIPO: (ipoId: string) => void;
  allottingIpoId: string | null;
  onRefreshIPO?: () => void;
  showToast?: (msg: string) => void;
  currentRoundId?: string;
}

export function IPOSubscriptionDesk({
  listings,
  subscriptions,
  onAllotIPO,
  allottingIpoId,
  onRefreshIPO,
  showToast,
  currentRoundId = 'round-1',
}: IPOSubscriptionDeskProps) {
  // Surprise IPO Modal State
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
              IPO Primary Book-Building &amp; Allotment Desk
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Teams submit applications in primary book-building sessions. You can also launch dynamic, unannounced surprise IPOs on the spot!
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

      {/* Listing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map((ipo) => {
          const subsForThis = subscriptions.filter((s) => s.ipo_id === ipo.id);
          const totalLotsRequested = subsForThis.reduce((acc, s) => acc + s.lots_requested, 0);
          const totalCapitalBid = subsForThis.reduce((acc, s) => acc + s.total_amount, 0);
          const subscriptionRatio = ipo.total_issue_lots > 0 ? (totalLotsRequested / ipo.total_issue_lots) : 0;
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
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                    ipo.status === 'ALLOTTED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : ipo.status === 'SUBSCRIPTION_OPEN'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
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
                    {totalLotsRequested} / {ipo.total_issue_lots} lots ({(subscriptionRatio).toFixed(2)}x Subscribed)
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

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-mono font-semibold text-zinc-600">
                  Total Bid: ₹{totalCapitalBid.toLocaleString('en-IN')}
                </span>

                <button
                  type="button"
                  onClick={() => onAllotIPO(ipo.id)}
                  disabled={!isPendingAllotment || allottingIpoId === ipo.id}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{allottingIpoId === ipo.id ? 'Allotting...' : '1-Click Allot Lots'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscriptions Table */}
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sub.status === 'ALLOTTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800 animate-pulse'
                      }`}>
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
      {/* LAUNCH SURPRISE IPO MODAL DIALOG */}
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
