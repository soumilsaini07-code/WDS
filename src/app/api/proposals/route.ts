import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getTradeProposals, createTradeProposal } from '@/lib/db';
import { ProposalStatus, ProposalThesisCategory, Role, TransactionType } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ProposalStatus | null;

    const proposals = await getTradeProposals(status || undefined);
    return NextResponse.json({ success: true, proposals });
  } catch (err: any) {
    console.error('Error fetching proposals:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch trade proposals' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    const body = await request.json();

    const {
      stockId,
      type,
      quantity,
      thesis_category,
      thesis_notes,
      proposer_role = 'participant',
      proposer_email,
    } = body;

    if (!stockId || !type || !quantity || !thesis_category || !thesis_notes) {
      return NextResponse.json(
        {
          error:
            'Missing required parameters: stockId, type, quantity, thesis_category, thesis_notes are mandatory.',
        },
        { status: 400 }
      );
    }

    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json(
        { error: 'Order type must be BUY or SELL.' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer.' },
        { status: 400 }
      );
    }

    const proposerId = session?.userId || 'user-participant-session';
    const proposerEmail = session?.email || proposer_email || 'participant@thapar.edu';
    const activeRole: Role = session?.role || (proposer_role as Role) || 'participant';

    const result = await createTradeProposal({
      proposer_id: proposerId,
      proposer_email: proposerEmail,
      proposer_role: activeRole,
      stock_id: stockId,
      type: type as TransactionType,
      quantity: parsedQty,
      thesis_category: thesis_category as ProposalThesisCategory,
      thesis_notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      proposal: result.proposal,
      message: 'Proposal successfully logged into Executive Board queue for risk evaluation.',
    });
  } catch (err: any) {
    console.error('Error creating trade proposal:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit trade proposal' },
      { status: 500 }
    );
  }
}
