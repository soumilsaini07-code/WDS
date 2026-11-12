import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { assignStudentToAdmin, getAllUsersWithStats } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    // Only superadmin can reassign students between cohort desks
    if (session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only Superadministrators have permission to reallot students across desk admins.' },
        { status: 403 }
      );
    }

    const { studentId, adminId, groupName } = await request.json();

    if (!studentId || !adminId) {
      return NextResponse.json(
        { error: 'Both studentId and adminId are required.' },
        { status: 400 }
      );
    }

    const updatedStudent = await assignStudentToAdmin(studentId, adminId, groupName);

    if (!updatedStudent) {
      return NextResponse.json(
        { error: 'Student or Target Admin account was not found.' },
        { status: 404 }
      );
    }

    const allStudents = await getAllUsersWithStats();

    return NextResponse.json({
      success: true,
      student: updatedStudent,
      users: allStudents,
      message: `Assigned ${updatedStudent.email} to ${updatedStudent.assigned_admin_name} (${updatedStudent.group_name || 'Desk'}).`,
    });
  } catch (err: any) {
    console.error('Student assignment error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
