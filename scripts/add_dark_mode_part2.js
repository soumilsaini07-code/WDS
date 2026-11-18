const fs = require('fs');
const filePath = 'C:/Users/Soumil/.gemini/antigravity-ide/scratch/wolf-of-dalal-street/src/app/broker/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// --- 1. SECONDARY TRADE INPUT CARDS ---
// Card 01: Buyer Team
content = content.replace(
  `{/* CARD 01: BUYER TEAM */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 01: BUYER TEAM */}
              <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }\`}>`
);

content = content.replace(
  `<span className="font-mono text-[11px] text-[#000000] font-bold">
                      CASH: ₹{(buyerRecord.currentCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>`,
  `<span className={\`font-mono text-[11px] font-bold \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                      CASH: ₹{(buyerRecord.currentCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>`
);

content = content.replace(
  `className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none placeholder:text-black/20 focus:ring-0"
                    required
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                    BUYER
                  </span>`,
  `className={\`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 \${
                      isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                    }\`}
                    required
                  />
                  <span className={\`font-mono text-[11px] uppercase tracking-[0.2em] shrink-0 \${
                    isDark ? 'text-zinc-500' : 'text-[#737373]'
                  }\`}>
                    BUYER
                  </span>`
);

content = content.replace(
  `<div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373] flex items-center justify-between">`,
  `<div className={\`pt-2 border-t text-[11px] font-mono flex items-center justify-between \${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }\`}>`
);

// Card 02: Seller Team
content = content.replace(
  `{/* CARD 02: SELLER TEAM */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 02: SELLER TEAM */}
              <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }\`}>`
);

content = content.replace(
  `className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0052CC] font-bold hover:underline cursor-pointer"`,
  `className={\`font-mono text-[11px] uppercase tracking-[0.1em] font-bold hover:underline cursor-pointer \${
                      isDark ? 'text-blue-400' : 'text-[#0052CC]'
                    }\`}`
);

content = content.replace(
  `className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none placeholder:text-black/20 focus:ring-0"
                    required
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                    SELLER
                  </span>`,
  `className={\`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 \${
                      isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                    }\`}
                    required
                  />
                  <span className={\`font-mono text-[11px] uppercase tracking-[0.2em] shrink-0 \${
                    isDark ? 'text-zinc-500' : 'text-[#737373]'
                  }\`}>
                    SELLER
                  </span>`
);

content = content.replace(
  `<div className="pt-2 border-t border-black/5 text-[11px] font-mono text-[#737373]">
                  0% FEE ON CENTRAL PRIMARY POOL • 1% DUAL ON INTER-TEAM
                </div>`,
  `<div className={\`pt-2 border-t text-[11px] font-mono \${
                    isDark ? 'border-[#1b271e] text-zinc-400' : 'border-black/5 text-[#737373]'
                  }\`}>
                  0% FEE ON CENTRAL PRIMARY POOL • 1% DUAL ON INTER-TEAM
                </div>`
);

// Card 03: Stock & Agreed Price
content = content.replace(
  `{/* CARD 03: TRADED SECURITY & PRICE */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 03: TRADED SECURITY & PRICE */}
              <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }\`}>`
);

// Combobox Input
content = content.replace(
  `<div className="flex items-center gap-2 border-b-2 border-black/20 focus-within:border-[#0052CC] transition-colors pb-1">`,
  `<div className={\`flex items-center gap-2 border-b-2 transition-colors pb-1 \${
                        isDark ? 'border-[#233327] focus-within:border-emerald-500' : 'border-black/20 focus-within:border-[#0052CC]'
                      }\`}>`
);

content = content.replace(
  `className="w-full text-base font-bold text-[#000000] bg-transparent outline-none placeholder:text-black/35 placeholder:font-normal"`,
  `className={\`w-full text-base font-bold bg-transparent outline-none placeholder:font-normal \${
                          isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/35'
                        }\`}`
);

// Combobox Dropdown Container
content = content.replace(
  `<div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-black/15 shadow-2xl overflow-hidden max-h-72 flex flex-col">`,
  `<div className={\`absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border shadow-2xl overflow-hidden max-h-72 flex flex-col \${
                        isDark ? 'bg-[#0d1410] border-[#1e2c21] shadow-black/80' : 'bg-white border-black/15'
                      }\`}>`
);

content = content.replace(
  `<div className="px-3.5 py-2 bg-gray-50 border-b border-black/5 text-[10px] font-mono text-gray-500 uppercase flex items-center justify-between">`,
  `<div className={\`px-3.5 py-2 border-b text-[10px] font-mono uppercase flex items-center justify-between \${
                          isDark ? 'bg-[#101712] border-[#1e2c21] text-zinc-400' : 'bg-gray-50 border-black/5 text-gray-500'
                        }\`}>`
);

