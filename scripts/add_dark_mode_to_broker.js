const fs = require('fs');
const filePath = 'C:/Users/Soumil/.gemini/antigravity-ide/scratch/wolf-of-dalal-street/src/app/broker/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add theme hook if not present
if (!content.includes('const isDark = theme === \'dark\';')) {
  const target = `  const [slipMode, setSlipMode] = useState<'trade' | 'ipo'>('trade');`;
  const replacement = `  const [slipMode, setSlipMode] = useState<'trade' | 'ipo'>('trade');

  // Theme State: 'dark' (Institutional Terminal) or 'light' (Financial Paper)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wds_theme') as 'dark' | 'light';
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('wds_theme', next);
    } catch {}
  };

  const isDark = theme === 'dark';`;
  content = content.replace(target, replacement);
}

// 2. Replace root div
content = content.replace(
  `<div className="min-h-screen bg-[#FFFFFF] text-[#000000] font-sans antialiased selection:bg-[#0052CC] selection:text-white transition-colors duration-500 relative">`,
  `<div className={\`min-h-screen font-sans antialiased selection:bg-[#0052CC] selection:text-white transition-colors duration-300 relative \${
      isDark ? 'bg-[#080d0a] text-[#e2e8e3]' : 'bg-[#FFFFFF] text-[#000000]'
    }\`}>`
);

// 3. Replace header
content = content.replace(
  `<header className="border-b border-black/10 px-6 sm:px-12 py-6 flex flex-wrap items-center justify-between gap-6">`,
  `<header className={\`px-6 sm:px-12 py-6 flex flex-wrap items-center justify-between gap-6 border-b transition-colors \${
        isDark ? 'border-[#1b261f] bg-[#0b110e]/95' : 'border-black/10 bg-white'
      }\`}>`
);

// 4. Replace header title & round pill
content = content.replace(
  `<h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#000000]">`,
  `<h1 className={\`text-xl sm:text-2xl font-bold tracking-tight \${
              isDark ? 'text-white' : 'text-[#000000]'
            }\`}>`
);

content = content.replace(
  `<span className="font-mono text-xs px-2.5 py-0.5 rounded-full border border-black/10 bg-[#F8F9FA] text-[#000000] font-semibold">`,
  `<span className={\`font-mono text-xs px-2.5 py-0.5 rounded-full border font-semibold \${
              isDark
                ? 'border-[#233327] bg-[#121c15] text-emerald-300'
                : 'border-black/10 bg-[#F8F9FA] text-[#000000]'
            }\`}>`
);

// 5. Replace telemetry badge
content = content.replace(
  `<div className="flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-[#F8F9FA]">`,
  `<div className={\`flex items-center gap-2 px-3 py-1 rounded-full border \${
            isDark
              ? 'border-[#233327] bg-[#121c15] text-[#e2e8e3]'
              : 'border-black/10 bg-[#F8F9FA] text-[#000000]'
          }\`}>`
);

// 6. Replace refresh button and add Theme Toggle Button right next to it
const refreshTarget = `<button
            onClick={fetchLedger}


            className="p-2 rounded-full border border-black/10 hover:border-black/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            title="Refresh Ledger"
          >
            ↻
          </button>`;

const refreshWithToggle = `<button
            onClick={fetchLedger}
            className={\`p-2 rounded-full border transition-all duration-300 cursor-pointer \${
              isDark
                ? 'border-[#233327] text-zinc-300 hover:border-emerald-500 hover:text-white bg-[#121c15]'
                : 'border-black/10 hover:border-black/30'
            }\`}
            title="Refresh Ledger"
          >
            ↻
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={\`px-3.5 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all duration-300 cursor-pointer \${
              isDark
                ? 'bg-[#16221a] text-emerald-300 border-[#2a3d2e] hover:bg-[#1e2f24]'
                : 'bg-[#F8F9FA] text-[#000000] border-black/10 hover:border-black/30'
            }\`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span className="font-bold uppercase tracking-wider">{isDark ? 'LIGHT' : 'DARK'}</span>
          </button>`;

