import { NextResponse } from 'next/server';
import { getSyndicateFundDetails } from '@/lib/db';

export async function GET() {
  try {
    const details = await getSyndicateFundDetails();
    return NextResponse.json({
      success: true,
      ...details,
    });
  } catch (err: any) {
    console.error('Error fetching syndicate fund details:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch syndicate fund details' },
      { status: 500 }
    );
  }
}
