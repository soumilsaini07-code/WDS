import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth';
import { getUserByEmail, createUser } from '@/lib/db';

export async function POST() {
  try {
    const demoEmail = 'student@thapar.edu';
    let user = await getUserByEmail(demoEmail);
    if (!user) {
      user = await createUser({
        email: demoEmail,
        password_hash: '$2a$10$7Z8VfIvxjVl79E8wU4mUjeG46Jt0Rz1U4X8h4J0n7eN69g2P48WvW',
        role: 'participant',
        balance: 1000000,
        ecoin_balance: 100,
      });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: 'participant',
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

    return NextResponse.json({ success: true, role: 'participant', token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to switch to participant' }, { status: 500 });
  }
}
