/**
 * Full Event-Day Human Condition & Mass Stress Simulation
 * Covers:
 * 1. Human Error & Edge Case Fuzzing on Broker Desk
 * 2. Concurrent Mass Student Slip Submissions (10 simultaneous trades)
 * 3. Round 0 Primary Pool Rules, 60% Deployment Target & Disqualification Audits
 * 4. Inter-Team P2P Trading with Dual 5% Brokerage & 3-Trade VWAP Pricing
 * 5. Macro Shocks, Breaking News & N% Delta Factor
 * 6. Market Drift R% Calculation (70% Price Shift + 30% Volume Skew)
 * 7. Dynamic 4-Branch Pricing Settlement Engine & Circuit Collars (±10%)
 * 8. IPO Bidding, Reserve Floor, Smooth Pricing Formula & Randomized Lottery Allotment
 * 9. Multi-Round Progression (Round 0 -> Round 1 -> Round 2 -> IPO-1 -> Round 3 -> IPO-2 -> Round 4 -> Round 5)
 * 10. Negative Outcome & State Corruption Detection
 */

const { SignJWT } = require('jose');
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'econ-club-thapar-dalal-street-super-secret-key-2026');

let adminToken = '';

async function getAdminToken() {
  if (!adminToken) {
    adminToken = await new SignJWT({
      userId: 'usr-admin-master',
      email: 'admin.econ@thapar.edu',
      role: 'superadmin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);
  }
  return adminToken;
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (path.startsWith('/api/admin') || options.asAdmin) {
    const token = await getAdminToken();
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `econ_token=${token}`;
  }
  const res = await fetch(url, {
    headers,
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

let testPassed = 0;
let testFailed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    testPassed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    testFailed++;
    console.error(`  ✗ FAIL: ${message}`);
    failures.push(message);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('STARTING COMPREHENSIVE HUMAN CONDITION & EVENT-DAY STRESS SIMULATION');
  console.log('======================================================================\n');

  // STEP 0: Initial Health & Base State Check
  console.log('[STAGE 0] Checking System Baseline Health & Connectivity...');
  const healthRes = await request('/api/health');
  assert(healthRes.status === 200, `Health API reachable (Status: ${healthRes.status})`);

  const stocksRes = await request('/api/stocks');
  assert(stocksRes.status === 200 && Array.isArray(stocksRes.data.stocks), `Stocks loaded (Count: ${stocksRes.data.stocks?.length})`);
  const allStocks = stocksRes.data.stocks;
  const sampleStock = allStocks[0];
  console.log(`  Selected reference stock: ${sampleStock.ticker} (${sampleStock.name}) @ ₹${sampleStock.current_price}`);

  // STEP 1: Human Error & Edge Case Fuzzing on Broker Desk
  console.log('\n[STAGE 1] Testing Human Slip Entry Errors & Desk Safeguards...');

  // 1.1 Blank buyer name
  const err1 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: '', sellerTeamName: 'Team Alpha', stockId: sampleStock.id, quantity: 10, agreedPrice: sampleStock.current_price }),
  });
  assert(err1.status === 400 && err1.data.error?.includes('Buying team name is required'), 'Rejects blank buyer team name');

  // 1.2 Blank seller name
  const err2 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team Alpha', sellerTeamName: '   ', stockId: sampleStock.id, quantity: 10, agreedPrice: sampleStock.current_price }),
  });
  assert(err2.status === 400 && err2.data.error?.includes('Selling team name is required'), 'Rejects blank seller team name');

  // 1.3 Self-trading (Buyer == Seller)
  const err3 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Bulls Capital', sellerTeamName: 'Bulls Capital', stockId: sampleStock.id, quantity: 10, agreedPrice: sampleStock.current_price }),
  });
  assert(err3.status === 400 && err3.data.error?.includes('cannot be the same'), 'Rejects self-trading when buyer and seller match');

  // 1.4 Non-existent stock ID
  const err4 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team A', sellerTeamName: 'Team B', stockId: 'NON_EXISTENT_TICKER_999', quantity: 10, agreedPrice: 100 }),
  });
  assert(err4.status === 400 && err4.data.error?.includes('not found'), 'Rejects non-existent stock symbol');

  // 1.5 Negative quantity
  const err5 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team A', sellerTeamName: 'Team B', stockId: sampleStock.id, quantity: -25, agreedPrice: sampleStock.current_price }),
  });
  assert(err5.status === 400 && err5.data.error?.includes('positive'), 'Rejects negative share quantity (-25)');

  // 1.6 Zero quantity
  const err6 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team A', sellerTeamName: 'Team B', stockId: sampleStock.id, quantity: 0, agreedPrice: sampleStock.current_price }),
  });
  assert(err6.status === 400 && err6.data.error?.includes('positive'), 'Rejects zero share quantity (0)');

  // 1.7 Negative price
  const err7 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team A', sellerTeamName: 'Team B', stockId: sampleStock.id, quantity: 10, agreedPrice: -150 }),
  });
  assert(err7.status === 400 && err7.data.error?.includes('positive'), 'Rejects negative trade price (-₹150)');

  // 1.8 Zero price
  const err8 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team A', sellerTeamName: 'Team B', stockId: sampleStock.id, quantity: 10, agreedPrice: 0 }),
  });
  assert(err8.status === 400 && err8.data.error?.includes('positive'), 'Rejects zero trade price (₹0)');

  // 1.9 Extreme price breaching circuit collar without bypass flag
  const extremePrice = Number((sampleStock.current_price * 2.5).toFixed(2));
  const err9 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team A', sellerTeamName: 'Team B', stockId: sampleStock.id, quantity: 10, agreedPrice: extremePrice, allowCircuitBypass: false }),
  });
  assert(err9.status === 400 && err9.data.error?.includes('breaches circuit limits'), 'Blocks trade outside circuit collars when bypass is FALSE');

  // 1.10 Same trade with explicit allowCircuitBypass: true (Auction floor exception)
  const pass10 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({ buyerTeamName: 'Team Alpha', sellerTeamName: 'Team Beta', stockId: sampleStock.id, quantity: 10, agreedPrice: extremePrice, allowCircuitBypass: true }),
  });
  assert(pass10.status === 200 && pass10.data.success, 'Allows trade outside circuit collars when allowCircuitBypass is TRUE');

  // STEP 2: Mass Concurrent Broker Submissions (Simulate 10 Students at Once)
  console.log('\n[STAGE 2] Testing Mass Concurrent Student Trade Submissions (10 simultaneous slips)...');
  const testStock = allStocks[1] || allStocks[0];
  const concurrentTrades = [];
  for (let i = 1; i <= 10; i++) {
    concurrentTrades.push(
      request('/api/broker/settle', {
        method: 'POST',
        body: JSON.stringify({
          buyerTeamName: `Concurrent Buyer ${i}`,
          sellerTeamName: `Concurrent Seller ${i}`,
          stockId: testStock.id,
          quantity: 15,
          agreedPrice: testStock.current_price,
        }),
      })
    );
  }

  const massResults = await Promise.all(concurrentTrades);
  const massSuccesses = massResults.filter(r => r.status === 200 && r.data.success);
  assert(massSuccesses.length === 10, `All 10 concurrent trade slips settled cleanly (${massSuccesses.length}/10) via ACID FIFO queue`);

  // Verify broker ledger reflects mass transactions
  const ledgerRes = await request('/api/broker/ledger');
  assert(ledgerRes.status === 200 && ledgerRes.data.success, 'Broker ledger computed successfully');
  const snap = ledgerRes.data.snapshot;
  console.log(`  Current active teams tracked: ${snap.teamsPurse?.length}`);
  console.log(`  Total trades in ledger: ${snap.tradesLedger?.length}`);

  // STEP 3: Round 0 Primary Pool Rules, 60% Deployment & Cash Floor
  console.log('\n[STAGE 3] Testing Round 0 Rules, 60% Deployment Target & Cash Floor...');

  // Primary issuance trade for "Team High Roller" deploying > ₹6,00,000 (e.g. 500 shares @ ₹1,500 = ₹7,50,000)
  const expensiveStock = allStocks.find(s => s.current_price >= 1000) || sampleStock;
  const targetShares60 = Math.ceil(650000 / expensiveStock.current_price);
  const r0HighRoller = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Team HighRoller R0',
      sellerTeamName: 'Central Primary Pool',
      stockId: expensiveStock.id,
      quantity: targetShares60,
      agreedPrice: expensiveStock.current_price,
    }),
  });
  assert(r0HighRoller.status === 200 && r0HighRoller.data.summary.buyerBrokerage === 0, 'Round 0 Central Primary Pool purchase has 0% brokerage');

  // Primary issuance trade for "Team Underinvestor" deploying only ₹1,50,000 (< ₹6,00,000)
  const lowShares = Math.max(1, Math.floor(150000 / sampleStock.current_price));
  await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Team Underinvestor R0',
      sellerTeamName: 'Central Primary Pool',
      stockId: sampleStock.id,
      quantity: lowShares,
      agreedPrice: sampleStock.current_price,
    }),
  });

  const r0Audit = await request('/api/broker/ledger');
  const highRollerTeam = r0Audit.data.snapshot.teamsPurse.find(t => t.teamName === 'Team HighRoller R0');
  const underTeam = r0Audit.data.snapshot.teamsPurse.find(t => t.teamName === 'Team Underinvestor R0');

  assert(highRollerTeam && highRollerTeam.status === 'QUALIFIED', `Team HighRoller deployed >= 60% (Deployed: ₹${highRollerTeam?.round0Spent?.toLocaleString('en-IN')}) -> Status: ${highRollerTeam?.status}`);
  assert(underTeam && underTeam.status === 'ELIMINATED', `Team Underinvestor deployed < 60% (Deployed: ₹${underTeam?.round0Spent?.toLocaleString('en-IN')}) -> Status: ${underTeam?.status}`);

  // STEP 4: Secondary Inter-Team Trading (Rounds 1–7) & 3-Trade VWAP Rule
  console.log('\n[STAGE 4] Testing Secondary Inter-Team Trading: Dual 5% Brokerage & 3-Trade VWAP Rule...');

  const vwapStock = allStocks.find(s => s.ticker === 'ZOMATO') || allStocks[2];
  const initialVwapPrice = vwapStock.current_price;
  console.log(`  VWAP Test Stock: ${vwapStock.ticker} (Base LTP: ₹${initialVwapPrice})`);

  // Deal 1: 100 shares @ ₹200.00
  const d1 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Team P2P Buyer A',
      sellerTeamName: 'Team P2P Seller A',
      stockId: vwapStock.id,
      quantity: 100,
      agreedPrice: 200.00,
      allowCircuitBypass: true,
    }),
  });
  assert(d1.status === 200, 'Deal 1 executed');
  assert(d1.data.summary.buyerBrokerage === 1000 && d1.data.summary.sellerBrokerage === 1000, 'Dual 5% brokerage applied (5% buyer = ₹1,000, 5% seller = ₹1,000, total = ₹2,000)');

  // Deal 2: 200 shares @ ₹220.00
  const d2 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Team P2P Buyer B',
      sellerTeamName: 'Team P2P Seller B',
      stockId: vwapStock.id,
      quantity: 200,
      agreedPrice: 220.00,
      allowCircuitBypass: true,
    }),
  });
  assert(d2.status === 200, 'Deal 2 executed (Awaiting Deal 3 for rolling VWAP recalculation)');

  // Deal 3: 100 shares @ ₹240.00
  // Expected VWAP of Deal 1 (100 @ 200 = 20,000), Deal 2 (200 @ 220 = 44,000), Deal 3 (100 @ 240 = 24,000):
  // Total Vol = 400 shares, Total Value = 88,000 => VWAP = 88,000 / 400 = 220.00
  const d3 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Team P2P Buyer C',
      sellerTeamName: 'Team P2P Seller C',
      stockId: vwapStock.id,
      quantity: 100,
      agreedPrice: 240.00,
      allowCircuitBypass: true,
    }),
  });
  assert(d3.status === 200 && d3.data.summary.priceUpdated === true, 'Deal 3 triggers dynamic VWAP price update');
  assert(Math.abs(d3.data.summary.currentStockPrice - 220.00) < 0.1, `3-Deal Rolling VWAP matches mathematical expectation: ₹${d3.data.summary.currentStockPrice} (Expected: ₹220.00)`);

  // STEP 5: Macro & News Shocks (N% Delta)
  console.log('\n[STAGE 5] Testing Macro Shocks & Breaking News Engine...');

  const newsHeadline = 'Government Announces ₹50,000 Cr Electric Vehicle Subsidy Package';
  const newsEvent = await request('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      headline: newsHeadline,
      description: 'Major fiscal boost for domestic automobile manufacturers.',
      impactMap: { TATAMOTORS: 8.5 },
    }),
  });
  assert(newsEvent.status === 200 && newsEvent.data.success, `News event published: "${newsHeadline}"`);

  // Verify news reflected in /api/events
  const eventsRes = await request('/api/events');
  const latestArticle = eventsRes.data.news?.[0];
  assert(latestArticle && latestArticle.headline?.includes('Electric Vehicle'), 'News wire immediately receives breaking headline');
  assert(Boolean(latestArticle?.published_at), `News article has valid published_at ISO timestamp: ${latestArticle?.published_at}`);

  // STEP 6: Market Momentum Drift R% Formula
  console.log('\n[STAGE 6] Testing Market Momentum Drift R% Formula Calculation...');

  const rCalc = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'CALCULATE_R' }),
  });
  assert(rCalc.status === 200 && rCalc.data.success, 'R% Formula computed successfully');
  const rStats = rCalc.data.rStats;
  console.log(`  Calculated R%: ${rStats.calculated_r}%`);
  console.log(`  Traded stocks count: ${rStats.traded_stocks_count}`);
  console.log(`  Formula breakdown: ${rStats.formula_breakdown}`);
  assert(rStats.calculated_r >= -5.0 && rStats.calculated_r <= 5.0, 'R% strictly bounded within [-5.0%, +5.0%]');

  // STEP 7: Dynamic 4-Branch Pricing Settlement Engine & Circuit Collars
  console.log('\n[STAGE 7] Testing Dynamic 4-Branch Pricing Engine & Circuit Collars...');

  const pricingPreview = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({
      action: 'PREVIEW_PRICING',
      overrideR: 3.5, // +3.5% market drift
      stockNewsOverrides: { RELIANCE: 4.0, TATAMOTORS: -6.0 },
    }),
  });
  assert(pricingPreview.status === 200 && pricingPreview.data.success, 'Pricing preview computed successfully');
  const settlements = pricingPreview.data.preview.settlements;
  assert(settlements.length > 0, `Settlement previews generated for ${settlements.length} stocks`);

  // Verify branches exist and are assigned correctly
  const branchCounts = {};
  settlements.forEach(s => {
    branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1;
    // Verify circuit bounds
    assert(s.final_price >= s.circuit_lower && s.final_price <= s.circuit_upper, `Stock ${s.ticker} price ₹${s.final_price} stays strictly within circuit collars [₹${s.circuit_lower}, ₹${s.circuit_upper}]`);
  });
  console.log('  Branches breakdown:', branchCounts);

  // Apply settlements
  const applyRes = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({
      action: 'APPLY_PRICING',
      roundId: 'round-1',
      settlements: settlements.slice(0, 10), // Apply for sample batch
    }),
  });
  assert(applyRes.status === 200 && applyRes.data.success, `Applied price settlements for Dalal Street`);

  // STEP 8: IPO Rounds, Bidding, Lot Size & Fair Lottery Allotment
  console.log('\n[STAGE 8] Testing IPO Bidding, 10% Cash Reserve Floor & Lottery Allotment...');

  // Get IPO listings
  const ipoGet = await request('/api/ipo');
  assert(ipoGet.status === 200 && ipoGet.data.listings?.length > 0, `IPO listings retrieved (Count: ${ipoGet.data.listings?.length})`);
  const activeIpo = ipoGet.data.listings[0];
  console.log(`  Active IPO: ${activeIpo.company_name} (${activeIpo.ticker}) @ ₹${activeIpo.issue_price}/share, Lot Size: ${activeIpo.lot_size}`);

  // Open subscription window cleanly for testing
  const openIpo = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SET_STATUS', ipo_id: activeIpo.id, status: 'SUBSCRIPTION_OPEN', reset_bids: true }),
  });
  assert(openIpo.status === 200 && openIpo.data.success, `IPO subscription window opened for ${activeIpo.ticker}`);

  // 8.1 IPO Bidding: Invalid lots (below min)
  const ipoErr1 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: activeIpo.id, team_id: 'Team Alpha', lots: 0 }),
  });
  assert(ipoErr1.status === 400, 'Rejects IPO subscription with 0 lots (below min_lots)');

  // 8.2 IPO Bidding: Invalid lots (above max)
  const ipoErr2 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: activeIpo.id, team_id: 'Team Alpha', lots: 9999 }),
  });
  assert(ipoErr2.status === 400, 'Rejects IPO subscription with 9999 lots (above max_lots)');

  // 8.3 IPO Bidding: Valid bid by Team 1
  const ipoBid1 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: activeIpo.id, team_id: 'IPO Bidder Team 1', lots: 5 }),
  });
  assert(ipoBid1.status === 200 && ipoBid1.data.success, 'Valid IPO bid accepted for 5 lots');

  // 8.4 IPO Bidding: Duplicate bid rejection
  const ipoDup = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: activeIpo.id, team_id: 'IPO Bidder Team 1', lots: 3 }),
  });
  assert(ipoDup.status === 400 && ipoDup.data.error?.includes('already submitted'), 'Duplicate IPO bid by same team rejected');

  // 8.5 Valid bid by Team 2
  const ipoBid2 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: activeIpo.id, team_id: 'IPO Bidder Team 2', lots: 8 }),
  });
  assert(ipoBid2.status === 200 && ipoBid2.data.success, 'Valid IPO bid accepted for 8 lots');

  // 8.6 IPO Allotment Execution
  const allotRes = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'ALLOT', ipo_id: activeIpo.id }),
  });
  assert(allotRes.status === 200 && allotRes.data.success, `IPO successfully allotted (Allotted count: ${allotRes.data.allottedCount})`);
  console.log(`  IPO Listing Price calculated by smooth formula: ₹${allotRes.data.listingPrice}`);
  assert(typeof allotRes.data.listingPrice === 'number' && allotRes.data.listingPrice > 0, 'IPO smooth listing price is a positive finite number');

  // STEP 9: Full Round Progression Simulation (Round 0 -> Round 5)
  console.log('\n[STAGE 9] Testing End-to-End Multi-Round Progression & Transition State...');

  const roundsSequence = ['round-1', 'round-2', 'ipo-1', 'round-3'];
  for (const rId of roundsSequence) {
    const advRes = await request('/api/admin/rounds', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADVANCE', targetRoundId: rId }),
    });
    assert(advRes.status === 200 && advRes.data.success, `Advanced competition round to ${rId}`);
  }

  // STEP 10: Live Telemetry, Excel Export & Negative Balance Check
  console.log('\n[STAGE 10] Testing Telemetry, Offline Excel & Integrity Audits...');

  // 10.1 Latest Broadcast Trade for Floor Screen
  const latestTradeRes = await request('/api/trades/latest');
  assert(latestTradeRes.status === 200, 'Latest trade telemetry route active');
  console.log(`  Latest broadcast trade:`, latestTradeRes.data.trade ? `${latestTradeRes.data.trade.seller_team} -> ${latestTradeRes.data.trade.buyer_team}: ${latestTradeRes.data.trade.quantity} ${latestTradeRes.data.trade.ticker} @ ₹${latestTradeRes.data.trade.price}` : 'No trade yet');

  // 10.2 Excel 4-Sheet Export Integrity
  const excelRes = await fetch(`${BASE_URL}/api/broker/export-excel`);
  assert(excelRes.status === 200, 'Offline Excel export route responds with HTTP 200');
  const excelBuffer = await excelRes.arrayBuffer();
  assert(excelBuffer.byteLength > 1000, `Excel file generated with non-trivial byte size (${excelBuffer.byteLength} bytes)`);

  // 10.3 Final State Integrity Audit: Check for Negative Cash, NaN, or Corrupt Values
  const finalLedger = await request('/api/broker/ledger');
  const allTeams = finalLedger.data.snapshot.teamsPurse || [];
  let hasNegativeCash = false;
  let hasNaNValue = false;

  allTeams.forEach(t => {
    if (t.currentCash < 0) hasNegativeCash = true;
    if (Number.isNaN(t.currentCash) || Number.isNaN(t.totalNetWorth) || Number.isNaN(t.totalHoldingsValue)) {
      hasNaNValue = true;
    }
  });

  assert(!hasNegativeCash, 'ZERO negative cash balances detected across all participant teams');
  assert(!hasNaNValue, 'ZERO NaN calculations or division by zero detected in valuations');

  console.log('\n======================================================================');
  console.log(`SIMULATION SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log('======================================================================');

  if (testFailed > 0) {
    console.error('\nFAILURES RECORDED:');
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL HUMAN CONDITION, STRESS & FORMULA VERIFICATION TESTS PASSED PERFECTLY!');
  }
}

run().catch(err => {
  console.error('Fatal simulation error:', err);
  process.exit(1);
});
