import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { executeTrade } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Direct student participant self-trading is strictly blocked
    if (session.role !== 'admin' && session.role !== 'superadmin') {
      const deskAdmin = session.assigned_admin_name || 'your assigned Desk Admin';
      return NextResponse.json(
        {
          error: `Direct self-trading is disabled for participants. Please present your order slip to ${deskAdmin} to execute this transaction on your portfolio.`,
        },
        { status: 403 }
      );
    }

    const { stockId, type, quantity } = await request.json();

    if (!stockId || !type || !quantity) {
      return NextResponse.json(
        { error: 'Missing order parameters (stockId, type, quantity)' },
        { status: 400 }
      );
    }

    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json(
        { error: 'Invalid order type. Must be BUY or SELL.' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer.' },
        { status: 400 }
      );
    }

    const tradeResult = await executeTrade(session.userId, stockId, type, parsedQty);

    if (!tradeResult.success) {
      return NextResponse.json(
        { error: tradeResult.error || 'Trade execution failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: tradeResult.transaction,
    });
  } catch (err: any) {
    console.error('Trade error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
