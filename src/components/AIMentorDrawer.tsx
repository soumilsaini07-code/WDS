'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, Shield, User, RefreshCw, ChevronRight } from 'lucide-react';
import { AIMessage } from '@/lib/types';

interface AIMentorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIMentorDrawer({ isOpen, onClose }: AIMentorDrawerProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content:
        'Welcome to the Dalal Street Trading Pit! I am your **ECON AI Financial Mentor**.\n\nI can analyze macroeconomic shocks (RBI rate hikes, inflation spikes), evaluate valuation multiples (P/E, EV/EBITDA, Beta), explain order-book mechanics, or help you structure a risk-adjusted portfolio for this tournament.\n\n*(Club Guardrail: I provide educational valuation principles, not direct buy/sell tips).* What would you like to explore?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (userPrompt?: string) => {
    const textToSend = userPrompt || input.trim();
    if (!textToSend || loading) return;

    const newMessages: AIMessage[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('econ_token') : null;
      const res = await fetch('/api/ai-mentor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'Apologies, I encountered an issue formulating the market analysis. Please retry.',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Mentor connection issue. Please verify your network and retry shortly.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'How does this simulation work?',
    'How do I win this competition?',
    'What should I buy or avoid right now?',
    'How does an RBI rate hike affect stocks?',
    'Explain P/E ratio and how to use it',
    'How to manage risk with ₹10 Lakh cash?',
  ];

  // Helper to format assistant responses nicely with bolding, lists, and line breaks
  const formatContent = (text: string) => {
    const paragraphs = text.split('\n');
    return paragraphs.map((para, i) => {
      if (!para.trim()) return <div key={i} className="h-2" />;

      // Bullet points
      if (para.trim().startsWith('- ') || para.trim().startsWith('* ')) {
        const bulletText = para.trim().substring(2);
        return (
          <div key={i} className="flex items-start gap-2 my-1 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4a7c59] shrink-0 mt-1.5" />
            <div className="flex-1 leading-relaxed">
              {renderBoldText(bulletText)}
            </div>
          </div>
        );
      }

      // Numbered list: e.g. 1. 2. 3.
      const numMatch = para.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={i} className="flex items-start gap-2 my-1 pl-1">
            <span className="text-[11px] font-bold text-[#4a7c59] shrink-0 min-w-4">
              {numMatch[1]}.
            </span>
            <div className="flex-1 leading-relaxed">
              {renderBoldText(numMatch[2])}
            </div>
          </div>
        );
      }

      return (
        <p key={i} className="my-1.5 leading-relaxed">
          {renderBoldText(para)}
        </p>
      );
    });
  };

  // Helper for bold text parsing (**text**)
  const renderBoldText = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-[#18211b]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-[#ffffff] border-l border-[#e2e4dc] w-full max-w-lg h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#e2e4dc] bg-[#fbfbfa] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#edf5ef] border border-[#4a7c59]/30 flex items-center justify-center text-[#4a7c59] shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-headline font-bold text-[#18211b] tracking-tight">
                  ECON AI Mentor
                </h2>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[#edf5ef] text-[#295236] border border-[#4a7c59]/30 font-bold">
                  Dalal St. Live
                </span>
              </div>
              <div className="text-[11px] text-[#686e66]">
                Intra-Club Market & Macro Trading Tutor
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#686e66] hover:text-[#18211b] hover:bg-[#f3f4ee] p-1.5 rounded-lg transition-colors"
            title="Close Mentor Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guardrail Banner */}
        <div className="px-4 py-2 bg-[#f6f6f2] border-b border-[#e2e4dc] flex items-center gap-2 text-[11px] text-[#4a4e4a] shrink-0">
          <Shield className="w-3.5 h-3.5 text-[#4a7c59] shrink-0" />
          <span>Real-time market analysis & financial education. SEBI-aligned mentor rules.</span>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-[#ffffff]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-[#edf5ef] border border-[#4a7c59]/20 flex items-center justify-center text-[#4a7c59] shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed transition-all ${
                  m.role === 'user'
                    ? 'bg-[#4a7c59] text-white font-medium rounded-tr-xs shadow-sm'
                    : 'bg-[#fbfbfa] border border-[#e2e4dc] text-[#242826] rounded-tl-xs shadow-xs'
                }`}
              >
                {m.role === 'assistant' ? formatContent(m.content) : m.content}
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-[#f0ece4] border border-[#d8dbd0] flex items-center justify-center text-[#686e66] shrink-0 mt-0.5 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2.5 text-xs text-[#686e66] pl-9 py-2">
              <span className="w-2 h-2 rounded-full bg-[#4a7c59] animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-[#4a7c59] animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-[#4a7c59] animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-[11px] font-mono text-[#295236]">Formulating Dalal Street market analysis...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="p-3.5 border-t border-[#e2e4dc] bg-[#fdfdfb] shrink-0 space-y-2">
          <div className="text-[10px] font-bold text-[#686e66] uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4a7c59]" /> Quick Concept Inquiries
            </span>
            <span className="text-[9px] font-mono text-[#74796e]">Instant answers</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(p)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#f6f6f2] hover:bg-[#edf5ef] hover:border-[#4a7c59]/40 border border-[#e2e4dc] text-[#363a35] hover:text-[#295236] transition-all text-left font-medium truncate flex items-center justify-between group"
              >
                <span className="truncate">{p}</span>
                <ChevronRight className="w-3 h-3 text-[#74796e] group-hover:text-[#295236] shrink-0 ml-1 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t border-[#e2e4dc] bg-white flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about live stocks, RBI policies, P/E multiples, or risk..."
            className="flex-1 px-3.5 py-2.5 bg-[#fbfbfa] border border-[#d8dbd0] rounded-xl text-xs text-[#18211b] placeholder-[#74796e] focus:outline-none focus:border-[#4a7c59] focus:ring-1 focus:ring-[#4a7c59] transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-[#4a7c59] hover:bg-[#3e6a4b] text-white disabled:opacity-40 transition-all font-semibold flex items-center justify-center shadow-xs cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
