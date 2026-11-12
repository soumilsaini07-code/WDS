import { NextResponse } from 'next/server';
import { getCompetitionRounds, getIPOListings, getIPOSubscriptions, getTeams } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    const { rounds, currentRound, clock } = getCompetitionRounds();
    const ipos = getIPOListings();
    const activeIPO = ipos.find((i) => i.round_id === currentRound.id && i.status === 'SUBSCRIPTION_OPEN') || null;
    const allTeams = await getTeams();

    let teamSubscription = null;
    if (teamId && activeIPO) {
      const subs = getIPOSubscriptions(activeIPO.round_id);
      teamSubscription = subs.find((s) => s.team_id === teamId) || null;
    }

    return NextResponse.json({
      success: true,
      rounds,
      currentRound,
      clock,
      activeIPO,
      teamSubscription,
      teams: allTeams.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        balance: t.balance,
      })),
      serverTime: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
