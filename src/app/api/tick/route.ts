import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { simulateMarketTick } from '@/lib/db';

export async function POST() {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Unauthorized: Only platform administrators can trigger simulated market ticks.' },
        { status: 403 }
      );
    }

    const updatedStocks = await simulateMarketTick();
    return NextResponse.json({ success: true, stocks: updatedStocks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
