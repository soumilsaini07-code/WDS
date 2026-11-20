import { NextResponse } from 'next/server';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';
import { reconcileTeamsFromSupabase, reconcilePortfoliosFromSupabase, reconcileTransactionsFromSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Non-blocking parallel sync with Supabase so ledger snapshot is resilient
    await Promise.allSettled([
      reconcileTeamsFromSupabase(),
      reconcilePortfoliosFromSupabase(),
      reconcileTransactionsFromSupabase(),
    ]);
  } catch {}

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
