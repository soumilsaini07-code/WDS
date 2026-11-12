import { NextResponse } from 'next/server';
import { getMarketEvents, getNewsArticles } from '@/lib/db';

export async function GET() {
  const events = await getMarketEvents();
  const news = await getNewsArticles();
  return NextResponse.json({ events, news });
}
