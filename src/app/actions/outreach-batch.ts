'use server'

import { query } from '@/lib/db';
import { sendInitialCampaignEmailToRecipient, type SendCampaignResult } from '@/lib/email-sending';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export interface CompanyRecipientSummary {
  email: string;
  recruiterEmailId?: number | null;
  source?: string | null;
  verified?: boolean | null;
}

export interface BatchRecipientSendPayload {
  companyId?: number | null;
  recipientEmail: string;
  emailSubject: string;
  emailBody: string;
  accessToken?: string | null;
}

export interface LoadRecipientsResult {
  success: boolean;
  error?: string;
  companyId?: number | null;
  recipients?: CompanyRecipientSummary[];
}

export async function loadCompanyRecipients(companyName: string, accessToken?: string | null): Promise<LoadRecipientsResult> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const company = await query<{ id: number | null; company_name: string | null }>(
      `SELECT id, company_name
       FROM companies
       WHERE lower(company_name) = lower($1)
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [companyName]
    );

    const companyId = company.rows[0]?.id ?? null;
    if (!companyId) {
      return { success: false, error: 'No company matching that name was found.', companyId: null, recipients: [] };
    }

    const recipients = await query<{ recruiter_email: string | null; source: string | null; verified: boolean | null }>(
      `SELECT recruiter_email, source, verified
       FROM (
         SELECT email AS recruiter_email, 'company_email' AS source, true AS verified, created_at
         FROM company_emails
         WHERE company_id = $1
         UNION ALL
         SELECT recruiter_email, COALESCE(source, 'manual') AS source, COALESCE(verified, false) AS verified, created_at
         FROM recruiter_emails
         WHERE company_id = $1
       ) combined
       ORDER BY created_at ASC, recruiter_email ASC`,
      [companyId]
    );

    const normalizedRecipients = recipients.rows
      .map((row) => ({
        email: normalizeEmail(row.recruiter_email),
        source: row.source ?? null,
        verified: row.verified ?? null,
      }))
      .filter((row): row is { email: string; source: string | null; verified: boolean | null } => Boolean(row.email))
      .map((row) => ({ email: row.email, source: row.source, verified: row.verified }));

    return { success: true, companyId, recipients: normalizedRecipients };
  } catch (error) {
    console.error('Failed to load company recipients:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to load recipients.', companyId: null, recipients: [] };
  }
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function sendBatchRecipientInitialCampaign(payload: BatchRecipientSendPayload): Promise<SendCampaignResult> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, payload.accessToken);

    const normalizedRecipient = payload.recipientEmail?.trim();
    if (!normalizedRecipient) {
      return { success: false, error: 'A recipient email is required.', status: 'FAILED' };
    }

    const recipientLimitResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM email_logs el
       JOIN outreach_campaigns oc ON oc.id = el.campaign_id
       WHERE oc.user_id = $1
         AND el.send_type = 'INITIAL'
         AND UPPER(el.status) = 'SENT'
         AND el.sent_at >= NOW() - INTERVAL '1 hour'`,
      [authenticatedUser.id]
    );

    const recentSentCount = Number.parseInt(recipientLimitResult.rows[0]?.count ?? '0', 10);
    if (recentSentCount >= 20) {
      return {
        success: false,
        error: 'Per-user send limit reached. Please wait before sending more initial campaigns.',
        status: 'FAILED',
        recipient: normalizedRecipient,
      };
    }

    const result = await sendInitialCampaignEmailToRecipient({
      accessToken: payload.accessToken,
      companyId: payload.companyId ?? null,
      recipientEmail: normalizedRecipient,
      emailSubject: payload.emailSubject,
      emailBody: payload.emailBody,
      resumeUrl: null,
    });

    return result;
  } catch (error) {
    console.error('Failed to send batch recipient email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to send recipient email.',
      status: 'FAILED',
      recipient: payload.recipientEmail,
    };
  }
}
