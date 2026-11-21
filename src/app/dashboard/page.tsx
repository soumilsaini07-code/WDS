'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Stock, NewsArticle, CompetitionRound, IPOListing } from '@/lib/types';
import { realtimeHub } from '@/lib/realtime-hub';

interface LatestTrade {
  id: string;
  seller_team: string;
  buyer_team: string;
  ticker: string;
  stock_name: string;
  quantity: number;
  price: number;
  total_amount: number;
  timestamp: number;
}

interface TeamOption {
  id: string;
  name: string;
  code: string;
  balance: number;
}

// Stop handles for 10-second audio alerts
let activeTradeAudioContext: AudioContext | null = null;
let activeTradeAudioTimer: any = null;

function stopTradeBellAudio() {
  if (activeTradeAudioTimer) {
    clearTimeout(activeTradeAudioTimer);
    activeTradeAudioTimer = null;
  }
  if (activeTradeAudioContext) {
    try {
      activeTradeAudioContext.close().catch(() => { });
    } catch { }
    activeTradeAudioContext = null;
  }
}

// Basic Floor Audio Pack: Authentic Trading Bell (Plays across 10 seconds)
function playTradeBell() {
  try {
    stopTradeBellAudio();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    activeTradeAudioContext = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { });
    }

    const strikeBell = (offsetSec: number, volumeScale: number) => {
      const now = ctx.currentTime + offsetSec;

      // Primary strike: 880Hz (A5) -> 1320Hz (E6)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain1.gain.setValueAtTime(0.24 * volumeScale, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Shimmering metallic harmonic: 1760Hz
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1760, now);
      gain2.gain.setValueAtTime(0.12 * volumeScale, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.45);
    };

    // 10-Second Rhythmic Bell Chime Sequence (spaced across 10 seconds)
    strikeBell(0.0, 1.0);  // 0s
    strikeBell(2.5, 0.85); // 2.5s
    strikeBell(5.0, 0.70); // 5.0s
    strikeBell(7.5, 0.55); // 7.5s (rings out to 10s)

    activeTradeAudioTimer = setTimeout(() => {
      stopTradeBellAudio();
    }, 10000);
  } catch { }
}

let activeNewsAudioContext: AudioContext | null = null;
let activeNewsAudioTimer: any = null;

function stopNewsAlertAudio() {
  if (activeNewsAudioTimer) {
    clearTimeout(activeNewsAudioTimer);
    activeNewsAudioTimer = null;
  }
  if (activeNewsAudioContext) {
    try {
      activeNewsAudioContext.close().catch(() => { });
    } catch { }
    activeNewsAudioContext = null;
  }
}

// Basic Floor Audio Pack: 3-Tone Broadcast Alert (Plays across 10 seconds)
function playNewsAlertChime() {
  try {
    stopNewsAlertAudio();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    activeNewsAudioContext = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { });
    }

    const playNewsPulse = (offsetSec: number, isLast: boolean) => {
      const now = ctx.currentTime + offsetSec;

      // Tone 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.24, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Tone 2: 659.25 Hz (E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.28, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);

      // Tone 3: 1046.50 Hz (High C6)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1046.50, now + 0.24);
      gain3.gain.setValueAtTime(isLast ? 0.24 : 0.30, now + 0.24);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + (isLast ? 1.8 : 0.7));
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.24);
      osc3.stop(now + (isLast ? 1.8 : 0.7));
    };

    // 10-Second Rhythmic Broadcast Chime Sequence (spaced across 10 seconds)
    playNewsPulse(0.0, false); // 0.0s
    playNewsPulse(2.0, false); // 2.0s
    playNewsPulse(4.0, false); // 4.0s
    playNewsPulse(6.0, false); // 6.0s
    playNewsPulse(8.0, true);  // 8.0s -> smooth tail ends at exactly 10.0s

    activeNewsAudioTimer = setTimeout(() => {
      stopNewsAlertAudio();
    }, 10000);
  } catch { }
}

