import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AuthError, getAuthenticatedUserContext, getRequestAccessToken } from '@/lib/user-context';

interface CampaignRow {
  id: string;
  user_id: string;
  company_id: number | null;
  recruiter_email_id: number | null;
  email_subject: string | null;
  email_body: string | null;
  resume_url: string | null;
  status: string | null;
  sent_at: string | null;
  followup_count: number;
  created_at: string | null;
  last_sent_at: string | null;
  next_followup_at: string | null;
  updated_at: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getRequestAccessToken(request);
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query<CampaignRow>(
      `SELECT id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status, sent_at, followup_count, created_at, last_sent_at, next_followup_at, updated_at
       FROM outreach_campaigns
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [authenticatedUser.id]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list outreach campaigns:', error);
    return NextResponse.json({ error: 'Failed to list outreach campaigns.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const accessToken = getRequestAccessToken(request);
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const companyId = payload?.company_id ?? null;
    const recruiterEmailId = payload?.recruiter_email_id ?? null;
    const emailSubject = payload?.email_subject ?? null;
    const emailBody = payload?.email_body ?? null;
    const resumeUrl = payload?.resume_url ?? null;
    const status = payload?.status ?? 'PENDING';

    const result = await query<CampaignRow>(
      `INSERT INTO outreach_campaigns (
        user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status, sent_at, followup_count, created_at, last_sent_at, next_followup_at, updated_at`,
      [authenticatedUser.id, companyId, recruiterEmailId, emailSubject, emailBody, resumeUrl, status]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create outreach campaign:', error);
    return NextResponse.json({ error: 'Failed to create outreach campaign.' }, { status: 500 });
  }
}
