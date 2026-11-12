import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { adminExecuteTrade } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { studentId, stockId, type, quantity } = await request.json();

    if (!studentId || !stockId || !type || !quantity) {
      return NextResponse.json(
        { error: 'Missing required trade parameters (studentId, stockId, type, quantity).' },
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

    const result = await adminExecuteTrade(session, studentId, stockId, type, parsedQty);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Trade execution failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      student: result.student,
      message: `Successfully executed ${type} ${parsedQty} shares for student portfolio.`,
    });
  } catch (err: any) {
    console.error('Admin trade execution error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
