'use server'

import { query } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export interface DraftPayload {
  companyId: number;
  subject: string;
  body: string;
}

export interface DraftResult {
  success: boolean;
  error?: string;
  campaignId?: number;
  subject?: string | null;
  body?: string | null;
  status?: string | null;
}

function normalizeDraftValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isEditableCampaignStatus(status: string | null | undefined): boolean {
  if (typeof status !== 'string') {
    return true;
  }

  return status.trim().toLowerCase() !== 'sent';
}

export async function loadDraftForCompany(companyId: number, accessToken?: string | null): Promise<DraftResult> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query<{
      id: number;
      email_subject: string | null;
      email_body: string | null;
      status: string | null;
    }>(
      `SELECT id, email_subject, email_body, status
       FROM outreach_campaigns
       WHERE user_id = $1 AND company_id = $2 AND (status IS NULL OR LOWER(status) <> 'sent')
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [authenticatedUser.id, companyId]
    );

    const row = result.rows[0];
    return {
      success: true,
      campaignId: row?.id,
      subject: row?.email_subject ?? null,
      body: row?.email_body ?? null,
      status: row?.status ?? null,
    };
  } catch (error) {
    console.error('Failed to load draft:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load draft.',
    };
  }
}

export async function saveDraftForCompany(payload: DraftPayload, accessToken?: string | null): Promise<DraftResult> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const subject = normalizeDraftValue(payload.subject);
    const body = normalizeDraftValue(payload.body);

    if (subject === null || body === null) {
      throw new Error('Please enter both a subject and email body before saving.');
    }

    const existing = await query<{ id: number; status: string | null }>(
      `SELECT id, status
       FROM outreach_campaigns
       WHERE user_id = $1 AND company_id = $2 AND (status IS NULL OR LOWER(status) <> 'sent')
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [authenticatedUser.id, payload.companyId]
    );

    if (existing.rows[0]?.id && isEditableCampaignStatus(existing.rows[0].status)) {
      const updated = await query<{
        id: number;
        email_subject: string | null;
        email_body: string | null;
        status: string | null;
      }>(
        `UPDATE outreach_campaigns
         SET email_subject = $1,
             email_body = $2,
             status = 'DRAFT',
             updated_at = NOW()
         WHERE id = $3 AND user_id = $4
         RETURNING id, email_subject, email_body, status`,
        [subject, body, existing.rows[0].id, authenticatedUser.id]
      );

      const row = updated.rows[0];
      return {
        success: true,
        campaignId: row?.id,
        subject: row?.email_subject ?? null,
        body: row?.email_body ?? null,
        status: row?.status ?? null,
      };
    }

    const inserted = await query<{
      id: number;
      email_subject: string | null;
      email_body: string | null;
      status: string | null;
    }>(
      `INSERT INTO outreach_campaigns (user_id, company_id, email_subject, email_body, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'DRAFT', NOW(), NOW())
       RETURNING id, email_subject, email_body, status`,
      [authenticatedUser.id, payload.companyId, subject, body]
    );

    const row = inserted.rows[0];
    return {
      success: true,
      campaignId: row?.id,
      subject: row?.email_subject ?? null,
      body: row?.email_body ?? null,
      status: row?.status ?? null,
    };
  } catch (error) {
    console.error('Failed to save draft:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save draft.',
    };
  }
}
