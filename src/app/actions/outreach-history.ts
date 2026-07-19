'use server'

import { query } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export interface CompanyOutreachHistoryRow {
  campaignId: number;
  recipientEmail: string | null;
  campaignStatus: string | null;
  logStatus: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  sendType: string | null;
  errorMessage: string | null;
  sentAt: string | null;
}

export async function getCompanyOutreachHistory(companyId: number, accessToken?: string | null): Promise<CompanyOutreachHistoryRow[]> {
  const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

  const result = await query<{
    campaign_id: number;
    recipient_email: string | null;
    campaign_status: string | null;
    log_status: string | null;
    gmail_message_id: string | null;
    gmail_thread_id: string | null;
    send_type: string | null;
    error_message: string | null;
    sent_at: string | null;
  }>(
    `SELECT
      oc.id AS campaign_id,
      re.recruiter_email AS recipient_email,
      oc.status AS campaign_status,
      el.status AS log_status,
      el.gmail_message_id,
      el.gmail_thread_id,
      el.send_type,
      el.error_message,
      el.sent_at
     FROM outreach_campaigns oc
     LEFT JOIN recruiter_emails re ON re.id = oc.recruiter_email_id
     LEFT JOIN email_logs el ON el.campaign_id = oc.id
     WHERE oc.user_id = $1
       AND oc.company_id = $2
     ORDER BY oc.created_at DESC, oc.id DESC, el.sent_at DESC NULLS LAST, el.id DESC`,
    [authenticatedUser.id, companyId]
  );

  return result.rows.map((row) => ({
    campaignId: row.campaign_id,
    recipientEmail: row.recipient_email ?? null,
    campaignStatus: row.campaign_status ?? null,
    logStatus: row.log_status ?? null,
    gmailMessageId: row.gmail_message_id ?? null,
    gmailThreadId: row.gmail_thread_id ?? null,
    sendType: row.send_type ?? null,
    errorMessage: row.error_message ?? null,
    sentAt: row.sent_at ?? null,
  }));
}
