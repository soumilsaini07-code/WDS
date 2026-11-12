'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Stock, Portfolio, TransactionType } from '@/lib/types';

interface TradeModalProps {
  stock: Stock | null;
  initialType: TransactionType;
  availableCash: number;
  portfolio: Portfolio | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export function TradeModal({
  stock,
  initialType,
  availableCash,
  portfolio,
  onClose,
  onSuccess,
}: TradeModalProps) {
  if (!stock) return null;

  const [type, setType] = useState<TransactionType>(initialType);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const ownedShares = portfolio ? portfolio.shares_count : 0;
  const orderTotal = quantity * stock.current_price;

  // Maximum shares user can buy with cash or sell with owned shares
  const maxBuyShares = Math.floor(availableCash / stock.current_price);
  const maxSellShares = ownedShares;

  const setMaxQuantity = () => {
    if (type === 'BUY') {
      setQuantity(Math.max(1, maxBuyShares));
    } else {
      setQuantity(Math.max(1, maxSellShares));
    }
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (quantity <= 0) {
      setError('Please enter a valid share quantity.');
      return;
    }

    if (type === 'BUY' && orderTotal > availableCash) {
      setError(`Insufficient cash balance. Required: ₹${orderTotal.toFixed(2)}, Available: ₹${availableCash.toFixed(2)}`);
      return;
    }

    if (type === 'SELL' && quantity > ownedShares) {
      setError(`Insufficient shares. You own ${ownedShares} shares of ${stock.ticker}.`);
      return;
    }

    setLoading(true);

    const getAuthHeaders = (): Record<string, string> => {
      if (typeof window === 'undefined') return {};
      const token = localStorage.getItem('econ_token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    };

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          stockId: stock.id,
          type,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute trade.');
      }

      setSuccessMsg(
        `Order Filled: ${type} ${quantity} ${stock.ticker} @ ₹${stock.current_price.toFixed(2)}`
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Execution error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-none">
      <div className="bg-[#121824] border border-[#2A364F] rounded-lg w-full max-w-md p-6 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{stock.ticker}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-[#182030] text-[#94A3B8]">
                {stock.sector}
              </span>
            </div>
            <div className="text-xs text-[#94A3B8]">{stock.name}</div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Frozen Alert */}
        {stock.is_frozen && (
          <div className="p-3 rounded bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center gap-2 text-xs text-[#EF4444]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Trading circuit breaker active. Orders for {stock.ticker} are suspended.</span>
          </div>
        )}

        {/* Order Type Toggle (BUY / SELL) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B0E14] rounded border border-[#1E293B]">
          <button
            type="button"
            onClick={() => {
              setType('BUY');
              setError(null);
            }}
            className={`py-2 text-xs font-bold rounded transition-all ${
              type === 'BUY'
                ? 'bg-[#10B981] text-[#0B0E14]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            BUY ORDER
          </button>
          <button
            type="button"
            onClick={() => {
              setType('SELL');
              setError(null);
            }}
            className={`py-2 text-xs font-bold rounded transition-all ${
              type === 'SELL'
                ? 'bg-[#EF4444] text-white'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            SELL ORDER
          </button>
        </div>

        {/* Errors & Alerts */}
        {error && (
          <div className="p-2.5 rounded bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-start gap-2 text-xs text-[#EF4444]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded bg-[#10B981]/10 border border-[#10B981]/30 flex items-center gap-2 text-xs text-[#10B981]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Order Form */}
        <form onSubmit={handleOrder} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs bg-[#0B0E14] p-3 rounded border border-[#1E293B] font-mono-numbers">
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Market Execution Price</span>
              <span className="text-white font-bold text-sm">₹{stock.current_price.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">
                {type === 'BUY' ? 'Available Cash' : 'Owned Shares'}
              </span>
              <span className="text-white font-bold text-sm">
                {type === 'BUY'
                  ? `₹${availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                  : `${ownedShares} Shares`}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#94A3B8]">Share Quantity</label>
              <div className="flex items-center space-x-1">
                {[10, 50, 100].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setQuantity(step)}
                    className="px-1.5 py-0.5 rounded bg-[#182030] hover:bg-[#1E293B] text-[10px] font-mono text-[#94A3B8]"
                  >
                    +{step}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={setMaxQuantity}
                  className="px-2 py-0.5 rounded bg-[#E5B869]/20 hover:bg-[#E5B869]/30 text-[10px] font-mono font-bold text-[#E5B869]"
                >
                  MAX
                </button>
              </div>
            </div>

            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1E293B] rounded text-sm text-white focus:outline-none focus:border-[#E5B869] font-mono-numbers"
            />
          </div>

          {/* Cost breakdown */}
          <div className="pt-2 border-t border-[#1E293B] space-y-1 text-xs">
            <div className="flex justify-between text-[#94A3B8]">
              <span>Estimated Order Value</span>
              <span className="font-bold text-white font-mono-numbers">
                ₹{orderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-[#64748B]">
              <span>Exchange Transaction Fee (Simulated)</span>
              <span>₹0.00 (Zero Brokerage)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || stock.is_frozen}
            className={`w-full py-2.5 rounded font-bold text-xs transition-all disabled:opacity-40 shadow-sm ${
              type === 'BUY'
                ? 'bg-[#10B981] hover:bg-[#059669] text-[#0B0E14]'
                : 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
            }`}
          >
            {loading ? 'Routing Order to Exchange...' : `SUBMIT ${type} ORDER`}
          </button>
        </form>
      </div>
    </div>
  );
}
