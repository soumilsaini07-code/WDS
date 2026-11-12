import { NextResponse } from 'next/server';
import { getLatestBroadcastTrade } from '@/lib/db';

export async function GET() {
  try {
    const latestTrade = getLatestBroadcastTrade();
    return NextResponse.json(
      {
        success: true,
        latestTrade,
        serverTime: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=1, stale-while-revalidate=1',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
