'use client';

import React, { useState, useMemo } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, ShieldAlert, TrendingUp } from 'lucide-react';
import { Stock } from '@/lib/types';

interface TradingScreenProps {
  stocks: Stock[];
  onOpenTrade: (stock: Stock, type: 'BUY' | 'SELL') => void;
}

export function TradingScreen({ stocks, onOpenTrade }: TradingScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  // Extract unique sectors
  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => set.add(s.sector));
    return ['ALL', ...Array.from(set)];
  }, [stocks]);

  // Filtered stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
      const matchesSector = selectedSector === 'ALL' || stock.sector === selectedSector;
      const matchesSearch =
        stock.ticker.toLowerCase().includes(search.toLowerCase()) ||
        stock.name.toLowerCase().includes(search.toLowerCase());
      return matchesSector && matchesSearch;
    });
  }, [stocks, search, selectedSector]);

  // Helper for mini SVG sparkline
  const renderSparkline = (current: number, prev: number, high: number, low: number, isGain: boolean) => {
    const points = [
      { x: 0, y: 16 },
      { x: 20, y: low < prev ? 22 : 12 },
      { x: 40, y: isGain ? 8 : 24 },
      { x: 60, y: high > current ? 4 : 14 },
      { x: 80, y: isGain ? 2 : 26 },
    ];
    const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <svg className="w-20 h-7 overflow-visible" viewBox="0 0 80 28">
        <polyline
          fill="none"
          stroke={isGain ? '#10B981' : '#EF4444'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
      </svg>
    );
  };

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-lg overflow-hidden">
      {/* Header with Search and Sector Tabs */}
      <div className="p-4 border-b border-[#1E293B] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-[#E5B869]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Dalal Street Trading Desk (NSE/BSE)
            </h2>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or company..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#0B0E14] border border-[#1E293B] rounded text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#E5B869]"
            />
          </div>
        </div>

        {/* Sector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {sectors.map((sector) => (
            <button
              key={sector}
              onClick={() => setSelectedSector(sector)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                selectedSector === sector
                  ? 'bg-[#E5B869] text-[#0B0E14] font-semibold'
                  : 'bg-[#0B0E14] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              {sector}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B0E14] text-[#64748B] uppercase font-mono tracking-wider border-b border-[#1E293B]">
            <tr>
              <th className="px-4 py-2.5">Asset / Company</th>
              <th className="px-4 py-2.5 text-right">LTP (Last Traded Price)</th>
              <th className="px-4 py-2.5 text-right">24H Change</th>
              <th className="px-4 py-2.5 text-center hidden md:table-cell">Intraday Trend</th>
              <th className="px-4 py-2.5 text-right hidden lg:table-cell">Day Range (L - H)</th>
              <th className="px-4 py-2.5 text-center">Trade Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B] font-mono-numbers">
            {filteredStocks.map((stock) => {
              const change = stock.current_price - stock.previous_close;
              const changePercent = (change / stock.previous_close) * 100;
              const isGain = change >= 0;

              return (
                <tr key={stock.id} className="hover:bg-[#182030] transition-colors">
                  {/* Asset */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{stock.ticker}</span>
                      {stock.is_frozen && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 flex items-center gap-1">
                          <ShieldAlert className="w-2.5 h-2.5" /> CIRCUIT HALT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#64748B] font-sans truncate max-w-xs">
                      {stock.name} • <span className="text-[#94A3B8]">{stock.sector}</span>
                    </div>
                  </td>

                  {/* LTP */}
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-bold text-white">
                      ₹{stock.current_price.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[#64748B]">
                      Prev: ₹{stock.previous_close.toFixed(2)}
                    </div>
                  </td>

                  {/* Change */}
                  <td className="px-4 py-3 text-right">
                    <div
                      className={`font-bold flex items-center justify-end gap-0.5 text-xs ${
                        isGain ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isGain ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {isGain ? '+' : ''}₹{Math.abs(change).toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] ${
                        isGain ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isGain ? '+' : ''}{changePercent.toFixed(2)}%
                    </div>
                  </td>

                  {/* Trend Sparkline */}
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <div className="flex justify-center">
                      {renderSparkline(stock.current_price, stock.previous_close, stock.day_high, stock.day_low, isGain)}
                    </div>
                  </td>

                  {/* Range */}
                  <td className="px-4 py-3 text-right hidden lg:table-cell text-[#94A3B8]">
                    <div>₹{stock.day_low.toFixed(2)} - ₹{stock.day_high.toFixed(2)}</div>
                  </td>

                  {/* Trade Action Buttons */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button
                        onClick={() => onOpenTrade(stock, 'BUY')}
                        disabled={stock.is_frozen}
                        className="px-3 py-1 text-xs font-semibold rounded bg-[#10B981]/15 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/30 disabled:opacity-30 transition-all"
                      >
                        BUY
                      </button>
                      <button
                        onClick={() => onOpenTrade(stock, 'SELL')}
                        disabled={stock.is_frozen}
                        className="px-3 py-1 text-xs font-semibold rounded bg-[#EF4444]/15 hover:bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/30 disabled:opacity-30 transition-all"
                      >
                        SELL
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
  );
}
