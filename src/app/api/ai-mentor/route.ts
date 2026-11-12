import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getStocks, getUserById, getUserPortfolios, getMarketEvents } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // Retrieve real-time market context from database
    const [stocks, user, portfolios, events] = await Promise.all([
      getStocks(),
      getUserById(session.userId),
      getUserPortfolios(session.userId),
      getMarketEvents(),
    ]);

    // Format live tape context
    const stocksTape = stocks.map((s) => {
      const change = s.current_price - s.previous_close;
      const pct = ((change / s.previous_close) * 100).toFixed(2);
      return `${s.ticker} (${s.name}, ${s.sector}): ₹${s.current_price.toFixed(2)} (${Number(pct) >= 0 ? '+' : ''}${pct}%) | Day Range: ₹${s.day_low} - ₹${s.day_high}${s.is_frozen ? ' [CIRCUIT HALTED]' : ''}`;
    }).join('\n');

    const holdingsSummary = portfolios.length > 0
      ? portfolios.map((p) => {
          const st = stocks.find((s) => s.id === p.stock_id);
          const currentVal = st ? (p.shares_count * st.current_price).toFixed(2) : '0';
          const pnlPct = st ? (((st.current_price - p.avg_buy_price) / p.avg_buy_price) * 100).toFixed(1) : '0';
          return `${st?.ticker || 'ASSET'}: ${p.shares_count} shares @ avg ₹${p.avg_buy_price.toFixed(2)} (Val: ₹${currentVal}, PnL: ${Number(pnlPct) >= 0 ? '+' : ''}${pnlPct}%)`;
        }).join('; ')
      : 'No open stock positions (100% Cash / Dry Powder)';

    const userCash = user ? `₹${user.balance.toLocaleString('en-IN')}` : '₹10,00,000';
    const latestEvent = events[0] ? `"${events[0].headline}" - ${events[0].description}` : 'No active macro crisis';

    // Check for external LLM API Key (OpenAI or Gemini)
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openAiKey) {
      try {
        const systemPrompt = `You are the ECON Club AI Senior Trading Mentor for the "Wolf of Dalal Street" educational tournament at Thapar Institute of Engineering & Technology (TIET).
You speak like a seasoned, sharp, articulate institutional hedge fund trader and economics faculty mentor.

LIVE SIMULATION TELEMETRY:
- User Liquid Cash: ${userCash}
- User Holdings: ${holdingsSummary}
- Active Macro Event: ${latestEvent}
- Live Dalal Street Stocks Tape:
${stocksTape}

CORE MENTOR GUIDELINES:
1. NEVER give direct stock tips, price targets, or explicit "Buy X now" recommendations.
2. If asked "what should I buy" or "which stock will give maximum profit", explain how to evaluate sector rotation, valuation multiples (P/E, EV/EBITDA, PB), sensitivity to interest rates, and position sizing.
3. Be realistic, conversational, and direct. Reference actual live prices and market events in your explanations.
4. Keep answers concise, highly informative, structured with bold key concepts and bullet points.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            temperature: 0.65,
            max_tokens: 650,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) return NextResponse.json({ reply });
        }
      } catch (err) {
        console.warn('OpenAI call failed, activating local Dalal Street AI engine:', err);
      }
    }

    // High-Fidelity Dalal Street Financial Mentor Engine
    const lastUserMessage = (messages[messages.length - 1]?.content || '').trim().toLowerCase();

    let mentorResponse = '';

    // 1. "How does this work?" / Simulation mechanics / Rules
    if (
      lastUserMessage.includes('how does this work') ||
      lastUserMessage.includes('how does it work') ||
      lastUserMessage.includes('how to play') ||
      lastUserMessage.includes('what is this') ||
      lastUserMessage.includes('rules') ||
      lastUserMessage.includes('getting started') ||
      lastUserMessage.includes('start')
    ) {
      mentorResponse = `🏛️ **Wolf of Dalal Street Simulation Mechanics:**

Welcome to the trading floor. Here is how this live simulation operates:

1. **Capital Allocation:** Every participant starts with **₹10,00,000 in virtual liquid cash**. You currently have **${userCash}** available to deploy.
2. **The Asset Universe:** You are trading 10 blue-chip scrips across Energy, IT, Banking, Auto, and FMCG. Prices update in real time with simulated institutional order flow.
3. **Macroeconomic Shocks & Events:** The Faculty Command Center triggers live policy interventions (such as **RBI repo rate shifts**, inflation surprises, or quarterly earnings leaks). Watch the **Breaking News** feed on your right dock closely—prices re-rate rapidly following these catalysts.
4. **Order Execution:** Select any asset on your watchlist, enter your target quantity, and execute immediate market orders. Be mindful of position sizing—putting more than 20% into a single high-beta name increases your drawdown risk.
5. **Circuit Breakers:** If any asset experiences extreme volatility (+/- 10%), the exchange imposes an automatic trading halt to prevent contagion.
6. **Winning Criteria:** The leaderboard tracks **Total Net Worth** and **Sharpe-Adjusted Returns**. High returns coupled with measured volatility rank highest.

Would you like a breakdown of a specific stock or advice on how to structure your opening allocation?`;
    }

    // 2. Winning strategy / tips / how to win
    else if (
      lastUserMessage.includes('how to win') ||
      lastUserMessage.includes('strategy') ||
      lastUserMessage.includes('best strategy') ||
      lastUserMessage.includes('tips to win') ||
      lastUserMessage.includes('leaderboard') ||
      lastUserMessage.includes('win the competition')
    ) {
      mentorResponse = `🏆 **Dalal Street Winning Playbook:**

Winning a multi-round macroeconomic trading tournament requires more than speculative guessing. Top institutional desks follow these four rules:

1. **Information Asymmetry & Reaction Speed:**
   - When a macro bulletin drops (e.g. *${latestEvent.slice(0, 65)}...*), don't just react—anticipate second-order effects.
   - For instance: If RBI hikes rates, banks with strong CASA deposits (like HDFCBANK or ICICIBANK) often defend Net Interest Margins (NIM), while high-leverage auto names face immediate demand headwinds.

2. **The 20% Position Cap Rule:**
   - Never commit more than **₹2,00,000 (20% of your book)** to a single ticker. If that stock hits a circuit breaker down 8%, your total book only loses 1.6%, keeping you in the tournament game.

3. **Core-and-Satellite Portfolio Design:**
   - **Core (60%):** Stable compounders with steady cash flows (e.g., ITC in FMCG, TCS in IT).
   - **Satellite (40%):** High-beta momentum assets (e.g., TATAMOTORS, RELIANCE) to capitalize on intraday price swings.

4. **Preserve Dry Powder:**
   - Keeping **15% to 25% cash** lets you aggressively buy the dip when panic selling pushes fundamentally sound blue-chips below intrinsic value.`;
    }

    // 3. Direct Stock Tips / Buy-Sell Recommendations (Strict Guardrail + Constructive Education)
    else if (
      lastUserMessage.includes('should i buy') ||
      lastUserMessage.includes('should i sell') ||
      lastUserMessage.includes('recommend a stock') ||
      lastUserMessage.includes('which stock to buy') ||
      lastUserMessage.includes('best stock') ||
      lastUserMessage.includes('give me a tip') ||
      lastUserMessage.includes('buy or sell')
    ) {
      mentorResponse = `🛡️ **ECON Mentor Guardrail:** Under club and SEBI compliance guidelines, I do not issue direct buy/sell calls or target prices. 

However, let's dissect the current tape like a professional equity research analyst:

- **High-Beta Cyclicals (TATAMOTORS, TATASTEEL):** These scrips amplify broader market swings (Beta ~1.3 to 1.5). In an economic expansion or post-rate-cut regime, they generate the highest alpha, but suffer steep pullbacks during macro drawdowns.
- **Defensive Value (ITC, SUNPHARMA):** Low beta (<0.8), inelastic consumer demand, and strong dividend yields make these safe harbors when volatility spikes.
- **Banking Bellwethers (HDFCBANK, ICICIBANK):** Direct beneficiaries of credit growth; keep an eye on RBI repo rate announcements.
- **IT Exporters (TCS, INFY):** Driven by US/European tech spending and USD/INR exchange rate trends. A weaker rupee provides operational margin tailwinds.

*To decide on an entry:* Compare the current price against its **Day Low / Day High** range on your terminal and ask: *Does this trade provide an asymmetric risk-to-reward ratio (at least 2:1)?*`;
    }

    // 4. Specific Stock Breakdown inquiries (Reliance, TCS, HDFC, Tata Motors, Infosys, etc.)
    else if (
      lastUserMessage.includes('reliance') ||
      lastUserMessage.includes('tcs') ||
      lastUserMessage.includes('hdfc') ||
      lastUserMessage.includes('tatamotors') ||
      lastUserMessage.includes('tata motors') ||
      lastUserMessage.includes('infy') ||
      lastUserMessage.includes('infosys') ||
      lastUserMessage.includes('itc') ||
      lastUserMessage.includes('icici') ||
      lastUserMessage.includes('bharti') ||
      lastUserMessage.includes('airtel') ||
      lastUserMessage.includes('sunpharma') ||
      lastUserMessage.includes('l&t') ||
      lastUserMessage.includes('larsent')
    ) {
      // Find matching stock
      const matched = stocks.find((s) =>
        lastUserMessage.includes(s.ticker.toLowerCase()) ||
        lastUserMessage.includes(s.name.toLowerCase()) ||
        (lastUserMessage.includes('tata motors') && s.ticker === 'TATAMOTORS') ||
        (lastUserMessage.includes('infosys') && s.ticker === 'INFY') ||
        (lastUserMessage.includes('airtel') && s.ticker === 'BHARTIARTL') ||
        (lastUserMessage.includes('l&t') && s.ticker === 'LT')
      ) || stocks[0];

      const changeVal = matched.current_price - matched.previous_close;
      const changePct = ((changeVal / matched.previous_close) * 100).toFixed(2);
      const isUp = changeVal >= 0;

      mentorResponse = `📈 **Equity Deep-Dive: ${matched.ticker} (${matched.name})**

- **Sector:** ${matched.sector}
- **Current LTP:** ₹${matched.current_price.toFixed(2)} (${isUp ? '+' : ''}${changePct}% vs prev close ₹${matched.previous_close.toFixed(2)})
- **Day Trading Range:** ₹${matched.day_low.toFixed(2)} — ₹${matched.day_high.toFixed(2)}
- **Trading Status:** ${matched.is_frozen ? '⚠️ **CIRCUIT HALTED** — Order book temporarily frozen by exchange.' : '🟢 **ACTIVE** — Liquid continuous trading.'}

**Fundamental Drivers & Valuation Context:**
- **Key Catalysts:** Look at sector-specific inputs. If energy/refining margins expand or retail subscriber ARPU rises, ${matched.ticker} experiences earnings upgrades.
- **Risk Profile:** Note how it responds to the latest news bulletin: *${latestEvent.slice(0, 70)}...*
- **Portfolio Role:** Does your book need exposure to ${matched.sector}? If you already hold large weights in this sector, adding more creates unwanted sector concentration.`;
    }

    // 5. Macroeconomics: RBI Repo Rate / Monetary Policy / Inflation / CPI
    else if (
      lastUserMessage.includes('rbi') ||
      lastUserMessage.includes('repo') ||
      lastUserMessage.includes('interest rate') ||
      lastUserMessage.includes('inflation') ||
      lastUserMessage.includes('cpi') ||
      lastUserMessage.includes('monetary')
    ) {
      mentorResponse = `🏦 **RBI Monetary Policy & Equity Multiples:**

When the Reserve Bank of India (RBI) Monetary Policy Committee adjusts the **Repo Rate** (currently anchored around 6.50%), it reverberates across Dalal Street through three key transmission channels:

1. **Discount Rate & Valuation Compression:**
   - Stock prices equal the present value of future cash flows discounted by the cost of capital ($WACC$).
   - A rate hike increases the risk-free rate ($R_f$), expanding discount denominators and **compressing high-multiple growth equities** (especially rich P/E tech stocks).

2. **Borrowing Costs & Working Capital:**
   - Highly leveraged companies (infrastructure, capital goods, real estate) see immediate interest cost escalation, shaving net profit margins.

3. **Sectoral Divergence:**
   - **Financials (HDFCBANK, ICICIBANK):** Short-term benefit if loan books reprice upward faster than fixed deposits, expanding Net Interest Margins (NIM).
   - **Auto & Consumer Discretionary (TATAMOTORS):** Higher auto-loan EMIs dampen vehicle booking velocity.

*Trading Takeaway:* When the news ticker flashes an unexpected rate hike, rotate out of debt-laden cyclicals and into cash-rich, low-debt defensive names!`;
    }

    // 6. Valuation Metrics: P/E, P/B, EV/EBITDA, Beta
    else if (
      lastUserMessage.includes('pe ratio') ||
      lastUserMessage.includes('p/e') ||
      lastUserMessage.includes('multiple') ||
      lastUserMessage.includes('valuation') ||
      lastUserMessage.includes('ev/ebitda') ||
      lastUserMessage.includes('roce')
    ) {
      mentorResponse = `📊 **Essential Valuation Multiples on Dalal Street:**

1. **Price-to-Earnings (P/E) Ratio:**
   - **Formula:** $\\text{Market Price} \\div \\text{EPS}$
   - **Interpretation:** How much investors are willing to pay for ₹1 of annual net profit. A P/E of 45x means you pay ₹45 per ₹1 of current earnings—demanding significant double-digit forward growth to justify the valuation.
   - **Pitfall:** Never compare P/E across different sectors (e.g., comparing a capital-heavy steel manufacturer with a capital-light IT service firm).

2. **EV / EBITDA (Enterprise Value to EBITDA):**
   - Superior to P/E when comparing companies with different capital structures, because Enterprise Value incorporates both market cap and net debt.

3. **Beta ($\\beta$):**
   - **$\\beta = 1.0$:** Moves exactly in sync with the Nifty 50 benchmark.
   - **$\\beta > 1.2$:** High sensitivity. Yields outsized gains during rallies but punishes traders during market selloffs.
   - **$\\beta < 0.8$:** Defensive cushion. Holds ground during macro turmoil.`;
    }

    // 7. Portfolio Review & "How is my portfolio"
    else if (
      lastUserMessage.includes('my portfolio') ||
      lastUserMessage.includes('my holdings') ||
      lastUserMessage.includes('my balance') ||
      lastUserMessage.includes('my cash') ||
      lastUserMessage.includes('how am i doing') ||
      lastUserMessage.includes('portfolio review')
    ) {
      mentorResponse = `💼 **Your Live Portfolio Health Check:**

- **Liquid Cash Available:** ${userCash}
- **Current Holdings:** ${holdingsSummary}

**Mentor Diagnostic:**
${
  portfolios.length === 0
    ? '- **Cash Drag Alert:** You are currently holding 100% in liquid cash. While cash protects against drawdowns, zero equity exposure means you miss out on capital appreciation and dividend yields during market upward waves. Consider deploying 40-50% across 2 or 3 non-correlated sectors.'
    : `- **Sector Concentration:** You have ${portfolios.length} active position(s). Ensure your capital is split across distinct industries (e.g. not having 100% in IT or Banking).
- **Position Sizing:** Check that your largest single position does not exceed 25-30% of your total net worth.`
}

What specific rebalancing move would you like to run by me?`;
    }

    // 8. Risk Management / Stop Loss / Drawdown
    else if (
      lastUserMessage.includes('risk') ||
      lastUserMessage.includes('stop loss') ||
      lastUserMessage.includes('loss') ||
      lastUserMessage.includes('drawdown') ||
      lastUserMessage.includes('protect')
    ) {
      mentorResponse = `🛡️ **Professional Risk Management Principles:**

In institutional trading, longevity and risk control precede profitability:

1. **The Ruin Barrier:** A trader who loses 50% on a bad trade must generate a **100% return** just to break even. Cutting losses quickly is the most valuable discipline you can develop.
2. **Mental Stop-Loss Execution:** Before hitting "Buy", define your exit price:
   - *Example:* If you enter RELIANCE at ₹2,940, decide whether your threshold is -4% (₹2,822). If that price is reached, exit without emotional hesitation.
3. **Correlation Risk:** Buying 3 different IT stocks (TCS, INFY, Wipro) is not diversification—if the Nasdaq drops or US client budgets freeze, all three drop simultaneously. True diversification pairs tech with utilities, pharmaceuticals, or consumer staples.`;
    }

    // 9. Default Conversational Fallback (Insightful, dynamic, not generic static bullets)
    else {
      mentorResponse = `🎓 **Dalal Street Market Briefing:**

You're analyzing the trading pit during an active round. Here is the latest status across the floor:

- **Current Market Catalyst:** ${latestEvent}
- **Your Liquidity:** ${userCash} in available cash to execute trades.
- **Watchlist Highlights:**
  - Energy & Conglomerate: RELIANCE trading at ₹${stocks.find(s => s.ticker === 'RELIANCE')?.current_price.toFixed(2) || '2,940'}
  - IT Bellwether: TCS trading at ₹${stocks.find(s => s.ticker === 'TCS')?.current_price.toFixed(2) || '4,180'}
  - Private Banking: HDFCBANK trading at ₹${stocks.find(s => s.ticker === 'HDFCBANK')?.current_price.toFixed(2) || '1,650'}

**Where should we focus next?**
- Inquire about an asset: *"Explain TCS valuation"* or *"Analyze TATAMOTORS"*
- Explore macro policy: *"How does an RBI rate hike impact banks?"*
- Refine strategy: *"How should I manage my cash balance?"*`;
    }

    return NextResponse.json({ reply: mentorResponse });
  } catch (err: any) {
    console.error('AI Mentor Error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
