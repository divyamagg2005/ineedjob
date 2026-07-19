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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accessToken = getRequestAccessToken(request);
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query<CampaignRow>(
      `SELECT id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status, sent_at, followup_count, created_at, last_sent_at, next_followup_at, updated_at
       FROM outreach_campaigns
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [id, authenticatedUser.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Campaign not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to fetch outreach campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch outreach campaign.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const accessToken = getRequestAccessToken(request);
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query<CampaignRow>(
      `SELECT id, user_id FROM outreach_campaigns WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, authenticatedUser.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Campaign not found or access denied.' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [authenticatedUser.id, id];
    let index = 2;

    if (payload?.email_subject !== undefined) {
      updates.push(`email_subject = $${index++}`);
      values.push(payload.email_subject ?? null);
    }

    if (payload?.email_body !== undefined) {
      updates.push(`email_body = $${index++}`);
      values.push(payload.email_body ?? null);
    }

    if (payload?.status !== undefined) {
      updates.push(`status = $${index++}`);
      values.push(payload.status ?? null);
    }

    if (payload?.resume_url !== undefined) {
      updates.push(`resume_url = $${index++}`);
      values.push(payload.resume_url ?? null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);

    const updateResult = await query<CampaignRow>(
      `UPDATE outreach_campaigns SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status, sent_at, followup_count, created_at, last_sent_at, next_followup_at, updated_at`,
      [id, authenticatedUser.id, ...values.slice(2)]
    );

    return NextResponse.json(updateResult.rows[0]);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update outreach campaign:', error);
    return NextResponse.json({ error: 'Failed to update outreach campaign.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accessToken = getRequestAccessToken(request);
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query<{ id: string }>(
      `DELETE FROM outreach_campaigns WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, authenticatedUser.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Campaign not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete outreach campaign:', error);
    return NextResponse.json({ error: 'Failed to delete outreach campaign.' }, { status: 500 });
  }
}
