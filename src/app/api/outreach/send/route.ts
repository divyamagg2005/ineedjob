import { NextRequest, NextResponse } from 'next/server';
import { getRequestAccessToken } from '@/lib/user-context';
import { sendInitialCampaignEmailWithErrorHandling } from '@/lib/email-sending';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const accessToken = getRequestAccessToken(request);
    const campaignId = Number(payload?.campaignId ?? payload?.campaign_id);

    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return NextResponse.json({ error: 'A valid campaign ID is required.' }, { status: 400 });
    }

    const result = await sendInitialCampaignEmailWithErrorHandling({ campaignId, accessToken });

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to send email.' }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Failed to send initial campaign email:', error);
    return NextResponse.json({ error: 'Failed to send initial campaign email.' }, { status: 500 });
  }
}
