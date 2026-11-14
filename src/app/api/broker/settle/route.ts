import { NextResponse } from 'next/server';
import { executeInterTeamTrade } from '@/lib/db';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';
import { getCurrentSession } from '@/lib/auth';

// In-process FIFO settlement queue ensuring ACID atomic execution during peak concurrent student submissions
let settlementQueue: Promise<any> = Promise.resolve();

export async function POST(request: Request) {
  return new Promise<NextResponse>((resolve) => {
    settlementQueue = settlementQueue.then(async () => {
      try {
        const session = await getCurrentSession();
        const operatorEmail = session?.email || 'event-broker-desk@thapar.edu';

        const body = await request.json();
        const { buyerTeamName, sellerTeamName, stockId, quantity, agreedPrice, allowCircuitBypass } = body;

        if (!buyerTeamName || !buyerTeamName.trim()) {
          resolve(NextResponse.json({ error: 'Buying team name is required on the physical slip.' }, { status: 400 }));
          return;
        }
        if (!sellerTeamName || !sellerTeamName.trim()) {
          resolve(NextResponse.json({ error: 'Selling team name is required on the physical slip.' }, { status: 400 }));
          return;
        }
        if (!stockId) {
          resolve(NextResponse.json({ error: 'Stock selection is required.' }, { status: 400 }));
          return;
        }

        const parsedQty = parseInt(quantity, 10);
        const parsedPrice = parseFloat(agreedPrice);

        if (isNaN(parsedQty) || parsedQty <= 0) {
          resolve(NextResponse.json({ error: 'Quantity must be a positive integer of shares.' }, { status: 400 }));
          return;
        }
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          resolve(NextResponse.json({ error: 'Agreed price must be a valid positive amount.' }, { status: 400 }));
          return;
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
          resolve(NextResponse.json({ error: tradeResult.error || 'Failed to settle slip trade.' }, { status: 400 }));
          return;
        }

        // Compute updated snapshot
        const updatedSnapshot = computeBrokerLedgerSnapshot();

        resolve(NextResponse.json({
          success: true,
          summary: tradeResult.summary,
          snapshot: updatedSnapshot,
        }));
      } catch (err: any) {
        resolve(NextResponse.json({ error: err.message || 'Internal server error settling slip.' }, { status: 500 }));
      }
    });
  });
}

