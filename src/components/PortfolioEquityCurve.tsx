'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Calendar,
  TrendingUp,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { PortfolioSnapshot } from '@/lib/types';

interface PortfolioEquityCurveProps {
  snapshots: PortfolioSnapshot[];
  currentAum: number;
}

type Timeframe = '7D' | '5D' | '3D' | 'ALL';

export function PortfolioEquityCurve({
  snapshots,
  currentAum,
}: PortfolioEquityCurveProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter snapshots based on timeframe
  const filteredSnapshots = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    if (timeframe === '3D') return snapshots.slice(-3);
    if (timeframe === '5D') return snapshots.slice(-5);
    return snapshots;
  }, [snapshots, timeframe]);

  // Normalize snapshots for equity curve charting
  const chartData = useMemo(() => {
    if (!filteredSnapshots || filteredSnapshots.length === 0) return [];

    const baseFund = filteredSnapshots[0].fund_equity || 5000000;
    const baseBench = filteredSnapshots[0].benchmark_value || 21850;

    return filteredSnapshots.map((s, idx) => {
      const fundReturnPct = ((s.fund_equity - baseFund) / baseFund) * 100;
      const benchReturnPct = ((s.benchmark_value - baseBench) / baseBench) * 100;
      const alphaPct = fundReturnPct - benchReturnPct;
      const cashPct = s.cash_balance ? (s.cash_balance / s.fund_equity) * 100 : 75;

      return {
        id: s.id,
        label: s.date_label,
        timestamp: s.timestamp,
        fundEquity: s.fund_equity,
        cashBalance: s.cash_balance,
        benchmarkVal: s.benchmark_value,
        fundReturnPct: Number(fundReturnPct.toFixed(2)),
        benchReturnPct: Number(benchReturnPct.toFixed(2)),
        alphaPct: Number(alphaPct.toFixed(2)),
        cashPct: Number(cashPct.toFixed(1)),
        isLive: idx === filteredSnapshots.length - 1,
      };
    });
  }, [filteredSnapshots]);

  // Dimensions for SVG
  const width = 640;
  const height = 150;
  const padding = { top: 16, right: 28, bottom: 26, left: 44 };

  // Calculate dynamic min/max percentages with margin
  const allReturns = chartData.flatMap((d) => [d.fundReturnPct, d.benchReturnPct]);
  const rawMin = allReturns.length > 0 ? Math.min(...allReturns) : -1;
  const rawMax = allReturns.length > 0 ? Math.max(...allReturns) : 5;

  const minPct = Math.min(-0.5, Math.floor(rawMin * 10) / 10);
  const maxPct = Math.max(5.2, Math.ceil((rawMax + 0.4) * 10) / 10);

  const getX = (index: number) => {
    if (chartData.length <= 1) return padding.left;
    return (
      padding.left +
      (index / (chartData.length - 1)) * (width - padding.left - padding.right)
    );
  };

  const getY = (val: number) => {
    const range = maxPct - minPct || 1;
    return (
      height -
      padding.bottom -
      ((val - minPct) / range) * (height - padding.top - padding.bottom)
    );
  };

  // Monotone horizontal-tangent cubic bezier spline: guaranteed ZERO overshoot, dip, or sag
  const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = p2.x - p1.x;
      const cp1x = p1.x + dx * 0.45;
      const cp1y = p1.y;
      const cp2x = p2.x - dx * 0.45;
      const cp2y = p2.y;
      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  };

  // Points arrays
  const fundCoords = chartData.map((d, i) => ({ x: getX(i), y: getY(d.fundReturnPct) }));
  const benchCoords = chartData.map((d, i) => ({ x: getX(i), y: getY(d.benchReturnPct) }));

  const fundCurvePath = buildSmoothPath(fundCoords);
  const benchCurvePath = buildSmoothPath(benchCoords);

  // Gradient Area Path
  const bottomY = height - padding.bottom;
  const fundAreaPath =
    fundCoords.length > 0
      ? `${fundCurvePath} L ${fundCoords[fundCoords.length - 1].x},${bottomY} L ${fundCoords[0].x},${bottomY} Z`
      : '';

  // Current Latest Stats
  const lastPoint = chartData[chartData.length - 1];
  const activeHover = hoveredIndex !== null ? chartData[hoveredIndex] : lastPoint;

  const totalFundReturn = lastPoint ? lastPoint.fundReturnPct : 4.97;
  const totalBenchReturn = lastPoint ? lastPoint.benchReturnPct : 1.78;
  const currentAlpha = lastPoint ? lastPoint.alphaPct : 3.19;
  const alphaBps = Math.round(currentAlpha * 100);

  // Y-axis grid markers
  const gridSteps = 4;
  const yTicks = useMemo(() => {
    const ticks = [];
    const step = (maxPct - minPct) / gridSteps;
    for (let i = 0; i <= gridSteps; i++) {
      const val = minPct + step * i;
      ticks.push(Number(val.toFixed(1)));
    }
    return ticks;
  }, [minPct, maxPct]);

  return (
    <div className="bg-white border border-[#e2e4dc] rounded-xl shadow-card overflow-hidden flex flex-col">
      {/* 1. Header & Controls */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#e2e4dc] bg-[#fbfbfa] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-[#edf5ef] border border-[#cbe4d1] flex items-center justify-center text-[#4a7c59]">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#242826]">
                Syndicate Equity Curve vs. NIFTY 50
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#edf5ef] text-[#2e6930] font-semibold border border-[#cbe4d1]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4a7c59] animate-pulse" />
                Live MTM
              </span>
            </div>
            <p className="text-[10px] text-[#686e66] hidden sm:block">
              Benchmark-adjusted cumulative time-weighted returns (TWR)
            </p>
          </div>
        </div>

        {/* Timeframe Selector & Legend Badges */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center bg-[#f0ede6] p-0.5 rounded-md border border-[#e2e4dc] text-[10px] font-mono">
            {(['3D', '5D', 'ALL'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white text-[#242826] shadow-xs font-bold'
                    : 'text-[#686e66] hover:text-[#242826]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[#2e6930] bg-[#edf5ef] px-2 py-0.5 rounded-md border border-[#cbe4d1] font-bold text-[11px] font-mono shadow-xs">
            <Award className="w-3 h-3 text-[#4a7c59]" />
            <span>Alpha: +{currentAlpha}%</span>
            <span className="text-[9px] text-[#4a7c59] font-normal hidden sm:inline">({alphaBps} bps)</span>
          </div>
        </div>
      </div>

      {/* 2. Institutional Performance Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#e2e4dc] border-b border-[#e2e4dc] bg-[#fdfdfc] text-xs font-mono">
        <div className="px-2.5 py-1.5 sm:px-3 flex flex-col">
          <span className="text-[9.5px] text-[#686e66] font-sans uppercase font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4a7c59]" />
            Fund Return (Net)
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs sm:text-sm font-bold text-[#2e6930]">
              +{totalFundReturn}%
            </span>
            <span className="text-[10px] text-[#4a7c59] flex items-center">
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div className="px-2.5 py-1.5 sm:px-3 flex flex-col">
          <span className="text-[9.5px] text-[#686e66] font-sans uppercase font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8a9087]" />
            NIFTY 50 Benchmark
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs sm:text-sm font-bold text-[#686e66]">
              +{totalBenchReturn}%
            </span>
            <span className="text-[9.5px] text-[#8a9087] hidden sm:inline">({lastPoint?.benchmarkVal?.toLocaleString('en-IN')})</span>
          </div>
        </div>

        <div className="px-2.5 py-1.5 sm:px-3 flex flex-col">
          <span className="text-[9.5px] text-[#686e66] font-sans uppercase font-medium flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-[#4a7c59]" />
            Max Drawdown
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs sm:text-sm font-bold text-[#b44335]">
              -0.74%
            </span>
            <span className="text-[9.5px] text-[#686e66] hidden sm:inline">Low Vol</span>
          </div>
        </div>

        <div className="px-2.5 py-1.5 sm:px-3 flex flex-col">
          <span className="text-[9.5px] text-[#686e66] font-sans uppercase font-medium flex items-center gap-1">
            <Activity className="w-2.5 h-2.5 text-[#4a7c59]" />
            Sharpe / Beta
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs sm:text-sm font-bold text-[#242826]">
              2.31
            </span>
            <span className="text-[9.5px] text-[#686e66]">/ β 0.78</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive SVG Chart Area */}
      <div className="relative p-2 sm:p-2.5 bg-white select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-32 sm:h-36 md:h-40 overflow-visible cursor-crosshair"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {/* Smooth Forest Green Area Gradient */}
            <linearGradient id="fundAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#4a7c59" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#4a7c59" stopOpacity="0.00" />
            </linearGradient>

            {/* Benchmark Subtle Gradient */}
            <linearGradient id="benchAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8a9087" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#8a9087" stopOpacity="0.00" />
            </linearGradient>

            {/* Glow Filter for Fund Curve */}
            <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#4a7c59" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Labels */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            const isZero = Math.abs(val) < 0.05;

            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isZero ? '#b8beaf' : '#ebede6'}
                  strokeDasharray={isZero ? '0' : '3 3'}
                  strokeWidth={isZero ? '1.2' : '0.8'}
                />
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className={`text-[9.5px] font-mono select-none ${
                    isZero
                      ? 'fill-[#242826] font-bold'
                      : 'fill-[#8a9087] font-medium'
                  }`}
                >
                  {val > 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`}
                </text>
              </g>
            );
          })}

          {/* Area Fill under Fund Curve */}
          {fundAreaPath && (
            <path
              d={fundAreaPath}
              fill="url(#fundAreaGrad)"
              className="transition-all duration-300 pointer-events-none"
            />
          )}

          {/* Benchmark Polyline (Dashed Institutional Slate) */}
          <path
            d={benchCurvePath}
            fill="none"
            stroke="#8a9087"
            strokeWidth="1.8"
            strokeDasharray="4 4"
            className="pointer-events-none"
          />

          {/* Fund Spline (Deep Emerald Green with Subtle Glow) */}
          <path
            d={fundCurvePath}
            fill="none"
            stroke="#2e6930"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            className="pointer-events-none"
          />

          {/* Dynamic Crosshair Guide Line on Hover */}
          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <g className="pointer-events-none">
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={bottomY}
                stroke="#4a7c59"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.8"
              />
              <circle
                cx={getX(hoveredIndex)}
                cy={getY(chartData[hoveredIndex].fundReturnPct)}
                r="6"
                className="fill-[#2e6930] stroke-white stroke-2"
              />
              <circle
                cx={getX(hoveredIndex)}
                cy={getY(chartData[hoveredIndex].benchReturnPct)}
                r="4.5"
                className="fill-[#8a9087] stroke-white stroke-2"
              />
            </g>
          )}

          {/* Data Points & Touch Interaction Targets */}
          {chartData.map((d, i) => {
            const cx = getX(i);
            const cyFund = getY(d.fundReturnPct);
            const isHovered = hoveredIndex === i;
            const isLive = d.isLive;

            return (
              <g
                key={d.id || i}
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-pointer group"
              >
                {/* Invisible large touch target */}
                <rect
                  x={cx - 15}
                  y={padding.top}
                  width="30"
                  height={bottomY - padding.top}
                  fill="transparent"
                />

                {/* Point for Benchmark */}
                <circle
                  cx={cx}
                  cy={getY(d.benchReturnPct)}
                  r="2.5"
                  className="fill-[#8a9087] opacity-60 group-hover:opacity-100 transition-opacity"
                />

                {/* Live Pulsing Halo on Latest Point */}
                {isLive && hoveredIndex === null && (
                  <circle
                    cx={cx}
                    cy={cyFund}
                    r="8"
                    className="fill-[#4a7c59] opacity-30 animate-ping"
                  />
                )}

                {/* Point for Fund */}
                <circle
                  cx={cx}
                  cy={cyFund}
                  r={isHovered ? 5.5 : isLive ? 4.5 : 3.5}
                  className={`transition-all duration-150 ${
                    isLive
                      ? 'fill-[#2e6930] stroke-white stroke-2 ring-2 ring-[#4a7c59]/40'
                      : 'fill-[#4a7c59] stroke-white stroke-2'
                  }`}
                />

                {/* X-axis Date Labels */}
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-mono select-none transition-colors ${
                    isHovered || isLive
                      ? 'fill-[#1b3d22] font-bold text-[10.5px]'
                      : 'fill-[#686e66]'
                  }`}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 4. Active HUD Card (Shows Hovered details or Latest Snapshot) */}
        <div className="mt-1.5 py-1 px-2.5 rounded-lg bg-[#fbfbfa] border border-[#e2e4dc] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#242826] font-sans">
              {activeHover?.label || 'Live'}
            </span>
            <span className="text-[10px] text-[#686e66] font-sans">
              • {hoveredIndex !== null ? 'Inspecting' : 'Latest MTM'}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-[9.5px] text-[#686e66] font-sans uppercase">Fund:</span>
              <span className="font-bold text-[#242826]">
                ₹{activeHover?.fundEquity?.toLocaleString('en-IN') || '52,48,500'}
              </span>
              <span className="text-[10px] text-[#2e6930] font-bold">
                (+{activeHover?.fundReturnPct || 4.97}%)
              </span>
            </div>

            <div className="hidden sm:flex items-baseline gap-1">
              <span className="text-[9.5px] text-[#686e66] font-sans uppercase">NIFTY:</span>
              <span className="font-semibold text-[#686e66]">
                {activeHover?.benchmarkVal?.toLocaleString('en-IN') || '22,240'}
              </span>
              <span className="text-[10px] text-[#686e66]">
                (+{activeHover?.benchReturnPct || 1.78}%)
              </span>
            </div>

            <div className="flex items-baseline gap-1 bg-[#edf5ef] px-1.5 py-0.5 rounded text-[#2e6930] font-bold border border-[#cbe4d1]">
              <span className="text-[9px] font-sans uppercase">Alpha:</span>
              <span>+{activeHover?.alphaPct || 3.19}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
