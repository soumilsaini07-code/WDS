import { NextResponse } from 'next/server';
import { getStocks, getTeams, getCompetitionRounds, listDBSnapshots } from '@/lib/db';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const memory = process.memoryUsage();
    const roundsData = getCompetitionRounds();
    const stocks = await getStocks();
    const teams = await getTeams();
    const snapshots = listDBSnapshots();
    const recentAudits = logger.getRecentAuditLogs(5);

    // Read raw counts for transactions and slips safely
    let transactionsCount = 0;
    let orderSlipsCount = 0;
    let usersCount = 0;
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const dbFile = path.join(dataDir, 'db.json');
      if (fs.existsSync(dbFile)) {
        const raw = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
        transactionsCount = raw.transactions?.length || 0;
        orderSlipsCount = raw.order_slips?.length || 0;
        usersCount = raw.users?.length || 0;
      }
    } catch {}

    const payload = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      memory: {
        rssMB: Number((memory.rss / (1024 * 1024)).toFixed(2)),
        heapTotalMB: Number((memory.heapTotal / (1024 * 1024)).toFixed(2)),
        heapUsedMB: Number((memory.heapUsed / (1024 * 1024)).toFixed(2)),
        externalMB: Number((memory.external / (1024 * 1024)).toFixed(2)),
      },
      database: {
        stocksCount: stocks.length,
        teamsCount: teams.length,
        usersCount,
        transactionsCount,
        orderSlipsCount,
        currentRound: roundsData.currentRound.id,
        currentRoundName: roundsData.currentRound.name,
        clock: roundsData.clock,
        snapshotsCount: snapshots.length,
        latestSnapshot: snapshots[0] || null,
      },
      auditTelemetry: {
        recentAudits,
      },
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    logger.error('HealthCheck', 'Health endpoint check failed', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error occurred during health check',
      },
      { status: 500 }
    );
  }
}