export default function ParticipantMarketTerminal() {
  // Theme State: 'dark' (Institutional Bloomberg Terminal) or 'light' (Financial Paper)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wds_theme') as 'dark' | 'light';
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
      }
    } catch { }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('wds_theme', next);
    } catch { }
  };

  const isDark = theme === 'dark';

  // Market Data
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'GAINERS' | 'LOSERS' | 'HIGH_BETA'>('ALL');
  const [sortBy, setSortBy] = useState<'gainers' | 'losers' | 'price_desc' | 'alpha'>('alpha');

  // Competition & Floor Clock State
  const [currentRound, setCurrentRound] = useState<CompetitionRound | null>(null);
  const [roundClock, setRoundClock] = useState<{ remaining_seconds: number; is_paused: boolean; is_orders_locked: boolean }>({
    remaining_seconds: 1800,
    is_paused: false,
    is_orders_locked: false,
  });

  // Active IPO & Teams State
  const [activeIPO, setActiveIPO] = useState<IPOListing | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedIpoTeam, setSelectedIpoTeam] = useState<string>('');
  const [ipoLots, setIpoLots] = useState<number>(5);
  const [ipoSubmitting, setIpoSubmitting] = useState<boolean>(false);
  const [ipoReceipt, setIpoReceipt] = useState<{ success: boolean; message: string } | null>(null);
  const [isIpoDismissed, setIsIpoDismissed] = useState<boolean>(false);

  // Latest Broadcast Trade (Bulletproof 10-second banner)
  const [latestTrade, setLatestTrade] = useState<LatestTrade | null>(null);
  const [tradeBannerMsRemaining, setTradeBannerMsRemaining] = useState<number>(0);
  const tradeExpireAtRef = useRef<number>(0);
  const lastTradeIdRef = useRef<string | null>(null);

  // Audio Settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live News
  const [news, setNews] = useState<NewsArticle[]>([]);

  // Breaking News Alert Banner State
  const [latestNewsAlert, setLatestNewsAlert] = useState<NewsArticle | null>(null);
  const [newsAlertMsRemaining, setNewsAlertMsRemaining] = useState<number>(0);
  const newsAlertExpireRef = useRef<number>(0);
  const lastNewsIdRef = useRef<string>('');

  const triggerBreakingNewsAlert = (item: NewsArticle) => {
    if (!item) return;
    setLatestNewsAlert(item);
    newsAlertExpireRef.current = Date.now() + 10000;
    setNewsAlertMsRemaining(10000);
    if (soundEnabled) {
      playNewsAlertChime();
    }
  };

  // Mobile Tab View State ('equities' | 'chart' | 'news')
  const [mobileTab, setMobileTab] = useState<'equities' | 'chart' | 'news'>('equities');

  // Chart Interactive Hover & Expanded View State
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(false);

  // 1. Digital Countdown Timer (ticks every 1s locally when unpaused)
  useEffect(() => {
    const timer = setInterval(() => {
      setRoundClock((prev) => {
        if (prev.is_paused || prev.remaining_seconds <= 0) return prev;
        return { ...prev, remaining_seconds: prev.remaining_seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. High-Precision 10-Second Banner Countdown (ticks every 100ms)
  useEffect(() => {
    const bannerTimer = setInterval(() => {
      if (tradeExpireAtRef.current > 0) {
        const diff = tradeExpireAtRef.current - Date.now();
        if (diff > 0) {
          setTradeBannerMsRemaining(diff);
        } else {
          tradeExpireAtRef.current = 0;
          setTradeBannerMsRemaining(0);
          setLatestTrade(null);
        }
      }
    }, 100);
    return () => clearInterval(bannerTimer);
  }, []);

  // 2.2 High-Precision 15-Second Breaking News Alert Countdown
  useEffect(() => {
    const newsTimer = setInterval(() => {
      if (newsAlertExpireRef.current > 0) {
        const diff = newsAlertExpireRef.current - Date.now();
        if (diff > 0) {
          setNewsAlertMsRemaining(diff);
        } else {
          newsAlertExpireRef.current = 0;
          setNewsAlertMsRemaining(0);
          setLatestNewsAlert(null);
        }
      }
    }, 100);
    return () => clearInterval(newsTimer);
  }, []);

  // 2.5 Real-Time Supabase WebSocket Telemetry Engine via Singleton Hub
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      realtimeHub.onBroadcast('TRADE_EXECUTED', (payload: any) => {
        const trade = (payload?.payload || payload) as LatestTrade;
        if (trade && trade.id && lastTradeIdRef.current !== trade.id) {
          lastTradeIdRef.current = trade.id;
          setLatestTrade(trade);
          tradeExpireAtRef.current = Date.now() + 10000;
          setTradeBannerMsRemaining(10000);
          if (soundEnabled) {
            playTradeBell();
          }
        }
      }),
      realtimeHub.onBroadcast('STOCK_PRICE_UPDATED', (payload: any) => {
        const updated = (payload?.payload || payload) as Stock;
        if (updated && updated.id) {
          setStocks((prev) =>
            prev.map((s) => (s.id === updated.id || s.ticker === updated.ticker ? { ...s, ...updated } : s))
          );
          setSelectedStock((current) =>
            current && (current.id === updated.id || current.ticker === updated.ticker)
              ? { ...current, ...updated }
              : current
          );
        }
      }),
      realtimeHub.onBroadcast('CLOCK_UPDATED', (payload: any) => {
        const clock = payload?.payload || payload;
        if (clock) {
          setRoundClock(clock);
        }
      }),
      realtimeHub.onBroadcast('ROUND_ADVANCED', (payload: any) => {
        const round = payload?.payload || payload;
        if (round) {
          setCurrentRound(round);
        }
        fetch('/api/rounds')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.currentRound) setCurrentRound(data.currentRound);
            if (data?.activeIPO) setActiveIPO(data.activeIPO);
            else setActiveIPO(null);
            if (data?.clock) setRoundClock(data.clock);
          })
          .catch(() => {});
      }),
      realtimeHub.onBroadcast('IPO_ALLOTTED', () => {
        setActiveIPO(null);
      }),
      realtimeHub.onBroadcast('IPO_STATUS_UPDATED', (payload: any) => {
        const ipo = payload?.payload || payload;
        if (ipo) {
          setActiveIPO((prev) => (prev && prev.id === ipo.id ? { ...prev, ...ipo } : ipo));
        }
      }),
      realtimeHub.onBroadcast('IPO_SUBSCRIPTION_UPDATED', (payload: any) => {
        const update = payload?.payload || payload;
        if (update) {
          setActiveIPO((prev) =>
            prev && (prev.id === update.ipo_id || prev.ticker === update.ticker)
              ? {
                  ...prev,
                  total_demanded_lots: update.total_demanded_lots,
                  subscription_ratio: update.subscription_ratio,
                }
              : prev
          );
        }
      }),
      realtimeHub.onBroadcast('NEWS_PUBLISHED', (payload: any) => {
        const item = (payload?.payload?.news || payload?.news || payload) as NewsArticle;
        if (item) {
          triggerBreakingNewsAlert(item);
        }
      }),
      realtimeHub.onPostgresChange('stocks', (payload: any) => {
        const newStock = payload?.new as Stock;
        if (newStock && newStock.id) {
          setStocks((prev) =>
            prev.map((s) => (s.id === newStock.id || s.ticker === newStock.ticker ? { ...s, ...newStock } : s))
          );
          setSelectedStock((current) =>
            current && (current.id === newStock.id || current.ticker === newStock.ticker)
              ? { ...current, ...newStock }
              : current
          );
        }
      }),
      realtimeHub.onPostgresChange('round_clock', (payload: any) => {
        const clock = payload?.new as any;
        if (clock) {
          setRoundClock({
            remaining_seconds: clock.remaining_seconds,
            is_paused: clock.is_paused,
            is_orders_locked: clock.is_orders_locked,
          });
          fetch('/api/rounds')
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.currentRound) setCurrentRound(data.currentRound);
              if (data?.activeIPO) setActiveIPO(data.activeIPO);
              else setActiveIPO(null);
            })
            .catch(() => {});
        }
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [soundEnabled]);

  // 2.9 Immediate Initial Stocks Hydration Engine (Zero Wait / Non-blocking)
  useEffect(() => {
    let isMounted = true;
    const fetchImmediateStocks = async () => {
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.stocks && Array.isArray(data.stocks) && data.stocks.length > 0) {
            setStocks(data.stocks);
            setSelectedStock((curr) => curr || data.stocks[0]);
          }
        }
      } catch (e) {
        console.warn('Initial stocks fetch failed:', e);
      }
    };
    fetchImmediateStocks();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Real-Time Floor Polling Engine (Polls stocks, rounds, trades, and news every 1.5 seconds)
  useEffect(() => {
    let isMounted = true;

    const pollMarketData = async () => {
      try {
        const [stocksResult, roundsResult, tradeResult, newsResult] = await Promise.allSettled([
          fetch('/api/stocks').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/rounds').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/trades/latest?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/events').then((r) => (r.ok ? r.json() : null)),
        ]);

        if (!isMounted) return;

        const stocksRes = stocksResult.status === 'fulfilled' ? stocksResult.value : null;
        const roundsRes = roundsResult.status === 'fulfilled' ? roundsResult.value : null;
        const tradeRes = tradeResult.status === 'fulfilled' ? tradeResult.value : null;
        const newsRes = newsResult.status === 'fulfilled' ? newsResult.value : null;

        // A. Update Stocks
        if (stocksRes?.stocks && Array.isArray(stocksRes.stocks) && stocksRes.stocks.length > 0) {
          setStocks(stocksRes.stocks);
          setSelectedStock((current) => {
            if (!current && stocksRes.stocks.length > 0) return stocksRes.stocks[0];
            if (current) {
              const updated = stocksRes.stocks.find(
                (s: Stock) => s.id === current.id || s.ticker === current.ticker
              );
              return updated || current;
            }
            return current;
          });
        }

        // B. Update Round, Clock & IPO
        if (roundsRes?.success) {
          setCurrentRound(roundsRes.currentRound || null);
          if (roundsRes.clock) {
            setRoundClock((prev) => {
              if (roundsRes.clock.is_paused) return roundsRes.clock;
              const diff = Math.abs(prev.remaining_seconds - roundsRes.clock.remaining_seconds);
              if (
                prev.is_paused !== roundsRes.clock.is_paused ||
                prev.is_orders_locked !== roundsRes.clock.is_orders_locked ||
                diff > 2
              ) {
                return roundsRes.clock;
              }
              return prev;
            });
          }
          if (roundsRes.activeIPO) {
            setActiveIPO(roundsRes.activeIPO);
          } else {
            setActiveIPO(null);
          }
          if (roundsRes.teams && roundsRes.teams.length > 0) {
            setTeams(roundsRes.teams);
            setSelectedIpoTeam((prev) => prev || roundsRes.teams[0].id);
          }
        }

        // C. Update 10-Second Trade Broadcast Banner
        if (tradeRes?.latestTrade) {
          const trade = tradeRes.latestTrade as LatestTrade;
          if (trade.id && lastTradeIdRef.current !== trade.id) {
            const ageMs = Date.now() - (trade.timestamp || 0);
            if (ageMs < 30000) {
              lastTradeIdRef.current = trade.id;
              setLatestTrade(trade);
              const remaining = Math.max(3000, 10000 - Math.max(0, ageMs));
              tradeExpireAtRef.current = Date.now() + remaining;
              setTradeBannerMsRemaining(remaining);

              if (soundEnabled) {
                playTradeBell();
              }
            } else {
              lastTradeIdRef.current = trade.id;
            }
          }
        }

        // D. Update News & Trigger Breaking News Alerts
        if (newsRes?.news && Array.isArray(newsRes.news)) {
          setNews(newsRes.news);
          if (newsRes.news.length > 0) {
            const newestItem = newsRes.news[0];
            if (lastNewsIdRef.current && lastNewsIdRef.current !== newestItem.id) {
              const pubTime = new Date(newestItem.published_at).getTime();
              if (Date.now() - pubTime < 120000) {
                triggerBreakingNewsAlert(newestItem);
              }
            }
            lastNewsIdRef.current = newestItem.id;
          }
        }
      } catch (err) {
        // Background polling resilience
      }
    };

    pollMarketData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      pollMarketData();
    }, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [soundEnabled]);

  // Market Breadth Calculations
  const marketPulse = useMemo<{
    advancers: number;
    decliners: number;
    unchanged: number;
    total: number;
    advanceRatio: number;
    topGainer: Stock | null;
    topLoser: Stock | null;
  }>(() => {
    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    let topGainer: Stock | null = null;
    let topLoser: Stock | null = null;

    stocks.forEach((s) => {
      const chg = s.change ?? (s.current_price - s.previous_close);
      if (chg > 0) advancers++;
      else if (chg < 0) decliners++;
      else unchanged++;

      if (!topGainer || (s.change_percent ?? 0) > (topGainer.change_percent ?? 0)) {
        topGainer = s;
      }
      if (!topLoser || (s.change_percent ?? 0) < (topLoser.change_percent ?? 0)) {
        topLoser = s;
      }
    });

    return {
      advancers,
      decliners,
      unchanged,
      total: stocks.length || 78,
      advanceRatio: stocks.length > 0 ? (advancers / stocks.length) * 100 : 50,
      topGainer,
      topLoser,
    };
  }, [stocks]);

  // Sector Universe
  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [stocks]);

  // Filtered & Sorted Stocks List
  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = stocks.filter((s) => {
      const matchSearch =
        !q ||
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.sector && s.sector.toLowerCase().includes(q));

      const matchSector = selectedSector === 'ALL' || s.sector === selectedSector;

      let matchQuick = true;
      const chg = s.change_percent ?? (s.previous_close > 0 ? ((s.current_price - s.previous_close) / s.previous_close) * 100 : 0);
      if (quickFilter === 'GAINERS') matchQuick = chg > 0;
      if (quickFilter === 'LOSERS') matchQuick = chg < 0;
      if (quickFilter === 'HIGH_BETA') matchQuick = (s.beta ?? 1.0) >= 1.2;

      return matchSearch && matchSector && matchQuick;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'gainers') return (b.change_percent ?? 0) - (a.change_percent ?? 0);
      if (sortBy === 'losers') return (a.change_percent ?? 0) - (b.change_percent ?? 0);
      if (sortBy === 'price_desc') return b.current_price - a.current_price;
      return a.ticker.localeCompare(b.ticker);
    });

    return list;
  }, [stocks, searchQuery, selectedSector, quickFilter, sortBy]);

  // IPO Lot Application Handler
  const handleApplyIPO = async () => {
    if (!activeIPO) return;
    setIpoSubmitting(true);
    setIpoReceipt(null);
    try {
      const res = await fetch('/api/ipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBSCRIBE',
          ipo_id: activeIPO.id,
          team_id: selectedIpoTeam || teams[0]?.id || 'team-apex-01',
          lots: ipoLots,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIpoReceipt({
          success: true,
          message: `Successfully bid for ${ipoLots} lots (${ipoLots * activeIPO.lot_size} shares) of ${activeIPO.ticker}! Allotment will process at round close.`,
        });
      } else {
        setIpoReceipt({
          success: false,
          message: data.error || 'Failed to submit IPO subscription.',
        });
      }
    } catch (err: any) {
      setIpoReceipt({
        success: false,
        message: err.message || 'Network error applying for IPO.',
      });
    } finally {
      setIpoSubmitting(false);
    }
  };

  // Clock Formatting
  const mins = Math.floor(roundClock.remaining_seconds / 60);
  const secs = roundClock.remaining_seconds % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const { topGainer, topLoser } = marketPulse;

  return (
    <div
      className={`min-h-screen font-sans selection:bg-emerald-600 selection:text-white flex flex-col w-full max-w-full overflow-x-hidden transition-colors duration-200 ${isDark ? 'bg-[#060a08] text-[#e2e8e3]' : 'bg-[#f4f7f4] text-[#1e2720]'
        }`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP LIVE FLOOR APP BAR */}
      {/* ========================================================================= */}
      <header
        className={`backdrop-blur-md border-b sticky top-0 z-50 px-3 sm:px-6 py-2 sm:py-2.5 shadow-xl transition-colors duration-200 ${isDark ? 'bg-[#0b110e]/95 border-[#1b261f]' : 'bg-white/95 border-[#dbe4dd] shadow-xs'
          }`}
      >
        <div className="max-w-[1780px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Top Row on Mobile / Left Section on Desktop */}
          <div className="flex items-center justify-between gap-2.5 w-full sm:w-auto">
            {/* Brand Identity */}
            <div
              className={`h-9 sm:h-10 px-2.5 sm:px-3 py-1 rounded-xl border flex items-center gap-2 sm:gap-2.5 shadow-md transition-colors ${isDark
                  ? 'bg-gradient-to-r from-[#121c15] to-[#18251c] border-[#233527]'
                  : 'bg-gradient-to-r from-[#f0f6f1] to-[#e6f0e8] border-[#cce0d1]'
                }`}
            >
              <img
                src="/wds-logo-clean.png"
                alt="Wolf of Dalal Street"
                className="h-6 sm:h-7 w-auto object-contain shrink-0 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
              />
              <div className="flex flex-col leading-none">
                <span
                  className={`font-extrabold text-xs sm:text-base tracking-tight flex items-center gap-1 sm:gap-1.5 ${isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                >
                  Wolf of Dalal Street
                  <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-400 font-bold border border-emerald-700/80 uppercase font-mono tracking-wider shadow-xs">
                    FLOOR
                  </span>
                </span>
                <span className="text-[8px] sm:text-[9px] text-[#c9a661] font-semibold uppercase tracking-wider mt-0.5 truncate max-w-[160px] sm:max-w-none">
                  Economics Club • Thapar Univ
                </span>
              </div>
            </div>

            {/* Desktop Stage Info */}
            <div className={`hidden lg:flex items-center gap-2 pl-3 border-l text-xs ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <span
                className={`px-2.5 py-1 rounded-full font-extrabold text-[11px] font-mono shadow-xs border ${isDark
                    ? 'bg-[#16221a] text-emerald-300 border-[#2a3d2e]'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
              >
                Round {currentRound ? currentRound.index : 0} of 7
              </span>
              <span className={`font-bold text-xs truncate max-w-xs ${isDark ? 'text-white' : 'text-zinc-800'}`}>
                {currentRound?.name || 'Round 0: Initial Purchase Session'}
              </span>
            </div>

            {/* Mobile Header Quick Actions (Theme & Sound buttons aligned right on mobile) */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTheme}
                className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center justify-center cursor-pointer ${isDark
                    ? 'bg-[#152219] text-amber-300 border-emerald-700/60'
                    : 'bg-white text-zinc-700 border-zinc-300'
                  }`}
                title={isDark ? 'Switch to Light' : 'Switch to Dark'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isDark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) playTradeBell();
                }}
                className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center justify-center cursor-pointer ${isDark
                    ? soundEnabled
                      ? 'bg-[#152219] text-emerald-400 border-emerald-700/60'
                      : 'bg-[#101412] text-zinc-500 border-zinc-800'
                    : soundEnabled
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                  }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {soundEnabled ? 'volume_up' : 'volume_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Floor Clock, Desktop Toggles, and Stream Status */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Mobile Stage Pill */}
            <div className="flex lg:hidden items-center gap-1 text-[11px] font-mono">
              <span
                className={`px-2 py-0.5 rounded-lg font-bold border truncate max-w-[155px] ${isDark
                    ? 'bg-[#16221a] text-emerald-300 border-[#2a3d2e]'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
              >
                R{currentRound ? currentRound.index : 0}: {currentRound?.name?.split(':')[1]?.trim() || 'Initial'}
              </span>
            </div>

            {/* Live Synchronized Floor Clock */}
            <div
              className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border shadow-inner transition-colors ${isDark ? 'bg-[#080d0a] border-[#1e2a21]' : 'bg-[#f0f5f1] border-[#d2dfd5]'
                }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] sm:text-[20px] ${roundClock.is_paused ? 'text-amber-500' : 'text-emerald-500 animate-pulse'
                  }`}
              >
                schedule
              </span>
              <div className="text-right">
                <span className={`text-[8px] sm:text-[9px] uppercase font-bold block leading-none ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Timer
                </span>
                <span
                  className={`font-mono text-base sm:text-xl font-black tracking-wider ${roundClock.is_paused
                      ? 'text-amber-500'
                      : roundClock.remaining_seconds <= 120
                        ? 'text-rose-500 animate-pulse'
                        : 'text-emerald-500'
                    }`}
                >
                  {timeFormatted}
                  {roundClock.is_paused && (
                    <span className="text-[9px] text-amber-500 ml-1 font-bold tracking-normal uppercase">
                      (P)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Desktop Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`hidden sm:flex p-2 rounded-xl border text-xs font-bold transition items-center justify-center cursor-pointer shadow-xs ${isDark
                  ? 'bg-[#152219] text-amber-300 border-emerald-700/60 hover:bg-[#1b2d21]'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                }`}
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Terminal Theme'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Desktop Sound Toggle Button */}
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playTradeBell();
              }}
              className={`hidden sm:flex p-2 rounded-xl border text-xs font-bold transition items-center justify-center cursor-pointer ${isDark
                  ? soundEnabled
                    ? 'bg-[#152219] text-emerald-400 border-emerald-700/60 hover:bg-[#1b2d21]'
                    : 'bg-[#101412] text-zinc-500 border-zinc-800 hover:text-zinc-300'
                  : soundEnabled
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:text-zinc-600'
                }`}
              title={soundEnabled ? 'Floor Sound Alerts: Active (Click to mute)' : 'Floor Sound Alerts: Muted (Click to enable)'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {soundEnabled ? 'volume_up' : 'volume_off'}
              </span>
            </button>

            {/* Stream Pulse */}
            <div
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold shadow-inner shrink-0 ${isDark ? 'bg-[#080d0a] border-[#1e2a21]' : 'bg-[#f0f5f1] border-[#d2dfd5]'
                }`}
            >
              <span
                className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${roundClock.is_paused ? 'bg-amber-500' : 'bg-emerald-400 animate-ping'
                  }`}
              ></span>
              <span className={roundClock.is_paused ? 'text-amber-500' : 'text-emerald-500'}>
                {roundClock.is_paused ? 'PAUSED' : 'LIVE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CONTINUOUS RUNNING STOCK TICKER MARQUEE TAPE (SLOW, LEISURELY PACE) */}
      {/* ========================================================================= */}
      <div
        className={`w-full border-b overflow-hidden py-1.5 relative z-40 select-none shadow-xs transition-colors duration-200 ${isDark ? 'bg-[#070b08] border-[#18231c]' : 'bg-[#edf4ee] border-[#d5e0d7]'
          }`}
      >
        <div className="animate-marquee whitespace-nowrap flex items-center gap-6">
          {[...stocks, ...stocks].map((stk, idx) => {
            const chg =
              stk.change_percent ??
              (stk.previous_close > 0
                ? ((stk.current_price - stk.previous_close) / stk.previous_close) * 100
                : 0);
            const isUp = chg >= 0;
            return (
              <button
                key={`${stk.ticker}-${idx}`}
                type="button"
                onClick={() => setSelectedStock(stk)}
                className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-lg transition cursor-pointer text-left ${isDark ? 'hover:bg-[#141f17]' : 'hover:bg-[#e0ece2]'
                  }`}
              >
                <span className={`font-mono font-black text-xs ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {stk.ticker}
                </span>
                <span className={`font-mono text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  ₹{stk.current_price.toFixed(1)}
                </span>
                <span
                  className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded ${isUp
                      ? isDark
                        ? 'text-emerald-400 bg-emerald-950/70'
                        : 'text-emerald-700 bg-emerald-100'
                      : isDark
                        ? 'text-rose-400 bg-rose-950/70'
                        : 'text-rose-700 bg-rose-100'
                    }`}
                >
                  {isUp ? '▲ +' : '▼ '}
                  {Math.abs(chg).toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2.8 BREAKING NEWS WIRE FLASH NOTIFICATION BANNER */}
      {/* ========================================================================= */}
      {latestNewsAlert && newsAlertMsRemaining > 0 && (() => {
        const pctRemaining = Math.max(0, Math.min(100, (newsAlertMsRemaining / 10000) * 100));
        return (
          <div className="w-full relative z-40 transition-all duration-300 bg-[#160B0E]/95 border-b border-rose-500/30 shadow-[0_4px_24px_-4px_rgba(244,63,94,0.25)] backdrop-blur-xl text-white animate-in fade-in slide-in-from-top-2">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />

            <div className="max-w-[1780px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.16em] uppercase shrink-0 bg-rose-500/15 border border-rose-500/40 text-rose-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  </span>
                  <span>BREAKING NEWS WIRE</span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white tracking-tight truncate sm:whitespace-normal">
                    {latestNewsAlert.headline.replace(/^BREAKING:\s*/i, '')}
                  </h4>
                  {latestNewsAlert.body && latestNewsAlert.body !== 'Official market news flash released by exchange administration.' && (
                    <p className="text-[11px] text-zinc-300 line-clamp-1 mt-0.5">
                      {latestNewsAlert.body}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 justify-end">
                {latestNewsAlert.published_at && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 font-mono text-[11px] text-zinc-300">
                    <span className="material-symbols-outlined text-[13px] text-rose-400">schedule</span>
                    <span>
                      {new Date(latestNewsAlert.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 font-mono text-[11px] text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  <span className="tabular-nums font-medium text-zinc-200">
                    {(newsAlertMsRemaining / 1000).toFixed(1)}s
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    newsAlertExpireRef.current = 0;
                    setNewsAlertMsRemaining(0);
                    setLatestNewsAlert(null);
                    stopNewsAlertAudio();
                  }}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Dismiss news banner"
                >
                  <span className="material-symbols-outlined text-[16px] block">close</span>
                </button>
              </div>
            </div>

            <div className="w-full bg-white/[0.03] h-[1.5px] relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-pink-400 to-rose-300 transition-all duration-100 ease-linear shadow-[0_0_8px_#f43f5e]"
                style={{ width: `${pctRemaining}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 3. SLEEK FINANCIAL HUD TRADE EXECUTION NOTIFICATION BANNER */}
      {/* ========================================================================= */}
      {latestTrade && tradeBannerMsRemaining > 0 && (() => {
        const isPrimary =
          latestTrade.seller_team === 'Central Primary Pool' ||
          latestTrade.seller_team.includes('Primary') ||
          latestTrade.seller_team.includes('Issuer') ||
          latestTrade.seller_team.includes('Exchange') ||
          latestTrade.buyer_team === 'Central Primary Pool';

        const pctRemaining = Math.max(0, Math.min(100, (tradeBannerMsRemaining / 10000) * 100));

        return (
          <div
            className={`w-full relative z-40 transition-all duration-300 ${isPrimary
                ? 'bg-[#120F09]/95 border-b border-amber-500/20 shadow-[0_4px_24px_-4px_rgba(245,158,11,0.15)]'
                : 'bg-[#0B1015]/95 border-b border-emerald-500/20 shadow-[0_4px_24px_-4px_rgba(16,185,129,0.15)]'
              } backdrop-blur-xl text-white`}
          >
            {/* Top ambient hairline accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-px ${isPrimary
                  ? 'bg-gradient-to-r from-transparent via-amber-500/40 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent'
                }`}
            />

            <div className="max-w-[1780px] mx-auto px-4 sm:px-6 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Left Column: Settlement Signal & Counterparty Route */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Live Pulse Beacon Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.16em] uppercase shrink-0 ${isPrimary
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPrimary ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${isPrimary ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                    />
                  </span>
                  <span>{isPrimary ? 'PRIMARY ISSUE ALLOTMENT' : 'FLOOR SETTLEMENT'}</span>
                </div>

                {/* Transfer Route */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-zinc-200">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">SELLER</span>
                    <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                      {latestTrade.seller_team}
                    </span>
                  </div>

                  <span className={`text-xs font-mono font-bold ${isPrimary ? 'text-amber-400' : 'text-emerald-400'}`}>
                    →
                  </span>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-zinc-200">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">BUYER</span>
                    <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                      {latestTrade.buyer_team}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Transaction Details & Countdown */}
              <div className="flex items-center gap-3 justify-between md:justify-end flex-wrap">
                {/* Stock & Volume Pill */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 font-sans font-black text-white tracking-wider text-[11px]">
                    {latestTrade.ticker}
                  </span>
                  <span className="text-zinc-300">
                    {latestTrade.quantity.toLocaleString('en-IN')}{' '}
                    <span className="text-zinc-400 text-[10px]">SH</span>
                  </span>
                  <span className="text-zinc-400">@</span>
                  <span className="text-white font-semibold">
                    ₹{latestTrade.price.toFixed(2)}
                  </span>
                  <span className="text-zinc-400 mx-0.5">/</span>
                  <span className={`font-bold ${isPrimary ? 'text-amber-400' : 'text-emerald-400'}`}>
                    ₹{latestTrade.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* 10s Timer & Dismiss */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 font-mono text-[11px] text-zinc-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPrimary ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
                    <span className="tabular-nums font-medium text-zinc-200">
                      {(tradeBannerMsRemaining / 1000).toFixed(1)}s
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      tradeExpireAtRef.current = 0;
                      setTradeBannerMsRemaining(0);
                      setLatestTrade(null);
                      stopTradeBellAudio();
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Dismiss"
                  >
                    <span className="material-symbols-outlined text-[16px] block">close</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Micro Precision Progress Line */}
            <div className="w-full bg-white/[0.03] h-[1.5px] relative overflow-hidden">
              <div
                className={`h-full ${isPrimary
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300'
                  } transition-all duration-100 ease-linear`}
                style={{ width: `${pctRemaining}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 4. DYNAMIC MARKET PULSE & DALAL STREET BREADTH OVERVIEW */}
      {/* ========================================================================= */}
      <section
        className={`border-b px-3 sm:px-6 py-2.5 transition-colors duration-200 ${isDark ? 'bg-[#090e0b] border-[#18231c]' : 'bg-white border-[#dbe4dd]'
          }`}
      >
        <div className="max-w-[1780px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Market Breadth Gauge */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`font-bold uppercase font-mono tracking-wider text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Market Pulse:
              </span>
              <span
                className={`font-bold font-mono flex items-center gap-1 px-2 py-0.5 rounded border ${isDark
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
              >
                ▲ {marketPulse.advancers} Advancing
              </span>
              <span
                className={`font-bold font-mono flex items-center gap-1 px-2 py-0.5 rounded border ${isDark
                    ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
              >
                ▼ {marketPulse.decliners} Declining
              </span>
            </div>

            {/* Breadth Bar */}
            <div className="hidden lg:flex items-center gap-2 w-36">
              <div
                className={`w-full h-2 rounded-full overflow-hidden flex border ${isDark ? 'bg-rose-950 border-zinc-800' : 'bg-rose-200 border-zinc-300'
                  }`}
              >
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${marketPulse.advanceRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Top Mover Badges */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {topGainer ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedStock(topGainer);
                  setMobileTab('chart');
                }}
                className={`flex items-center justify-between sm:justify-start gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer text-[11px] font-mono ${isDark
                    ? 'bg-[#111c14] border-emerald-800/60 hover:bg-[#18291d]'
                    : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  }`}
              >
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Gainer:</span>
                <span className={`font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{topGainer.ticker}</span>
                <span className="font-bold text-emerald-500">
                  +{(topGainer.change_percent ?? 0).toFixed(1)}%
                </span>
              </button>
            ) : null}

            {topLoser ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedStock(topLoser);
                  setMobileTab('chart');
                }}
                className={`flex items-center justify-between sm:justify-start gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer text-[11px] font-mono ${isDark
                    ? 'bg-[#181012] border-rose-800/60 hover:bg-[#251518]'
                    : 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                  }`}
              >
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Loser:</span>
                <span className={`font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{topLoser.ticker}</span>
                <span className="font-bold text-rose-500">
                  {(topLoser.change_percent ?? 0).toFixed(1)}%
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE IPO PRIMARY OFFERING SHOWCASE (WHEN IN IPO ROUND) */}
      {/* ========================================================================= */}
      {activeIPO && isIpoDismissed && (
        <div className="max-w-[1780px] mx-auto px-3 sm:px-6 py-2">
          <button
            type="button"
            onClick={() => setIsIpoDismissed(false)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">stars</span>
            <span>Primary Offering Open: <strong>{activeIPO.company_name} ({activeIPO.ticker})</strong></span>
            <span className="text-[10px] bg-amber-500 text-black font-black px-1.5 py-0.5 rounded uppercase">Show Desk</span>
          </button>
        </div>
      )}

      {activeIPO && !isIpoDismissed && (
        <section
          className={`border-b-2 border-amber-500/80 px-3 sm:px-6 py-4 shadow-xl transition-colors duration-200 relative ${isDark
              ? 'bg-gradient-to-r from-[#171408] via-[#241e0b] to-[#171408]'
              : 'bg-gradient-to-r from-[#fdfbf3] via-[#f7f2dc] to-[#fdfbf3]'
            }`}
        >
          <div className="max-w-[1780px] mx-auto">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              {/* Left Info */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px] uppercase font-mono tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                    <span className="material-symbols-outlined text-[14px]">stars</span>
                    PRIMARY MARKET OFFERING OPEN
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-xs border font-bold ${isDark
                        ? 'bg-black/60 text-amber-300 border-amber-500/40'
                        : 'bg-white text-amber-800 border-amber-300'
                      }`}
                  >
                    {activeIPO.sector}
                  </span>

                  {typeof activeIPO.news_impact_percent === 'number' && activeIPO.news_impact_percent !== 0 && (
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-xs border font-bold flex items-center gap-1 ${activeIPO.news_impact_percent > 0
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {activeIPO.news_impact_percent > 0 ? 'trending_up' : 'trending_down'}
                      </span>
                      News Delta: {activeIPO.news_impact_percent > 0 ? `+${activeIPO.news_impact_percent}%` : `${activeIPO.news_impact_percent}%`}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className={`text-lg sm:text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {activeIPO.company_name} ({activeIPO.ticker})
                  </h2>
                  <span className={`text-xs sm:text-sm font-mono ${isDark ? 'text-amber-300' : 'text-amber-700 font-bold'}`}>
                    Ref Price P₀: <strong>₹{activeIPO.reference_price}</strong> • Lot Size: <strong>{activeIPO.lot_size} shares/lot</strong>
                  </span>
                </div>

                {activeIPO.news_headline && (
                  <div className="text-[11px] font-mono text-amber-400/90 italic flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">newspaper</span>
                    <span>News Impact Wire: &ldquo;{activeIPO.news_headline}&rdquo;</span>
                  </div>
                )}

                <p className={`text-xs max-w-3xl leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {(activeIPO.description || 'Enterprise offering on Dalal Street. Primary market offering open for offline book-building.')
                    .replace(/\.?\s*(Smooth\s*(pricing|S-Curve\s*Pricing)?[:\s]*)?P_?listing[\s\S]*$/i, '')
                    .replace(/Smooth\s*pricing[\s\S]*$/i, '')
                    .replace(/P_?listing[\s\S]*$/i, '')
                    .replace(/P0\s*[×*][\s\S]*$/i, '')
                    .replace(/Formula:[\s\S]*$/i, '')
                    .trim() || 'Enterprise offering on Dalal Street. Primary market offering open for offline book-building.'}
                </p>
              </div>

              {/* Dismiss / Hide Action Button */}
              <button
                type="button"
                onClick={() => setIsIpoDismissed(true)}
                title="Hide IPO Offering"
                className="self-end xl:self-start px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition border border-transparent hover:border-zinc-700 cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>✕</span>
                <span className="text-[11px]">Hide</span>
              </button>

              {/* Right: Demand Ratio Gauge & Offline Floor Book-Building Notice */}
              <div
                className={`border border-amber-500/40 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0 shadow-lg ${isDark ? 'bg-black/60' : 'bg-white'
                  }`}
              >
                {/* Demand Ratio Gauge */}
                <div className="text-center sm:text-right border-b sm:border-b-0 sm:border-r border-zinc-800 sm:pr-4 pb-2 sm:pb-0 min-w-[130px]">
                  <span className={`text-[10px] uppercase font-bold block font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Demand Ratio (S)
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-amber-500 font-mono block">
                    {activeIPO.subscription_ratio ? `${activeIPO.subscription_ratio.toFixed(2)}x` : '0.00x'}
                  </span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {activeIPO.total_demanded_lots || 0} / {activeIPO.total_issue_lots || 100} Lots
                  </span>
                  <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full transition-all duration-500 ${(activeIPO.subscription_ratio || 0) >= 1.0 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      style={{
                        width: `${Math.min(100, ((activeIPO.subscription_ratio || 0) / 1.5) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Offline Book-Building Notice */}
                {activeIPO.status === 'ALLOTTED' ? (
                  <div className="flex flex-col justify-center px-2 py-1 max-w-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs font-mono">
                      <span>🎉</span>
                      <span>ALLOTMENT FINALIZED</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-tight font-mono ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      Listing Price: <strong className="text-emerald-400">₹{(activeIPO.issue_price || activeIPO.reference_price).toFixed(2)}</strong>
                    </p>
                    <span className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                      🎙️ Allotments announced live by Econ Desk!
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center px-2 py-1 max-w-xs sm:max-w-sm">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs font-mono">
                      <span>📝</span>
                      <span>OFFLINE BOOK-BUILDING</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      Submit physical bid slip at the <strong>Econ Admin Desk</strong>.
                    </p>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      ⚡ If oversubscribed (S &gt; 1.0x), lots are drawn via fair randomized lottery.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Feedback */}
            {ipoReceipt && (
              <div
                className={`mt-2.5 p-2.5 rounded-xl text-xs font-bold font-mono flex items-center justify-between border ${ipoReceipt.success
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                  }`}
              >
                <span>{ipoReceipt.message}</span>
                <button
                  type="button"
                  onClick={() => setIpoReceipt(null)}
                  className="text-zinc-400 hover:text-white px-2 py-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. CONTROLS BAR: SEARCH, QUICK FILTERS, SECTOR CHIPS & SORTING */}
      {/* ========================================================================= */}
      <div
        className={`border-b px-3 sm:px-6 py-2.5 sm:py-3 static sm:sticky sm:top-[61px] z-30 shadow-md transition-colors duration-200 ${isDark ? 'bg-[#0b100d] border-[#18231c]' : 'bg-[#f8faf8] border-[#dbe4dd]'
          }`}
      >
        <div className="max-w-[1780px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full md:max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 78 stocks by Ticker, Company, or Sector (e.g. Zomato, Reliance)..."
              className={`w-full pl-9 pr-8 py-2 rounded-xl border text-xs sm:text-sm focus:border-emerald-500 focus:outline-none transition shadow-inner ${isDark
                  ? 'bg-[#121a14] border-[#233327] text-white placeholder-zinc-500'
                  : 'bg-white border-[#ccd9cf] text-zinc-900 placeholder-zinc-400'
                }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Buttons (Smooth Horizontal Scroll on Mobile) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => { setQuickFilter('ALL'); setSelectedSector('ALL'); }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs ${quickFilter === 'ALL' && selectedSector === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : isDark
                    ? 'bg-[#121a14] text-zinc-400 hover:text-white hover:bg-[#1a261d] border border-[#1e2c21]'
                    : 'bg-white text-zinc-600 hover:text-zinc-900 hover:bg-[#ebf3ed] border border-[#ccd9cf]'
                }`}
            >
              All 78 Stocks
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('GAINERS')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs ${quickFilter === 'GAINERS'
                  ? 'bg-emerald-600 text-white'
                  : isDark
                    ? 'bg-[#121a14] text-zinc-400 hover:text-emerald-300 hover:bg-[#1a261d] border border-[#1e2c21]'
                    : 'bg-white text-zinc-600 hover:text-emerald-700 hover:bg-[#ebf3ed] border border-[#ccd9cf]'
                }`}
            >
              🔥 Top Gainers
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('LOSERS')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs ${quickFilter === 'LOSERS'
                  ? 'bg-rose-600 text-white'
                  : isDark
                    ? 'bg-[#121a14] text-zinc-400 hover:text-rose-300 hover:bg-[#1a261d] border border-[#1e2c21]'
                    : 'bg-white text-zinc-600 hover:text-rose-700 hover:bg-[#ebf3ed] border border-[#ccd9cf]'
                }`}
            >
              ❄️ Top Losers
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('HIGH_BETA')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-xs ${quickFilter === 'HIGH_BETA'
                  ? 'bg-amber-600 text-white'
                  : isDark
                    ? 'bg-[#121a14] text-zinc-400 hover:text-amber-300 hover:bg-[#1a261d] border border-[#1e2c21]'
                    : 'bg-white text-zinc-600 hover:text-amber-700 hover:bg-[#ebf3ed] border border-[#ccd9cf]'
                }`}
            >
              ⚡ High Beta
            </button>
          </div>

          {/* Sector & Sort Dropdowns (Clean 2-Col on Mobile, Inline Flex on Desktop) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
            <select
              value={selectedSector}
              onChange={(e) => { setSelectedSector(e.target.value); setQuickFilter('ALL'); }}
              className={`w-full sm:w-auto px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none cursor-pointer border ${isDark
                  ? 'bg-[#121a14] border-[#1e2c21] text-zinc-300'
                  : 'bg-white border-[#ccd9cf] text-zinc-800'
                }`}
            >
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 'ALL' ? 'All Sectors' : sec}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className={`w-full sm:w-auto py-1.5 px-2.5 sm:px-3 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer shadow-inner ${isDark
                  ? 'bg-[#121a14] border-[#233327] text-white'
                  : 'bg-white border-[#ccd9cf] text-zinc-800'
                }`}
            >
              <option value="alpha">A-Z (Alphabetical)</option>
              <option value="gainers">Top Gainers (▲ %)</option>
              <option value="losers">Top Losers (▼ %)</option>
              <option value="price_desc">Highest Price (₹)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6.5. MOBILE VIEW TABS (Market Watch vs Interactive Chart vs Dalal Wire) */}
      {/* Hidden on Windows & Laptops (lg:hidden) */}
      {/* ========================================================================= */}
      <div
        className={`lg:hidden px-3 py-2 border-b sticky top-0 z-20 transition-colors backdrop-blur-md shadow-xs ${isDark ? 'bg-[#060a08]/95 border-[#18231c]' : 'bg-[#f4f7f4]/95 border-[#dbe4dd]'
          }`}
      >
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/20 border border-white/5 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => setMobileTab('equities')}
            className={`py-2 px-1 rounded-lg text-center transition flex items-center justify-center gap-1 ${mobileTab === 'equities'
                ? 'bg-emerald-600 text-white shadow-md'
                : isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
            <span className="text-[11px]">Equities ({filteredStocks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('chart')}
            className={`py-2 px-1 rounded-lg text-center transition flex items-center justify-center gap-1 ${mobileTab === 'chart'
                ? 'bg-emerald-600 text-white shadow-md'
                : isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">show_chart</span>
            <span className="text-[11px] truncate">{selectedStock ? selectedStock.ticker : 'Chart'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('news')}
            className={`py-2 px-1 rounded-lg text-center transition flex items-center justify-center gap-1 ${mobileTab === 'news'
                ? 'bg-emerald-600 text-white shadow-md'
                : isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">campaign</span>
            <span className="text-[11px]">Wire ({news.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. MAIN TRADING FLOOR CONTENT: 2-COLUMN MARKET VIEW */}
      {/* ========================================================================= */}
      <main className="max-w-[1780px] mx-auto w-full p-3 sm:p-6 flex-1 flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Column: Securities List (All 78 Stocks Grid) */}
        <section
          className={`w-full lg:w-[62%] xl:w-[65%] space-y-3 ${mobileTab === 'equities' ? 'block' : 'hidden lg:block'
            }`}
        >
          <div className="flex items-center justify-between text-xs px-1">
            <span className={`font-bold uppercase tracking-wider font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Live Equities ({filteredStocks.length} listed)
            </span>
            <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Select any card to stream interactive price history
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredStocks.map((stock) => {
              const isSelected = selectedStock?.id === stock.id || selectedStock?.ticker === stock.ticker;
              const change = stock.change ?? (stock.current_price - stock.previous_close);
              const changePct = stock.change_percent ?? (stock.previous_close > 0 ? (change / stock.previous_close) * 100 : 0);
              const isGain = change >= 0;

              return (
                <div
                  key={stock.id || stock.ticker}
                  onClick={() => setSelectedStock(stock)}
                  className={`p-3.5 rounded-2xl border transition duration-150 cursor-pointer relative overflow-hidden group shadow-md ${isSelected
                      ? isDark
                        ? 'bg-gradient-to-br from-[#16231a] to-[#1a2d1f] border-emerald-500 shadow-emerald-950/40 ring-2 ring-emerald-500/40 scale-[1.01]'
                        : 'bg-gradient-to-br from-[#ebf5ed] to-[#f0faf2] border-emerald-600 ring-2 ring-emerald-600/30 shadow-md scale-[1.01]'
                      : isDark
                        ? 'bg-[#0d1410] border-[#1c281f] hover:bg-[#121c15] hover:border-[#2d4032]'
                        : 'bg-white border-[#d8e4da] hover:bg-[#f3f8f4]'
                    }`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono text-base font-black transition ${isDark
                              ? 'text-white group-hover:text-emerald-300'
                              : 'text-zinc-900 group-hover:text-emerald-700'
                            }`}
                        >
                          {stock.ticker}
                        </span>
                        {stock.is_frozen && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase">
                            Halted
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {stock.name}
                      </p>
                    </div>

                    {/* % Change Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-xs font-black shrink-0 flex items-center gap-0.5 shadow-xs ${isGain
                          ? isDark
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isDark
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                    >
                      {isGain ? '▲ +' : '▼ '}
                      {Math.abs(changePct).toFixed(2)}%
                    </span>
                  </div>

                  {/* Price & Range */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className={`text-[10px] block uppercase font-mono leading-none ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Current Price
                      </span>
                      <span
                        className={`font-mono text-lg font-black mt-0.5 block tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'
                          }`}
                      >
                        ₹{stock.current_price.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] block uppercase font-mono leading-none ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Circuit Bounds (±10%)
                      </span>
                      <span className={`text-[11px] font-mono mt-0.5 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        ₹{stock.lower_circuit?.toFixed(0) || (stock.current_price * 0.9).toFixed(0)} - ₹{stock.upper_circuit?.toFixed(0) || (stock.current_price * 1.1).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Sector Tag & Footer */}
                  <div className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] ${isDark ? 'border-white/5 text-zinc-400' : 'border-zinc-100 text-zinc-500'}`}>
                    <span className="truncate max-w-[170px]">{stock.sector}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStock(stock);
                        setMobileTab('chart');
                      }}
                      className={`font-bold hover:underline flex items-center gap-0.5 cursor-pointer ${isDark ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                    >
                      Chart
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredStocks.length === 0 && (
              <div
                className={`col-span-full py-16 text-center rounded-2xl border ${isDark ? 'text-zinc-400 bg-[#0e1511] border-[#1d2920]' : 'text-zinc-500 bg-white border-[#d8e4da]'
                  }`}
              >
                <span className="material-symbols-outlined text-4xl text-zinc-400 mb-2 block">
                  search_off
                </span>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  No equities found matching &ldquo;{searchQuery}&rdquo;
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Try another ticker symbol, company name, or reset sector filters.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Interactive Stock Chart & Floor Wire (Sticky on Desktop) */}
        <aside
          className={`w-full lg:w-[38%] xl:w-[35%] lg:sticky lg:top-[125px] space-y-4 ${mobileTab === 'equities' ? 'hidden lg:block' : 'block'
            }`}
        >
          {/* Mobile Back Button to Watchlist */}
          <button
            type="button"
            onClick={() => setMobileTab('equities')}
            className={`lg:hidden w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-mono font-bold transition shadow-xs cursor-pointer ${isDark
                ? 'bg-[#121c15] text-emerald-300 border-emerald-800/80 hover:bg-[#18291d]'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to 78 Equities Watchlist
          </button>

          {/* Selected Stock Hero Card with Interactive SVG Chart */}
          {selectedStock && (
            <div
              className={`rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 border transition-colors duration-200 ${mobileTab === 'news' ? 'hidden lg:block' : 'block'
                } ${isDark ? 'bg-[#0c120f] border-[#1e2c21]' : 'bg-white border-[#d8e4da]'}`}
            >
              {/* Header Info */}
              <div className={`flex items-start justify-between gap-3 pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-xl sm:text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      {selectedStock.ticker}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${isDark
                          ? 'bg-[#17231a] text-emerald-300 border-emerald-800'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                    >
                      {selectedStock.sector}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {selectedStock.name}
                  </p>
                </div>

                <div className="text-right">
                  <span className={`text-xl sm:text-2xl font-mono font-black block ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    ₹{selectedStock.current_price.toFixed(2)}
                  </span>
                  {(() => {
                    const chg = selectedStock.change ?? (selectedStock.current_price - selectedStock.previous_close);
                    const pct = selectedStock.change_percent ?? (selectedStock.previous_close > 0 ? (chg / selectedStock.previous_close) * 100 : 0);
                    const isUp = chg >= 0;
                    return (
                      <span className={`text-xs font-mono font-bold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isUp ? '+' : ''}{chg.toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Interactive SVG Area Chart */}
              <div>
                <div className={`flex items-center justify-between text-[11px] mb-2 font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Price History (Round-by-Round)</span>
                    <span className="text-emerald-500 flex items-center gap-1 font-bold text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Live Updates
                    </span>
                  </div>

                  {/* Expand / Fullscreen View Button */}
                  <button
                    type="button"
                    onClick={() => setIsChartExpanded(true)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition border cursor-pointer ${isDark
                        ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border-zinc-700/80'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                      }`}
                    title="Open expanded high-definition chart"
                  >
                    <span className="material-symbols-outlined text-[13px]">open_in_full</span>
                    <span>Deep Dive</span>
                  </button>
                </div>

                {(() => {
                  const history: number[] =
                    selectedStock.historical_prices && selectedStock.historical_prices.length > 1
                      ? selectedStock.historical_prices
                      : [
                        selectedStock.previous_close * 0.985,
                        selectedStock.previous_close * 0.992,
                        selectedStock.previous_close * 1.008,
                        selectedStock.previous_close * 0.997,
                        selectedStock.previous_close * 1.003,
                        selectedStock.current_price,
                      ];

                  const rawMin = Math.min(...history);
                  const rawMax = Math.max(...history);
                  const rawDelta = rawMax - rawMin;
                  const pad = rawDelta > 0 ? rawDelta * 0.15 : (rawMax * 0.05 || 5);
                  const min = Math.max(0, rawMin - pad);
                  const max = rawMax + pad;
                  const range = max - min || 1;

                  // High-Clarity Canvas Dimensions (2x taller than original)
                  const width = 560;
                  const height = 280;
                  const paddingLeft = 54;
                  const paddingRight = 24;
                  const paddingTop = 32;
                  const paddingBottom = 40;
                  const chartW = width - paddingLeft - paddingRight;
                  const chartH = height - paddingTop - paddingBottom;

                  const points = history.map((val: number, idx: number) => {
                    const x = paddingLeft + (history.length > 1 ? (idx / (history.length - 1)) * chartW : chartW / 2);
                    const y = paddingTop + chartH - ((val - min) / range) * chartH;
                    return { x, y, val, round: idx };
                  });

                  const pathD = points.reduce((acc: string, pt: { x: number; y: number }, idx: number) => {
                    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                  }, '');

                  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`;
                  const isUp = history[history.length - 1] >= history[0];
                  const strokeColor = isUp ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626');
                  const fillColor = isUp ? 'url(#greenGradientThemeLg)' : 'url(#redGradientThemeLg)';

                  const activeIdx = hoveredPointIndex !== null ? hoveredPointIndex : points.length - 1;
                  const activePt = points[activeIdx] || points[points.length - 1];

                  // Y-Axis Horizontal Grid Lines (4 evenly spaced price levels)
                  const yTicks = [1, 0.67, 0.33, 0].map((pct) => {
                    const val = min + range * pct;
                    const yPos = paddingTop + chartH * (1 - pct);
                    return { val, yPos };
                  });

                  // X-Axis Round Interval Decider (avoids label collisions)
                  const showXLabel = (idx: number, total: number) => {
                    if (total <= 6) return true;
                    if (total <= 12) return idx % 2 === 0 || idx === total - 1;
                    if (total <= 20) return idx % 3 === 0 || idx === total - 1;
                    return idx % 4 === 0 || idx === total - 1;
                  };

                  return (
                    <div
                      className={`p-3.5 sm:p-4 rounded-2xl border relative transition-colors ${isDark ? 'bg-[#080d0a] border-zinc-800/80' : 'bg-[#f4f8f5] border-[#d8e4da]'
                        }`}
                    >
                      {/* Active Point Live Inspection Bar */}
                      {activePt && (
                        <div
                          className={`flex items-center justify-between text-xs font-mono pb-2.5 border-b mb-2.5 ${isDark ? 'border-zinc-800/80' : 'border-zinc-200'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-800'
                              }`}>
                              Round {activePt.round}
                            </span>
                            <span className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                              ₹{activePt.val.toFixed(2)}
                            </span>
                          </div>

                          {activeIdx > 0 ? (
                            (() => {
                              const prev = history[activeIdx - 1];
                              const diff = activePt.val - prev;
                              const pct = prev > 0 ? (diff / prev) * 100 : 0;
                              const up = diff >= 0;
                              return (
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${up
                                    ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                                    : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                  {up ? '▲ +' : '▼ '}{diff.toFixed(2)} ({up ? '+' : ''}{pct.toFixed(2)}%)
                                </span>
                              );
                            })()
                          ) : (
                            <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              Initial Round 0 Base
                            </span>
                          )}
                        </div>
                      )}

                      {/* Large SVG Chart Canvas (Taller height: h-64 sm:h-72 lg:h-80) */}
                      <svg
                        viewBox={`0 0 ${width} ${height}`}
                        className="w-full h-64 sm:h-72 lg:h-80 overflow-visible select-none"
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      >
                        <defs>
                          <linearGradient id="greenGradientThemeLg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={isDark ? 0.45 : 0.35} />
                            <stop offset="60%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={isDark ? 0.15 : 0.10} />
                            <stop offset="100%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="redGradientThemeLg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isDark ? '#f87171' : '#ef4444'} stopOpacity={isDark ? 0.45 : 0.35} />
                            <stop offset="60%" stopColor={isDark ? '#f87171' : '#ef4444'} stopOpacity={isDark ? 0.15 : 0.10} />
                            <stop offset="100%" stopColor={isDark ? '#f87171' : '#ef4444'} stopOpacity={0.0} />
                          </linearGradient>
                          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Y-Axis Horizontal Grid Lines with Monospace Price Ticks */}
                        {yTicks.map((tick, i) => (
                          <g key={`ytick-${i}`}>
                            <line
                              x1={paddingLeft}
                              y1={tick.yPos}
                              x2={width - paddingRight}
                              y2={tick.yPos}
                              stroke={isDark ? '#1a271e' : '#e2ece4'}
                              strokeDasharray="4 4"
                              strokeWidth="1"
                            />
                            <text
                              x={paddingLeft - 8}
                              y={tick.yPos + 3.5}
                              textAnchor="end"
                              fill={isDark ? '#71717a' : '#94a3b8'}
                              fontSize="9.5"
                              fontFamily="monospace"
                              fontWeight="600"
                            >
                              ₹{tick.val.toFixed(1)}
                            </text>
                          </g>
                        ))}

                        {/* Solid Bottom Baseline */}
                        <line
                          x1={paddingLeft}
                          y1={paddingTop + chartH}
                          x2={width - paddingRight}
                          y2={paddingTop + chartH}
                          stroke={isDark ? '#26382b' : '#cbd5e1'}
                          strokeWidth="1"
                        />

                        {/* X-Axis Round Indicators (R0, R3, R6 ...) */}
                        {points.map((pt, i) => {
                          if (!showXLabel(i, points.length)) return null;
                          return (
                            <text
                              key={`xlabel-${i}`}
                              x={pt.x}
                              y={paddingTop + chartH + 18}
                              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                              fill={isDark ? '#71717a' : '#64748b'}
                              fontSize="9.5"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              R{i}
                            </text>
                          );
                        })}

                        {/* Area Fill */}
                        <path d={areaD} fill={fillColor} />

                        {/* Line Stroke with Enhanced Thickness */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter={isDark ? 'url(#glow)' : undefined}
                        />

                        {/* Vertical Interactive Crosshair Guideline */}
                        {hoveredPointIndex !== null && activePt && (
                          <g>
                            <line
                              x1={activePt.x}
                              y1={paddingTop}
                              x2={activePt.x}
                              y2={paddingTop + chartH}
                              stroke={strokeColor}
                              strokeDasharray="3 3"
                              strokeWidth="1.5"
                              opacity="0.8"
                            />
                          </g>
                        )}

                        {/* Data Points on Curve */}
                        {points.map((pt: { x: number; y: number; val: number; round: number }, i: number) => {
                          const isHovered = hoveredPointIndex === i;
                          const isLast = i === points.length - 1;
                          const isMax = pt.val === rawMax;
                          const isMin = pt.val === rawMin;

                          return (
                            <g
                              key={i}
                              onMouseEnter={() => setHoveredPointIndex(i)}
                              className="cursor-pointer"
                            >
                              {/* Transparent wider target circle for easy hover / touch */}
                              <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                              {/* Hovered Target Glow Ring */}
                              {isHovered && (
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="10"
                                  fill={strokeColor}
                                  fillOpacity="0.25"
                                  className="animate-ping"
                                />
                              )}

                              {/* Visible Point Circle */}
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isHovered ? 6 : isLast ? 4.5 : 3}
                                fill={isHovered ? '#fff' : strokeColor}
                                stroke={isDark ? '#080d0a' : '#fff'}
                                strokeWidth={isHovered ? 2.5 : 1.5}
                                className="transition-all"
                              />

                              {/* High/Low Non-Colliding Markers (when not hovering) */}
                              {hoveredPointIndex === null && isMax && (
                                <g transform={`translate(${pt.x}, ${pt.y - 10})`}>
                                  <text
                                    x="0"
                                    y="0"
                                    textAnchor="middle"
                                    fill={isDark ? '#34d399' : '#059669'}
                                    fontSize="9"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                  >
                                    ▲ ₹{pt.val.toFixed(1)}
                                  </text>
                                </g>
                              )}
                              {hoveredPointIndex === null && isMin && !isMax && (
                                <g transform={`translate(${pt.x}, ${pt.y + 14})`}>
                                  <text
                                    x="0"
                                    y="0"
                                    textAnchor="middle"
                                    fill={isDark ? '#f87171' : '#dc2626'}
                                    fontSize="9"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                  >
                                    ▼ ₹{pt.val.toFixed(1)}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {/* Hovered Point Floating Price Pill Tooltip */}
                        {hoveredPointIndex !== null && activePt && (
                          <g
                            transform={`translate(${Math.min(
                              Math.max(activePt.x, paddingLeft + 42),
                              width - paddingRight - 42
                            )}, ${Math.max(paddingTop + 14, activePt.y - 14)})`}
                          >
                            <rect
                              x="-38"
                              y="-16"
                              width="76"
                              height="20"
                              rx="6"
                              fill={isDark ? '#0c1610' : '#ffffff'}
                              stroke={strokeColor}
                              strokeWidth="1.5"
                              filter="drop-shadow(0 2px 5px rgba(0,0,0,0.4))"
                            />
                            <text
                              x="0"
                              y="-2.5"
                              textAnchor="middle"
                              fill={isDark ? '#ffffff' : '#0f172a'}
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              ₹{activePt.val.toFixed(2)}
                            </text>
                          </g>
                        )}
                      </svg>

                      {/* Bottom Quick Advice Note */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                        <span>Click or hover points to view round-by-round shifts</span>
                        <span>Baseline: ₹{selectedStock.previous_close.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Key Technical Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div
                  className={`p-2.5 rounded-xl border ${isDark ? 'bg-[#101712] border-zinc-800' : 'bg-[#f2f7f3] border-[#d8e4da]'
                    }`}
                >
                  <span className={`text-[10px] block uppercase font-sans ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Lower Circuit (-10%)
                  </span>
                  <span className="font-bold text-rose-500">
                    ₹{selectedStock.lower_circuit?.toFixed(2) || (selectedStock.current_price * 0.9).toFixed(2)}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${isDark ? 'bg-[#101712] border-zinc-800' : 'bg-[#f2f7f3] border-[#d8e4da]'
                    }`}
                >
                  <span className={`text-[10px] block uppercase font-sans ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Upper Circuit (+10%)
                  </span>
                  <span className="font-bold text-emerald-500">
                    ₹{selectedStock.upper_circuit?.toFixed(2) || (selectedStock.current_price * 1.1).toFixed(2)}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${isDark ? 'bg-[#101712] border-zinc-800' : 'bg-[#f2f7f3] border-[#d8e4da]'
                    }`}
                >
                  <span className={`text-[10px] block uppercase font-sans ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Day High
                  </span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    ₹{selectedStock.day_high?.toFixed(2) || '—'}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${isDark ? 'bg-[#101712] border-zinc-800' : 'bg-[#f2f7f3] border-[#d8e4da]'
                    }`}
                >
                  <span className={`text-[10px] block uppercase font-sans ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Day Low
                  </span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    ₹{selectedStock.day_low?.toFixed(2) || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Live Floor Announcements & Macro Shocks */}
          <div
            className={`rounded-3xl p-4 sm:p-5 shadow-xl space-y-3 border transition-colors duration-200 ${mobileTab === 'chart' ? 'hidden lg:block' : 'block'
              } ${isDark ? 'bg-[#0c120f] border-[#1e2c21]' : 'bg-white border-[#d8e4da]'}`}
          >
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[18px]">campaign</span>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Dalal Street Wire &amp; Shocks
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${isDark
                    ? 'text-zinc-400 bg-black/40 border-white/5'
                    : 'text-zinc-600 bg-zinc-100 border-zinc-200'
                  }`}
              >
                {news.length} Broadcasts
              </span>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {news.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border space-y-1 transition ${isDark
                      ? 'bg-[#101712] border-[#1c281f] hover:border-[#2f4233]'
                      : 'bg-[#f6fbf7] border-[#dbe7dc] hover:border-[#b5ccb8]'
                    }`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold uppercase tracking-wider text-amber-500 font-mono">
                      {(item as any).source || 'ECON DESK'}
                    </span>
                    <span className={`font-mono text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {item.published_at
                        ? new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                        : (item as any).created_at
                          ? new Date((item as any).created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                          : 'Just now'}
                    </span>
                  </div>
                  <h4 className={`text-xs font-bold leading-snug ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {item.headline}
                  </h4>
                  <p className={`text-[11px] line-clamp-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {item.body || (item as any).summary}
                  </p>
                </div>
              ))}

              {news.length === 0 && (
                <div className={`py-8 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  No breaking news releases at this moment. Desk announcements and regulatory flashes will appear here in real time.
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* ========================================================================= */}
      {/* 8. MOBILE FLOATING ACTION PILL (When viewing Equities & stock is selected) */}
      {/* ========================================================================= */}
      {selectedStock && mobileTab === 'equities' && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 animate-in slide-in-from-bottom duration-200">
          <div
            onClick={() => setMobileTab('chart')}
            className={`p-2.5 sm:p-3 rounded-2xl border shadow-2xl flex items-center justify-between cursor-pointer backdrop-blur-md ${isDark
                ? 'bg-[#0e1711]/95 border-emerald-500/80 text-white shadow-emerald-950/60'
                : 'bg-white/95 border-emerald-600 text-zinc-900 shadow-xl'
              }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-xs shrink-0">
                <span className="material-symbols-outlined text-[18px]">show_chart</span>
              </div>
              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-black text-xs sm:text-sm">{selectedStock.ticker}</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    ₹{selectedStock.current_price.toFixed(1)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate max-w-[160px] sm:max-w-xs">
                  {selectedStock.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-mono font-black text-xs flex items-center gap-1 shadow-md shrink-0 cursor-pointer"
            >
              Chart
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen / Deep Dive Expanded Chart Modal */}
      {isChartExpanded && selectedStock && (() => {
        const history: number[] =
          selectedStock.historical_prices && selectedStock.historical_prices.length > 1
            ? selectedStock.historical_prices
            : [
              selectedStock.previous_close * 0.985,
              selectedStock.previous_close * 0.992,
              selectedStock.previous_close * 1.008,
              selectedStock.previous_close * 0.997,
              selectedStock.previous_close * 1.003,
              selectedStock.current_price,
            ];

        const rawMin = Math.min(...history);
        const rawMax = Math.max(...history);
        const rawDelta = rawMax - rawMin;
        const pad = rawDelta > 0 ? rawDelta * 0.12 : (rawMax * 0.05 || 5);
        const min = Math.max(0, rawMin - pad);
        const max = rawMax + pad;
        const range = max - min || 1;

        const width = 920;
        const height = 360;
        const paddingLeft = 68;
        const paddingRight = 32;
        const paddingTop = 36;
        const paddingBottom = 46;
        const chartW = width - paddingLeft - paddingRight;
        const chartH = height - paddingTop - paddingBottom;

        const points = history.map((val: number, idx: number) => {
          const x = paddingLeft + (history.length > 1 ? (idx / (history.length - 1)) * chartW : chartW / 2);
          const y = paddingTop + chartH - ((val - min) / range) * chartH;
          return { x, y, val, round: idx };
        });

        const pathD = points.reduce((acc: string, pt: { x: number; y: number }, idx: number) => {
          return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
        }, '');

        const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`;
        const isUp = history[history.length - 1] >= history[0];
        const strokeColor = isUp ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626');
        const fillColor = isUp ? 'url(#greenGradientModal)' : 'url(#redGradientModal)';

        const activeIdx = hoveredPointIndex !== null ? hoveredPointIndex : points.length - 1;
        const activePt = points[activeIdx] || points[points.length - 1];

        const yTicks = [1, 0.75, 0.5, 0.25, 0].map((pct) => {
          const val = min + range * pct;
          const yPos = paddingTop + chartH * (1 - pct);
          return { val, yPos };
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div
              className={`w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${isDark ? 'bg-[#0d1410] border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                }`}
            >
              {/* Modal Header */}
              <div className={`p-4 sm:p-6 border-b flex items-start justify-between gap-4 ${isDark ? 'border-zinc-800/80 bg-[#090e0b]' : 'border-zinc-200 bg-zinc-50'}`}>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                      {selectedStock.ticker}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${isDark ? 'bg-[#152218] text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                      {selectedStock.sector}
                    </span>
                    <span className="text-xs font-mono font-semibold text-zinc-400">
                      {selectedStock.name}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-1">
                    Complete High-Precision Trajectory · {history.length} Rounds Recorded · Official ECON Exchange
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-mono font-black block">
                      ₹{selectedStock.current_price.toFixed(2)}
                    </span>
                    {(() => {
                      const chg = selectedStock.change ?? (selectedStock.current_price - selectedStock.previous_close);
                      const pct = selectedStock.change_percent ?? (selectedStock.previous_close > 0 ? (chg / selectedStock.previous_close) * 100 : 0);
                      const up = chg >= 0;
                      return (
                        <span className={`text-xs font-mono font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {up ? '+' : ''}{chg.toFixed(2)} ({up ? '+' : ''}{pct.toFixed(2)}%)
                        </span>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsChartExpanded(false);
                      setHoveredPointIndex(null);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition border cursor-pointer ${isDark
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                        : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700 border-zinc-300'
                      }`}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body: Large Chart & Stats */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                {/* Active Round Inspection Strip */}
                <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 font-mono ${isDark ? 'bg-black/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-800'
                      }`}>
                      Round {activePt.round}
                    </span>
                    <span className="text-xl sm:text-2xl font-black">
                      ₹{activePt.val.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {activeIdx > 0 ? (
                      (() => {
                        const prev = history[activeIdx - 1];
                        const diff = activePt.val - prev;
                        const pct = prev > 0 ? (diff / prev) * 100 : 0;
                        const up = diff >= 0;
                        return (
                          <span className={`font-bold px-2 py-1 rounded ${up
                              ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                              : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-800'
                            }`}>
                            Round Shift: {up ? '+' : ''}{diff.toFixed(2)} ({up ? '+' : ''}{pct.toFixed(2)}%)
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-zinc-400">Round 0 Starting Base</span>
                    )}

                    {(() => {
                      const netVsBase = activePt.val - history[0];
                      const pctVsBase = history[0] > 0 ? (netVsBase / history[0]) * 100 : 0;
                      const upBase = netVsBase >= 0;
                      return (
                        <span className="text-zinc-400">
                          Vs Base: <strong className={upBase ? 'text-emerald-400' : 'text-rose-400'}>
                            {upBase ? '+' : ''}{netVsBase.toFixed(2)} ({upBase ? '+' : ''}{pctVsBase.toFixed(2)}%)
                          </strong>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Massive High-Def Widescreen SVG Chart */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#080d0a] border-zinc-800/80' : 'bg-[#f4f8f5] border-[#d8e4da]'}`}>
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-80 sm:h-96 md:h-[400px] overflow-visible select-none"
                    onMouseLeave={() => setHoveredPointIndex(null)}
                  >
                    <defs>
                      <linearGradient id="greenGradientModal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={0.4} />
                        <stop offset="65%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="redGradientModal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isDark ? '#f87171' : '#ef4444'} stopOpacity={0.4} />
                        <stop offset="65%" stopColor={isDark ? '#f87171' : '#ef4444'} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={isDark ? '#f87171' : '#ef4444'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Horizontal Grid Lines */}
                    {yTicks.map((tick, i) => (
                      <g key={`modal-ytick-${i}`}>
                        <line
                          x1={paddingLeft}
                          y1={tick.yPos}
                          x2={width - paddingRight}
                          y2={tick.yPos}
                          stroke={isDark ? '#1a271e' : '#e2ece4'}
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 10}
                          y={tick.yPos + 4}
                          textAnchor="end"
                          fill={isDark ? '#71717a' : '#94a3b8'}
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          ₹{tick.val.toFixed(2)}
                        </text>
                      </g>
                    ))}

                    {/* Bottom Solid Baseline */}
                    <line
                      x1={paddingLeft}
                      y1={paddingTop + chartH}
                      x2={width - paddingRight}
                      y2={paddingTop + chartH}
                      stroke={isDark ? '#26382b' : '#cbd5e1'}
                      strokeWidth="1.5"
                    />

                    {/* X-Axis Round Milestone Labels */}
                    {points.map((pt, i) => (
                      <g key={`modal-xlabel-${i}`}>
                        <line
                          x1={pt.x}
                          y1={paddingTop + chartH}
                          x2={pt.x}
                          y2={paddingTop + chartH + 5}
                          stroke={isDark ? '#26382b' : '#cbd5e1'}
                        />
                        <text
                          x={pt.x}
                          y={paddingTop + chartH + 20}
                          textAnchor="middle"
                          fill={isDark ? '#71717a' : '#64748b'}
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          R{i}
                        </text>
                      </g>
                    ))}

                    {/* Area Fill */}
                    <path d={areaD} fill={fillColor} />

                    {/* Curve Line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Guideline */}
                    {hoveredPointIndex !== null && activePt && (
                      <line
                        x1={activePt.x}
                        y1={paddingTop}
                        x2={activePt.x}
                        y2={paddingTop + chartH}
                        stroke={strokeColor}
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                        opacity="0.85"
                      />
                    )}

                    {/* Points */}
                    {points.map((pt, i) => {
                      const isHovered = hoveredPointIndex === i;
                      const isLast = i === points.length - 1;
                      const isMax = pt.val === rawMax;
                      const isMin = pt.val === rawMin;

                      return (
                        <g
                          key={`modal-pt-${i}`}
                          onMouseEnter={() => setHoveredPointIndex(i)}
                          className="cursor-pointer"
                        >
                          <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />

                          {isHovered && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="12"
                              fill={strokeColor}
                              fillOpacity="0.3"
                              className="animate-ping"
                            />
                          )}

                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 7 : isLast ? 5 : 3.5}
                            fill={isHovered ? '#fff' : strokeColor}
                            stroke={isDark ? '#080d0a' : '#fff'}
                            strokeWidth={isHovered ? 3 : 2}
                          />

                          {/* High and Low Badges */}
                          {isMax && (
                            <g transform={`translate(${pt.x}, ${pt.y - 12})`}>
                              <rect x="-30" y="-14" width="60" height="16" rx="4" fill={isDark ? '#064e3b' : '#d1fae5'} stroke={strokeColor} strokeWidth="1" />
                              <text x="0" y="-3" textAnchor="middle" fill={isDark ? '#a7f3d0' : '#065f46'} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                H: ₹{pt.val.toFixed(1)}
                              </text>
                            </g>
                          )}
                          {isMin && !isMax && (
                            <g transform={`translate(${pt.x}, ${pt.y + 16})`}>
                              <rect x="-30" y="-2" width="60" height="16" rx="4" fill={isDark ? '#881337' : '#ffe4e6'} stroke={strokeColor} strokeWidth="1" />
                              <text x="0" y="9" textAnchor="middle" fill={isDark ? '#fecdd3' : '#9f1239'} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                L: ₹{pt.val.toFixed(1)}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Hover Tooltip Box */}
                    {hoveredPointIndex !== null && activePt && (
                      <g
                        transform={`translate(${Math.min(
                          Math.max(activePt.x, paddingLeft + 50),
                          width - paddingRight - 50
                        )}, ${Math.max(paddingTop + 16, activePt.y - 18)})`}
                      >
                        <rect
                          x="-46"
                          y="-20"
                          width="92"
                          height="24"
                          rx="7"
                          fill={isDark ? '#0c1610' : '#ffffff'}
                          stroke={strokeColor}
                          strokeWidth="2"
                          filter="drop-shadow(0 3px 6px rgba(0,0,0,0.5))"
                        />
                        <text
                          x="0"
                          y="-3.5"
                          textAnchor="middle"
                          fill={isDark ? '#ffffff' : '#0f172a'}
                          fontSize="11.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          ₹{activePt.val.toFixed(2)}
                        </text>
                      </g>
                    )}
                  </svg>
                </div>

                {/* Round-by-Round Breakdown Matrix */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-400">
                    <span>Round-by-Round Price Ledger</span>
                    <span>Click any chip to jump to that round</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {history.map((price, idx) => {
                      const isSelected = activeIdx === idx;
                      const prev = idx > 0 ? history[idx - 1] : price;
                      const shift = price - prev;
                      const up = shift >= 0;

                      return (
                        <button
                          key={`chip-${idx}`}
                          type="button"
                          onClick={() => setHoveredPointIndex(idx)}
                          className={`p-2 rounded-xl border text-left shrink-0 transition font-mono cursor-pointer ${isSelected
                              ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/10'
                              : isDark
                                ? 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800'
                                : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-400">
                            <span>R{idx}</span>
                            {idx > 0 && (
                              <span className={`font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {up ? '+' : ''}{shift.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold font-mono text-on-surface mt-0.5">
                            ₹{price.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Technical Limits Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                    <span className="text-[10px] text-zinc-500 block uppercase">Lower Circuit (-10%)</span>
                    <span className="font-bold text-rose-500">
                      ₹{selectedStock.lower_circuit?.toFixed(2) || (selectedStock.current_price * 0.9).toFixed(2)}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                    <span className="text-[10px] text-zinc-500 block uppercase">Upper Circuit (+10%)</span>
                    <span className="font-bold text-emerald-500">
                      ₹{selectedStock.upper_circuit?.toFixed(2) || (selectedStock.current_price * 1.1).toFixed(2)}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                    <span className="text-[10px] text-zinc-500 block uppercase">Session Peak (ATH)</span>
                    <span className="font-bold text-emerald-400">₹{rawMax.toFixed(2)}</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                    <span className="text-[10px] text-zinc-500 block uppercase">Session Trough (ATL)</span>
                    <span className="font-bold text-rose-400">₹{rawMin.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