content = content.replace(
  `<div className="overflow-y-auto divide-y divide-gray-100 flex-1">`,
  `<div className={\`overflow-y-auto divide-y flex-1 \${
                          isDark ? 'divide-[#18231c]' : 'divide-gray-100'
                        }\`}>`
);

// Stock dropdown item
content = content.replace(
  `className={\`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-blue-50/80 transition-colors cursor-pointer \${
                                    isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600' : ''
                                  }\`}`,
  `className={\`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer \${
                                    isSelected
                                      ? isDark ? 'bg-[#152219] border-l-4 border-emerald-500' : 'bg-blue-50/90 border-l-4 border-blue-600'
                                      : isDark ? 'hover:bg-[#152219]' : 'hover:bg-blue-50/80'
                                  }\`}`
);

content = content.replace(
  `<span className="font-mono font-bold text-xs text-black shrink-0">`,
  `<span className={\`font-mono font-bold text-xs shrink-0 \${isDark ? 'text-white' : 'text-black'}\`}>`
);

content = content.replace(
  `<span className="text-xs text-gray-800 font-medium truncate">`,
  `<span className={\`text-xs font-medium truncate \${isDark ? 'text-zinc-300' : 'text-gray-800'}\`}>`
);

// Price Input in Card 03
content = content.replace(
  `className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none focus:ring-0 font-mono"
                      required`,
  `className={\`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 font-mono \${
                        isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                      }\`}
                      required`
);

// Card 04: Share Quantity
content = content.replace(
  `{/* CARD 04: QUANTITY & EXECUTION */}
              <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 04: QUANTITY & EXECUTION */}
              <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
              }\`}>`
);

content = content.replace(
  `<span className="font-mono text-[11px] text-[#000000] font-bold">
                    GROSS: ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>`,
  `<span className={\`font-mono text-[11px] font-bold \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                    GROSS: ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>`
);

content = content.replace(
  `className="w-full text-2xl font-bold text-[#000000] bg-transparent border-none outline-none focus:ring-0 font-mono"
                    required
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373] shrink-0">
                    SHARES
                  </span>`,
  `className={\`w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 font-mono \${
                      isDark ? 'text-white placeholder:text-zinc-600' : 'text-[#000000] placeholder:text-black/20'
                    }\`}
                    required
                  />
                  <span className={\`font-mono text-[11px] uppercase tracking-[0.2em] shrink-0 \${
                    isDark ? 'text-zinc-500' : 'text-[#737373]'
                  }\`}>
                    SHARES
                  </span>`
);

content = content.replace(
  `<span className="font-bold text-[#000000]">
                    {parsedQty} × ₹{parsedPrice.toFixed(2)}
                  </span>`,
  `<span className={\`font-bold \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                    {parsedQty} × ₹{parsedPrice.toFixed(2)}
                  </span>`
);

// --- 2. EDITORIAL VOUCHER BREAKDOWN STRIP ---
content = content.replace(
  `{/* EDITORIAL VOUCHER BREAKDOWN STRIP */}
            <div className="p-6 rounded-[24px] border border-black/10 bg-[#FFFFFF] space-y-4">`,
  `{/* EDITORIAL VOUCHER BREAKDOWN STRIP */}
            <div className={\`p-6 rounded-[24px] border space-y-4 \${
              isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#FFFFFF] border-black/10'
            }\`}>`
);

content = content.replace(
  `<div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/10 font-mono text-xs">`,
  `<div className={\`flex flex-wrap items-center justify-between gap-4 pb-4 border-b font-mono text-xs \${
                isDark ? 'border-[#1b271e]' : 'border-black/10'
              }\`}>`
);

content = content.replace(
  `<span className="text-xl font-bold text-[#000000]">
                    ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>`,
  `<span className={\`text-xl font-bold \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                    ₹{grossDealValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>`
);

content = content.replace(
  `<span className="text-xl font-bold text-[#000000]">
                    {isBrokerageWaived ? '₹0.00 (WAIVED)' : \`+₹\${buyerBrokerage.toLocaleString('en-IN')}\`}
                  </span>`,
  `<span className={\`text-xl font-bold \${isDark ? 'text-emerald-400' : 'text-[#000000]'}\`}>
                    {isBrokerageWaived ? '₹0.00 (WAIVED)' : \`+₹\${buyerBrokerage.toLocaleString('en-IN')}\`}
                  </span>`
);

content = content.replace(
  `<span className="text-xl font-bold text-[#0052CC]">
                    ₹{totalDeskFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>`,
  `<span className={\`text-xl font-bold \${isDark ? 'text-blue-400' : 'text-[#0052CC]'}\`}>
                    ₹{totalDeskFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>`
);

