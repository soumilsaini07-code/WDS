import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import {
  advanceCompetitionRound,
  updateRoundClock,
  calculateMarketRFormula,
  previewRoundSettlement,
  applyRoundSettlement,
  getCompetitionRounds,
} from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const data = getCompetitionRounds();
    const rStats = calculateMarketRFormula(data.currentRound.id);
    return NextResponse.json({
      success: true,
      ...data,
      rStats,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'ADVANCE': {
        const result = advanceCompetitionRound(body.targetRoundId);
        return NextResponse.json(result);
      }

      case 'UPDATE_CLOCK': {
        const clock = updateRoundClock({
          remaining_seconds: body.remaining_seconds,
          is_paused: body.is_paused,
          is_orders_locked: body.is_orders_locked,
        });
        return NextResponse.json({ success: true, clock });
      }

      case 'CALCULATE_R': {
        const rStats = calculateMarketRFormula(body.roundId);
        return NextResponse.json({ success: true, rStats });
      }

      case 'PREVIEW_PRICING': {
        const preview = previewRoundSettlement({
          roundId: body.roundId,
          overrideR: typeof body.overrideR === 'number' ? body.overrideR : undefined,
          stockNewsOverrides: body.stockNewsOverrides || undefined,
          stockROverrides: body.stockROverrides || undefined,
          randomizeR: Boolean(body.randomizeR),
        });
        return NextResponse.json({ success: true, preview });
      }

      case 'APPLY_PRICING': {
        if (!body.roundId || !Array.isArray(body.settlements)) {
          return NextResponse.json(
            { success: false, error: 'roundId and settlements array are required.' },
            { status: 400 }
          );
        }
        const result = applyRoundSettlement(
          body.roundId,
          body.settlements,
          body.adminEmail || 'admin.econ@thapar.edu'
        );
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

