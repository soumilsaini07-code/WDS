import { NextResponse } from 'next/server';
import { getStocks } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const startTime = Date.now();
    const stocks = await getStocks();

    // Fast price signature checksum for high-efficiency ETag computation
    let priceSum = 0;
    for (let i = 0; i < stocks.length; i++) {
      priceSum = (priceSum + stocks[i].current_price * 100) | 0;
    }
    const etag = `W/"stocks-${stocks.length}-${priceSum}"`;

    const clientEtag = request.headers.get('if-none-match');
    if (clientEtag && clientEtag === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
          'ETag': etag,
          'X-Cache-Lookup': 'HIT-INDEX',
          'X-Response-Time-Ms': String(Date.now() - startTime),
        },
      });
    }

    return NextResponse.json(
      { stocks },
      {
        headers: {
          'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
          'ETag': etag,
          'X-Cache-Lookup': 'MISS-INDEX',
          'X-Response-Time-Ms': String(Date.now() - startTime),
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stocks' },
      { status: 500 }
    );
  }
}
