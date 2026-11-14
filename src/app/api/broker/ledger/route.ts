import { NextResponse } from 'next/server';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = computeBrokerLedgerSnapshot();
    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to compute ledger snapshot.' }, { status: 500 });
  }
}
