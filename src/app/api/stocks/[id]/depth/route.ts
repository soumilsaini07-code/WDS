import { NextResponse } from 'next/server';
import { generateMarketDepth } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const depth = generateMarketDepth(id);
    return NextResponse.json({ success: true, depth });
  } catch (err: any) {
    console.error('Error fetching market depth:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate market depth' },
      { status: 500 }
    );
  }
}