// --- 3. MASTER LEDGER SECTION ---
content = content.replace(
  `<section className="space-y-6 pt-12 border-t border-black/10">`,
  `<section className={\`space-y-6 pt-12 border-t \${isDark ? 'border-[#1b261f]' : 'border-black/10'}\`}>`
);

content = content.replace(
  `<div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/10">`,
  `<div className={\`flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b \${isDark ? 'border-[#1b261f]' : 'border-black/10'}\`}>`
);

content = content.replace(
  `<h3 className="text-3xl font-bold tracking-[-0.04em] text-[#000000] mt-1">`,
  `<h3 className={\`text-3xl font-bold tracking-[-0.04em] mt-1 \${isDark ? 'text-white' : 'text-[#000000]'}\`}>`
);

// Tab buttons
content = content.replace(
  `activeTab === 'purses'
                    ? 'bg-[#000000] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'`,
  `activeTab === 'purses'
                    ? isDark
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#000000] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'`
);

content = content.replace(
  `activeTab === 'ledger'
                    ? 'bg-[#000000] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'`,
  `activeTab === 'ledger'
                    ? isDark
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#000000] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'`
);

content = content.replace(
  `activeTab === 'matrix'
                    ? 'bg-[#000000] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'`,
  `activeTab === 'matrix'
                    ? isDark
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#000000] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000]'`
);

content = content.replace(
  `activeTab === 'ipo'
                    ? 'bg-[#0052CC] text-white font-bold'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#0052CC]'`,
  `activeTab === 'ipo'
                    ? 'bg-[#0052CC] text-white font-bold'
                    : isDark
                    ? 'bg-[#101712] text-zinc-400 hover:text-blue-400 border border-[#1e2b20]'
                    : 'bg-[#F8F9FA] text-[#737373] hover:text-[#0052CC]'`
);

// Search inputs
content = content.replace(
  `className="py-2 px-4 rounded-full bg-[#F8F9FA] border border-black/10 text-xs text-[#000000] outline-none w-72 uppercase tracking-[0.1em]"`,
  `className={\`py-2 px-4 rounded-full border text-xs outline-none w-72 uppercase tracking-[0.1em] \${
                    isDark
                      ? 'bg-[#101712] border-[#1e2c21] text-white placeholder:text-zinc-600'
                      : 'bg-[#F8F9FA] border-black/10 text-[#000000]'
                  }\`}`
);

content = content.replace(
  `className="py-2 px-4 rounded-full bg-[#F8F9FA] border border-black/10 text-xs text-[#000000] outline-none w-80 uppercase tracking-[0.1em] font-mono"`,
  `className={\`py-2 px-4 rounded-full border text-xs outline-none w-80 uppercase tracking-[0.1em] font-mono \${
                  isDark
                    ? 'bg-[#101712] border-[#1e2c21] text-white placeholder:text-zinc-600'
                    : 'bg-[#F8F9FA] border-black/10 text-[#000000]'
                }\`}`
);

// Tables - Tab 1 (Purses Table)
content = content.replace(
  `<div className="overflow-x-auto border border-black/10 rounded-[24px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">`,
  `<div className={\`overflow-x-auto border rounded-[24px] \${
                isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
              }\`}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className={\`text-[11px] uppercase tracking-[0.2em] border-b \${
                    isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                  }\`}>`
);

content = content.replace(
  `<tbody className="divide-y divide-black/5 text-[#000000]">`,
  `<tbody className={\`divide-y \${
                    isDark ? 'divide-[#18231c] text-zinc-200' : 'divide-black/5 text-[#000000]'
                  }\`}>`
);

content = content.replace(
  `className={\`hover:bg-[#F8F9FA] transition-colors duration-150 \${
                            isEliminated ? 'bg-red-50/40' : ''
                          }\`}`,
  `className={\`transition-colors duration-150 \${
                            isEliminated
                              ? isDark ? 'bg-rose-950/30 hover:bg-rose-950/50' : 'bg-red-50/40 hover:bg-red-50/70'
                              : isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'
                          }\`}`
);

content = content.replace(
  `<div className="font-bold text-[#000000]">{tp.teamName}</div>`,
  `<div className={\`font-bold \${isDark ? 'text-white' : 'text-[#000000]'}\`}>{tp.teamName}</div>`
);

// Tables - Tab 2 (Trades Table)
content = content.replace(
  `<div className="overflow-x-auto border border-black/10 rounded-[24px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                    <tr>
                      <th className="py-3 px-4">SLIP ID</th>`,
  `<div className={\`overflow-x-auto border rounded-[24px] \${
                isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
              }\`}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className={\`text-[11px] uppercase tracking-[0.2em] border-b \${
                    isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                  }\`}>
                    <tr>
                      <th className="py-3 px-4">SLIP ID</th>`
);

