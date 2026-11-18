const http = require('http');
const { SignJWT } = require('jose');
const { execSync } = require('child_process');

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
  console.log('TESTING: MARKET MANIPULATION DYNAMIC PRICING ENGINE (N% & R%)');
  console.log('======================================================================\n');

  try {
    // 1. Advance to Round 1 so P2P floor trading can occur
    console.log('[STAGE 1] Setting up Round 1 Floor Trading Environment...');
    const advRes = await request('/api/admin/rounds', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADVANCE', targetRoundId: 'round-1' }),
    });
    assert(advRes.status === 200 && advRes.data.success, 'Successfully advanced to Round 1 (P2P Floor Trading)');

    // Fetch initial stock baseline prices
    const stocksRes = await request('/api/stocks');
    const allStocks = stocksRes.data.stocks;

    const infy = allStocks.find(s => s.ticker === 'INFY');
    const tataPower = allStocks.find(s => s.ticker === 'TATAPOWER');
    const zomato = allStocks.find(s => s.ticker === 'ZOMATO');
    const tcs = allStocks.find(s => s.ticker === 'TCS');
    const hdfc = allStocks.find(s => s.ticker === 'HDFCBANK');
    const sbin = allStocks.find(s => s.ticker === 'SBIN');

    assert(infy && tataPower && zomato && tcs && hdfc && sbin, 'Identified test equities in stock master universe');

    // 2. Execute Floor Trades for Branch 1 & Branch 2
    console.log('\n[STAGE 2] Executing P2P Floor Orders for Branch 1 & Branch 2...');

    // Trade INFY: Apex sells 60 INFY to Titans @ ₹1,190.00 (Agreed floor price)
    const infyTradeRes = await request('/api/broker/settle', {
      method: 'POST',
      body: JSON.stringify({
        buyerTeamName: 'Dalal Street Titans',
        sellerTeamName: 'Apex Alpha Syndicate',
        stockId: infy.id,
        agreedPrice: 1190.00,
        quantity: 60,
      }),
    });
    assert(infyTradeRes.status === 200 && infyTradeRes.data.success, 'Executed INFY floor trade (Deal 1: 60 shares @ ₹1,190.00)');

    // Trade TATAPOWER: 2 trades to test VWAP calculation
    // Deal 1: 100 @ 340
    // Deal 2: 150 @ 350
    // VWAP = (100*340 + 150*350) / 250 = (34000 + 52500) / 250 = 86500 / 250 = 346.00
    const tpTrade1 = await request('/api/broker/settle', {
      method: 'POST',
      body: JSON.stringify({
        buyerTeamName: 'Alpha Traders',
        sellerTeamName: 'Beta Capital',
        stockId: tataPower.id,
        agreedPrice: 340.00,
        quantity: 100,
      }),
    });
    assert(tpTrade1.status === 200 && tpTrade1.data.success, 'Executed TATAPOWER trade 1 (100 shares @ ₹340.00)');

    const tpTrade2 = await request('/api/broker/settle', {
      method: 'POST',
      body: JSON.stringify({
        buyerTeamName: 'Gamma Bulls',
        sellerTeamName: 'Delta Hedge',
        stockId: tataPower.id,
        agreedPrice: 350.00,
        quantity: 150,
      }),
    });
    assert(tpTrade2.status === 200 && tpTrade2.data.success, 'Executed TATAPOWER trade 2 (150 shares @ ₹350.00)');

    // 3. Preview Round Settlement with Specific N% & R% Overrides
    console.log('\n[STAGE 3] Previewing Settlement with Global R% & Specific Stock N% Shocks...');
    const targetGlobalR = 2.50; // +2.50% macro market drift
    const stockNewsOverrides = {
      [tataPower.ticker]: 4.00,   // +4.00% news impact for TATAPOWER
      [zomato.ticker]: -5.00,     // -5.00% negative news shock for ZOMATO
      [hdfc.ticker]: 25.00,       // +25.00% extreme news shock (Should trigger Upper Circuit)
      [sbin.ticker]: -30.00,      // -30.00% extreme news shock (Should trigger Lower Circuit)
    };

    const previewRes = await request('/api/admin/rounds', {
      method: 'POST',
      body: JSON.stringify({
        action: 'PREVIEW_PRICING',
        roundId: 'round-1',
        overrideR: targetGlobalR,
        stockNewsOverrides,
      }),
    });

    assert(previewRes.status === 200 && previewRes.data.success, 'Calculated dynamic pricing preview');
    const settlements = previewRes.data.preview?.settlements || [];
    assert(settlements.length === allStocks.length, `Settlements generated for all ${settlements.length} active stocks`);

    // 4. Verify Branch 1: Orders Only (INFY)
    console.log('\n[STAGE 4] Verifying Branch 1: Orders Only [P_orders × (1 + R%)]...');
    const infySettlement = settlements.find(s => s.stock_id === infy.id);
    assert(infySettlement !== undefined, 'Found INFY settlement entry');
    assert(infySettlement.branch === 'BRANCH_1_ORDERS', `Branch is BRANCH_1_ORDERS (Actual: ${infySettlement.branch})`);
    assert(infySettlement.order_count === 1, `Order count recorded: ${infySettlement.order_count}`);
    assert(infySettlement.orders_baseline_price === 1190.00, `P_orders VWAP matches trade price: ₹${infySettlement.orders_baseline_price}`);
    assert(infySettlement.news_impact_percent === 0, `N% is 0 (Actual: ${infySettlement.news_impact_percent}%)`);
    assert(infySettlement.market_drift_percent === targetGlobalR, `R% matches global drift: ${infySettlement.market_drift_percent}%`);
    
    // Formula check: P_orders * (1 + R/100) = 1190 * 1.025 = 1219.75
    const expectedInfyPrice = Number((1190.00 * (1 + targetGlobalR / 100)).toFixed(2));
    assert(
      infySettlement.calculated_price === expectedInfyPrice,
      `Calculated price strictly matches P_orders × (1 + R%): ₹${infySettlement.calculated_price} (Expected: ₹${expectedInfyPrice})`
    );
    assert(infySettlement.final_price === expectedInfyPrice, `Final price confirmed: ₹${infySettlement.final_price}`);
    assert(infySettlement.is_circuit_breached === false, 'Within circuit collar bounds');

    // 5. Verify Branch 2: Orders + News (TATAPOWER)
    console.log('\n[STAGE 5] Verifying Branch 2: Orders + News [P_orders × (1 + N%) × (1 + R%)]...');
    const tpSettlement = settlements.find(s => s.stock_id === tataPower.id);
    assert(tpSettlement !== undefined, 'Found TATAPOWER settlement entry');
    assert(tpSettlement.branch === 'BRANCH_2_ORDERS_AND_NEWS', `Branch is BRANCH_2_ORDERS_AND_NEWS (Actual: ${tpSettlement.branch})`);
    assert(tpSettlement.order_count === 2, `Recorded both orders: ${tpSettlement.order_count}`);
    
    const expectedTPVwap = 346.00;
    assert(
      Math.abs(tpSettlement.orders_baseline_price - expectedTPVwap) < 0.01,
      `Quantity-weighted VWAP accurately calculated: ₹${tpSettlement.orders_baseline_price} (Expected: ₹${expectedTPVwap})`
    );
    assert(tpSettlement.news_impact_percent === 4.00, `N% matches override: +${tpSettlement.news_impact_percent}%`);
    assert(tpSettlement.market_drift_percent === targetGlobalR, `R% matches global drift: +${tpSettlement.market_drift_percent}%`);

    // Sequential multiplication formula check: 346.00 * 1.04 * 1.025 = 368.836 -> 368.84
    const expectedTPPrice = Number((expectedTPVwap * (1 + 0.04) * (1 + targetGlobalR / 100)).toFixed(2));
    assert(
      tpSettlement.calculated_price === expectedTPPrice,
      `Calculated price matches P_orders × (1 + N%) × (1 + R%): ₹${tpSettlement.calculated_price} (Expected: ₹${expectedTPPrice})`
    );
    assert(tpSettlement.final_price === expectedTPPrice, `Final price confirmed: ₹${tpSettlement.final_price}`);

    // 6. Verify Branch 3: News Only (ZOMATO)
    console.log('\n[STAGE 6] Verifying Branch 3: News Only [P_current × (1 + N%)]...');
    const zomatoSettlement = settlements.find(s => s.stock_id === zomato.id);
    assert(zomatoSettlement !== undefined, 'Found ZOMATO settlement entry');
    assert(zomatoSettlement.branch === 'BRANCH_3_NEWS_ONLY', `Branch is BRANCH_3_NEWS_ONLY (Actual: ${zomatoSettlement.branch})`);
    assert(zomatoSettlement.order_count === 0, 'No floor orders recorded for ZOMATO');
    assert(zomatoSettlement.news_impact_percent === -5.00, `N% matches override: ${zomatoSettlement.news_impact_percent}%`);
    
    // Formula check: P_current * (1 + N/100) = current_price * 0.95 = 343.65 * 0.95 = 326.47
    const expectedZomatoPrice = Number((zomato.current_price * (1 - 0.05)).toFixed(2));
    assert(
      zomatoSettlement.calculated_price === expectedZomatoPrice,
      `Calculated price matches P_current × (1 + N%): ₹${zomatoSettlement.calculated_price} (Expected: ₹${expectedZomatoPrice})`
    );
    assert(zomatoSettlement.final_price === expectedZomatoPrice, `Final price confirmed: ₹${zomatoSettlement.final_price}`);

    // 7. Verify Branch 4: NULL (No Orders, No News) (TCS)
    console.log('\n[STAGE 7] Verifying Branch 4: NULL [P_current × (1 + R%)]...');
    const tcsSettlement = settlements.find(s => s.stock_id === tcs.id);
    assert(tcsSettlement !== undefined, 'Found TCS settlement entry');
    assert(tcsSettlement.branch === 'BRANCH_4_NULL', `Branch is BRANCH_4_NULL (Actual: ${tcsSettlement.branch})`);
    assert(tcsSettlement.order_count === 0, 'No orders for TCS');
    assert(tcsSettlement.news_impact_percent === 0, 'No news for TCS');

    // Formula check: P_current * (1 + R/100) = 2502.60 * 1.025 = 2565.17
    const expectedTcsPrice = Number((tcs.current_price * (1 + targetGlobalR / 100)).toFixed(2));
    assert(
      tcsSettlement.calculated_price === expectedTcsPrice,
      `Calculated price matches P_current × (1 + R%): ₹${tcsSettlement.calculated_price} (Expected: ₹${expectedTcsPrice})`
    );

    // 8. Verify Circuit Breaker Upper Collar Clamp (+25% shock clamped to +10%)
    console.log('\n[STAGE 8] Verifying ±10% Circuit Collar Breaker Enforcement...');
    const hdfcSettlement = settlements.find(s => s.stock_id === hdfc.id);
    const upperCollar = Number((hdfc.current_price * 1.10).toFixed(2));
    assert(hdfcSettlement.is_circuit_breached === true, `Upper circuit breach detected on HDFCBANK (+25% shock)`);
    assert(
      hdfcSettlement.final_price === upperCollar,
      `Final price clamped strictly to Upper Circuit: ₹${hdfcSettlement.final_price} (Clamped from raw calculated ₹${hdfcSettlement.calculated_price})`
    );

    // Lower Collar Clamp (-30% shock clamped to -10%)
    const sbinSettlement = settlements.find(s => s.stock_id === sbin.id);
    const lowerCollar = Number((sbin.current_price * 0.90).toFixed(2));
    assert(sbinSettlement.is_circuit_breached === true, `Lower circuit breach detected on SBIN (-30% shock)`);
    assert(
      sbinSettlement.final_price === lowerCollar,
      `Final price clamped strictly to Lower Circuit: ₹${sbinSettlement.final_price} (Clamped from raw calculated ₹${sbinSettlement.calculated_price})`
    );

    // 9. Apply Settlements to Live Dalal Street Universe
    console.log('\n[STAGE 9] Applying Price Settlements Across Dalal Street Universe...');
    const applyRes = await request('/api/admin/rounds', {
      method: 'POST',
      body: JSON.stringify({
        action: 'APPLY_PRICING',
        roundId: 'round-1',
        settlements,
      }),
    });
    assert(applyRes.status === 200 && applyRes.data.success, 'Successfully applied price settlements to all equities');

    // Verify stock prices and graphs updated
    const postApplyStocks = await request('/api/stocks');
    const updatedInfy = postApplyStocks.data.stocks.find(s => s.id === infy.id);
    assert(
      updatedInfy.current_price === infySettlement.final_price,
      `INFY live price updated to settlement price: ₹${updatedInfy.current_price}`
    );
    assert(
      updatedInfy.historical_prices[updatedInfy.historical_prices.length - 1] === infySettlement.final_price,
      `INFY graph trajectory appended opening price for next round`
    );
    assert(
      updatedInfy.upper_circuit === Number((updatedInfy.current_price * 1.10).toFixed(2)),
      `New upper circuit collar set for upcoming round: ₹${updatedInfy.upper_circuit}`
    );

    // Verify teams mark-to-market portfolios recalculated with zero NaNs
    const postApplyLedger = await request('/api/broker/ledger');
    const teams = postApplyLedger.data.snapshot?.teamsPurse || [];
    const corruptedTeams = teams.filter(t => isNaN(t.currentCash) || isNaN(t.totalNetWorth) || t.currentCash < 0);
    assert(corruptedTeams.length === 0, 'All participant teams mark-to-market portfolios recalculated cleanly (Zero NaNs)');

  } finally {
    // 10. CRITICAL TEARDOWN: Clear all test data and restore clean dry run environment
    console.log('\n[STAGE 10] TEARDOWN: Purging all test data and resetting to pristine dry run state...');
    try {
      execSync('node scripts/clean_reset_for_dry_run.js', { stdio: 'pipe' });
      console.log('  ✓ Clean reset script executed successfully');

      // Verify clean state
      const verifyRes = await request('/api/admin/rounds');
      assert(verifyRes.data.currentRound?.id === 'round-0', 'Platform restored cleanly to Round 0');
      assert(verifyRes.data.clock?.remaining_seconds > 0, 'Clock reset to fresh 30:00 minutes');

      const verifyLedger = await request('/api/broker/ledger');
      assert(verifyLedger.data.snapshot?.tradesLedger?.length === 0, 'Trades ledger purged to 0 test trades');
      assert(verifyLedger.data.snapshot?.teamsPurse !== undefined, 'Teams purse ledger verified cleanly');

      console.log('  ✓ Verified 100% of test data has been cleared and platform is dry-run ready!');
    } catch (cleanErr) {
      console.error('Teardown failed:', cleanErr);
      failed++;
    }
  }

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
