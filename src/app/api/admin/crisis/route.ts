import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { triggerCrisisScenario } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { presetId } = await request.json();

    if (!presetId) {
      return NextResponse.json({ error: 'presetId is required' }, { status: 400 });
    }

    const event = await triggerCrisisScenario(presetId);
    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
