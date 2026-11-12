import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { injectMarketEvent } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 403 });
    }

    const { headline, description, impactMap } = await request.json();

    if (!headline || !description || !impactMap || typeof impactMap !== 'object') {
      return NextResponse.json(
        { error: 'Invalid event payload. Required: headline, description, impactMap (object)' },
        { status: 400 }
      );
    }

    const event = await injectMarketEvent(headline, description, impactMap);

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    console.error('Admin event error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
