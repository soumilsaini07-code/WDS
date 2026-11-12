'use client';

import React from 'react';
import { CompetitionRound, StockPriceSettlement } from '@/lib/types';

interface DynamicPricingSettlementConsoleProps {
  currentRound: CompetitionRound | null;
  rFormulaStats: {
    calculated_r: number;
    average_traded_stock_shift: number;
    total_round_buy_volume: number;
    total_round_sell_volume: number;
    traded_stocks_count: number;
    formula_breakdown: string;
  } | null;
  overrideR: string;
  onOverrideRChange: (val: string) => void;
  stockNewsDeltas: Record<string, string>;
  onStockNewsDeltaChange: (ticker: string, val: string) => void;
  stockRDeltas?: Record<string, string>;
  onStockRDeltaChange?: (ticker: string, val: string) => void;
  onRandomizeAllR?: () => void;
  previewSettlements: StockPriceSettlement[];
  onGeneratePreview: () => void;
  onApplySettlement: () => void;
  loadingPreview: boolean;
  applyingSettlement: boolean;
}

export function DynamicPricingSettlementConsole({
  currentRound,
  rFormulaStats,
  overrideR,
  onOverrideRChange,
  stockNewsDeltas,
  onStockNewsDeltaChange,
  stockRDeltas = {},
  onStockRDeltaChange,
  onRandomizeAllR,
  previewSettlements,
  onGeneratePreview,
  onApplySettlement,
  loadingPreview,
  applyingSettlement,
}: DynamicPricingSettlementConsoleProps) {
  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & HANDWRITTEN RULEBOOK CARD */}
      <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[26px] text-emerald-700">
                candlestick_chart
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-on-surface">
                Dynamic Round-End Pricing Settlement Engine
              </h2>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Implements the handwritten 4-branch stock pricing protocol for{' '}
              <strong>{currentRound?.name || 'Active Round'}</strong>. Clamped within strictly enforced ±10% upper and lower circuit collars.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onRandomizeAllR && (
              <button
                type="button"
                onClick={onRandomizeAllR}
                disabled={loadingPreview}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                title="Automatically assign random R% (between 1% and 10%) to each stock"
              >
                <span className="material-symbols-outlined text-[16px]">casino</span>
                <span>Randomize R% (1%-10%)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onGeneratePreview}
              disabled={loadingPreview}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>{loadingPreview ? 'Calculating...' : 'Recalculate & Preview'}</span>
            </button>

            <button
              type="button"
              onClick={onApplySettlement}
              disabled={applyingSettlement || previewSettlements.length === 0}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-extrabold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">broadcast_on_personal</span>
              <span>{applyingSettlement ? 'Broadcasting...' : 'Broadcast Prices to Floor'}</span>
            </button>
          </div>
        </div>

        {/* The 4-Branch Reference Grid (From User's Handwritten Image) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Branch 1 */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
            <div className="flex items-center justify-between font-bold text-emerald-900 mb-1">
              <span className="px-2 py-0.5 rounded bg-emerald-200/80 text-[10px]">BRANCH 1</span>
              <span>Orders Only</span>
            </div>
            <div className="font-mono font-bold text-sm text-emerald-800 my-1">
              P<sub>next</sub> = P<sub>orders</sub> × (1 + R%)
            </div>
            <p className="text-[11px] text-emerald-700">
              When trades occurred in the round but no news catalyst hit. Next price is volume-weighted average price (VWAP) shifted by market drift R%.
            </p>
          </div>

          {/* Branch 2 */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
            <div className="flex items-center justify-between font-bold text-blue-900 mb-1">
              <span className="px-2 py-0.5 rounded bg-blue-200/80 text-[10px]">BRANCH 2</span>
              <span>Orders + News</span>
            </div>
            <div className="font-mono font-bold text-sm text-blue-800 my-1">
              P<sub>next</sub> = P<sub>orders</sub> × (1 + N% + R%)
            </div>
            <p className="text-[11px] text-blue-700">
              When both trading volume and breaking news shocks impacted the stock. Baseline is VWAP shifted by both news impact N% and market drift R%.
            </p>
          </div>

          {/* Branch 3 */}
          <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
            <div className="flex items-center justify-between font-bold text-purple-900 mb-1">
              <span className="px-2 py-0.5 rounded bg-purple-200/80 text-[10px]">BRANCH 3</span>
              <span>News Only</span>
            </div>
            <div className="font-mono font-bold text-sm text-purple-800 my-1">
              P<sub>next</sub> = P<sub>current</sub> × (1 + N%)
            </div>
            <p className="text-[11px] text-purple-700">
              When no trades were logged but material news broke. Baseline is current price directly shifted by the news variance N%.
            </p>
          </div>

          {/* Branch 4 */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
            <div className="flex items-center justify-between font-bold text-amber-900 mb-1">
              <span className="px-2 py-0.5 rounded bg-amber-200/80 text-[10px]">BRANCH 4</span>
              <span>NULL (Drift)</span>
            </div>
            <div className="font-mono font-bold text-sm text-amber-800 my-1">
              P<sub>next</sub> = P<sub>current</sub> × (1 + R%)
            </div>
            <p className="text-[11px] text-amber-700">
              No orders and no news. Stock drifts alongside overall market sentiment R%, locked within strict ±10% upper and lower circuit collars.
            </p>
          </div>
        </div>
      </div>

      {/* 2. MARKET MOMENTUM R% FORMULA & ADMIN CONTROL CARD */}
      <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[22px]">functions</span>
              <h3 className="font-bold text-sm sm:text-base text-on-surface">
                Market Momentum Formula (R% Drift)
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant font-mono">
              {rFormulaStats?.formula_breakdown || 'R% = (Avg Traded Stocks Shift × 0.7) + (Net Volume Skew × 2.0)'}
            </p>
          </div>

          {/* Live Breakdown Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-[#f5f1ea] border border-outline-variant/60 text-xs font-mono">
              <span className="text-on-surface-variant text-[10px] block">Traded Stocks</span>
              <span className="font-bold text-on-surface">
                {rFormulaStats?.traded_stocks_count ?? 0} securities
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#f5f1ea] border border-outline-variant/60 text-xs font-mono">
              <span className="text-on-surface-variant text-[10px] block">Avg Traded Shift</span>
              <span className={`font-bold ${
                (rFormulaStats?.average_traded_stock_shift ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {(rFormulaStats?.average_traded_stock_shift ?? 0) >= 0 ? '+' : ''}
                {rFormulaStats?.average_traded_stock_shift?.toFixed(2) ?? '0.00'}%
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#f5f1ea] border border-outline-variant/60 text-xs font-mono">
              <span className="text-on-surface-variant text-[10px] block">Buy / Sell Volume</span>
              <span className="font-bold text-on-surface">
                {rFormulaStats?.total_round_buy_volume ?? 0} / {rFormulaStats?.total_round_sell_volume ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Admin Slider & Input for R% */}
        <div className="p-4 rounded-xl bg-[#faf8f4] border border-[#e5dfd3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-on-surface flex items-center justify-between">
              <span>Admin Override for Market Drift R%:</span>
              <span className="font-mono text-emerald-800 text-sm font-black">
                {parseFloat(overrideR) >= 0 ? '+' : ''}{overrideR}%
              </span>
            </label>
            <input
              type="range"
              min="-5.0"
              max="5.0"
              step="0.1"
              value={overrideR}
              onChange={(e) => onOverrideRChange(e.target.value)}
              className="w-full accent-emerald-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>-5.0% (Bearish Market)</span>
              <span>0.0% (Neutral)</span>
              <span>+5.0% (Bullish Market)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.05"
              value={overrideR}
              onChange={(e) => onOverrideRChange(e.target.value)}
              className="w-24 text-right py-2 px-3 rounded-lg bg-white border border-outline-variant/70 text-xs font-mono font-bold"
            />
            <button
              type="button"
              onClick={() => {
                if (rFormulaStats) {
                  onOverrideRChange(rFormulaStats.calculated_r.toFixed(2));
                }
              }}
              className="px-3 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-xs font-semibold text-zinc-800 transition"
              title="Reset R to auto-calculated formula value"
            >
              Reset to Auto
            </button>
          </div>
        </div>
      </div>

      {/* 3. DYNAMIC 4-BRANCH SETTLEMENT PREVIEW TABLE */}
      <div className="bg-white rounded-2xl border border-outline-variant/70 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-on-surface">
              Settlement Allocation &amp; Circuit Collars Table
            </h3>
            <p className="text-xs text-on-surface-variant">
              Edit any stock&apos;s News Impact (N%) directly. Price recalculates according to Branches 1, 2, 3, or 4 and is capped at ±10% circuits.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-3 py-1 bg-[#f5f1ea] rounded-full border border-outline-variant/60 text-on-surface-variant">
            {previewSettlements.length} Securities In Scope
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f5f1ea] border-b border-outline-variant/60 text-[11px] font-bold text-on-surface uppercase tracking-wider">
                <th className="py-3 px-3.5">Security</th>
                <th className="py-3 px-3 text-right">Current Price</th>
                <th className="py-3 px-3 text-center">Orders Traded</th>
                <th className="py-3 px-3 text-right">VWAP (P<sub>orders</sub>)</th>
                <th className="py-3 px-3 text-center">News N%</th>
                <th className="py-3 px-3 text-center">Market R%</th>
                <th className="py-3 px-3">Handwritten Branch</th>
                <th className="py-3 px-3 text-right">Raw Formula</th>
                <th className="py-3 px-3 text-center">Circuit Collars (±10%)</th>
                <th className="py-3 px-3.5 text-right font-black text-emerald-900">Final Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40 font-mono">
              {previewSettlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-on-surface-variant font-sans">
                    <span className="material-symbols-outlined text-[32px] text-zinc-400 block mb-1">
                      calculate
                    </span>
                    Click <strong>&quot;Recalculate &amp; Preview&quot;</strong> above to generate dynamic pricing settlements.
                  </td>
                </tr>
              ) : (
                previewSettlements.map((item) => {
                  const currentN = stockNewsDeltas[item.ticker] ?? stockNewsDeltas[item.stock_id] ?? item.news_impact_percent.toString();

                  let branchBadge = 'bg-zinc-100 text-zinc-800 border-zinc-300';
                  let branchShort = 'Branch 4: NULL';
                  if (item.branch === 'BRANCH_1_ORDERS') {
                    branchBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    branchShort = 'B1: Orders';
                  } else if (item.branch === 'BRANCH_2_ORDERS_AND_NEWS') {
                    branchBadge = 'bg-blue-100 text-blue-900 border-blue-300';
                    branchShort = 'B2: Orders + News';
                  } else if (item.branch === 'BRANCH_3_NEWS_ONLY') {
                    branchBadge = 'bg-purple-100 text-purple-900 border-purple-300';
                    branchShort = 'B3: News Only';
                  }

                  const priceDiff = item.final_price - item.previous_round_price;
                  const priceDiffPct = item.previous_round_price > 0 ? (priceDiff / item.previous_round_price) * 100 : 0;

                  return (
                    <tr key={item.stock_id} className="hover:bg-[#faf8f4] transition">
                      {/* Security */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-on-surface text-xs">{item.ticker}</div>
                        <div className="font-sans text-[10px] text-on-surface-variant line-clamp-1">
                          {item.name}
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="py-3 px-3 text-right font-semibold text-on-surface">
                        ₹{item.previous_round_price.toFixed(2)}
                      </td>

                      {/* Orders Traded */}
                      <td className="py-3 px-3 text-center">
                        {item.order_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {item.order_count} trades ({item.total_volume_traded} sh)
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* VWAP */}
                      <td className="py-3 px-3 text-right">
                        {item.orders_baseline_price ? (
                          <span className="font-semibold text-emerald-700">
                            ₹{item.orders_baseline_price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Editable News N% */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={currentN}
                            onChange={(e) => onStockNewsDeltaChange(item.ticker, e.target.value)}
                            className="w-16 text-center py-1 px-1 rounded border border-outline-variant/70 text-xs font-mono font-bold bg-white"
                          />
                          <span className="text-[11px] font-bold text-zinc-500">%</span>
                        </div>
                      </td>

                      {/* Market R% (Assigned automatically between 1% and 10% per stock, editable) */}
                      <td className="py-3 px-3 text-center font-bold">
                        {onStockRDeltaChange ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={stockRDeltas[item.ticker] ?? stockRDeltas[item.stock_id] ?? item.market_drift_percent.toString()}
                              onChange={(e) => onStockRDeltaChange(item.ticker, e.target.value)}
                              className={`w-16 text-center py-1 px-1 rounded border border-outline-variant/70 text-xs font-mono font-bold bg-white ${
                                (parseFloat(stockRDeltas[item.ticker] ?? item.market_drift_percent.toString()) || 0) >= 0
                                  ? 'text-emerald-800'
                                  : 'text-rose-700'
                              }`}
                            />
                            <span className="text-[11px] font-bold text-zinc-500">%</span>
                          </div>
                        ) : (
                          <span className={item.market_drift_percent >= 0 ? 'text-emerald-800' : 'text-rose-700'}>
                            {item.market_drift_percent >= 0 ? '+' : ''}{item.market_drift_percent}%
                          </span>
                        )}
                      </td>

                      {/* Branch Badge */}
                      <td className="py-3 px-3 font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${branchBadge}`} title={item.branch_label}>
                          {branchShort}
                        </span>
                      </td>

                      {/* Raw Calculated Price */}
                      <td className="py-3 px-3 text-right text-zinc-600">
                        ₹{item.calculated_price.toFixed(2)}
                      </td>

                      {/* Circuit Collars */}
                      <td className="py-3 px-3 text-center text-[10px] text-zinc-500">
                        ₹{item.circuit_lower.toFixed(2)} – ₹{item.circuit_upper.toFixed(2)}
                      </td>

                      {/* Final Price */}
                      <td className="py-3 px-3.5 text-right font-black text-sm text-on-surface">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.is_circuit_breached && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-bold font-sans">
                              CIRCUIT HIT
                            </span>
                          )}
                          <span className={item.is_circuit_breached ? 'text-rose-700' : 'text-emerald-800'}>
                            ₹{item.final_price.toFixed(2)}
                          </span>
                        </div>
                        <div className={`text-[10px] font-medium font-mono ${priceDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {priceDiff >= 0 ? '+' : ''}{priceDiffPct.toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

