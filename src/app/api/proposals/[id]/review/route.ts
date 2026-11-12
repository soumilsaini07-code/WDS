import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { reviewTradeProposal } from '@/lib/db';
import { Role } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentSession();
    const body = await request.json();

    const { action, feedback, reviewer_role, reviewer_email } = body;

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        { error: 'Action must be APPROVE or REJECT.' },
        { status: 400 }
      );
    }

    // Role check: prioritize session, fallback to body role for demo seat switching
    const role: Role = session?.role || (reviewer_role as Role) || 'executive_board';
    const email = session?.email || reviewer_email || 'exec.board@thapar.edu';
    const userId = session?.userId || 'user-exec-board';

    const result = await reviewTradeProposal(
      id,
      { id: userId, email, role },
      action,
      feedback
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      proposal: result.proposal,
      message:
        action === 'APPROVE'
          ? 'Proposal APPROVED: Trade executed into Syndicate Fund portfolio.'
          : 'Proposal REJECTED: Feedback recorded in governance audit trail.',
    });
  } catch (err: any) {
    console.error('Error reviewing proposal:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to review trade proposal' },
      { status: 500 }
    );
  }
}