if (content.includes(refreshTarget)) {
  content = content.replace(refreshTarget, refreshWithToggle);
} else {
  // Try lenient match for refresh button
  content = content.replace(
    /className="p-2 rounded-full border border-black\/10 hover:border-black\/30 transition-all[^"]*"\s+title="Refresh Ledger"\s*>\s*↻\s*<\/button>/,
    `className={\`p-2 rounded-full border transition-all duration-300 cursor-pointer \${
              isDark
                ? 'border-[#233327] text-zinc-300 hover:border-emerald-500 hover:text-white bg-[#121c15]'
                : 'border-black/10 hover:border-black/30'
            }\`}
            title="Refresh Ledger"
          >
            ↻
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={\`px-3.5 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs transition-all duration-300 cursor-pointer \${
              isDark
                ? 'bg-[#16221a] text-emerald-300 border-[#2a3d2e] hover:bg-[#1e2f24]'
                : 'bg-[#F8F9FA] text-[#000000] border-black/10 hover:border-black/30'
            }\`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span className="font-bold uppercase tracking-wider">{isDark ? 'LIGHT' : 'DARK'}</span>
          </button>`
  );
}

// 7. Auto-sync badge in header
content = content.replace(
  `className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono"`,
  `className={\`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono \${
            isDark
              ? 'bg-[#152219] border-emerald-800 text-emerald-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }\`}`
);

// 8. Hero Section
content = content.replace(
  `<section className="px-6 sm:px-12 pt-12 pb-8 border-b border-black/10">`,
  `<section className={\`px-6 sm:px-12 pt-12 pb-8 border-b \${
        isDark ? 'border-[#1b261f]' : 'border-black/10'
      }\`}>`
);

content = content.replace(
  `<h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.05em] leading-[0.9] text-[#000000]">`,
  `<h2 className={\`text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.05em] leading-[0.9] \${
            isDark ? 'text-white' : 'text-[#000000]'
          }\`}>`
);

content = content.replace(
  `<p className="mt-4 text-base sm:text-lg font-normal text-[#525252] max-w-2xl leading-relaxed">`,
  `<p className={\`mt-4 text-base sm:text-lg font-normal max-w-2xl leading-relaxed \${
            isDark ? 'text-zinc-400' : 'text-[#525252]'
          }\`}>`
);

// Metrics row in hero
content = content.replace(
  `<div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 pt-8 border-t border-black/10">`,
  `<div className={\`grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 pt-8 border-t \${
            isDark ? 'border-[#1b261f]' : 'border-black/10'
          }\`}>`
);

// Numbers in metrics row
content = content.replace(
  `<span className="text-3xl font-bold tracking-tight text-[#000000]">
                {snapshot?.totalDealsSettled ?? 0}`,
  `<span className={\`text-3xl font-bold tracking-tight \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                {snapshot?.totalDealsSettled ?? 0}`
);

content = content.replace(
  `<span className="text-3xl font-bold tracking-tight text-[#000000]">
                {(snapshot?.totalVolumeShares ?? 0).toLocaleString('en-IN')}`,
  `<span className={\`text-3xl font-bold tracking-tight \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                {(snapshot?.totalVolumeShares ?? 0).toLocaleString('en-IN')}`
);

content = content.replace(
  `<span className="text-3xl font-bold tracking-tight text-[#000000]">
                ₹{(snapshot?.totalGrossConsideration ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
  `<span className={\`text-3xl font-bold tracking-tight \${isDark ? 'text-white' : 'text-[#000000]'}\`}>
                ₹{(snapshot?.totalGrossConsideration ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
);

// 9. Input Matrix header strip
content = content.replace(
  `<div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-black/10">`,
  `<div className={\`flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b \${
            isDark ? 'border-[#1b261f]' : 'border-black/10'
          }\`}>`
);

// 10. Secondary Trade Slip button
content = content.replace(
  `slipMode === 'trade'
                      ? 'bg-[#000000] text-white font-bold shadow-sm'
                      : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000] border border-black/10'`,
  `slipMode === 'trade'
                      ? isDark
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'bg-[#000000] text-white font-bold shadow-sm'
                      : isDark
                      ? 'bg-[#101712] text-zinc-400 hover:text-white border border-[#1e2b20]'
                      : 'bg-[#F8F9FA] text-[#737373] hover:text-[#000000] border border-black/10'`
);

// IPO Application Slip button
content = content.replace(
  `slipMode === 'ipo'
                      ? 'bg-[#0052CC] text-white font-bold shadow-sm'
                      : 'bg-[#F8F9FA] text-[#737373] hover:text-[#0052CC] border border-black/10'`,
  `slipMode === 'ipo'
                      ? 'bg-[#0052CC] text-white font-bold shadow-sm'
                      : isDark
                      ? 'bg-[#101712] text-zinc-400 hover:text-blue-400 border border-[#1e2b20]'
                      : 'bg-[#F8F9FA] text-[#737373] hover:text-[#0052CC] border border-black/10'`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Base dark mode setup applied to broker/page.tsx');
