'use client';

import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { MarketDepth, Stock } from '@/lib/types';

interface MarketDepthLadderProps {
  stocks: Stock[];
  selectedStock?: Stock;
  onSelectStock?: (stock: Stock) => void;
  onSelectPrice?: (price: number, action: 'BUY' | 'SELL') => void;
}

export function MarketDepthLadder({
  stocks,
  selectedStock: propSelectedStock,
  onSelectStock,
  onSelectPrice,
}: MarketDepthLadderProps) {
  const [currentStock, setCurrentStock] = useState<Stock>(
    propSelectedStock || stocks[0] || ({} as Stock)
  );
  const [depth, setDepth] = useState<MarketDepth | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (propSelectedStock && propSelectedStock.id !== currentStock.id) {
      setCurrentStock(propSelectedStock);
    }
  }, [propSelectedStock]);

  useEffect(() => {
    if (!currentStock?.id) return;
    fetchDepth(currentStock.id);
  }, [currentStock?.id, currentStock?.current_price]);

  const fetchDepth = async (stockId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/stocks/${stockId}/depth`);
      const data = await res.json();
      if (data.success && data.depth) {
        setDepth(data.depth);
      }
    } catch (err) {
      console.error('Failed to load depth:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = stocks.find((item) => item.id === e.target.value);
    if (s) {
      setCurrentStock(s);
      if (onSelectStock) onSelectStock(s);
    }
  };

  const maxBidVol = depth?.bids?.[depth.bids.length - 1]?.totalVolume || 1000;
  const maxAskVol = depth?.asks?.[depth.asks.length - 1]?.totalVolume || 1000;
  const maxTotal = Math.max(maxBidVol, maxAskVol);

  return (
    <div className="bg-white border border-[#e2e4dc] rounded-xl shadow-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e2e4dc] flex items-center justify-between bg-[#fbfbfa]">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#4a7c59]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#242826]">
            Level 2 Market Depth
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-[#f6f6f2] text-[#686e66] border border-[#e2e4dc] rounded font-mono">
            5-Deep Ladder
          </span>
        </div>

        {/* Stock Selector */}
        <div className="flex items-center gap-2">
          <select
            value={currentStock?.id || ''}
            onChange={handleStockChange}
            aria-label="Select ticker for Market Depth ladder"
            className="bg-white border border-[#e2e4dc] text-[#242826] text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#4a7c59] font-mono shadow-xs"
          >
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ticker} (₹{s.current_price.toFixed(2)})
              </option>
            ))}
          </select>
          <button
            onClick={() => currentStock?.id && fetchDepth(currentStock.id)}
            title="Refresh depth quotes"
            className="p-1 rounded-md hover:bg-[#f6f6f2] text-[#686e66] hover:text-[#242826] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Spread Bar */}
      <div className="px-4 py-2 bg-[#f6f6f2] border-b border-[#e2e4dc] flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2 text-[#686e66]">
          <span>Bid-Ask Spread:</span>
          <span className="text-[#242826] font-bold">
            ₹{depth?.spread ? depth.spread.toFixed(2) : '0.00'}
          </span>
          <span className="text-[#4a7c59] bg-[#edf5ef] px-1.5 py-0.2 rounded border border-[#cbe4d1] text-[10px] font-bold">
            {depth?.spreadBps || 12} bps
          </span>
        </div>
        <div className="text-[10px] text-[#8a9087]">
          LTP: <span className="text-[#242826] font-bold">₹{currentStock?.current_price?.toFixed(2)}</span>
        </div>
      </div>

      {/* Depth Table */}
      <div className="p-3 grid grid-cols-2 gap-3 text-xs font-mono">
        {/* BIDS (BUY) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-[#4a7c59] border-b border-[#cbe4d1] pb-1 mb-1.5 uppercase">
            <span>Orders / Vol</span>
            <span className="text-right">Bid Price (₹)</span>
          </div>
          <div className="space-y-1">
            {depth?.bids?.map((bid, i) => {
              const depthPct = Math.min(100, Math.round((bid.totalVolume / maxTotal) * 100));
              return (
                <div
                  key={i}
                  onClick={() => onSelectPrice && onSelectPrice(bid.price, 'SELL')}
                  className="group relative flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-[#edf5ef] transition-colors"
                >
                  {/* Depth Fill Bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-[#edf5ef]/80 rounded pointer-events-none transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-[#686e66]">
                    <span className="text-[#8a9087] text-[9px]">({bid.ordersCount})</span>
                    <span>{bid.quantity.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="relative z-10 font-bold text-[#295236] group-hover:underline text-[12px]">
                    ₹{bid.price.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ASKS (SELL) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-[#be3835] border-b border-[#f5c6c6] pb-1 mb-1.5 uppercase">
            <span>Ask Price (₹)</span>
            <span className="text-right">Orders / Vol</span>
          </div>
          <div className="space-y-1">
            {depth?.asks?.map((ask, i) => {
              const depthPct = Math.min(100, Math.round((ask.totalVolume / maxTotal) * 100));
              return (
                <div
                  key={i}
                  onClick={() => onSelectPrice && onSelectPrice(ask.price, 'BUY')}
                  className="group relative flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-[#fdf2f2] transition-colors"
                >
                  {/* Depth Fill Bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#fdf2f2]/80 rounded pointer-events-none transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <div className="relative z-10 font-bold text-[#be3835] group-hover:underline text-[12px]">
                    ₹{ask.price.toFixed(2)}
                  </div>
                  <div className="relative z-10 flex items-center justify-end gap-1.5 text-[11px] text-[#686e66]">
                    <span>{ask.quantity.toLocaleString('en-IN')}</span>
                    <span className="text-[#8a9087] text-[9px]">({ask.ordersCount})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-auto px-3 py-2 bg-[#fbfbfa] border-t border-[#e2e4dc] text-[10px] text-[#8a9087] flex items-center justify-between font-mono">
        <span>Click price quote to prime order ticket</span>
        <span>Simulated Latency: ~12ms</span>
      </div>
    </div>
  );
}
