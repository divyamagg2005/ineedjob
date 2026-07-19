import { NextRequest, NextResponse } from 'next/server';
import { getRequestAccessToken } from '@/lib/user-context';
import { sendInitialCampaignEmailWithErrorHandling, sendFollowUpCampaignEmailWithErrorHandling } from '@/lib/email-sending';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const accessToken = getRequestAccessToken(request);
    const campaignId = Number(payload?.campaignId ?? payload?.campaign_id);
    const companyId = Number(payload?.companyId ?? payload?.company_id);
    const followUp = Boolean(payload?.followUp ?? payload?.follow_up ?? payload?.mode === 'followup');

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
