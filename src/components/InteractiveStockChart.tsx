'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Stock } from '@/lib/types';
import { TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react';

interface DataPoint {
  time: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface InteractiveStockChartProps {
  stock: Stock;
  onTickerChange?: (ticker: string) => void;
  availableStocks?: Stock[];
}

export function InteractiveStockChart({
  stock,
  onTickerChange,
  availableStocks = [],
}: InteractiveStockChartProps) {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');
  const [chartType, setChartType] = useState<'area' | 'candle'>('area');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Generate realistic historical time-series deterministically based on stock metrics
  const seriesData: DataPoint[] = useMemo(() => {
    const points: DataPoint[] = [];
    const basePrice = stock.current_price || 1000;
    const prevClose = stock.previous_close || basePrice * 0.99;
    const dayHigh = stock.day_high || Math.max(basePrice, prevClose) * 1.015;
    const dayLow = stock.day_low || Math.min(basePrice, prevClose) * 0.985;

    // Pseudo-random deterministic generator based on ticker string
    const seed = (stock.ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 13) % 1000;
    const pseudoRand = (i: number, offset: number) => {
      const x = Math.sin(seed + i * 9.17 + offset) * 10000;
      return x - Math.floor(x);
    };

    if (timeframe === '1D') {
      // 26 intervals (every 15 mins from 09:15 to 15:30)
      const count = 26;
      const hours = [
        '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00',
        '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00',
        '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00',
        '15:15', '15:30'
      ];

      for (let i = 0; i < count; i++) {
        const progress = i / (count - 1);
        // Trend gently towards current_price
        const trend = prevClose + (basePrice - prevClose) * progress;
        const noise = (pseudoRand(i, 1) - 0.48) * (dayHigh - dayLow) * 0.4;
        
        const p = i === count - 1 ? basePrice : Math.max(dayLow * 0.998, Math.min(dayHigh * 1.002, trend + noise));
        const o = i === 0 ? prevClose : points[i - 1].close;
        const h = Math.max(o, p) + pseudoRand(i, 2) * (dayHigh - dayLow) * 0.12;
        const l = Math.min(o, p) - pseudoRand(i, 3) * (dayHigh - dayLow) * 0.12;
        
        points.push({
          time: hours[i],
          price: Number(p.toFixed(2)),
          open: Number(o.toFixed(2)),
          high: Number(Math.min(dayHigh * 1.005, h).toFixed(2)),
          low: Number(Math.max(dayLow * 0.995, l).toFixed(2)),
          close: Number(p.toFixed(2)),
          volume: Math.floor(15000 + pseudoRand(i, 4) * 85000),
        });
      }
    } else if (timeframe === '1W') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const subPerDay = 5;
      const count = days.length * subPerDay;

      for (let i = 0; i < count; i++) {
        const dayIdx = Math.floor(i / subPerDay);
        const subIdx = i % subPerDay;
        const timeLabel = `${days[dayIdx]} ${['10:00', '11:30', '13:00', '14:30', '15:30'][subIdx]}`;
        const progress = i / (count - 1);
        const wave = Math.sin(progress * Math.PI * 2.5) * (dayHigh - dayLow) * 0.6;
        const noise = (pseudoRand(i, 5) - 0.5) * (dayHigh - dayLow) * 0.35;
        const p = i === count - 1 ? basePrice : Math.max(dayLow * 0.97, Math.min(dayHigh * 1.03, prevClose * 0.98 + (basePrice - prevClose * 0.98) * progress + wave + noise));
        const o = i === 0 ? prevClose * 0.98 : points[i - 1].close;

        points.push({
          time: timeLabel,
          price: Number(p.toFixed(2)),
          open: Number(o.toFixed(2)),
          high: Number((Math.max(o, p) * 1.004).toFixed(2)),
          low: Number((Math.min(o, p) * 0.996).toFixed(2)),
          close: Number(p.toFixed(2)),
          volume: Math.floor(45000 + pseudoRand(i, 6) * 120000),
        });
      }
    } else if (timeframe === '1M') {
      const count = 22; // ~22 trading sessions in a month
      for (let i = 0; i < count; i++) {
        const dateNum = (i + 1).toString().padStart(2, '0');
        const progress = i / (count - 1);
        const trend = (basePrice * 0.94) + (basePrice * 0.06) * progress;
        const wave = Math.cos(progress * Math.PI * 3) * (dayHigh - dayLow) * 0.9;
        const noise = (pseudoRand(i, 7) - 0.49) * (dayHigh - dayLow) * 0.5;
        const p = i === count - 1 ? basePrice : Math.max(dayLow * 0.94, Math.min(dayHigh * 1.06, trend + wave + noise));
        const o = i === 0 ? basePrice * 0.95 : points[i - 1].close;

        points.push({
          time: `${dateNum} Sep`,
          price: Number(p.toFixed(2)),
          open: Number(o.toFixed(2)),
          high: Number((Math.max(o, p) * 1.008).toFixed(2)),
          low: Number((Math.min(o, p) * 0.992).toFixed(2)),
          close: Number(p.toFixed(2)),
          volume: Math.floor(80000 + pseudoRand(i, 8) * 200000),
        });
      }
    } else {
      // 1Y
      const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
      for (let i = 0; i < months.length; i++) {
        const progress = i / (months.length - 1);
        const wave = Math.sin(progress * Math.PI * 1.8) * basePrice * 0.12;
        const noise = (pseudoRand(i, 9) - 0.5) * basePrice * 0.05;
        const p = i === months.length - 1 ? basePrice : basePrice * 0.88 + (basePrice * 0.12) * progress + wave + noise;
        const o = i === 0 ? basePrice * 0.85 : points[i - 1].close;

        points.push({
          time: `${months[i]} 2026`,
          price: Number(p.toFixed(2)),
          open: Number(o.toFixed(2)),
          high: Number((Math.max(o, p) * 1.015).toFixed(2)),
          low: Number((Math.min(o, p) * 0.985).toFixed(2)),
          close: Number(p.toFixed(2)),
          volume: Math.floor(500000 + pseudoRand(i, 10) * 1500000),
        });
      }
    }

    return points;
  }, [stock, timeframe]);

  // Overall bounds
  const { minPrice, maxPrice, startPrice, activePrice, isNetGain, priceDelta, percentDelta } = useMemo(() => {
    if (!seriesData.length) {
      return {
        minPrice: 0,
        maxPrice: 100,
        startPrice: 0,
        activePrice: 0,
        isNetGain: true,
        priceDelta: 0,
        percentDelta: 0,
      };
    }
    const minP = Math.min(...seriesData.map((d) => d.low || d.price));
    const maxP = Math.max(...seriesData.map((d) => d.high || d.price));
    const padding = (maxP - minP) * 0.08 || 1;
    const start = seriesData[0].price;
    const current = hoveredPoint ? hoveredPoint.price : seriesData[seriesData.length - 1].price;
    const delta = current - start;
    const pct = start !== 0 ? (delta / start) * 100 : 0;

    return {
      minPrice: Math.max(0, minP - padding),
      maxPrice: maxP + padding,
      startPrice: start,
      activePrice: current,
      isNetGain: delta >= 0,
      priceDelta: delta,
      percentDelta: pct,
    };
  }, [seriesData, hoveredPoint]);

  // SVG Coordinate mapping
  const width = 800;
  const height = 240;
  const chartPadBottom = 26;
  const effectiveHeight = height - chartPadBottom;

  const getX = (index: number) => (index / (seriesData.length - 1)) * (width - 70) + 10;
  const getY = (price: number) => {
    if (maxPrice === minPrice) return effectiveHeight / 2;
    return effectiveHeight - ((price - minPrice) / (maxPrice - minPrice)) * (effectiveHeight - 20) - 10;
  };

  // Build smooth Area SVG Path
  const { linePath, areaPath } = useMemo(() => {
    if (!seriesData.length) return { linePath: '', areaPath: '' };

    const pts = seriesData.map((d, i) => ({ x: getX(i), y: getY(d.price) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    const aPath = `${d} L ${lastX} ${effectiveHeight} L ${firstX} ${effectiveHeight} Z`;

    return { linePath: d, areaPath: aPath };
  }, [seriesData, minPrice, maxPrice]);

  // Handle Mouse/Touch Hover to Scrub
  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || !seriesData.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const relativeX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, relativeX / rect.width));
    const targetIdx = Math.round(pct * (seriesData.length - 1));
    const point = seriesData[targetIdx];

    if (point) {
      setHoveredPoint(point);
      setHoverX(getX(targetIdx));
    }
  };

  const handlePointerLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  // 4 Y-Axis price levels
  const yAxisTicks = useMemo(() => {
    const step = (maxPrice - minPrice) / 3;
    return [
      maxPrice,
      maxPrice - step,
      minPrice + step,
      minPrice,
    ];
  }, [minPrice, maxPrice]);

  // 4 X-Axis timeline labels
  const xAxisTicks = useMemo(() => {
    if (seriesData.length <= 4) return seriesData.map((d, i) => ({ label: d.time, x: getX(i) }));
    const indices = [
      0,
      Math.floor(seriesData.length * 0.33),
      Math.floor(seriesData.length * 0.66),
      seriesData.length - 1,
    ];
    return indices.map((idx) => ({
      label: seriesData[idx].time,
      x: getX(idx),
    }));
  }, [seriesData]);

  // Palette tokens based on net gain
  const themeStroke = isNetGain ? '#4a7c59' : '#be3835';
  const themeBgBadge = isNetGain ? 'bg-[#edf5ef] text-[#295236] border-[#4a7c59]/25' : 'bg-[#fdf2f2] text-[#be3835] border-[#be3835]/25';

  return (
    <div className="bg-white rounded-xl border border-[#e2e4dc] shadow-card overflow-hidden">
      {/* 1. CHART HEADER & CONTROL BAR */}
      <div className="p-3.5 sm:p-5 border-b border-[#e2e4dc] flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
        <div className="flex items-center gap-3">
          <div>
            {/* Stock Selector & Badge */}
            <div className="flex items-center gap-2">
              {availableStocks.length > 0 && onTickerChange ? (
                <select
                  value={stock.ticker}
                  onChange={(e) => onTickerChange(e.target.value)}
                  className="font-bold text-base sm:text-lg text-[#242826] tracking-tight bg-transparent border-b border-[#d8dbd0] focus:outline-none focus:border-[#4a7c59] cursor-pointer py-0.5"
                >
                  {availableStocks.map((s) => (
                    <option key={s.id} value={s.ticker}>
                      {s.ticker} — {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h3 className="font-bold text-base sm:text-lg text-[#242826] tracking-tight">
                  {stock.ticker} — {stock.name}
                </h3>
              )}
              <span className="text-[10px] sm:text-[11px] font-bold text-[#686e66] bg-[#f6f6f2] px-2 py-0.5 rounded border border-[#e2e4dc] font-mono">
                NSE: {stock.ticker}
              </span>
            </div>

            {/* Dynamic Active Price & Change Indicator */}
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-[#242826] tabular-nums font-mono-numbers tracking-tight">
                ₹{activePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums font-mono border flex items-center gap-1 ${themeBgBadge}`}>
                {isNetGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isNetGain ? '+' : ''}{percentDelta.toFixed(2)}% ({isNetGain ? '+' : ''}₹{priceDelta.toFixed(2)})
              </span>
              {hoveredPoint && (
                <span className="text-[11px] text-[#686e66] font-medium font-mono hidden xs:inline-block">
                  at {hoveredPoint.time}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls: Timeframe & Chart Style Toggles */}
        <div className="flex items-center gap-2">
          {/* Chart Style Toggle (Area Line vs Candlesticks) */}
          <div className="inline-flex rounded-lg bg-[#f6f6f2] p-0.5 border border-[#e2e4dc]">
            <button
              onClick={() => setChartType('area')}
              title="Smooth Area Line Chart"
              className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartType === 'area'
                  ? 'bg-white text-[#4a7c59] shadow-xs border border-[#e2e4dc]/60'
                  : 'text-[#686e66] hover:text-[#242826]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Line</span>
            </button>
            <button
              onClick={() => setChartType('candle')}
              title="Japanese Candlestick View"
              className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartType === 'candle'
                  ? 'bg-white text-[#4a7c59] shadow-xs border border-[#e2e4dc]/60'
                  : 'text-[#686e66] hover:text-[#242826]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Candles</span>
            </button>
          </div>

          {/* Timeframe Selectors */}
          <div className="inline-flex rounded-lg bg-[#f6f6f2] p-0.5 border border-[#e2e4dc] text-xs font-semibold">
            {(['1D', '1W', '1M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs ${
                  timeframe === tf
                    ? 'bg-white text-[#4a7c59] shadow-xs border border-[#e2e4dc]/60 font-bold'
                    : 'text-[#686e66] hover:text-[#242826]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE SVG CANVAS */}
      <div className="p-2 sm:p-4 bg-[#fbfbfa]/90 relative select-none">
        <div className="relative w-full h-[220px] sm:h-[260px]">
          <svg
            ref={svgRef}
            className="w-full h-full cursor-crosshair overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseLeave={handlePointerLeave}
            onTouchEnd={handlePointerLeave}
          >
            <defs>
              <linearGradient id="chartGradientGreen" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.28" />
                <stop offset="70%" stopColor="#4a7c59" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#4a7c59" stopOpacity="0.00" />
              </linearGradient>
              <linearGradient id="chartGradientRed" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#be3835" stopOpacity="0.28" />
                <stop offset="70%" stopColor="#be3835" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#be3835" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Horizontal Y-Axis Grid Lines & Price Labels */}
            {yAxisTicks.map((p, idx) => {
              const y = getY(p);
              return (
                <g key={idx}>
                  <line
                    x1="0"
                    x2={width - 70}
                    y1={y}
                    y2={y}
                    stroke="#e2e4dc"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={width - 5}
                    y={y + 3.5}
                    textAnchor="end"
                    className="font-mono text-[11px] font-medium"
                    fill="#757b72"
                  >
                    ₹{p.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </text>
                </g>
              );
            })}

            {/* Previous Close Reference Guideline */}
            {stock.previous_close && stock.previous_close >= minPrice && stock.previous_close <= maxPrice && (
              <g>
                <line
                  x1="0"
                  x2={width - 70}
                  y1={getY(stock.previous_close)}
                  y2={getY(stock.previous_close)}
                  stroke="#9aa095"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <rect
                  x="5"
                  y={getY(stock.previous_close) - 9}
                  width="70"
                  height="16"
                  rx="3"
                  fill="#f6f6f2"
                  stroke="#d8dbd0"
                  strokeWidth="0.8"
                />
                <text
                  x="8"
                  y={getY(stock.previous_close) + 3}
                  className="font-mono text-[9px] font-bold"
                  fill="#686e66"
                >
                  PREV CLOSE
                </text>
              </g>
            )}

            {/* CHART TYPE 1: SMOOTH AREA & STROKE */}
            {chartType === 'area' && (
              <>
                <path
                  d={areaPath}
                  fill={`url(#${isNetGain ? 'chartGradientGreen' : 'chartGradientRed'})`}
                />
                <path
                  d={linePath}
                  fill="none"
                  stroke={themeStroke}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* CHART TYPE 2: CANDLESTICK BARS */}
            {chartType === 'candle' &&
              seriesData.map((d, i) => {
                const cx = getX(i);
                const candleWidth = Math.max(3, Math.min(10, (width / seriesData.length) * 0.65));
                const yOpen = getY(d.open);
                const yClose = getY(d.close);
                const yHigh = getY(d.high);
                const yLow = getY(d.low);
                const isBullish = d.close >= d.open;
                const candleColor = isBullish ? '#4a7c59' : '#be3835';

                const rectY = Math.min(yOpen, yClose);
                const rectHeight = Math.max(2, Math.abs(yClose - yOpen));

                return (
                  <g key={i}>
                    {/* Wick */}
                    <line
                      x1={cx}
                      x2={cx}
                      y1={yHigh}
                      y2={yLow}
                      stroke={candleColor}
                      strokeWidth="1.2"
                    />
                    {/* Body */}
                    <rect
                      x={cx - candleWidth / 2}
                      y={rectY}
                      width={candleWidth}
                      height={rectHeight}
                      rx="1"
                      fill={candleColor}
                    />
                  </g>
                );
              })}

            {/* HOVER SCRUBBER: VERTICAL LINE & ACTIVE POINT */}
            {hoverX !== null && hoveredPoint && (
              <g>
                {/* Vertical Cursor Scrubber */}
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1="0"
                  y2={effectiveHeight}
                  stroke="#4a7c59"
                  strokeDasharray="3 3"
                  strokeWidth="1.5"
                />

                {/* Pulsing Active Ring */}
                <circle
                  cx={hoverX}
                  cy={getY(hoveredPoint.price)}
                  r="7"
                  fill="#4a7c59"
                  fillOpacity="0.25"
                  className="animate-ping"
                />
                <circle
                  cx={hoverX}
                  cy={getY(hoveredPoint.price)}
                  r="5"
                  fill={isNetGain ? '#4a7c59' : '#be3835'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Floating Tooltip Pill */}
                <g transform={`translate(${Math.min(width - 150, Math.max(10, hoverX - 60))}, ${Math.max(10, getY(hoveredPoint.price) - 46)})`}>
                  <rect
                    width="120"
                    height="38"
                    rx="6"
                    fill="#18211b"
                    fillOpacity="0.95"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <text
                    x="60"
                    y="15"
                    textAnchor="middle"
                    className="font-mono text-[10px] font-bold"
                    fill="#e2e4dc"
                  >
                    {hoveredPoint.time}
                  </text>
                  <text
                    x="60"
                    y="30"
                    textAnchor="middle"
                    className="font-mono text-[12px] font-bold"
                    fill="#ffffff"
                  >
                    ₹{hoveredPoint.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </text>
                </g>
              </g>
            )}

            {/* Static Active Point at Last Data Index when not hovering */}
            {hoverX === null && seriesData.length > 0 && (
              <g>
                <circle
                  cx={getX(seriesData.length - 1)}
                  cy={getY(seriesData[seriesData.length - 1].price)}
                  r="5"
                  fill={themeStroke}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* X-Axis Timeline Labels */}
            {xAxisTicks.map((t, idx) => (
              <text
                key={idx}
                x={t.x}
                y={height - 6}
                textAnchor={idx === 0 ? 'start' : idx === xAxisTicks.length - 1 ? 'end' : 'middle'}
                className="font-mono text-[10px] font-semibold"
                fill="#8a8f85"
              >
                {t.label}
              </text>
            ))}
          </svg>

          {/* Current Live Price Floating Tag on the Right Axis */}
          <div
            className="absolute right-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs tabular-nums font-mono transition-all duration-300 pointer-events-none"
            style={{
              top: `${Math.max(4, Math.min(195, getY(activePrice) - 10))}px`,
              backgroundColor: themeStroke,
            }}
          >
            ₹{activePrice.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 3. COMPREHENSIVE MARKET METRICS STRIP */}
      <div className="px-4 py-3 bg-[#fdfdfc] border-t border-[#e2e4dc] text-xs">
        {/* Day Range Slider */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#686e66] font-medium">
              Day Low: <b className="text-[#242826]">₹{(stock.day_low || minPrice).toFixed(2)}</b>
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#4a7c59] bg-[#edf5ef] px-1.5 sm:px-2 py-0.5 rounded">
              <span className="xs:hidden">Range</span>
              <span className="hidden xs:inline">Today's Trading Range</span>
            </span>
            <span className="text-[#686e66] font-medium">
              Day High: <b className="text-[#242826]">₹{(stock.day_high || maxPrice).toFixed(2)}</b>
            </span>
          </div>
          <div className="relative w-full bg-[#f0ece4] h-2 rounded-full overflow-hidden">
            {/* Range Track Fill */}
            {stock.day_high && stock.day_low && stock.day_high > stock.day_low && (
              <div
                className="h-full bg-gradient-to-r from-[#be3835]/40 via-[#d8dbd0] to-[#4a7c59]/40"
                style={{ width: '100%' }}
              />
            )}
            {/* Current Position Pin */}
            <div
              className="absolute top-0 bottom-0 w-2.5 bg-[#4a7c59] rounded-full border-2 border-white shadow-xs transform -translate-x-1/2 transition-all duration-500"
              style={{
                left: `${Math.max(
                  3,
                  Math.min(
                    97,
                    (((activePrice - (stock.day_low || minPrice)) /
                      ((stock.day_high || maxPrice) - (stock.day_low || minPrice) || 1)) *
                      100)
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        {/* 4 Financial Key Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#e2e4dc]/70 font-mono-numbers text-[11px]">
          <div className="p-2 rounded-lg bg-[#f6f6f2] border border-[#e2e4dc]/60">
            <span className="text-[#686e66] block text-[10px] uppercase font-sans font-medium">Open Price</span>
            <span className="font-bold text-[#242826] text-xs">
              ₹{(stock.previous_close * 1.002 || activePrice).toFixed(2)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#f6f6f2] border border-[#e2e4dc]/60">
            <span className="text-[#686e66] block text-[10px] uppercase font-sans font-medium">Prev. Close</span>
            <span className="font-bold text-[#242826] text-xs">
              ₹{(stock.previous_close || activePrice * 0.99).toFixed(2)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#f6f6f2] border border-[#e2e4dc]/60">
            <span className="text-[#686e66] block text-[10px] uppercase font-sans font-medium">Sector &amp; Exchange</span>
            <span className="font-bold text-[#242826] text-xs font-sans truncate block">
              {stock.sector || 'NSE Large Cap'}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#f6f6f2] border border-[#e2e4dc]/60">
            <span className="text-[#686e66] block text-[10px] uppercase font-sans font-medium">Estimated Volume</span>
            <span className="font-bold text-[#242826] text-xs">
              {(seriesData.reduce((acc, d) => acc + d.volume, 0) / 100000).toFixed(1)}L Shares
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
