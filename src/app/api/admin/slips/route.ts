import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getOrderSlips, getOrderSlipBySlipId, adminExecuteOrderSlip } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slipId = searchParams.get('slipId');

    if (slipId) {
      const slip = await getOrderSlipBySlipId(slipId);
      if (!slip) {
        return NextResponse.json({ error: `Order slip "${slipId}" not found.` }, { status: 404 });
      }
      return NextResponse.json({ slip });
    }

    const allSlips = await getOrderSlips();
    return NextResponse.json({ slips: allSlips });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { slipId, action } = await request.json();

    if (!slipId) {
      return NextResponse.json({ error: 'Slip ID is required.' }, { status: 400 });
    }

    if (action === 'LOOKUP') {
      const slip = await getOrderSlipBySlipId(slipId);
      if (!slip) {
        return NextResponse.json({ error: `Order slip "${slipId}" not found.` }, { status: 404 });
      }
      return NextResponse.json({ success: true, slip });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ error: 'Action must be APPROVE or REJECT.' }, { status: 400 });
    }

    const result = await adminExecuteOrderSlip(session, slipId, action);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Execution failed.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      slip: result.slip,
      transaction: result.transaction,
      message:
        action === 'APPROVE'
          ? `Order Slip ${result.slip?.slip_id} successfully approved and executed! Real-time Excel sheet updated.`
          : `Order Slip ${result.slip?.slip_id} rejected.`,
    });
  } catch (err: any) {
    console.error('Admin slip execution error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
