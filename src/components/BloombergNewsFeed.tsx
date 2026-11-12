'use client';

import React from 'react';
import { Newspaper, BellRing, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { NewsArticle, MarketEvent } from '@/lib/types';

interface BloombergNewsFeedProps {
  news: NewsArticle[];
  events: MarketEvent[];
}

export function BloombergNewsFeed({ news, events }: BloombergNewsFeedProps) {
  // Format relative timestamp
  const getRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getSentimentBadge = (sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => {
    switch (sentiment) {
      case 'BULLISH':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/30">
            <TrendingUp className="w-2.5 h-2.5" /> BULLISH
          </span>
        );
      case 'BEARISH':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#EF4444] bg-[#EF4444]/15 px-1.5 py-0.5 rounded border border-[#EF4444]/30">
            <TrendingDown className="w-2.5 h-2.5" /> BEARISH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#94A3B8] bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">
            <Minus className="w-2.5 h-2.5" /> NEUTRAL
          </span>
        );
    }
  };

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Newspaper className="w-4 h-4 text-[#E5B869]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Bloomberg Terminal Wire
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
          <span className="text-[10px] font-mono text-[#94A3B8]">LIVE FEED</span>
        </div>
      </div>

      {/* Beginner Sentiment Explanation Strip */}
      <div className="px-3.5 py-1.5 bg-[#0e141f] border-b border-[#1E293B] flex items-center justify-between text-[10px] text-[#94A3B8]">
        <span className="font-medium text-[#64748B]">Market Sentiment:</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[#10B981] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Bullish = Positive (Price Up)
          </span>
          <span className="text-[#334155]">•</span>
          <span className="flex items-center gap-1 text-[#EF4444] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" /> Bearish = Negative (Price Down)
          </span>
        </div>
      </div>

      {/* Latest Admin Breaking Macro Shocks Banner (if any) */}
      {events.length > 0 && (
        <div className="p-3 bg-[#E5B869]/10 border-b border-[#E5B869]/30">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#E5B869] mb-1">
            <BellRing className="w-3.5 h-3.5 animate-bounce" />
            <span>LATEST MACRO EVENT INJECTION</span>
          </div>
          <div className="text-xs font-semibold text-white">
            {events[0].headline}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            {events[0].description}
          </p>
          {/* Ticker Impact Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {Object.entries(events[0].impact_map || {}).map(([ticker, delta]) => (
              <span
                key={ticker}
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  delta >= 0
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                }`}
              >
                {ticker}: {delta >= 0 ? '+' : ''}{delta}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* News Feed List */}
      <div className="divide-y divide-[#1E293B] overflow-y-auto max-h-[380px] p-2 space-y-2">
        {news.map((item) => (
          <div
            key={item.id}
            className="p-2.5 rounded bg-[#0B0E14]/70 hover:bg-[#182030] transition-colors border border-transparent hover:border-[#1E293B]"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              {getSentimentBadge(item.sentiment)}
              <span className="text-[10px] font-mono text-[#64748B]">
                {getRelativeTime(item.published_at)}
              </span>
            </div>

            <h3 className="text-xs font-semibold text-white hover:text-[#E5B869] transition-colors leading-snug">
              {item.headline}
            </h3>

            <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed line-clamp-3">
              {item.body}
            </p>
          </div>
        ))}

        {news.length === 0 && (
          <div className="text-center py-8 text-xs text-[#64748B]">
            Awaiting upcoming market releases...
          </div>
        )}
      </div>
    </div>
  );
}
