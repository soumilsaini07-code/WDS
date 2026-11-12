import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getLiveTradesCSVContent } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const csvContent = getLiveTradesCSVContent();

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dalal_street_live_trades_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
