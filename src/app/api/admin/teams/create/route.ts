import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getLocalDB, saveLocalDB, syncTeamPortfolioAndBalance, getTeams, syncTeamToSupabase } from '@/lib/db';
import { Team } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const teamName = (body.name || body.teamName || '').trim();
    if (!teamName) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    const db = getLocalDB();
    if (!db.teams) db.teams = [];

    // Check duplicate
    if (db.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase())) {
      return NextResponse.json({ error: `A team named "${teamName}" already exists.` }, { status: 400 });
    }

    const code = (body.code || teamName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)).toUpperCase() || 'TEAM';
    const leaderName = (body.leaderName || teamName).trim();
    const leaderEmail = (body.leaderEmail || `${code.toLowerCase()}@thapar.edu`).trim();
    const balance = typeof body.balance === 'number' ? body.balance : 1000000;

    const newTeam: Team = {
      id: 'team-' + Math.random().toString(36).substring(2, 8),
      name: teamName,
      code,
      leader_id: 'usr-' + Math.random().toString(36).substring(2, 8),
      leader_name: leaderName,
      leader_email: leaderEmail,
      balance,
      members: [
        {
          id: 'usr-' + Math.random().toString(36).substring(2, 8),
          name: leaderName,
          email: leaderEmail,
          roll: code,
          is_leader: true,
        },
      ],
      created_at: new Date().toISOString(),
    };

    db.teams.push(newTeam);
    saveLocalDB(db);
    syncTeamPortfolioAndBalance(newTeam.id);
    syncTeamToSupabase(newTeam);

    const allTeams = await getTeams();
    return NextResponse.json({
      success: true,
      team: newTeam,
      teams: allTeams,
      message: `Team "${teamName}" created successfully with starting purse ₹${(balance / 100000).toFixed(2)}L.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create team.' }, { status: 500 });
  }
}
