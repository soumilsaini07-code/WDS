import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserTeam, joinTeamByCode, createTeam } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const team = await getUserTeam(session.userId);
    return NextResponse.json({ success: true, team });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const body = await request.json();
    const { action, code, teamName, customCode } = body;

    if (action === 'CREATE') {
      if (!teamName || !teamName.trim()) {
        return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
      }
      const result = await createTeam(session.userId, teamName, customCode);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to create team.' }, { status: 400 });
      }
      return NextResponse.json({ success: true, team: result.team });
    }

    // Default action: JOIN BY CODE
    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Team code is required to join.' }, { status: 400 });
    }

    const result = await joinTeamByCode(session.userId, code);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to join team.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, team: result.team });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
