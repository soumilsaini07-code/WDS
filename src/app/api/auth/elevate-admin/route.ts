import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionToken, COOKIE_NAME, getCurrentSession, isAuthorizedAdmin } from '@/lib/auth';
import { getUserByEmail, createUser } from '@/lib/db';

export async function POST() {
  try {
    const session = await getCurrentSession();

    // Verify caller is an authorized admin
    if (!session || (!isAuthorizedAdmin(session.email) && session.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Admin elevation is restricted to authorized platform directors.' },
        { status: 403 }
      );
    }

    const adminEmail = session.email;
    let admin = await getUserByEmail(adminEmail);
    if (!admin) {
      admin = await createUser({
        email: adminEmail,
        password_hash: '$2a$10$7Z8VfIvxjVl79E8wU4mUjeG46Jt0Rz1U4X8h4J0n7eN69g2P48WvW',
        role: 'admin',
        balance: 10000000,
        ecoin_balance: 1000,
      });
    }

    const token = await createSessionToken({
      userId: admin.id,
      email: admin.email,
      role: 'admin',
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ success: true, role: 'admin', token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to switch to admin' }, { status: 500 });
  }
}
