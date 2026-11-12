'use client';

import React from 'react';
import { Briefcase, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { Portfolio, Stock } from '@/lib/types';

interface HoldingsTableProps {
  portfolios: Portfolio[];
  onQuickTrade: (stock: Stock, type: 'BUY' | 'SELL') => void;
}

export function HoldingsTable({ portfolios, onQuickTrade }: HoldingsTableProps) {
  if (portfolios.length === 0) {
    return (
      <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-8 text-center">
        <Briefcase className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
        <div className="text-sm font-semibold text-white">No Active Holdings</div>
        <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
          Your portfolio currently holds 100% virtual cash. Explore listed stocks in the Trading Terminal below to place your first trade.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Briefcase className="w-4 h-4 text-[#E5B869]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">Current Holdings</span>
        </div>
        <span className="text-xs font-mono text-[#94A3B8]">{portfolios.length} Positions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B0E14] text-[#64748B] uppercase font-mono tracking-wider border-b border-[#1E293B]">
            <tr>
              <th className="px-4 py-2.5">Ticker & Sector</th>
              <th className="px-4 py-2.5 text-right">Quantity</th>
              <th className="px-4 py-2.5 text-right">Avg. Buy Price</th>
              <th className="px-4 py-2.5 text-right">Current Price</th>
              <th className="px-4 py-2.5 text-right">Current Value</th>
              <th className="px-4 py-2.5 text-right">Unrealized P&L</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B] font-mono-numbers">
            {portfolios.map((p) => {
              const stock = p.stock;
              const currentPrice = stock ? stock.current_price : p.avg_buy_price;
              const totalValue = p.shares_count * currentPrice;
              const totalCost = p.shares_count * p.avg_buy_price;
              const pnl = totalValue - totalCost;
              const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
              const isGain = pnl >= 0;

              return (
                <tr key={p.id} className="hover:bg-[#182030] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      {stock?.ticker || 'UNKNOWN'}
                      {stock?.is_frozen && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40">
                          FROZEN
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#64748B] font-sans">
                      {stock?.sector || stock?.name || 'Equity'}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right font-medium text-white">
                    {p.shares_count.toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-right text-[#94A3B8]">
                    ₹{p.avg_buy_price.toFixed(2)}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold text-white">
                    ₹{currentPrice.toFixed(2)}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-white">
                    ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className={`font-bold flex items-center justify-end gap-0.5 ${isGain ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {isGain ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {isGain ? '+' : ''}₹{pnl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] ${isGain ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {isGain ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    {stock && (
                      <button
                        onClick={() => onQuickTrade(stock, 'SELL')}
                        disabled={stock.is_frozen}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 disabled:opacity-40 transition-all inline-flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" /> Sell
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
