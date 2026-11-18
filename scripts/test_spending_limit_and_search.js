const http = require('http');
const { SignJWT } = require('jose');

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
  console.log('TESTING: 10 LAKH SPENDING CAP ENFORCEMENT & PREVENTING 50 LAKH PURCHASES');
  console.log('======================================================================\n');

  // STEP 1: Get initial platform state
  const ledgerRes = await request('/api/broker/ledger');
  assert(ledgerRes.status === 200, 'Broker ledger loaded');
  const stocks = ledgerRes.data.snapshot?.stocks || [];
  const reliance = stocks.find(s => s.ticker === 'RELIANCE') || stocks[0];
  const reliancePrice = reliance.current_price;
  console.log(`  Using stock ${reliance.ticker} @ ₹${reliancePrice}`);

  // Test Team: "Apex Alpha Syndicate" (Initial purse = ₹10,00,000)
  const initialApex = ledgerRes.data.snapshot?.teamsPurse.find(t => t.teamName === 'Apex Alpha Syndicate');
  assert(initialApex && initialApex.currentCash === 1000000, `Apex starting cash is exactly ₹10,00,000 (Actual: ₹${initialApex?.currentCash})`);

  // TEST CASE 1: Attempt to purchase ₹50,00,000 of shares (e.g., 4,300 shares @ ~₹1,164.90 = ~₹50,09,070)
  console.log('\n[TEST 1] Attempting massive 50 Lakh trade in Round 0 (Must be REJECTED)...');
  const hugeQty = Math.ceil(5000000 / reliancePrice);
  const hugeValue = Number((hugeQty * reliancePrice).toFixed(2));
  console.log(`  Attempting to buy ${hugeQty} shares (Gross value: ₹${hugeValue.toLocaleString('en-IN')})`);

  const hugeTradeRes = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Apex Alpha Syndicate',
      sellerTeamName: 'Central Primary Pool',
      stockId: reliance.id,
      agreedPrice: reliancePrice,
      quantity: hugeQty,
    }),
  });

  assert(hugeTradeRes.status === 400, `Massive 50 Lakh purchase rejected with HTTP 400 (Status: ${hugeTradeRes.status})`);
  assert(hugeTradeRes.data.success !== true, 'Trade execution blocked');
  assert(
    hugeTradeRes.data.error?.includes('INSUFFICIENT FUNDS') || hugeTradeRes.data.error?.includes('EXCEEDS ROUND 0 PURSE LIMIT'),
    `Correct error returned: "${hugeTradeRes.data.error}"`
  );

  // Verify wallet balance was NOT inflated
  const ledgerAfterHuge = await request('/api/broker/ledger');
  const apexAfterHuge = ledgerAfterHuge.data.snapshot?.teamsPurse.find(t => t.teamName === 'Apex Alpha Syndicate');
  assert(apexAfterHuge.currentCash === 1000000, `Apex wallet was NOT inflated, remained ₹10,00,000 (Actual: ₹${apexAfterHuge.currentCash})`);

  // TEST CASE 2: Legitimate valid trade within ₹10 Lakhs (e.g. ₹6,50,000 - 558 shares)
  console.log('\n[TEST 2] Executing legitimate trade of ~₹6.5 Lakhs (satisfies >= 60% requirement)...');
  const validQty = Math.floor(650000 / reliancePrice);
  const validValue = Number((validQty * reliancePrice).toFixed(2));
  console.log(`  Buying ${validQty} shares (Gross value: ₹${validValue.toLocaleString('en-IN')})`);

  const validTradeRes = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Apex Alpha Syndicate',
      sellerTeamName: 'Central Primary Pool',
      stockId: reliance.id,
      agreedPrice: reliancePrice,
      quantity: validQty,
    }),
  });

  assert(validTradeRes.status === 200 && validTradeRes.data.success, 'Legitimate trade executed successfully');
  
  const ledgerAfterValid = await request('/api/broker/ledger');
  const apexAfterValid = ledgerAfterValid.data.snapshot?.teamsPurse.find(t => t.teamName === 'Apex Alpha Syndicate');
  const expectedRemaining = Number((1000000 - validValue).toFixed(2));
  assert(
    Math.abs(apexAfterValid.currentCash - expectedRemaining) < 1,
    `Apex remaining cash correctly deducted to ₹${apexAfterValid.currentCash.toLocaleString('en-IN')} (Expected: ₹${expectedRemaining.toLocaleString('en-IN')})`
  );
  assert(
    apexAfterValid.round0Spent === validValue,
    `Apex Round 0 deployed tracked: ₹${apexAfterValid.round0Spent.toLocaleString('en-IN')} / ₹10,00,000`
  );

  // TEST CASE 3: Attempt second trade that would exceed ₹10,00,000 total purse
  // (Apex has ~₹3.5L cash left. Attempting to buy ₹4,00,000 -> must be REJECTED)
  console.log('\n[TEST 3] Attempting second trade of ₹4 Lakhs (Total spend would be ~₹10.5 Lakhs > ₹10 Lakhs cap)...');
  const excessQty = Math.ceil(400000 / reliancePrice);
  const excessValue = Number((excessQty * reliancePrice).toFixed(2));

  const excessTradeRes = await request('/api/broker/settle', {
    method: 'POST',
    body: JSON.stringify({
      buyerTeamName: 'Apex Alpha Syndicate',
      sellerTeamName: 'Central Primary Pool',
      stockId: reliance.id,
      agreedPrice: reliancePrice,
      quantity: excessQty,
    }),
  });

  assert(excessTradeRes.status === 400, `Over-budget second trade rejected with HTTP 400 (Status: ${excessTradeRes.status})`);
  assert(
    excessTradeRes.data.error?.includes('INSUFFICIENT FUNDS') || excessTradeRes.data.error?.includes('EXCEEDS ROUND 0 PURSE LIMIT'),
    `Correct error returned: "${excessTradeRes.data.error}"`
  );

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
