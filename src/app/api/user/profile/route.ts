import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserById, updateUser, joinTeamByCode } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { first_name, last_name, username, team_code } = await request.json();

    if (!first_name || !first_name.trim()) {
      return NextResponse.json({ error: 'First name is required.' }, { status: 400 });
    }

    const trimmedFirst = first_name.trim();
    const trimmedLast = (last_name || '').trim();
    const finalUsername = (username || `${trimmedFirst} ${trimmedLast}`.trim()).trim();

    const updated = await updateUser(session.userId, {
      first_name: trimmedFirst,
      last_name: trimmedLast,
      username: finalUsername,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 404 });
    }

    let joinedTeam = null;
    if (team_code && team_code.trim()) {
      const joinResult = await joinTeamByCode(session.userId, team_code.trim());
      if (!joinResult.success) {
        return NextResponse.json({ error: joinResult.error }, { status: 400 });
      }
      joinedTeam = joinResult.team;
    }

    return NextResponse.json({
      success: true,
      team: joinedTeam,
      user: {
        id: updated.id,
        email: updated.email,
        first_name: updated.first_name,
        last_name: updated.last_name,
        username: updated.username,
        role: updated.role,
        balance: updated.balance,
        team_id: joinedTeam?.id || updated.team_id,
        team_name: joinedTeam?.name || updated.team_name,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
