import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getTeams, superadminManageTeam } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const teams = await getTeams();
    return NextResponse.json({ teams });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized: Superadmin master credentials required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const adminEmail = body.adminEmail;
    const adminPassword = body.adminPassword;
    const action = body.action;
    const teamId = body.teamId;
    const payload = body.payload || {
      memberId: body.userId || body.memberId,
      name: body.newName || body.name,
      email: body.newEmail || body.email,
      roll: body.roll,
      isLeader: body.isLeader,
    };

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Two-step verification required: Please enter your Superadmin email and password.' },
        { status: 401 }
      );
    }

    if (!action || !teamId) {
      return NextResponse.json(
        { error: 'Action and teamId are required.' },
        { status: 400 }
      );
    }

    const result = await superadminManageTeam(adminEmail, adminPassword, action, teamId, payload);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Action failed.' }, { status: 400 });
    }

    const allTeams = await getTeams();

    return NextResponse.json({
      success: true,
      team: result.team,
      teams: allTeams,
      message: 'Team structure successfully updated after two-step verification.',
    });
  } catch (err: any) {
    console.error('Superadmin team management error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
