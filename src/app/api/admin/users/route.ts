import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import {
  getStudentsForAdmin,
  getAllUsersWithStats,
  getAllAdmins,
  updateUserBalance,
  getUserTransactions,
  updateUserRole,
  getUserById,
} from '@/lib/db';
import { Role } from '@/lib/types';

export async function GET() {
  const session = await getCurrentSession();
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const isSuper = session.role === 'superadmin';
  const scopedStudents = await getStudentsForAdmin(session);
  const allStudents = isSuper ? scopedStudents : await getAllUsersWithStats();
  const admins = await getAllAdmins();
  const allTransactions = await getUserTransactions();

  // Audit logs scoped: desk admin sees transactions for their assigned cohort
  const scopedTransactions = isSuper
    ? allTransactions.slice(0, 50)
    : allTransactions
        .filter((tx) => scopedStudents.some((st) => st.id === tx.user_id))
        .slice(0, 50);

  return NextResponse.json({
    success: true,
    isSuperAdmin: isSuper,
    currentAdmin: {
      id: session.userId,
      email: session.email,
      role: session.role,
    },
    users: scopedStudents,
    allStudents: isSuper ? scopedStudents : undefined,
    admins,
    auditLogs: scopedTransactions,
  });
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, amountDelta, ecoinDelta } = await request.json();

    if (!userId || amountDelta === undefined) {
      return NextResponse.json(
        { error: 'Missing userId or amountDelta' },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserBalance(
      userId,
      parseFloat(amountDelta),
      ecoinDelta ? parseFloat(ecoinDelta) : 0
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password_hash, ...safeUser } = updatedUser;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'Missing userId or role parameter' },
        { status: 400 }
      );
    }

    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Protection against privilege escalation & unauthorized administrative alteration:
    // Only superadmin can alter roles if either the target is an administrator or the requested role is administrator
    const isTargetAdmin = targetUser.role === 'admin' || targetUser.role === 'superadmin';
    const isRequestedAdmin = role === 'admin' || role === 'superadmin';

    if ((isTargetAdmin || isRequestedAdmin) && session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only Superadministrators hold authority to grant, alter, or revoke administrative roles.' },
        { status: 403 }
      );
    }

    const updatedUser = await updateUserRole(userId, role as Role);
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure password_hash is never serialized into response
    const { password_hash, ...safeUpdatedUser } = updatedUser;

    return NextResponse.json({
      success: true,
      user: safeUpdatedUser,
      message: `User ${updatedUser.email} role updated to ${role}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
