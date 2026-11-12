'use client';

import React from 'react';
import { PieChart } from 'lucide-react';
import { Portfolio, Stock } from '@/lib/types';

interface PortfolioDonutProps {
  portfolios: Portfolio[];
  cash: number;
}

const PALETTE = [
  '#E5B869', // Subtle Gold
  '#38BDF8', // Sky Blue
  '#10B981', // Emerald
  '#A855F7', // Purple
  '#F97316', // Orange
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#FACC15', // Yellow
];

export function PortfolioDonut({ portfolios, cash }: PortfolioDonutProps) {
  // Aggregate asset values
  const items: { label: string; value: number; color: string }[] = [];

  let totalHoldingsVal = 0;
  portfolios.forEach((p, index) => {
    const price = p.stock ? p.stock.current_price : p.avg_buy_price;
    const val = p.shares_count * price;
    if (val > 0) {
      totalHoldingsVal += val;
      items.push({
        label: p.stock?.ticker || 'Stock',
        value: val,
        color: PALETTE[index % PALETTE.length],
      });
    }
  });

  // Free Cash segment
  if (cash > 0) {
    items.unshift({
      label: 'Free Cash (INR)',
      value: cash,
      color: '#475569',
    });
  }

  const grandTotal = items.reduce((acc, curr) => acc + curr.value, 0);

  // SVG calculations for Donut
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-[#E5B869]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">Asset Allocation</span>
        </div>
        <span className="text-[11px] font-mono text-[#94A3B8]">
          ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="flex items-center justify-center gap-6 my-auto py-2">
        {/* SVG Donut */}
        <div className="relative w-[180px] h-[180px] shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
            {items.map((item, i) => {
              const percent = grandTotal > 0 ? item.value / grandTotal : 0;
              const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
              const strokeDashoffset = -circumference * accumulatedPercent;
              accumulatedPercent += percent;

              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500 hover:opacity-85"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-[10px] uppercase font-mono text-[#94A3B8]">Holdings</span>
            <span className="text-sm font-bold font-mono-numbers text-white">
              {portfolios.length} Assets
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 overflow-y-auto max-h-[160px] pr-2 flex-1 text-xs font-mono-numbers">
          {items.map((item, i) => {
            const pct = grandTotal > 0 ? (item.value / grandTotal) * 100 : 0;
            return (
              <div key={i} className="flex items-center justify-between text-[#94A3B8] hover:text-white transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  ></span>
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="font-semibold text-white ml-2">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-[#64748B] pt-2 border-t border-[#1E293B] text-center">
        Diversification helps mitigate single-sector volatility during macro shocks.
      </div>
    </div>
  );
}
