import { NextResponse } from 'next/server';
import {
  getIPOListings,
  getIPOSubscriptions,
  subscribeToIPO,
  allotIPOLots,
  createCustomIPO,
} from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId') || undefined;

    const listings = getIPOListings();
    const subscriptions = getIPOSubscriptions(roundId);

    return NextResponse.json({
      success: true,
      listings,
      subscriptions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

let ipoQueue: Promise<any> = Promise.resolve();

export async function POST(request: Request) {
  return new Promise<NextResponse>((resolve) => {
    ipoQueue = ipoQueue.then(async () => {
      try {
        const body = await request.json();
        const { action } = body;

        if (action === 'SUBSCRIBE') {
          const { ipo_id, team_id, user_id, lots } = body;
          if (!ipo_id || !team_id || !lots) {
            resolve(NextResponse.json(
              { success: false, error: 'ipo_id, team_id, and lots are required' },
              { status: 400 }
            ));
            return;
          }
          const result = subscribeToIPO({
            ipo_id,
            team_id,
            user_id: user_id || '',
            lots: Number(lots),
          });
          resolve(NextResponse.json(result, { status: result.success ? 200 : 400 }));
          return;
        }

        if (action === 'ALLOT') {
          const { ipo_id, admin_email } = body;
          if (!ipo_id) {
            resolve(NextResponse.json({ success: false, error: 'ipo_id is required' }, { status: 400 }));
            return;
          }
          const result = allotIPOLots(admin_email || 'admin.econ@thapar.edu', ipo_id);
          resolve(NextResponse.json(result, { status: result.success ? 200 : 400 }));
          return;
        }

        if (action === 'CREATE') {
          const {
            admin_email,
            company_name,
            ticker,
            sector,
            issue_price,
            lot_size,
            total_issue_lots,
            round_id,
            description,
          } = body;

          const result = createCustomIPO({
            adminEmail: admin_email || 'admin.econ@thapar.edu',
            company_name,
            ticker,
            sector,
            issue_price: Number(issue_price),
            lot_size: lot_size ? Number(lot_size) : undefined,
            total_issue_lots: total_issue_lots ? Number(total_issue_lots) : undefined,
            round_id,
            description,
          });

          resolve(NextResponse.json(result, { status: result.success ? 201 : 400 }));
          return;
        }

        resolve(NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 }));
      } catch (error: any) {
        resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
      }
    });
  });
}

