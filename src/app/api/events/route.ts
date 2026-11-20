import { NextResponse } from 'next/server';
import { getMarketEvents, getNewsArticles } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const events = await getMarketEvents();
  const news = await getNewsArticles();
  return NextResponse.json({ events, news });
}
