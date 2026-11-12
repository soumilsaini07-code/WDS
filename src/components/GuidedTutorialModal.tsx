'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Building2,
  LineChart,
  Newspaper,
  Compass,
  Lightbulb,
} from 'lucide-react';

interface GuidedTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuidedTutorialModal({ isOpen, onClose }: GuidedTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFinish = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wds_tutorial_completed', 'true');
    }
    onClose();
  };

  const steps = [
    {
      badge: 'Step 1 of 5 • Welcome to WDS',
      title: 'Welcome to Wolf of Dalal Street! 🐺',
      subtitle: 'Your virtual institutional trading simulator is ready.',
      icon: <Compass className="w-6 h-6 text-[#4a7c59]" />,
      content: (
        <div className="space-y-3.5 text-xs text-[#242826] leading-relaxed">
          <p>
            Welcome to the flagship trading competition of <strong>ECON Club TIET</strong>! You don&apos;t need to be a Wall Street expert to compete—the platform is designed for everyone from total beginners to seasoned traders.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="bg-[#f6f6f2] p-3 rounded-lg border border-[#e2e4dc]">
              <div className="flex items-center gap-2 font-bold text-[#242826] mb-1">
                <DollarSign className="w-4 h-4 text-[#4a7c59]" />
                <span>₹10,00,000 Virtual Cash</span>
              </div>
              <p className="text-[#686e66] text-[11px]">
                You receive 10 Lakh rupees in simulation cash to build your dream portfolio without risking any real money.
              </p>
            </div>

            <div className="bg-[#f6f6f2] p-3 rounded-lg border border-[#e2e4dc]">
              <div className="flex items-center gap-2 font-bold text-[#242826] mb-1">
                <LineChart className="w-4 h-4 text-[#7b6332]" />
                <span>The Main Objective</span>
              </div>
              <p className="text-[#686e66] text-[11px]">
                Buy undervalued stocks, profit from breaking economic events, protect your capital, and climb the live Sharpe leaderboard!
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: 'Step 2 of 5 • How Prices Work',
      title: 'How Stock Prices Move in the Simulator 📈',
      subtitle: 'Understanding live micro-ticks and circuit collars.',
      icon: <LineChart className="w-6 h-6 text-[#4a7c59]" />,
      content: (
        <div className="space-y-3.5 text-xs text-[#242826] leading-relaxed">
          <p>
            The stock prices are <strong>live simulation prices</strong> modeled after top Indian blue-chip companies (Reliance, TCS, HDFC Bank, Tata Motors, etc.):
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-2.5 bg-[#edf5ef] p-2.5 rounded-lg border border-[#cbe4d1]">
              <span className="w-5 h-5 rounded-full bg-[#4a7c59] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-[#295236] block">Real-time Micro-Ticks:</strong>
                <span className="text-[#3e6a4b] text-[11px]">
                  Prices fluctuate every few seconds based on continuous stochastic order-flow (~ ±1.2% per tick) to simulate active trading floors.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-[#fbfbfa] p-2.5 rounded-lg border border-[#e2e4dc]">
              <span className="w-5 h-5 rounded-full bg-[#7b6332] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-[#242826] block">Circuit Collar Bands (±10%):</strong>
                <span className="text-[#686e66] text-[11px]">
                  Like the real National Stock Exchange (NSE), if a stock surges or crashes by 10% in a single session, a regulatory circuit breaker freezes orders to protect investors.
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: 'Step 3 of 5 • Market Feed Decoded',
      title: 'Bullish vs Bearish: What Does It Mean? 📰',
      subtitle: 'How breaking news impacts stock valuations.',
      icon: <Newspaper className="w-6 h-6 text-[#7b6332]" />,
      content: (
        <div className="space-y-3.5 text-xs text-[#242826] leading-relaxed">
          <p>
            In your <strong>Bloomberg Terminal Feed</strong>, breaking market events are classified into two major sentiments based on their net economic impact:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Bullish card */}
            <div className="bg-[#edf5ef] p-3 rounded-lg border border-[#cbe4d1]">
              <div className="flex items-center gap-1.5 font-bold text-[#295236] mb-1">
                <TrendingUp className="w-4 h-4 text-[#4a7c59]" />
                <span className="text-xs uppercase tracking-wide">🟢 BULLISH (Tezi)</span>
              </div>
              <p className="text-[#3e6a4b] text-[11px] leading-relaxed">
                <strong>Good News!</strong> When events have a positive net impact (e.g. RBI cuts interest rates, record corporate profits, strong GDP growth), prices are expected to <strong>rise</strong>.
              </p>
              <div className="mt-2 text-[10px] font-semibold text-[#295236] bg-white/70 px-2 py-1 rounded border border-[#cbe4d1]">
                💡 Action: Good time to BUY before prices peak.
              </div>
            </div>

            {/* Bearish card */}
            <div className="bg-[#fdf2f2] p-3 rounded-lg border border-[#f5c6c6]">
              <div className="flex items-center gap-1.5 font-bold text-[#be3835] mb-1">
                <TrendingDown className="w-4 h-4 text-[#be3835]" />
                <span className="text-xs uppercase tracking-wide">🔴 BEARISH (Mandi)</span>
              </div>
              <p className="text-[#962624] text-[11px] leading-relaxed">
                <strong>Negative News!</strong> When events have a negative net impact (e.g. global crude oil spikes, inflation surge, supply shortages), prices are expected to <strong>fall</strong>.
              </p>
              <div className="mt-2 text-[10px] font-semibold text-[#be3835] bg-white/70 px-2 py-1 rounded border border-[#f5c6c6]">
                💡 Action: Consider SELLING to protect profits.
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: 'Step 4 of 5 • Making Your First Trade',
      title: 'How to Execute a Trade in 3 Clicks 🛒',
      subtitle: 'Simple step-by-step trading walkthrough.',
      icon: <Sparkles className="w-6 h-6 text-[#4a7c59]" />,
      content: (
        <div className="space-y-3 text-xs text-[#242826] leading-relaxed">
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-[#f6f6f2] rounded-lg border border-[#e2e4dc]">
              <span className="w-5 h-5 rounded-full bg-[#141b16] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                1
              </span>
              <span><strong>Select a Ticker:</strong> Click on any stock on your watchlist or from the dropdown (e.g. RELIANCE, TCS, INFY).</span>
            </div>

            <div className="flex items-center gap-2 p-2 bg-[#f6f6f2] rounded-lg border border-[#e2e4dc]">
              <span className="w-5 h-5 rounded-full bg-[#4a7c59] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                2
              </span>
              <span><strong>Click &quot;Trade&quot;:</strong> Enter the number of shares you want to purchase. The total cost automatically calculates against your available cash.</span>
            </div>

            <div className="flex items-center gap-2 p-2 bg-[#f6f6f2] rounded-lg border border-[#e2e4dc]">
              <span className="w-5 h-5 rounded-full bg-[#7b6332] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                3
              </span>
              <span><strong>Confirm Order:</strong> Click &quot;Buy Shares&quot;. The shares immediately appear in your Portfolio Holdings with real-time profit tracking!</span>
            </div>
          </div>

          <div className="bg-[#edf5ef] p-2.5 rounded-lg border border-[#cbe4d1] text-[11px] text-[#295236] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#4a7c59] shrink-0" />
            <span><strong>Golden Rule:</strong> Buy when prices dip, and sell when prices rise above your average buy price to secure profit!</span>
          </div>
        </div>
      ),
    },
    {
      badge: 'Step 5 of 5 • Team Trading & Order Slips',
      title: 'Team Trading & Assisted Execution 📜',
      subtitle: 'Collaborate in your team and execute via Order Slips.',
      icon: <Building2 className="w-6 h-6 text-[#4a7c59]" />,
      content: (
        <div className="space-y-3.5 text-xs text-[#242826] leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#fbfbfa] p-3 rounded-lg border border-[#e2e4dc]">
              <div className="font-bold text-[#141b16] text-xs flex items-center gap-1.5 mb-1">
                <span>👥 Team Trading (Max 6)</span>
              </div>
              <p className="text-[#686e66] text-[11px] leading-relaxed">
                Work closely with your team members and Team Leader. Strategize together based on live market news dispatches.
              </p>
            </div>

            <div className="bg-[#edf5ef] p-3 rounded-lg border border-[#cbe4d1]">
              <div className="font-bold text-[#295236] text-xs flex items-center gap-1.5 mb-1">
                <span>📜 Order Slip Verification</span>
              </div>
              <p className="text-[#3e6a4b] text-[11px] leading-relaxed">
                Generate an Order Slip with your Slip ID. Present the slip to your Desk Admin for real-time approval and execution!
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#f6f6f2] rounded-lg border border-[#e2e4dc] flex items-start gap-2 text-[11px] text-[#686e66]">
            <HelpCircle className="w-4 h-4 text-[#4a7c59] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#242826]">Need assistance during the competition?</strong>
              <p className="mt-0.5">
                Click the <strong>AI Mentor</strong> button in the header anytime to get instant strategic analysis, risk reviews, and valuation guidance.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-[#e2e4dc] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#e2e4dc] flex items-center justify-between bg-[#fbfbfa]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#edf5ef] border border-[#cbe4d1] flex items-center justify-center">
              {current.icon}
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-[#4a7c59] tracking-wider block">
                {current.badge}
              </span>
              <h2 className="text-base font-bold text-[#242826] leading-tight">
                {current.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFinish}
              className="text-[11px] font-semibold text-[#8a9087] hover:text-[#242826] px-2 py-1 rounded hover:bg-[#eae6de] transition cursor-pointer"
            >
              Skip Tour
            </button>
            <button
              onClick={handleFinish}
              aria-label="Close guided tutorial"
              className="w-7 h-7 rounded-lg text-[#8a9087] hover:text-[#242826] hover:bg-[#eae6de] flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-[#e2e4dc] h-1">
          <div
            className="bg-[#4a7c59] h-1 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <p className="text-xs text-[#686e66] font-medium border-b border-[#e2e4dc]/60 pb-2">
            {current.subtitle}
          </p>
          {current.content}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-[#fbfbfa] border-t border-[#e2e4dc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Step Indicator Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentStep === idx
                    ? 'w-6 bg-[#4a7c59]'
                    : 'w-2 bg-[#d1d5db] hover:bg-[#9ca3af]'
                }`}
              />
            ))}
          </div>

          {/* Navigation CTAs */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-1.5 text-xs font-semibold text-[#686e66] hover:text-[#242826] bg-white border border-[#e2e4dc] rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#4a7c59] hover:bg-[#3e6a4b] rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#141b16] hover:bg-[#242826] rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8eb69b]" />
                <span>Start Trading Now!</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
