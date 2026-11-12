'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, Activity, PieChart, Info, ShieldAlert } from 'lucide-react';
import { InstitutionalRiskMetrics, SyndicateFund } from '@/lib/types';

interface RiskGuardrailsCardProps {
  metrics: InstitutionalRiskMetrics;
  fund: SyndicateFund;
}

export function RiskGuardrailsCard({ metrics, fund }: RiskGuardrailsCardProps) {
  const varPercentage = ((metrics.var95Percent1Day / (fund.total_aum || 1)) * 100).toFixed(2);
  const hasConcentrationBreach = metrics.sectorAllocations.some((s) => s.isConcentrated);

  return (
    <div className="bg-white border border-[#e2e4dc] rounded-xl shadow-card overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#e2e4dc] flex items-center justify-between bg-[#fbfbfa]">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-[#edf5ef] border border-[#cbe4d1] flex items-center justify-center text-[#4a7c59]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#242826]">
            Institutional Risk Guardrails
          </span>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded font-mono font-semibold bg-[#edf5ef] text-[#4a7c59] border border-[#e2e4dc]">
          Mandate Compliant
        </span>
      </div>

      <div className="p-2.5 sm:p-3 space-y-2.5">
        {/* Core Risk Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {/* 95% 1-Day VaR */}
          <div className="bg-[#fbfbfa] border border-[#e2e4dc] rounded-lg p-2">
            <div className="flex items-center justify-between text-[10px] text-[#686e66]">
              <span className="font-medium">95% 1-Day VaR</span>
              <Activity className="w-2.5 h-2.5 text-[#be3835]" />
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-[#242826] mt-0.5">
              ₹{metrics.var95Percent1Day.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[9px] text-[#be3835] font-mono font-semibold">
              {varPercentage}% of AUM
            </div>
          </div>

          {/* Portfolio Beta */}
          <div className="bg-[#fbfbfa] border border-[#e2e4dc] rounded-lg p-2">
            <div className="flex items-center justify-between text-[10px] text-[#686e66]">
              <span className="font-medium">Beta (β)</span>
              <Info className="w-2.5 h-2.5 text-[#4a7c59]" />
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-[#242826] mt-0.5">
              {metrics.portfolioBeta.toFixed(2)}
            </div>
            <div className="text-[9px] text-[#8a9087] font-mono">
              vs. NIFTY (1.00)
            </div>
          </div>

          {/* Sharpe Ratio */}
          <div className="bg-[#fbfbfa] border border-[#e2e4dc] rounded-lg p-2">
            <div className="flex items-center justify-between text-[10px] text-[#686e66]">
              <span className="font-medium">Sharpe Ratio</span>
              <Activity className="w-2.5 h-2.5 text-[#7b6332]" />
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-[#7b6332] mt-0.5">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-[9px] text-[#4a7c59] font-mono font-semibold">
              Tier-1 Quality
            </div>
          </div>

          {/* Circuit Collar Halts */}
          <div className="bg-[#fbfbfa] border border-[#e2e4dc] rounded-lg p-2">
            <div className="flex items-center justify-between text-[10px] text-[#686e66]">
              <span className="font-medium">Circuit Halts</span>
              <ShieldAlert className="w-2.5 h-2.5 text-[#7b6332]" />
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-[#242826] mt-0.5">
              {metrics.circuitLimitBreachesCount} Assets
            </div>
            <div className="text-[9px] text-[#8a9087] font-mono">
              ±10% Bands
            </div>
          </div>
        </div>

        {/* Sector Concentration Bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#242826]">
              <PieChart className="w-3 h-3 text-[#4a7c59]" />
              <span>Sector Exposure &amp; Concentration Limit (&lt; 40%)</span>
            </div>
            {hasConcentrationBreach && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-[#be3835] bg-[#fdf2f2] px-1.5 py-0.2 rounded border border-[#f5c6c6]">
                <AlertTriangle className="w-2.5 h-2.5 text-[#be3835]" />
                CONCENTRATION ALERT
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {metrics.sectorAllocations.map((sec) => (
              <div key={sec.sector} className="text-xs">
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="text-[#686e66] font-medium">{sec.sector}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[#8a9087]">
                      ₹{sec.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                    <span
                      className={`font-bold ${
                        sec.isConcentrated ? 'text-[#be3835]' : 'text-[#242826]'
                      }`}
                    >
                      {sec.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#f6f6f2] h-1.5 rounded-full overflow-hidden border border-[#e2e4dc]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sec.isConcentrated
                        ? 'bg-[#be3835]'
                        : sec.percentage > 30
                        ? 'bg-[#c89228]'
                        : 'bg-[#4a7c59]'
                    }`}
                    style={{ width: `${Math.min(100, sec.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
