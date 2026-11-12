import { NextResponse } from 'next/server';
import { authenticateUser, createSessionToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const authResult = await authenticateUser(email, password);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      assigned_admin_id: user.assigned_admin_id,
      assigned_admin_name: user.assigned_admin_name,
      group_name: user.group_name,
      team_id: user.team_id,
      team_name: user.team_name,
      is_team_leader: user.is_team_leader,
    });

    const response = NextResponse.json({
      success: true,
      token,
      role: user.role,
      redirectTo:
        user.role === 'admin' || user.role === 'superadmin'
          ? '/admin'
          : !user.first_name && (!user.username || user.username.startsWith('Trader_'))
          ? '/onboarding/profile'
          : '/dashboard',
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
        team_id: user.team_id,
        team_name: user.team_name,
        is_team_leader: user.is_team_leader,
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
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
