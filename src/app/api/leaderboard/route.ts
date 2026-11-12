import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getAllUsersWithStats } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();

    // Leaderboard is strictly restricted to Faculty and Desk Administrators
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Access Denied: The live leaderboard rankings are restricted to authorized administrators.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filterAdminId = searchParams.get('adminId');

    const usersWithStats = await getAllUsersWithStats();

    // Role-based scoping:
    // If superadmin: can see all students, or filter by adminId if requested
    // If desk admin: can strictly see only students in their assigned cohort
    let scopedUsers = usersWithStats;
    if (session.role === 'admin') {
      scopedUsers = usersWithStats.filter(
        (u) => u.assigned_admin_id === session.userId || u.assigned_admin_name === session.email
      );
    } else if (session.role === 'superadmin' && filterAdminId && filterAdminId !== 'ALL') {
      scopedUsers = usersWithStats.filter((u) => u.assigned_admin_id === filterAdminId);
    }

    // Sort by Total Net Worth descending
    const sorted = [...scopedUsers].sort((a, b) => b.netWorth - a.netWorth);

    const leaderboard = sorted.map((u, idx) => {
      const returnPercent = Number(u.totalReturnPercent.toFixed(1));
      const displayName =
        u.username ||
        (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : null) ||
        `Trader_${u.email.split('@')[0]}`;

      return {
        rank: `#${idx + 1}`,
        id: u.id,
        email: u.email,
        name: displayName,
        role: u.role,
        balance: u.balance,
        holdingsValue: u.holdingsValue,
        netWorth: u.netWorth,
        returnPct: (returnPercent >= 0 ? '+' : '') + `${returnPercent}%`,
        rawReturn: returnPercent,
        holdingsCount: u.holdingsCount || 0,
        assigned_admin_id: u.assigned_admin_id,
        assigned_admin_name: u.assigned_admin_name || 'Unassigned',
        group_name: u.group_name || 'General Cohort',
      };
    });

    return NextResponse.json({
      success: true,
      leaderboard,
      totalParticipants: leaderboard.length,
      scope: session.role === 'superadmin' ? 'global' : 'cohort',
      adminName: session.email,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
