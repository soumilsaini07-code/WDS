import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { executeInterTeamTrade } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { sellerTeamId, buyerTeamId, stockId, quantity, agreedPrice, allowCircuitBypass } = await request.json();

    if (!sellerTeamId || !buyerTeamId) {
      return NextResponse.json({ error: 'Both Seller and Buyer teams are required.' }, { status: 400 });
    }
    if (!stockId) {
      return NextResponse.json({ error: 'Stock selection is required.' }, { status: 400 });
    }
    const parsedQty = parseInt(quantity, 10);
    const parsedPrice = parseFloat(agreedPrice);

    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive integer.' }, { status: 400 });
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: 'Agreed price must be a positive number.' }, { status: 400 });
    }

    const result = await executeInterTeamTrade(
      session.email,
      sellerTeamId,
      buyerTeamId,
      stockId,
      parsedQty,
      parsedPrice,
      { flexibleFloorMode: true, allowCircuitBypass: Boolean(allowCircuitBypass) }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Inter-team trade failed.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      summary: result.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

