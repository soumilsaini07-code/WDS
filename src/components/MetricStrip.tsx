'use client';

import React from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign, PiggyBank, Coins } from 'lucide-react';
import { PortfolioMetric } from '@/lib/types';

interface MetricStripProps {
  metrics: PortfolioMetric;
  ecoinBalance: number;
}

export function MetricStrip({ metrics, ecoinBalance }: MetricStripProps) {
  const isPnlPositive = metrics.todayPnl >= 0;
  const isReturnPositive = metrics.totalReturn >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* 1. Net Worth */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-3.5">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-medium">Total Net Worth</span>
          <Wallet className="w-3.5 h-3.5 text-[#E5B869]" />
        </div>
        <div className="text-xl font-bold font-mono-numbers text-white mt-1">
          ₹{metrics.totalNetWorth.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">
          Holdings + Free Cash
        </div>
      </div>

      {/* 2. Available Virtual Cash */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-3.5">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-medium">Available Cash</span>
          <PiggyBank className="w-3.5 h-3.5 text-[#60A5FA]" />
        </div>
        <div className="text-xl font-bold font-mono-numbers text-white mt-1">
          ₹{metrics.availableCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">
          Liquid for order placement
        </div>
      </div>

      {/* 3. Today's P&L */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-3.5">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-medium">Today's P&L</span>
          {isPnlPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />
          )}
        </div>
        <div
          className={`text-xl font-bold font-mono-numbers mt-1 ${
            isPnlPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
          }`}
        >
          {isPnlPositive ? '+' : ''}₹{Math.abs(metrics.todayPnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div
          className={`text-[11px] font-mono-numbers mt-0.5 ${
            isPnlPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
          }`}
        >
          {isPnlPositive ? '+' : ''}{metrics.todayPnlPercent.toFixed(2)}% (Intraday)
        </div>
      </div>

      {/* 4. Total Return */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-3.5">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-medium">Total Return</span>
          <TrendingUp className="w-3.5 h-3.5 text-[#E5B869]" />
        </div>
        <div
          className={`text-xl font-bold font-mono-numbers mt-1 ${
            isReturnPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
          }`}
        >
          {isReturnPositive ? '+' : ''}₹{Math.abs(metrics.totalReturn).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div
          className={`text-[11px] font-mono-numbers mt-0.5 ${
            isReturnPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
          }`}
        >
          {isReturnPositive ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}% vs ₹10L base
        </div>
      </div>

      {/* 5. ECoin Balance */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-lg p-3.5 col-span-2 md:col-span-1">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-medium">ECoin Club Tokens</span>
          <Coins className="w-3.5 h-3.5 text-[#E5B869]" />
        </div>
        <div className="text-xl font-bold font-mono-numbers text-[#E5B869] mt-1 flex items-center gap-1.5">
          <span>{ecoinBalance}</span>
          <span className="text-xs uppercase font-mono text-[#94A3B8]">ECOIN</span>
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">
          Earned via Learning Hub
        </div>
      </div>
    </div>
  );
}