content = content.replace(
  `<tr key={t.slipId} className="hover:bg-[#F8F9FA] transition">`,
  `<tr key={t.slipId} className={\`transition \${isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'}\`}>`
);

content = content.replace(
  `<td className="py-3 px-4 font-bold text-[#0052CC]">{t.slipId}</td>`,
  `<td className={\`py-3 px-4 font-bold \${isDark ? 'text-blue-400' : 'text-[#0052CC]'}\`}>{t.slipId}</td>`
);

// Tables - Tab 3 (Holdings Matrix)
content = content.replace(
  `<div className="overflow-x-auto border border-black/10 rounded-[24px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                  <tr>
                    <th className="py-3 px-4 sticky left-0 bg-[#F8F9FA] z-10">TEAM</th>`,
  `<div className={\`overflow-x-auto border rounded-[24px] \${
              isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
            }\`}>
              <table className="w-full text-left text-xs font-mono">
                <thead className={\`text-[11px] uppercase tracking-[0.2em] border-b \${
                  isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                }\`}>
                  <tr>
                    <th className={\`py-3 px-4 sticky left-0 z-10 \${isDark ? 'bg-[#101712]' : 'bg-[#F8F9FA]'}\`}>TEAM</th>`
);

content = content.replace(
  `<td className="py-3 px-4 font-sans font-bold text-[#000000] sticky left-0 bg-white z-10 border-r border-black/10">`,
  `<td className={\`py-3 px-4 font-sans font-bold sticky left-0 z-10 border-r \${
                        isDark ? 'bg-[#0d1410] text-white border-[#1e2c21]' : 'bg-white text-[#000000] border-black/10'
                      }\`}>`
);

// Tables - Tab 4 (IPO Applications)
content = content.replace(
  `<div className="overflow-x-auto border border-black/10 rounded-[24px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F8F9FA] text-[#737373] text-[11px] uppercase tracking-[0.2em] border-b border-black/10">
                    <tr>
                      <th className="py-3 px-4">APPLICATION SLIP ID</th>`,
  `<div className={\`overflow-x-auto border rounded-[24px] \${
                isDark ? 'border-[#1e2c21] bg-[#0d1410]' : 'border-black/10 bg-white'
              }\`}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className={\`text-[11px] uppercase tracking-[0.2em] border-b \${
                    isDark ? 'bg-[#101712] text-zinc-400 border-[#1e2c21]' : 'bg-[#F8F9FA] text-[#737373] border-black/10'
                  }\`}>
                    <tr>
                      <th className="py-3 px-4">APPLICATION SLIP ID</th>`
);

content = content.replace(
  `<tr key={sub.id} className="hover:bg-[#F8F9FA] transition">`,
  `<tr key={sub.id} className={\`transition \${isDark ? 'hover:bg-[#121c15]' : 'hover:bg-[#F8F9FA]'}\`}>`
);

// IPO form input cards (Card 01 - 04)
content = content.replace(
  `{/* CARD 01: IPO LISTING */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 01: IPO LISTING */}
                <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }\`}>`
);

content = content.replace(
  `{/* CARD 02: APPLYING TEAM */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 02: APPLYING TEAM */}
                <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }\`}>`
);

content = content.replace(
  `{/* CARD 03: LOTS REQUESTED */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 03: LOTS REQUESTED */}
                <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }\`}>`
);

content = content.replace(
  `{/* CARD 04: TOTAL SHARES & OUTFLOW */}
                <div className="p-6 rounded-[24px] bg-[#F8F9FA] border border-black/10 flex flex-col justify-between space-y-4">`,
  `{/* CARD 04: TOTAL SHARES & OUTFLOW */}
                <div className={\`p-6 rounded-[24px] border flex flex-col justify-between space-y-4 \${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#F8F9FA] border-black/10'
                }\`}>`
);

// IPO Breakdown Strip
content = content.replace(
  `{/* EDITORIAL IPO BREAKDOWN STRIP */}
                <div className="p-6 rounded-[24px] border border-black/10 bg-[#FFFFFF] space-y-4">`,
  `{/* EDITORIAL IPO BREAKDOWN STRIP */}
                <div className={\`p-6 rounded-[24px] border space-y-4 \${
                  isDark ? 'bg-[#0d1410] border-[#1e2c21]' : 'bg-[#FFFFFF] border-black/10'
                }\`}>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Part 2 dark mode updates applied successfully to broker/page.tsx');
