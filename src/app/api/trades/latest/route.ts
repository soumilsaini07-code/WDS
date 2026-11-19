import { NextResponse } from 'next/server';
import { getLatestBroadcastTrade } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
