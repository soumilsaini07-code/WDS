import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createOrderSlip, getOrderSlips } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const stockId = body.stockId || body.stock_id;
    const type = body.type || body.order_type;
    const quantity = body.quantity;

    if (!stockId || !type || !quantity) {
      return NextResponse.json(
        { error: 'Missing required parameters: stockId, type (BUY/SELL), quantity.' },
        { status: 400 }
      );
    }

    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json({ error: 'Order type must be BUY or SELL.' }, { status: 400 });
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: 'Share quantity must be a positive integer.' }, { status: 400 });
    }

    const result = await createOrderSlip(session.userId, stockId, type, parsedQty);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create order slip.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      slip: result.slip,
      message: `Generated Order Slip #${result.slip?.slip_id}. Present this Slip ID to your Desk Admin.`,
    });
  } catch (err: any) {
    console.error('Order slip generation error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const slips = await getOrderSlips(session.team_id || session.userId);
    return NextResponse.json({ slips });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
