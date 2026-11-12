import { NextResponse } from 'next/server';
import { createDBSnapshot, listDBSnapshots, rollbackDBSnapshot } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const snapshots = listDBSnapshots();
    return NextResponse.json({
      success: true,
      snapshots,
      count: snapshots.length,
      serverTime: Date.now(),
    });
  } catch (error: any) {
    logger.error('RollbackAPI', 'Failed to retrieve snapshot list', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list snapshots' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, label, filename, adminEmail } = body;

    switch (action) {
      case 'CREATE': {
        const snapshot = createDBSnapshot(label || 'manual_admin');
        const snapshots = listDBSnapshots();
        return NextResponse.json({
          success: true,
          message: `Snapshot "${snapshot.filename}" created successfully.`,
          snapshot,
          snapshots,
        });
      }

      case 'ROLLBACK': {
        if (!filename) {
          return NextResponse.json(
            { success: false, error: 'Snapshot filename is required for rollback.' },
            { status: 400 }
          );
        }

        const result = rollbackDBSnapshot(filename);
        if (!result.success) {
          return NextResponse.json(result, { status: 400 });
        }

        const snapshots = listDBSnapshots();
        return NextResponse.json({
          ...result,
          snapshots,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action: ${action}. Expected CREATE or ROLLBACK.` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('RollbackAPI', 'Failed to execute snapshot action', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error processing snapshot action' },
      { status: 500 }
    );
  }
}

