import { NextResponse } from 'next/server';
import { registerUser, createSessionToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required for registration.' },
        { status: 400 }
      );
    }

    const regResult = await registerUser(email, password, fullName);
    if (!regResult.success || !regResult.user) {
      return NextResponse.json(
        { error: regResult.error || 'Registration failed.' },
        { status: 400 }
      );
    }

    const user = regResult.user;
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      assigned_admin_id: user.assigned_admin_id,
      assigned_admin_name: user.assigned_admin_name,
      group_name: user.group_name,
    });

    const response = NextResponse.json({
      success: true,
      token,
      role: user.role,
      redirectTo: '/onboarding/profile',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        balance: user.balance,
        ecoin_balance: user.ecoin_balance,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        assigned_admin_id: user.assigned_admin_id,
        assigned_admin_name: user.assigned_admin_name,
        group_name: user.group_name,
      },
    });

    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://') ||
      process.env.NODE_ENV === 'production';

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal registration error.' },
      { status: 500 }
    );
  }
}
