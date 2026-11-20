import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getTeams, modifyTeamBudget } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const teams = await getTeams();
    return NextResponse.json({ success: true, teams });
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

    const body = await request.json();
    const { teamId, action, amount, reason } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required.' }, { status: 400 });
    }

    if (action !== 'RESET_ALL_10L' && !teamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
    }

    const result = await modifyTeamBudget(session.email, teamId || 'ALL', action, amount, reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to modify budget.' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
