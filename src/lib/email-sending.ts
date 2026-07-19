import { query } from '@/lib/db';
import { getAuthenticatedUserContext, AuthError } from '@/lib/user-context';
import { getResumeBufferFromS3 } from '@/lib/s3';

export interface SendCampaignResult {
  success: boolean;
  error?: string;
  status?: string;
  campaignId?: number;
  messageId?: string | null;
  threadId?: string | null;
  recipient?: string | null;
}

interface CampaignRow {
  id: number;
  user_id: string;
  company_id: number | null;
  recruiter_email_id: number | null;
  email_subject: string | null;
  email_body: string | null;
  resume_url: string | null;
  status: string | null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createMimeMessage({
  recipient,
  subject,
  body,
  attachmentBuffer,
  attachmentName,
  senderEmail,
}: {
  recipient: string;
  subject: string;
  body: string;
  attachmentBuffer?: Buffer | null;
  attachmentName?: string | null;
  senderEmail: string;
}): string {
  if (!attachmentBuffer) {
    const lines = [
      `From: ${senderEmail}`,
      `To: ${recipient}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
      '',
    ];

    return lines.join('\r\n');
  }

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const attachmentBase64 = attachmentBuffer.toString('base64');
  const finalAttachmentName = attachmentName || 'resume.pdf';

  const lines = [
    `From: ${senderEmail}`,
    `To: ${recipient}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${finalAttachmentName}"`,
    `Content-Disposition: attachment; filename="${finalAttachmentName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    attachmentBase64,
    '',
    `--${boundary}--`,
    '',
  ];

  return lines.join('\r\n');
}

async function resolveRecipientEmail(campaign: CampaignRow): Promise<{ recipientEmail: string; recruiterEmailId: number | null }> {
  if (campaign.recruiter_email_id) {
    const recruiter = await query<{ id: number; recruiter_email: string | null }>(
      `SELECT id, recruiter_email FROM recruiter_emails WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [campaign.recruiter_email_id, campaign.company_id]
    );

    const recruiterEmail = normalizeText(recruiter.rows[0]?.recruiter_email);
    if (recruiterEmail) {
      return { recipientEmail: recruiterEmail, recruiterEmailId: recruiter.rows[0]?.id ?? campaign.recruiter_email_id };
    }
  }

  if (campaign.company_id) {
    const companyEmail = await query<{ id: number; email: string | null }>(
      `SELECT id, email FROM company_emails WHERE company_id = $1 ORDER BY created_at ASC, id ASC LIMIT 1`,
      [campaign.company_id]
    );

    const candidateEmail = normalizeText(companyEmail.rows[0]?.email);
    if (candidateEmail) {
      const existingRecruiter = await query<{ id: number }>(
        `SELECT id FROM recruiter_emails WHERE company_id = $1 AND lower(recruiter_email) = lower($2) LIMIT 1`,
        [campaign.company_id, candidateEmail]
      );

      if (existingRecruiter.rows[0]?.id) {
        return { recipientEmail: candidateEmail, recruiterEmailId: existingRecruiter.rows[0].id };
      }

      const inserted = await query<{ id: number }>(
        `INSERT INTO recruiter_emails (company_id, recruiter_email, source, verified, created_at)
         VALUES ($1, $2, 'manual', true, NOW())
         RETURNING id`,
        [campaign.company_id, candidateEmail]
      );

      return { recipientEmail: candidateEmail, recruiterEmailId: inserted.rows[0]?.id ?? null };
    }
  }

  throw new Error('No recipient email is available for this company.');
}

async function resolveRecipientEmailForCompany({
  companyId,
  recipientEmail,
}: {
  companyId: number | null;
  recipientEmail: string;
}): Promise<{ recipientEmail: string; recruiterEmailId: number | null }> {
  const normalizedRecipientEmail = normalizeText(recipientEmail);
  if (!normalizedRecipientEmail) {
    throw new Error('A recipient email is required.');
  }

  if (!companyId) {
    return { recipientEmail: normalizedRecipientEmail, recruiterEmailId: null };
  }

  const existingRecruiter = await query<{ id: number; recruiter_email: string | null }>(
    `SELECT id, recruiter_email FROM recruiter_emails WHERE company_id = $1 AND lower(recruiter_email) = lower($2) LIMIT 1`,
    [companyId, normalizedRecipientEmail]
  );

  if (existingRecruiter.rows[0]?.id) {
    return {
      recipientEmail: normalizedRecipientEmail,
      recruiterEmailId: existingRecruiter.rows[0].id,
    };
  }

  const inserted = await query<{ id: number }>(
    `INSERT INTO recruiter_emails (company_id, recruiter_email, source, verified, created_at)
     VALUES ($1, $2, 'manual', true, NOW())
     RETURNING id`,
    [companyId, normalizedRecipientEmail]
  );

  return {
    recipientEmail: normalizedRecipientEmail,
    recruiterEmailId: inserted.rows[0]?.id ?? null,
  };
}

async function findExistingSentCampaign({
  userId,
  companyId,
  recruiterEmailId,
  subject,
  body,
  resumeUrl,
}: {
  userId: string;
  companyId: number | null;
  recruiterEmailId: number | null;
  subject: string | null;
  body: string | null;
  resumeUrl: string | null;
}): Promise<number | null> {
  const result = await query<{ id: number }>(
    `SELECT id
     FROM outreach_campaigns
     WHERE user_id = $1
       AND (($2::bigint IS NOT NULL AND company_id = $2) OR ($2::bigint IS NULL AND company_id IS NULL))
       AND (($3::bigint IS NOT NULL AND recruiter_email_id = $3) OR ($3::bigint IS NULL AND recruiter_email_id IS NULL))
       AND lower(COALESCE(email_subject, '')) = lower($4)
       AND lower(COALESCE(email_body, '')) = lower($5)
       AND COALESCE(resume_url, '') = COALESCE($6, '')
       AND UPPER(COALESCE(status, '')) = 'SENT'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, companyId ?? null, recruiterEmailId ?? null, subject ?? '', body ?? '', resumeUrl ?? '']
  );

  return result.rows[0]?.id ?? null;
}

export async function sendInitialCampaignEmailToRecipient({
  accessToken,
  companyId,
  recipientEmail,
  emailSubject,
  emailBody,
  resumeUrl,
}: {
  accessToken?: string | null;
  companyId?: number | null;
  recipientEmail: string;
  emailSubject: string;
  emailBody: string;
  resumeUrl?: string | null;
}): Promise<SendCampaignResult> {
  const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);
  const normalizedSubject = normalizeText(emailSubject);
  const normalizedBody = normalizeText(emailBody);
  const normalizedResumeUrl = normalizeText(resumeUrl);

  if (!normalizedSubject) {
    return { success: false, error: 'This campaign is missing a subject.', status: 'FAILED', recipient: recipientEmail };
  }

  if (!normalizedBody) {
    return { success: false, error: 'This campaign is missing an email body.', status: 'FAILED', recipient: recipientEmail };
  }

  const { recipientEmail: resolvedRecipientEmail, recruiterEmailId } = await resolveRecipientEmailForCompany({
    companyId: companyId ?? null,
    recipientEmail,
  });

  const existingSentCampaignId = await findExistingSentCampaign({
    userId: authenticatedUser.id,
    companyId: companyId ?? null,
    recruiterEmailId,
    subject: normalizedSubject,
    body: normalizedBody,
    resumeUrl: normalizedResumeUrl,
  });

  if (existingSentCampaignId) {
    return {
      success: false,
      error: 'This recipient already received the same initial campaign.',
      status: 'DUPLICATE',
      recipient: resolvedRecipientEmail,
      campaignId: existingSentCampaignId,
    };
  }

  const recentSentResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM outreach_campaigns
     WHERE user_id = $1
       AND UPPER(COALESCE(status, '')) = 'SENT'
       AND sent_at >= NOW() - INTERVAL '1 hour'`,
    [authenticatedUser.id]
  );

  const recentSentCount = Number.parseInt(recentSentResult.rows[0]?.count ?? '0', 10);
  if (recentSentCount >= 8) {
    return {
      success: false,
      error: 'Per-user send limit reached. Please wait before sending more initial campaigns.',
      status: 'FAILED',
      recipient: resolvedRecipientEmail,
    };
  }

  const campaignInsert = await query<{ id: number }>(
    `INSERT INTO outreach_campaigns (
      user_id,
      company_id,
      recruiter_email_id,
      email_subject,
      email_body,
      resume_url,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'SENDING', NOW(), NOW())
     RETURNING id`,
    [authenticatedUser.id, companyId ?? null, recruiterEmailId ?? null, normalizedSubject, normalizedBody, normalizedResumeUrl]
  );

  const campaignId = campaignInsert.rows[0]?.id;
  if (!campaignId) {
    throw new Error('Unable to create a recipient campaign record.');
  }

  try {
    await query(
      `UPDATE outreach_campaigns
       SET status = 'SENDING', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [campaignId, authenticatedUser.id]
    );

    let attachmentBuffer: Buffer | null = null;
    let attachmentName: string | null = null;

    if (normalizedResumeUrl) {
      try {
        attachmentBuffer = await getResumeBufferFromS3(normalizedResumeUrl);
        attachmentName = normalizedResumeUrl.split('/').pop() || 'resume.pdf';
      } catch (error) {
        console.warn('Unable to fetch resume attachment for batch send, continuing without attachment.', error);
      }
    }

    const senderEmail = authenticatedUser.email;
    const mimeMessage = createMimeMessage({
      recipient: resolvedRecipientEmail,
      subject: normalizedSubject,
      body: normalizedBody,
      attachmentBuffer,
      attachmentName,
      senderEmail,
    });

    const encodedMessage = Buffer.from(mimeMessage, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    const gmailPayload = await gmailResponse.json().catch(() => ({}));

    if (!gmailResponse.ok) {
      const errorMessage = typeof gmailPayload?.error?.message === 'string'
        ? gmailPayload.error.message
        : 'Gmail rejected the message.';
      throw new Error(errorMessage);
    }

    const messageId = typeof gmailPayload?.id === 'string' ? gmailPayload.id : null;
    const threadId = typeof gmailPayload?.threadId === 'string' ? gmailPayload.threadId : null;

    await query(
      `UPDATE outreach_campaigns
       SET recruiter_email_id = $1,
           status = 'SENT',
           sent_at = NOW(),
           last_sent_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [recruiterEmailId ?? null, campaignId, authenticatedUser.id]
    );

    await query(
      `INSERT INTO email_logs (campaign_id, gmail_message_id, gmail_thread_id, send_type, status, error_message, sent_at)
       VALUES ($1, $2, $3, 'INITIAL', 'SENT', NULL, NOW())`,
      [campaignId, messageId, threadId]
    );

    return {
      success: true,
      status: 'SENT',
      campaignId,
      messageId,
      threadId,
      recipient: resolvedRecipientEmail,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send email.';

    await query(
      `UPDATE outreach_campaigns SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND user_id = $2`,
      [campaignId, authenticatedUser.id]
    );

    await query(
      `INSERT INTO email_logs (campaign_id, gmail_message_id, gmail_thread_id, send_type, status, error_message, sent_at)
       VALUES ($1, NULL, NULL, 'INITIAL', 'FAILED', $2, NOW())`,
      [campaignId, message]
    );

    return {
      success: false,
      error: message,
      status: 'FAILED',
      campaignId,
      recipient: resolvedRecipientEmail,
    };
  }
}

export async function sendInitialCampaignEmail({
  campaignId,
  companyId,
  accessToken,
}: {
  campaignId?: number | null;
  companyId?: number | null;
  accessToken?: string | null;
}): Promise<SendCampaignResult> {
  const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

  const campaignQuery = await query<CampaignRow>(
    `SELECT id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status
     FROM outreach_campaigns
     WHERE user_id = $1
       AND (($2::bigint IS NOT NULL AND id = $2) OR ($3::bigint IS NOT NULL AND company_id = $3))
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [authenticatedUser.id, campaignId ?? null, companyId ?? null]
  );

  const campaign = campaignQuery.rows[0];
  if (!campaign) {
    throw new Error('Campaign not found or access denied.');
  }

  const normalizedStatus = campaign.status?.trim().toUpperCase();
  if (normalizedStatus === 'SENT') {
    throw new Error('This campaign has already been sent.');
  }

  if (normalizedStatus === 'SENDING') {
    throw new Error('A send request is already in progress for this campaign.');
  }

  await query(
    `UPDATE outreach_campaigns
     SET status = 'SENDING', updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [campaign.id, authenticatedUser.id]
  );

  const subject = normalizeText(campaign.email_subject);
  const body = normalizeText(campaign.email_body);
  const resumeKey = normalizeText(campaign.resume_url);

  if (!subject) {
    throw new Error('This campaign is missing a subject.');
  }

  if (!body) {
    throw new Error('This campaign is missing an email body.');
  }

  if (!resumeKey) {
    throw new Error('This campaign is missing a resume attachment.');
  }

  const { recipientEmail, recruiterEmailId } = await resolveRecipientEmail(campaign);

  let attachmentBuffer: Buffer;
  try {
    attachmentBuffer = await getResumeBufferFromS3(resumeKey);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to fetch the attached resume.');
  }

  const senderEmail = authenticatedUser.email;
  const attachmentName = resumeKey.split('/').pop() || 'resume.pdf';
  const mimeMessage = createMimeMessage({
    recipient: recipientEmail,
    subject,
    body,
    attachmentBuffer,
    attachmentName,
    senderEmail,
  });

  const encodedMessage = Buffer.from(mimeMessage, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  const gmailPayload = await gmailResponse.json().catch(() => ({}));

  if (!gmailResponse.ok) {
    const errorMessage = typeof gmailPayload?.error?.message === 'string'
      ? gmailPayload.error.message
      : 'Gmail rejected the message.';
    throw new Error(errorMessage);
  }

  const messageId = typeof gmailPayload?.id === 'string' ? gmailPayload.id : null;
  const threadId = typeof gmailPayload?.threadId === 'string' ? gmailPayload.threadId : null;

  await query(
    `UPDATE outreach_campaigns
     SET recruiter_email_id = $1,
         status = 'SENT',
         sent_at = NOW(),
         last_sent_at = NOW(),
         updated_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [recruiterEmailId ?? campaign.recruiter_email_id, campaign.id, authenticatedUser.id]
  );

  await query(
    `INSERT INTO email_logs (campaign_id, gmail_message_id, gmail_thread_id, send_type, status, error_message, sent_at)
     VALUES ($1, $2, $3, 'INITIAL', 'SENT', NULL, NOW())`,
    [campaign.id, messageId, threadId]
  );

  return {
    success: true,
    status: 'SENT',
    campaignId: campaign.id,
    messageId,
    threadId,
    recipient: recipientEmail,
  };
}

export async function sendInitialCampaignEmailWithErrorHandling({
  campaignId,
  companyId,
  accessToken,
}: {
  campaignId?: number | null;
  companyId?: number | null;
  accessToken?: string | null;
}): Promise<SendCampaignResult> {
  try {
    return await sendInitialCampaignEmail({ campaignId, companyId, accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send email.';
    const typedError = error as Error & { status?: number };
    const authError = error instanceof AuthError;
    const statusCode = authError ? typedError.status ?? 401 : 500;

    try {
      const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);
      const campaign = await query<{ id: number }>(
        `SELECT id FROM outreach_campaigns WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [campaignId, authenticatedUser.id]
      );

      if (campaign.rows[0]?.id) {
        await query(
          `UPDATE outreach_campaigns SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND user_id = $2`,
          [campaign.rows[0].id, authenticatedUser.id]
        );

        await query(
          `INSERT INTO email_logs (campaign_id, gmail_message_id, gmail_thread_id, send_type, status, error_message, sent_at)
           VALUES ($1, NULL, NULL, 'INITIAL', 'FAILED', $2, NOW())`,
          [campaign.rows[0].id, message]
        );
      }
    } catch (logError) {
      console.error('Failed to log send error:', logError);
    }

    return {
      success: false,
      error: message,
      status: 'FAILED',
      campaignId: campaignId ?? undefined,
    };
  }
}
