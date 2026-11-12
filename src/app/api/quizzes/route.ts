import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getQuizzes, submitQuizScore } from '@/lib/db';

export async function GET() {
  const quizzes = await getQuizzes();
  return NextResponse.json({ quizzes });
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId, score, totalQuestions } = await request.json();

    if (!quizId || score === undefined || !totalQuestions) {
      return NextResponse.json(
        { error: 'Missing quiz grading payload' },
        { status: 400 }
      );
    }

    const result = await submitQuizScore(session.userId, quizId, score, totalQuestions);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
