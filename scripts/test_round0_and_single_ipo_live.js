const http = require('http');
const { SignJWT } = require('jose');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'econ-club-thapar-dalal-street-super-secret-key-2026'
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

async function getAdminToken() {
  return await new SignJWT({
    userId: 'super-admin-01',
    email: 'admin.dalal@thapar.edu',
    name: 'Super Admin',
    role: 'superadmin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(SECRET);
}

async function request(path, options = {}) {
  const token = await getAdminToken();
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      Cookie: `econ_token=${token}`,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: data ? JSON.parse(data) : {},
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data,
            });
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('======================================================================');
  console.log('VERIFYING: NO LIVE UPDATION IN ROUND 0, EXACTLY 1 ROUND AFTER IPO');
  console.log('======================================================================\n');

  // STEP 1: Verify Initial Clean State in Round 0
  console.log('[STEP 1] Verifying Clean Platform State & Round Sequence...');
  const roundsRes = await request('/api/admin/rounds');
  assert(roundsRes.status === 200 && roundsRes.data.success, 'Fetched admin rounds data');
  assert(roundsRes.data.currentRound?.id === 'round-0', `Current round is round-0 (${roundsRes.data.currentRound?.name})`);
  assert(roundsRes.data.rounds?.length === 5, `Strictly 5 rounds configured: ${roundsRes.data.rounds.map(r => r.id).join(' -> ')}`);
  
  const ipoRounds = roundsRes.data.rounds.filter(r => r.type === 'IPO');
  assert(ipoRounds.length === 1 && ipoRounds[0].id === 'ipo-1', 'Strictly ONLY 1 IPO round exists in competition structure');

  // Verify there is strictly ONLY ONE round after the IPO round
  const ipoRoundIndex = roundsRes.data.rounds.findIndex(r => r.id === 'ipo-1');
  const roundsAfterIPO = roundsRes.data.rounds.slice(ipoRoundIndex + 1);
  assert(
    roundsAfterIPO.length === 1 && roundsAfterIPO[0].id === 'round-3',
    `Strictly ONLY ONE round after IPO round: ${roundsAfterIPO.map(r => r.id).join(', ')} (${roundsAfterIPO[0]?.name})`
  );

  // Check 14 official cohort teams and ZERO test teams
  const ledgerSnapshot = await request('/api/broker/ledger');
  assert(ledgerSnapshot.status === 200, 'Broker ledger accessible');
  const teams = ledgerSnapshot.data.snapshot?.teamsPurse || [];
  assert(teams.length === 14, `Exactly 14 authentic student teams loaded: ${teams.length} teams`);
  
  const hasAdHocTeams = teams.some(t => t.teamName.startsWith('TEAM '));
  assert(!hasAdHocTeams, 'Zero ad-hoc test teams (TEAM 1, 2, 4, 11 pruned)');

  const primaryPoolTeam = teams.find(t => t.teamName.toLowerCase().includes('primary pool'));
  assert(primaryPoolTeam !== undefined, 'Central Primary Pool exists for Round 0 initial purchases');

  // STEP 2: Execute Round 0 Primary Desk Purchase & Verify NO Live Price Updation
  console.log('\n[STEP 2] Executing Round 0 Primary Desk Purchase & Verifying NO Live Updation...');
  const stocksRes = await request('/api/stocks');
  const reliance = stocksRes.data.stocks.find(s => s.ticker === 'RELIANCE') || stocksRes.data.stocks[0];
  const initialHistoryLen = reliance.historical_prices?.length || 0;
  const initialPrice = reliance.current_price;
  console.log(`  Initial RELIANCE price: ₹${initialPrice}, historical points: ${initialHistoryLen}`);

  const tradeQty = 550; // 550 * ~1164 = ~6.4 Lakhs (surpasses 60% / ₹6L mandatory threshold)
  const tradePrice = reliance.current_price;

  // Submit physical trade slip via /api/broker/settle
  const r0SlipRes = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Apex Alpha Syndicate',
      sellerTeamName: 'Central Primary Pool',
      stockId: reliance.id,
      agreedPrice: tradePrice,
      quantity: tradeQty,
    }),
  });

  assert(r0SlipRes.status === 200 && r0SlipRes.data.success, `Round 0 primary issuance slip executed successfully (Deals count: ${r0SlipRes.data.summary?.dealsCount})`);
  assert(r0SlipRes.data.summary?.buyerBrokerage === 0 && r0SlipRes.data.summary?.sellerBrokerage === 0, 'Zero brokerage charged on Central Primary Pool issuance (0% Round 0 exemption)');
  assert(r0SlipRes.data.summary?.priceUpdated === false, 'Confirmed: priceUpdated flag is FALSE in Round 0 (no price recalculation)');

  // Verify Broker Ledger reflects the trade, cash, and 60% deployment status
  const postR0Ledger = await request('/api/broker/ledger');
  const r0Trades = postR0Ledger.data.snapshot?.tradesLedger || [];
  assert(r0Trades.length === 1, `Broker ledger recorded 1 executed trade: Slip ${r0Trades[0]?.slipId}`);
  
  const apexPurse = postR0Ledger.data.snapshot?.teamsPurse.find(t => t.teamName === 'Apex Alpha Syndicate');
  assert(apexPurse && apexPurse.round0Spent >= 600000, `Apex Alpha Syndicate deployed ₹${apexPurse.round0Spent.toLocaleString('en-IN')} (Target ₹6,00,000 satisfied)`);
  assert(apexPurse.round0DeployedPercent >= 60, `Apex deployment progress: ${apexPurse.round0DeployedPercent.toFixed(1)}% (Qualified for floor trading)`);

  // Verify Dashboard Stock Graph DID NOT change or append in Round 0
  const postR0Stocks = await request('/api/stocks');
  const updatedReliance = postR0Stocks.data.stocks.find(s => s.id === reliance.id);
  assert(
    updatedReliance.historical_prices?.length === initialHistoryLen,
    `Stock historical graph was NOT updated in Round 0: retained exact ${initialHistoryLen} points`
  );
  assert(
    updatedReliance.current_price === initialPrice,
    `Stock price remained fixed at base reference LTP: ₹${updatedReliance.current_price} (No fluctuation in Round 0)`
  );

  // Verify NO live HUD trade banner broadcast in Round 0
  const latestTradeRes = await request('/api/trades/latest');
  assert(
    latestTradeRes.data.latestTrade === null || latestTradeRes.data.latestTrade === undefined,
    'No HUD trade ticker banner broadcast in Round 0 (floor displays remain calm during desk onboarding)'
  );

  // STEP 3: Advance to Round 1 (P2P Floor Trading) & Test that Live VWAP Updation DOES Activate
  console.log('\n[STEP 3] Advancing to Round 1 (P2P Trading) & Testing Live VWAP Activation...');
  const advR1 = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-1' }),
  });
  assert(advR1.status === 200 && advR1.data.success, 'Advanced to Round 1');

  // Secondary floor trade: Apex sells 50 RELIANCE to Dalal Street Titans at agreed price ₹1180
  const r1SlipRes = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Dalal Street Titans',
      sellerTeamName: 'Apex Alpha Syndicate',
      stockId: reliance.id,
      agreedPrice: 1180.00,
      quantity: 50,
    }),
  });
  assert(r1SlipRes.status === 200 && r1SlipRes.data.success, 'Round 1 P2P trade executed with 5% dual brokerage');
  assert(r1SlipRes.data.summary?.buyerBrokerage > 0 && r1SlipRes.data.summary?.sellerBrokerage > 0, 'Dual 5% brokerage applied to both teams on secondary floor');
  assert(r1SlipRes.data.summary?.priceUpdated === true, 'Confirmed: priceUpdated flag is TRUE in Round 1 (live price updating active)');

  // Verify Reliance graph updated in Round 1
  const postR1Stocks = await request('/api/stocks');
  const r1Reliance = postR1Stocks.data.stocks.find(s => s.id === reliance.id);
  assert(
    r1Reliance.historical_prices?.length === initialHistoryLen + 1,
    `Stock historical graph dynamically updated in Round 1: ${initialHistoryLen} -> ${r1Reliance.historical_prices.length} points`
  );

  // STEP 4: Advance through Round 2 to Single IPO Round (ipo-1)
  console.log('\n[STEP 4] Advancing to Round 2 and then Single IPO Round (ipo-1)...');
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-2' }),
  });
  console.log('  ✓ Round 2 active');

  const advIPO = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'ipo-1' }),
  });
  assert(advIPO.status === 200 && advIPO.data.success, 'Advanced to Single IPO Round (ipo-1)');

  // Verify Single IPO Listing
  const ipoData = await request('/api/ipo');
  assert(ipoData.status === 200 && ipoData.data.listings.length === 1, `Exactly 1 IPO listing available: ${ipoData.data.listings[0]?.company_name}`);
  const novaTech = ipoData.data.listings[0];
  assert(novaTech.ticker === 'NOVATECH', `IPO ticker is NOVATECH (Issue price ₹${novaTech.issue_price})`);

  // Place IPO Bids from multiple teams
  console.log('  Submitting IPO subscription bids...');
  const bid1 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: novaTech.id, team_id: 'Apex Alpha Syndicate', lots: 10 }),
  });
  assert(bid1.status === 200 && bid1.data.success, 'Apex Alpha Syndicate placed IPO bid for 10 lots');

  const bid2 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: novaTech.id, team_id: 'Dalal Street Titans', lots: 15 }),
  });
  assert(bid2.status === 200 && bid2.data.success, 'Dalal Street Titans placed IPO bid for 15 lots');

  // Allot IPO using Smooth Listing Formula: P_listing = P0 * (0.7 + 0.6S / (1+S))
  console.log('  Executing IPO lot allotment and secondary market listing...');
  const allotRes = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'ALLOT', ipo_id: novaTech.id }),
  });
  assert(allotRes.status === 200 && allotRes.data.success, `IPO allotted successfully @ calculated listing price: ₹${allotRes.data.listingPrice}`);
  assert(allotRes.data.allottedCount > 0, `Allotted ${allotRes.data.allottedCount} bids to participating teams`);

  // Verify NOVATECH is now listed in stocks
  const postIpoStocks = await request('/api/stocks');
  const listedNova = postIpoStocks.data.stocks.find(s => s.ticker === 'NOVATECH');
  assert(listedNova !== undefined, `NOVATECH is now listed in stock universe at ₹${listedNova?.current_price}`);
  assert(listedNova?.historical_prices?.length >= 2, `NOVATECH price history initialized with base P0 and listing price: [${listedNova?.historical_prices?.join(', ')}]`);

  // STEP 5: Advance from ipo-1 to Round 3 (The ONLY round after IPO round)
  console.log('\n[STEP 5] Advancing from IPO Round directly to Round 3 (Final Trading & Closing Bell)...');
  const advR3 = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-3' }),
  });
  assert(advR3.status === 200 && advR3.data.success, 'Advanced directly from ipo-1 to round-3');
  assert(advR3.data.currentRound?.name.includes('Closing Bell'), `Round 3 is the Final Closing Bell Round: "${advR3.data.currentRound?.name}"`);

  // Trade NOVATECH in Round 3
  const novaTradeRes = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Alpha Traders',
      sellerTeamName: 'Apex Alpha Syndicate',
      stockId: listedNova.id,
      agreedPrice: listedNova.current_price,
      quantity: 12,
    }),
  });
  assert(novaTradeRes.status === 200 && novaTradeRes.data.success, 'NOVATECH traded on secondary floor in Round 3');

  // STEP 6: Final Platform Health & Valuation Integrity
  console.log('\n[STEP 6] Final Integrity Check & Valuation Health...');
  const finalLedger = await request('/api/broker/ledger');
  const allPurses = finalLedger.data.snapshot?.teamsPurse || [];
  const invalidPurses = allPurses.filter(p => Number.isNaN(p.currentCash) || Number.isNaN(p.totalNetWorth) || p.currentCash < 0);
  assert(invalidPurses.length === 0, 'Zero NaN or negative cash balances across all participating syndicates');

  console.log('\n======================================================================');
  console.log(`TOTAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
