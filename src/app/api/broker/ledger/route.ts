import { NextResponse } from 'next/server';
import { computeBrokerLedgerSnapshot } from '@/lib/broker-ledger';
import {
  reconcileTeamsFromSupabase,
  reconcilePortfoliosFromSupabase,
  reconcileTransactionsFromSupabase,
  reconcileClockFromSupabase,
  reconcileIPOFromSupabase,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Non-blocking parallel sync with Supabase with a strict 2s ceiling
    await Promise.race([
      Promise.allSettled([
        reconcileTeamsFromSupabase(),
        reconcilePortfoliosFromSupabase(),
        reconcileTransactionsFromSupabase(),
        reconcileClockFromSupabase(),
        reconcileIPOFromSupabase(),
      ]),
      new Promise((r) => setTimeout(r, 2000)),
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
