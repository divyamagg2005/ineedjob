import { NextRequest, NextResponse } from 'next/server';
import { getRequestAccessToken } from '@/lib/user-context';
import { sendInitialCampaignEmailWithErrorHandling, sendFollowUpCampaignEmailWithErrorHandling, sendInitialCampaignEmailToRecipient } from '@/lib/email-sending';
import { query } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const accessToken = getRequestAccessToken(request);
    const campaignId = Number(payload?.campaignId ?? payload?.campaign_id);
    const companyId = Number(payload?.companyId ?? payload?.company_id);
    const followUp = Boolean(payload?.followUp ?? payload?.follow_up ?? payload?.mode === 'followup');
    const recipientEmail = typeof payload?.recipientEmail === 'string' ? payload.recipientEmail.trim() : null;

    // When a specific recipient is provided, look up the saved draft and send directly to that address
    if (recipientEmail && Number.isInteger(companyId) && companyId > 0 && !followUp) {
      const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

      const draftResult = await query<{ email_subject: string | null; email_body: string | null; resume_url: string | null }>(
        `SELECT
           -- Take subject/body from the most recent draft
           (SELECT email_subject FROM outreach_campaigns WHERE user_id = $1 AND company_id = $2 ORDER BY updated_at DESC, created_at DESC LIMIT 1) AS email_subject,
           (SELECT email_body FROM outreach_campaigns WHERE user_id = $1 AND company_id = $2 ORDER BY updated_at DESC, created_at DESC LIMIT 1) AS email_body,
           -- Take resume_url from whichever campaign has one set (most recently updated)
           (SELECT resume_url FROM outreach_campaigns WHERE user_id = $1 AND company_id = $2 AND resume_url IS NOT NULL ORDER BY updated_at DESC, created_at DESC LIMIT 1) AS resume_url`,
        [authenticatedUser.id, companyId]
      );

      const draft = draftResult.rows[0];
      if (!draft?.email_subject || !draft?.email_body) {
        return NextResponse.json({ error: 'No saved draft found for this company. Please save a draft first.' }, { status: 400 });
      }

      // Log so we can debug resume attachment issues
      console.log(`[send] companyId=${companyId} resume_url=${draft.resume_url ?? 'none'}`);

      const result = await sendInitialCampaignEmailToRecipient({
        accessToken,
        companyId,
        recipientEmail,
        emailSubject: draft.email_subject,
        emailBody: draft.email_body,
        resumeUrl: draft.resume_url ?? null,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error ?? 'Failed to send email.' }, { status: 500 });
      }
      return NextResponse.json(result, { status: 200 });
    }

    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      if (Number.isInteger(companyId) && companyId > 0) {
        if (followUp) {
          const result = await sendFollowUpCampaignEmailWithErrorHandling({ companyId, accessToken });
          if (!result.success) {
            return NextResponse.json({ error: result.error ?? 'Failed to send follow-up email.' }, { status: 500 });
          }
          return NextResponse.json(result, { status: 200 });
        }

        const result = await sendInitialCampaignEmailWithErrorHandling({ companyId, accessToken });
        if (!result.success) {
          return NextResponse.json({ error: result.error ?? 'Failed to send email.' }, { status: 500 });
        }
        return NextResponse.json(result, { status: 200 });
      }

      return NextResponse.json({ error: 'A valid campaign or company ID is required.' }, { status: 400 });
    }

    const result = followUp
      ? await sendFollowUpCampaignEmailWithErrorHandling({ campaignId, accessToken })
      : await sendInitialCampaignEmailWithErrorHandling({ campaignId, accessToken });

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? (followUp ? 'Failed to send follow-up email.' : 'Failed to send email.') }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Failed to send outreach email:', error);
    return NextResponse.json({ error: 'Failed to send outreach email.' }, { status: 500 });
  }
}
