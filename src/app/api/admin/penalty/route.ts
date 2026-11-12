import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { applyTeamPenalty } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { teamId, reason, customAmount } = await request.json();
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'Penalty reason is required.' }, { status: 400 });
    }

    const result = await applyTeamPenalty(session.email, teamId, reason, customAmount);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to apply penalty.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      penaltyAmount: result.penaltyAmount,
      reasonLabel: result.reasonLabel,
      team: result.team,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

