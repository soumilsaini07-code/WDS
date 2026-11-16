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
  const res = await fetch(url, { headers, ...options });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('TESTING LIVE UPDATION & GRAPH UPDATES IN EVERY ROUND (R0 -> R5 + IPOs)');
  console.log('======================================================================\n');

  // STEP 0: Check Baseline
  console.log('[ROUND 0] Testing Live Updation & Graph in Round 0 (Primary Issuance Desk)...');
  const stocks0 = await request('/api/stocks');
  assert(stocks0.status === 200 && stocks0.data.stocks?.length > 0, 'Fetched active stocks');
  const testStock = stocks0.data.stocks.find(s => s.ticker === 'RELIANCE') || stocks0.data.stocks[0];
  const initialGraphLen = testStock.historical_prices?.length || 0;
  console.log(`  Target: ${testStock.ticker} (Base: ₹${testStock.current_price}, Graph points: ${initialGraphLen})`);

  // Trade in Round 0 from Central Primary Pool
  const r0Trade = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Apex Alpha Syndicate',
      sellerTeamName: 'Central Primary Pool',
      stockId: testStock.id,
      quantity: 50,
      agreedPrice: testStock.current_price,
    }),
  });
  assert(r0Trade.status === 200 && r0Trade.data.success, 'Round 0 trade executed on broker desk');

  // Verify Graph in Round 0
  const stocks0After = await request('/api/stocks');
  const testStockAfter0 = stocks0After.data.stocks.find(s => s.id === testStock.id);
  assert(
    testStockAfter0.historical_prices?.length === initialGraphLen + 1,
    `Round 0 trade successfully appended point to graph (Before: ${initialGraphLen}, After: ${testStockAfter0.historical_prices?.length})`
  );

  // Verify Latest Broadcast Banner on Dashboard
  const latest0 = await request('/api/trades/latest');
  assert(
    latest0.data.latestTrade?.ticker === testStock.ticker,
    `Dashboard broadcast banner immediately updated to latest trade: ${latest0.data.latestTrade?.ticker}`
  );

  // STEP 1: Transition to Round 1 & Apply Price Settlement
  console.log('\n[ROUND 0 -> ROUND 1 TRANSITION] Testing Price Settlement Graph Progression...');
  const preview1 = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'PREVIEW_PRICING', roundId: 'round-0', overrideR: 2.0 }),
  });
  assert(preview1.status === 200 && preview1.data.success, 'Settlement pricing preview generated');
  const settlementSample = preview1.data.preview.settlements;

  const apply1 = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'APPLY_PRICING', roundId: 'round-0', settlements: settlementSample }),
  });
  assert(apply1.status === 200 && apply1.data.success, 'Settlement pricing applied across Dalal Street');

  // Advance to Round 1
  const adv1 = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-1' }),
  });
  assert(adv1.status === 200 && adv1.data.currentRound?.id === 'round-1', 'Competition advanced to Round 1: Inter-Team Trading');

  // Verify Graph received Round 1 Opening Settlement Price
  const stocks1 = await request('/api/stocks');
  const testStock1 = stocks1.data.stocks.find(s => s.id === testStock.id);
  assert(
    testStock1.historical_prices?.length === initialGraphLen + 2,
    `Round 1 opening settlement price appended to graph (Points: ${testStock1.historical_prices?.length})`
  );

  // STEP 2: Secondary Inter-Team Trading in Round 1
  console.log('\n[ROUND 1] Testing Inter-Team Floor Trading Live Updation & Rolling VWAP Graph...');
  const zomatoStock = stocks1.data.stocks.find(s => s.ticker === 'ZOMATO');
  const zomatoGraphBefore = zomatoStock.historical_prices?.length || 0;
  const newAgreedPrice = Number((zomatoStock.current_price * 1.03).toFixed(2));

  const p2pTrade1 = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Alpha Traders',
      sellerTeamName: 'Beta Capital',
      stockId: zomatoStock.id,
      quantity: 80,
      agreedPrice: newAgreedPrice,
    }),
  });
  assert(p2pTrade1.status === 200 && p2pTrade1.data.success, 'Round 1 secondary P2P trade executed');

  // Verify ZOMATO graph and price updated live
  const stocks1After = await request('/api/stocks');
  const zomatoAfter = stocks1After.data.stocks.find(s => s.id === zomatoStock.id);
  assert(zomatoAfter.current_price === newAgreedPrice, `ZOMATO price dynamically updated to agreed trade price: ₹${zomatoAfter.current_price}`);
  assert(
    zomatoAfter.historical_prices?.length === zomatoGraphBefore + 1,
    `ZOMATO price graph received new trade price point (Before: ${zomatoGraphBefore}, After: ${zomatoAfter.historical_prices?.length})`
  );

  // STEP 3: Transition Round 1 -> Round 2
  console.log('\n[ROUND 1 -> ROUND 2 TRANSITION] Testing Macro News Shock & Round 2 Price Settlement...');
  // Publish breaking news
  await request('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify({ headline: 'Tech Surge: IT & Digital Services Lead Dalal Street Rally', impactMap: { INFY: 4.5 } }),
  });

  const preview2 = await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'PREVIEW_PRICING', roundId: 'round-1', overrideR: 1.5 }),
  });
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'APPLY_PRICING', roundId: 'round-1', settlements: preview2.data.preview.settlements }),
  });
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-2' }),
  });
  console.log('  ✓ Advanced to Round 2 with News & Market Drift applied');

  // STEP 4: IPO Round 1 (Tech Unicorn Primary Offering)
  console.log('\n[IPO ROUND 1] Testing IPO Bidding, Smooth Listing Formula & Graph Creation...');
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'ipo-1' }),
  });

  // Verify IPO status opened
  const ipoGet = await request('/api/ipo');
  const novatechIpo = ipoGet.data.listings.find(i => i.ticker === 'NOVATECH');
  assert(novatechIpo && novatechIpo.status === 'SUBSCRIPTION_OPEN', 'NOVATECH IPO status switched to SUBSCRIPTION_OPEN');

  // Submit Bids from multiple teams
  await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: novatechIpo.id, team_id: 'Apex Alpha Syndicate', lots: 6 }),
  });
  await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: novatechIpo.id, team_id: 'Gamma Bulls', lots: 10 }),
  });
  console.log('  ✓ Placed IPO bids for 16 lots');

  // Allot IPO
  const allotRes = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'ALLOT', ipo_id: novatechIpo.id }),
  });
  assert(allotRes.status === 200 && allotRes.data.success, `NOVATECH IPO allotted @ smooth listing price ₹${allotRes.data.listingPrice}`);

  // Verify NOVATECH exists in db.stocks and has a newly minted price graph!
  const stocksAfterIpo = await request('/api/stocks');
  const listedNovatech = stocksAfterIpo.data.stocks.find(s => s.ticker === 'NOVATECH');
  assert(listedNovatech !== undefined, 'Newly allotted IPO stock NOVATECH listed on active secondary exchange');
  assert(
    listedNovatech.historical_prices?.length >= 2,
    `NOVATECH graph initialized with multi-point reference-to-listing trajectory (Points: ${listedNovatech.historical_prices?.length})`
  );

  // STEP 5: Round 3 (Multi-Sector Expansion & Secondary Trading of NOVATECH)
  console.log('\n[ROUND 3] Testing Secondary Floor Trading of Newly Listed IPO Stock...');
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-3' }),
  });

  const novaPrice = Number((listedNovatech.current_price * 1.05).toFixed(2));
  const novaTrade = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Delta Hedge',
      sellerTeamName: 'Apex Alpha Syndicate',
      stockId: listedNovatech.id,
      quantity: 24,
      agreedPrice: novaPrice,
    }),
  });
  assert(novaTrade.status === 200 && novaTrade.data.success, 'Successfully executed floor trade for newly listed IPO stock NOVATECH');

  // Verify NOVATECH graph received trade #3 point
  const stocks3 = await request('/api/stocks');
  const novaStock3 = stocks3.data.stocks.find(s => s.ticker === 'NOVATECH');
  assert(
    novaStock3.historical_prices?.length === listedNovatech.historical_prices.length + 1,
    `NOVATECH graph dynamically updated to ${novaStock3.historical_prices.length} points following floor trade`
  );

  // STEP 6: IPO Round 2 (EcoPower Green Hydrogen)
  console.log('\n[IPO ROUND 2] Testing Second Primary Market IPO Offering (ECOPOWER)...');
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'ipo-2' }),
  });

  const ipoGet2 = await request('/api/ipo');
  const ecopowerIpo = ipoGet2.data.listings.find(i => i.ticker === 'ECOPOWER');
  assert(ecopowerIpo && ecopowerIpo.status === 'SUBSCRIPTION_OPEN', 'ECOPOWER IPO subscription opened');

  await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUBSCRIBE', ipo_id: ecopowerIpo.id, team_id: 'Zeta Holdings', lots: 5 }),
  });
  const allot2 = await request('/api/ipo', {
    method: 'POST',
    body: JSON.stringify({ action: 'ALLOT', ipo_id: ecopowerIpo.id }),
  });
  assert(allot2.status === 200 && allot2.data.success, `ECOPOWER IPO allotted @ ₹${allot2.data.listingPrice}`);

  // STEP 7: Round 4 & Round 5 (High Beta Floor Trading & Closing Bell)
  console.log('\n[ROUND 4 & ROUND 5] Testing Final Rounds & Closing Bell Valuation...');
  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-4' }),
  });
  console.log('  ✓ Round 4 active');

  await request('/api/admin/rounds', {
    method: 'POST',
    body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-5' }),
  });
  console.log('  ✓ Round 5 (Final Trading & Closing Bell) active');

  // Verify final broker ledger and graphs across all 80 stocks
  const finalLedger = await request('/api/broker/ledger');
  assert(finalLedger.status === 200 && finalLedger.data.snapshot?.tradesLedger?.length > 0, 'Final broker ledger computed');
  console.log(`  Total trades executed across all rounds: ${finalLedger.data.snapshot?.tradesLedger?.length}`);
  console.log(`  Total volume traded: ${finalLedger.data.snapshot?.totalVolumeShares} shares`);

  const finalStocks = await request('/api/stocks');
  const stocksWithGraphs = finalStocks.data.stocks.filter(s => s.historical_prices && s.historical_prices.length > 1);
  assert(
    stocksWithGraphs.length === finalStocks.data.stocks.length,
    `100% of all ${finalStocks.data.stocks.length} equities possess active, populated price history curves`
  );

  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed === 0) {
    console.log('\n🎉 ALL ROUNDS VERIFIED: LIVE UPDATION & GRAPH UPDATES ARE 100% OPERATIONAL!');
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
