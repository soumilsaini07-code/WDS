import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getStocks, updateStock } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const stocks = await getStocks();
  return NextResponse.json({ stocks });
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { stockId, currentPrice, isFrozen } = await request.json();

    if (!stockId) {
      return NextResponse.json({ error: 'stockId is required' }, { status: 400 });
    }

    const updates: any = {};
    if (currentPrice !== undefined) updates.current_price = parseFloat(currentPrice);
    if (isFrozen !== undefined) updates.is_frozen = Boolean(isFrozen);

    const updated = await updateStock(stockId, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, stock: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
