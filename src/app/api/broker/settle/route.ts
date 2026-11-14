import { NextResponse } from 'next/server';
import { executeInterTeamTrade } from '@/lib/db';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';
import { getCurrentSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    const operatorEmail = session?.email || 'event-broker-desk@thapar.edu';

    const body = await request.json();
    const { buyerTeamName, sellerTeamName, stockId, quantity, agreedPrice, allowCircuitBypass } = body;

    if (!buyerTeamName || !buyerTeamName.trim()) {
      return NextResponse.json({ error: 'Buying team name is required on the physical slip.' }, { status: 400 });
    }
    if (!sellerTeamName || !sellerTeamName.trim()) {
      return NextResponse.json({ error: 'Selling team name is required on the physical slip.' }, { status: 400 });
    }
    if (!stockId) {
      return NextResponse.json({ error: 'Stock selection is required.' }, { status: 400 });
    }

    const parsedQty = parseInt(quantity, 10);
    const parsedPrice = parseFloat(agreedPrice);

    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive integer of shares.' }, { status: 400 });
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: 'Agreed price must be a valid positive amount.' }, { status: 400 });
    }

    const tradeResult = await executeInterTeamTrade(
      operatorEmail,
      sellerTeamName.trim(),
      buyerTeamName.trim(),
      stockId,
      parsedQty,
      parsedPrice,
      { flexibleFloorMode: true, allowCircuitBypass: Boolean(allowCircuitBypass) }
    );

    if (!tradeResult.success) {
      return NextResponse.json({ error: tradeResult.error || 'Failed to settle slip trade.' }, { status: 400 });
    }

    // Compute updated snapshot
    const updatedSnapshot = computeBrokerLedgerSnapshot();

    return NextResponse.json({
      success: true,
      summary: tradeResult.summary,
      snapshot: updatedSnapshot,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error settling slip.' }, { status: 500 });
  }
}
