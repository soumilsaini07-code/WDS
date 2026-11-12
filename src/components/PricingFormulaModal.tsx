'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, BookOpen, Calculator, Info } from 'lucide-react';

export function PricingFormulaModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-2.5 py-1.5 rounded-lg bg-[#f6f6f2] hover:bg-[#eae6de] border border-[#e2e4dc] text-xs font-semibold text-[#242826] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
        title="View Official Stock Pricing Formulas & Dynamic Circuit Model"
      >
        <span className="material-symbols-outlined text-[16px] text-[#4a7c59]">functions</span>
        <span className="hidden sm:inline">Pricing Formulas</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#ffffff] text-[#242826] w-full max-w-3xl rounded-2xl border border-[#e2e4dc] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-auto">
            {/* Modal Header */}
            <div className="bg-[#141b16] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#2d3a31]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2e4a36] flex items-center justify-center text-emerald-300">
                  <Calculator className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                    Dalal Street Dynamic Stock Pricing &amp; Circuit Protocol
                  </h3>
                  <p className="text-[11px] text-[#8eb69b] font-mono">
                    Official 4-Branch Pricing Model • ECON Edition 2026
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto text-xs leading-relaxed text-[#363a35]">
              {/* Introduction Callout */}
              <div className="p-3.5 rounded-xl bg-[#f6f6f2] border border-[#e2e4dc] flex items-start gap-3">
                <Info className="w-5 h-5 text-[#4a7c59] shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs text-[#525750]">
                  Between trading rounds, all stock prices recalculate based on executed orders, breaking macroeconomic news, and market momentum. All price adjustments are strictly clamped within the <strong>±10% Lower &amp; Upper Circuit Collars</strong>.
                </p>
              </div>

              {/* The 4 Branches */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#686e66]">
                  The 4 Dynamic Pricing Branches
                </h4>

                {/* Branch 1 */}
                <div className="p-4 rounded-xl bg-[#ffffff] border-2 border-emerald-300 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px] uppercase font-mono">
                      Branch 1: Orders After Time
                    </span>
                    <span className="text-xs font-bold text-[#4a7c59]">Trades Logged • No News</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#edf5ef] font-mono font-bold text-sm text-[#1e462a] border border-[#cbe4d1]">
                    P<sub>next</sub> = P<sub>orders</sub> × (1 + R%)
                  </div>
                  <p className="text-[11px] text-[#555a53]">
                    When trades occurred during the session but no company-specific news was issued. <strong>P<sub>orders</sub></strong> is the Volume-Weighted Average Price (VWAP) of all executed trades, adjusted by overall market drift <strong>R%</strong>.
                  </p>
                </div>

                {/* Branch 2 */}
                <div className="p-4 rounded-xl bg-[#ffffff] border-2 border-blue-300 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px] uppercase font-mono">
                      Branch 2: Orders After Time + News
                    </span>
                    <span className="text-xs font-bold text-blue-800">Trades Logged + Breaking News</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50 font-mono font-bold text-sm text-blue-950 border border-blue-200">
                    P<sub>next</sub> = P<sub>orders</sub> × (1 + N% + R%)
                  </div>
                  <p className="text-[11px] text-[#555a53]">
                    When both floor trades occurred and breaking news affected the company. Baseline VWAP (<strong>P<sub>orders</sub></strong>) shifts with the news delta <strong>N%</strong> and market drift <strong>R%</strong>.
                  </p>
                </div>

                {/* Branch 3 */}
                <div className="p-4 rounded-xl bg-[#ffffff] border-2 border-purple-300 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] uppercase font-mono">
                      Branch 3: News Only
                    </span>
                    <span className="text-xs font-bold text-purple-800">No Trades • Breaking News</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-purple-50 font-mono font-bold text-sm text-purple-950 border border-purple-200">
                    P<sub>next</sub> = P<sub>current</sub> × (1 + N%)
                  </div>
                  <p className="text-[11px] text-[#555a53]">
                    When no floor orders took place for that security but material news was broadcasted. Current price adjusts directly by the news impact <strong>N%</strong>.
                  </p>
                </div>

                {/* Branch 4 */}
                <div className="p-4 rounded-xl bg-[#ffffff] border-2 border-amber-300 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] uppercase font-mono">
                      Branch 4: NULL (Drift Only)
                    </span>
                    <span className="text-xs font-bold text-amber-800">No Trades • No News</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 font-mono font-bold text-sm text-amber-950 border border-amber-200">
                    P<sub>next</sub> = P<sub>current</sub> × (1 + R%)
                  </div>
                  <p className="text-[11px] text-[#555a53]">
                    When no trading activity and no specific news occurred. The stock drifts with broader market momentum <strong>R%</strong>.
                  </p>
                </div>
              </div>

              {/* Formula for R% */}
              <div className="p-4 rounded-xl bg-[#f6f6f2] border border-[#e2e4dc] space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#242826] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#4a7c59]">query_stats</span>
                  Mathematical Formula for Market Momentum (R%)
                </h4>
                <div className="p-2.5 rounded-lg bg-white border border-[#e2e4dc] font-mono text-xs text-[#242826]">
                  R% = Clamp( [Avg % Price Shift of All Traded Stocks × 0.70] + [Net Floor Volume Skew × 2.0], -5.0%, +5.0% )
                </div>
                <p className="text-[11px] text-[#686e66]">
                  <strong>R%</strong> captures macro market sentiment by tracking the average shift of all sold securities weighted with buy/sell pressure. Both <strong>R%</strong> and <strong>N%</strong> remain subject to administrative calibration.
                </p>
              </div>

              {/* Circuit Limit Rule */}
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
                <span className="font-bold text-xs uppercase tracking-wider text-rose-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">shield</span>
                  ±10% Lower &amp; Upper Circuit Breaker Collars
                </span>
                <p className="text-[11px] text-rose-800">
                  Lower Circuit = Previous Round Price × 0.90 (-10%)<br />
                  Upper Circuit = Previous Round Price × 1.10 (+10%)<br />
                  If any formula outputs a price beyond these collars, the price is hard-clamped at the circuit limit.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#f6f6f2] px-5 py-3 border-t border-[#e2e4dc] flex items-center justify-between">
              <span className="text-[11px] text-[#686e66] font-mono">
                Verified against Official Event Rulebook §3
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-[#4a7c59] hover:bg-[#3d6749] text-white text-xs font-bold transition cursor-pointer"
              >
                Close &amp; Return
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

