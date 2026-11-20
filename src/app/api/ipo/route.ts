import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import {
  getIPOListings,
  getIPOSubscriptions,
  subscribeToIPO,
  allotIPOLots,
  createCustomIPO,
  updateIPOStatus,
  reconcileIPOFromSupabase,
  getLocalDB,
} from '@/lib/db';
import { pushIpoBidToGoogleSheets } from '@/lib/google-sheets-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await reconcileIPOFromSupabase();
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
        await reconcileIPOFromSupabase();
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

          if (result.success && result.subscription) {
            const db = getLocalDB();
            const ipo = (db.ipo_listings || []).find((i) => i.id === ipo_id);
            pushIpoBidToGoogleSheets({
              subscriptionId: result.subscription.id,
              teamName: result.subscription.team_name,
              ticker: ipo?.ticker || result.subscription.ipo_id,
              lots: result.subscription.lots_requested,
              shares: result.subscription.share_quantity,
              issuePrice: result.subscription.issue_price,
              totalAmount: result.subscription.total_amount,
              status: result.subscription.status,
            });
          }

          resolve(NextResponse.json(result, { status: result.success ? 200 : 400 }));
          return;
        }

        if (action === 'ALLOT' || action === 'CREATE' || action === 'SET_STATUS') {
          const session = await getCurrentSession();
          if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
            resolve(NextResponse.json({ success: false, error: 'Unauthorized: Admin privileges required.' }, { status: 403 }));
            return;
          }

          if (action === 'ALLOT') {
            const { ipo_id } = body;
            if (!ipo_id) {
              resolve(NextResponse.json({ success: false, error: 'ipo_id is required' }, { status: 400 }));
              return;
            }
            const result = allotIPOLots(session.email || 'admin.econ@thapar.edu', ipo_id);
            resolve(NextResponse.json(result, { status: result.success ? 200 : 400 }));
            return;
          }

          if (action === 'CREATE') {
            const {
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
              adminEmail: session.email || 'admin.econ@thapar.edu',
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

          if (action === 'SET_STATUS') {
            const { ipo_id, status, reset_bids } = body;
            if (!ipo_id || !status) {
              resolve(NextResponse.json({ success: false, error: 'ipo_id and status are required' }, { status: 400 }));
              return;
            }
            const result = updateIPOStatus({ ipo_id, status, reset_bids: Boolean(reset_bids) });
            resolve(NextResponse.json(result, { status: result.success ? 200 : 400 }));
            return;
          }
        }

        resolve(NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 }));
      } catch (error: any) {
        resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
      }
    });
  });
}

