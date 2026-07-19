import { query, transaction } from '@/lib/db';
import { getAuthenticatedUserContext, AuthError } from '@/lib/user-context';
import { getResumeBufferFromS3 } from '@/lib/s3';

const DEFAULT_MAX_INITIAL_SENDS_PER_HOUR = 8;
const DEFAULT_MAX_BATCH_SENDS_PER_HOUR = 20;

function getConfiguredSendLimit(defaultValue: number, envVarName: string): number {
  const configuredValue = Number.parseInt(process.env[envVarName] ?? '', 10);
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : defaultValue;
}

function normalizeRecipientValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidRecipientAddress(value: string | null | undefined): boolean {
  const normalized = normalizeRecipientValue(value);
  if (!normalized) {
    return false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(normalized);
}

function getSendContextLogFields({ campaignId, companyId, recipientEmail, followUp }: { campaignId?: number | null; companyId?: number | null; recipientEmail?: string | null; followUp?: boolean }) {
  return {
    campaignId: campaignId ?? null,
    companyId: companyId ?? null,
    recipientEmail: recipientEmail ? recipientEmail.replace(/(.{2}).+(@.*)/, '$1***$2') : null,
    followUp: Boolean(followUp),
  };
}

export interface SendCampaignResult {
  success: boolean;
  error?: string;
  status?: string;
  campaignId?: number;
  messageId?: string | null;
  threadId?: string | null;
  recipient?: string | null;
}

function normalizeStatusValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function toDisplayStatus(status: string | null | undefined): string {
  const normalized = normalizeStatusValue(status);
  if (!normalized) {
    return 'NEW';
  }

  switch (normalized) {
    case 'PENDING':
    case 'NEW':
      return 'NEW';
    case 'DRAFT':
      return 'DRAFT';
    case 'QUEUED':
      return 'QUEUED';
    case 'SENDING':
      return 'SENDING';
    case 'SENT':
    case 'COMPLETED':
      return 'SENT';
    case 'PARTIALLY SENT':
    case 'PARTIALLY_SENT':
      return 'PARTIALLY SENT';
    case 'FAILED':
      return 'FAILED';
    case 'FOLLOW-UP DUE':
    case 'FOLLOW_UP_DUE':
      return 'FOLLOW-UP DUE';
    default:
      return normalized;
  }
}

function toSafeUserError(message: string | null | undefined): string {
  if (!message) {
    return 'We could not deliver this email. Please try again later.';
  }

  const normalized = message.toLowerCase();
  if (normalized.includes('invalid google access token') || normalized.includes('authentication required')) {
    return 'Your Google sign-in session expired. Please sign out and sign in again.';
  }

  if (normalized.includes('gmail') || normalized.includes('quota') || normalized.includes('rate limit')) {
    return 'We could not send the email right now. Please try again later.';
  }

  return 'We could not deliver this email. Please try again later.';
}

async function upsertCampaignStatus({
  campaignId,
  userId,
  status,
  messageId,
  threadId,
  recipientEmail,
  errorMessage,
}: {
  campaignId: number;
  userId: string;
  status: string;
  messageId?: string | null;
  threadId?: string | null;
  recipientEmail?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  await query(
    `UPDATE outreach_campaigns
     SET status = $1,
         last_sent_at = CASE WHEN $1 = 'SENT' OR $1 = 'FAILED' THEN NOW() ELSE last_sent_at END,
         updated_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [status, campaignId, userId]
  );

  if (messageId || threadId || recipientEmail || errorMessage) {
    await query(
      `INSERT INTO email_logs (campaign_id, gmail_message_id, gmail_thread_id, send_type, status, error_message, sent_at)
       VALUES ($1, $2, $3, 'INITIAL', $4, $5, NOW())`,
      [campaignId, messageId ?? null, threadId ?? null, status, errorMessage ?? null]
    );
  }
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
  followup_count: number | null;
  last_sent_at: string | null;
  next_followup_at: string | null;
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

function buildFollowUpBody({
  originalBody,
  followUpNumber,
}: {
  originalBody: string;
  followUpNumber: number;
}): string {
  const body = normalizeText(originalBody) ?? '';
  const prefix = `Hi there,\n\nI'm following up on my previous outreach message. This is follow-up ${followUpNumber} of 5.\n\n`;
  return `${prefix}${body}`.trim();
}

function buildFollowUpSubject({
  originalSubject,
  followUpNumber,
}: {
  originalSubject: string;
  followUpNumber: number;
}): string {
  const subject = normalizeText(originalSubject) ?? 'Following up on my previous message';
  return `Follow-up ${followUpNumber}: ${subject}`;
}

function getFollowUpSendType(followUpNumber: number): string {
  switch (followUpNumber) {
    case 1:
      return 'FOLLOWUP_1';
    case 2:
      return 'FOLLOWUP_2';
    case 3:
      return 'FOLLOWUP_3';
    case 4:
      return 'FOLLOWUP_4';
    default:
      return 'FOLLOWUP_5';
  }
}

function getFollowUpEligibility(campaign: CampaignRow): {
  eligible: boolean;
  due: boolean;
  followUpNumber: number;
  reason: string;
} {
  const followUpCount = Number(campaign.followup_count ?? 0);
  if (followUpCount >= 5) {
    return { eligible: false, due: false, followUpNumber: 5, reason: 'The follow-up lifecycle for this recipient is already complete.' };
  }

  if (!campaign.last_sent_at) {
    return { eligible: false, due: false, followUpNumber: followUpCount + 1, reason: 'The initial email has not been sent yet.' };
  }

  const nextFollowUpAt = campaign.next_followup_at ? new Date(campaign.next_followup_at) : null;
  const isDue = Boolean(nextFollowUpAt && nextFollowUpAt <= new Date());
  if (!isDue) {
    const nextLabel = nextFollowUpAt ? nextFollowUpAt.toISOString() : 'unknown';
    return { eligible: false, due: false, followUpNumber: followUpCount + 1, reason: `Follow-up is not due yet. Next follow-up is scheduled for ${nextLabel}.` };
  }

  return { eligible: true, due: true, followUpNumber: followUpCount + 1, reason: 'Follow-up is ready to send.' };
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

async function ensureCompanyAccess({
  userId,
  companyId,
}: {
  userId: string;
  companyId: number | null;
}): Promise<void> {
  if (!companyId) {
    return;
  }

  const result = await query<{ id: number }>(
    `SELECT id
     FROM outreach_campaigns
     WHERE user_id = $1 AND company_id = $2
     LIMIT 1`,
    [userId, companyId]
  );

  if (!result.rows[0]?.id) {
    throw new Error('The selected company is not available for your account.');
  }
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
  const normalizedRecipient = normalizeRecipientValue(recipientEmail);

  if (!normalizedRecipient || !isValidRecipientAddress(normalizedRecipient)) {
    return { success: false, error: 'Please provide a valid recipient email address.', status: 'FAILED', recipient: normalizedRecipient ?? recipientEmail };
  }

  await ensureCompanyAccess({ userId: authenticatedUser.id, companyId: companyId ?? null });

  if (!normalizedSubject) {
    return { success: false, error: 'This campaign is missing a subject.', status: 'FAILED', recipient: recipientEmail };
  }

  if (!normalizedBody) {
    return { success: false, error: 'This campaign is missing an email body.', status: 'FAILED', recipient: recipientEmail };
  }

  const { recipientEmail: resolvedRecipientEmail, recruiterEmailId } = await resolveRecipientEmailForCompany({
    companyId: companyId ?? null,
    recipientEmail: normalizedRecipient,
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

  const maxInitialSendsPerHour = getConfiguredSendLimit(DEFAULT_MAX_INITIAL_SENDS_PER_HOUR, 'INITIAL_EMAILS_PER_HOUR');
  const recentSentCount = Number.parseInt(recentSentResult.rows[0]?.count ?? '0', 10);
  if (recentSentCount >= maxInitialSendsPerHour) {
    return {
      success: false,
      error: 'Per-user send limit reached. Please wait before sending more initial campaigns.',
      status: 'FAILED',
      recipient: resolvedRecipientEmail,
    };
  }

  const campaignId = await transaction(async (client) => {
    const campaignInsert = await client.query<{ id: number }>(
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
      ) VALUES ($1, $2, $3, $4, $5, $6, 'QUEUED', NOW(), NOW())
       RETURNING id`,
      [authenticatedUser.id, companyId ?? null, recruiterEmailId ?? null, normalizedSubject, normalizedBody, normalizedResumeUrl]
    );

    const insertedCampaignId = campaignInsert.rows[0]?.id;
    if (!insertedCampaignId) {
      throw new Error('Unable to create a recipient campaign record.');
    }

    await client.query(
      `UPDATE outreach_campaigns
       SET status = 'SENDING', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [insertedCampaignId, authenticatedUser.id]
    );

    return insertedCampaignId;
  });

  try {

    let attachmentBuffer: Buffer | null = null;
    let attachmentName: string | null = null;

    if (normalizedResumeUrl) {
      try {
        attachmentBuffer = await getResumeBufferFromS3(normalizedResumeUrl);
        attachmentName = normalizedResumeUrl.split('/').pop() || 'resume.pdf';
      } catch (error) {
        // Fail hard — don't send the email without the resume
        const message = error instanceof Error ? error.message : 'Unable to fetch resume from S3.';
        throw new Error(`Resume attachment could not be loaded: ${message}. Please re-upload your resume and try again.`);
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
      console.warn('Gmail send failed for initial outreach.', getSendContextLogFields({ campaignId, companyId, recipientEmail: resolvedRecipientEmail, followUp: false }));
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
      [campaignId, toSafeUserError(message)]
    );

    return {
      success: false,
      error: toSafeUserError(message),
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

  const campaign = await transaction(async (client) => {
    const campaignQuery = await client.query<CampaignRow>(
      `SELECT id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status
       FROM outreach_campaigns
       WHERE user_id = $1
         AND (($2::bigint IS NOT NULL AND id = $2) OR ($3::bigint IS NOT NULL AND company_id = $3))
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [authenticatedUser.id, campaignId ?? null, companyId ?? null]
    );

    const row = campaignQuery.rows[0];
    if (!row) {
      throw new Error('Campaign not found or access denied.');
    }

    const normalizedStatus = normalizeStatusValue(row.status);
    if (normalizedStatus === 'SENT' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'PARTIALLY SENT') {
      throw new Error('This campaign has already been sent.');
    }

    if (normalizedStatus === 'SENDING' || normalizedStatus === 'QUEUED') {
      throw new Error('A send request is already in progress for this campaign.');
    }

    await client.query(
      `UPDATE outreach_campaigns
       SET status = 'SENDING', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [row.id, authenticatedUser.id]
    );

    return row;
  });
  if (!campaign) {
    throw new Error('Campaign not found or access denied.');
  }

  await ensureCompanyAccess({ userId: authenticatedUser.id, companyId: campaign.company_id });

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
         followup_count = 0,
         next_followup_at = NOW() + INTERVAL '7 days',
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

export async function sendFollowUpCampaignEmail({
  campaignId,
  companyId,
  accessToken,
}: {
  campaignId?: number | null;
  companyId?: number | null;
  accessToken?: string | null;
}): Promise<SendCampaignResult> {
  const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

  const campaign = await transaction(async (client) => {
    const campaignQuery = await client.query<CampaignRow>(
      `SELECT id, user_id, company_id, recruiter_email_id, email_subject, email_body, resume_url, status, followup_count, last_sent_at, next_followup_at
       FROM outreach_campaigns
       WHERE user_id = $1
         AND (($2::bigint IS NOT NULL AND id = $2) OR ($3::bigint IS NOT NULL AND company_id = $3))
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [authenticatedUser.id, campaignId ?? null, companyId ?? null]
    );

    const row = campaignQuery.rows[0];
    if (!row) {
      throw new Error('Campaign not found or access denied.');
    }

    const eligibility = getFollowUpEligibility(row);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    const normalizedStatus = normalizeStatusValue(row.status);
    if (normalizedStatus === 'SENDING' || normalizedStatus === 'QUEUED') {
      throw new Error('A send request is already in progress for this campaign.');
    }

    await client.query(
      `UPDATE outreach_campaigns
       SET status = 'SENDING', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [row.id, authenticatedUser.id]
    );

    return row;
  });

  const eligibility = getFollowUpEligibility(campaign);

  await ensureCompanyAccess({ userId: authenticatedUser.id, companyId: campaign.company_id });

  const subject = normalizeText(campaign.email_subject);
  const body = normalizeText(campaign.email_body);
  const resumeKey = normalizeText(campaign.resume_url);

  if (!subject) {
    throw new Error('This campaign is missing a subject.');
  }

  if (!body) {
    throw new Error('This campaign is missing an email body.');
  }

  const { recipientEmail, recruiterEmailId } = await resolveRecipientEmail(campaign);

  let attachmentBuffer: Buffer;
  try {
    attachmentBuffer = await getResumeBufferFromS3(resumeKey ?? '');
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to fetch the attached resume.');
  }

  const senderEmail = authenticatedUser.email;
  const attachmentName = (resumeKey ?? '').split('/').pop() || 'resume.pdf';
  const logContext = getSendContextLogFields({ campaignId: campaign.id, companyId: campaign.company_id, recipientEmail: recipientEmail, followUp: true });
  const followUpSubject = buildFollowUpSubject({ originalSubject: subject, followUpNumber: eligibility.followUpNumber });
  const followUpBody = buildFollowUpBody({ originalBody: body, followUpNumber: eligibility.followUpNumber });
  const mimeMessage = createMimeMessage({
    recipient: recipientEmail,
    subject: followUpSubject,
    body: followUpBody,
    attachmentBuffer,
    attachmentName,
    senderEmail,
  });

  const encodedMessage = Buffer.from(mimeMessage, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  const lastThreadResult = await query<{ gmail_thread_id: string | null }>(
    `SELECT gmail_thread_id
     FROM email_logs
     WHERE campaign_id = $1 AND gmail_thread_id IS NOT NULL
     ORDER BY sent_at DESC, id DESC
     LIMIT 1`,
    [campaign.id]
  );

  const threadId = lastThreadResult.rows[0]?.gmail_thread_id ?? null;
  const requestBody = threadId ? { raw: encodedMessage, threadId } : { raw: encodedMessage };

  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const gmailPayload = await gmailResponse.json().catch(() => ({}));

  if (!gmailResponse.ok) {
    const errorMessage = typeof gmailPayload?.error?.message === 'string'
      ? gmailPayload.error.message
      : 'Gmail rejected the message.';
    throw new Error(errorMessage);
  }

  const messageId = typeof gmailPayload?.id === 'string' ? gmailPayload.id : null;
  const receivedThreadId = typeof gmailPayload?.threadId === 'string' ? gmailPayload.threadId : threadId;
  const nextFollowUpCount = (campaign.followup_count ?? 0) + 1;

  await query(
    `UPDATE outreach_campaigns
     SET recruiter_email_id = $1,
         followup_count = $2,
         last_sent_at = NOW(),
         next_followup_at = CASE WHEN $2 < 5 THEN NOW() + INTERVAL '7 days' ELSE NULL END,
         status = CASE WHEN $2 >= 5 THEN 'COMPLETED' ELSE 'SENT' END,
         updated_at = NOW()
     WHERE id = $3 AND user_id = $4`,
    [recruiterEmailId ?? campaign.recruiter_email_id, nextFollowUpCount, campaign.id, authenticatedUser.id]
  );

  await query(
    `INSERT INTO email_logs (campaign_id, gmail_message_id, gmail_thread_id, send_type, status, error_message, sent_at)
     VALUES ($1, $2, $3, $4, 'SENT', NULL, NOW())`,
    [campaign.id, messageId, receivedThreadId, getFollowUpSendType(eligibility.followUpNumber)]
  );

  return {
    success: true,
    status: nextFollowUpCount >= 5 ? 'COMPLETED' : 'SENT',
    campaignId: campaign.id,
    messageId,
    threadId: receivedThreadId,
    recipient: recipientEmail,
  };
}

export async function sendFollowUpCampaignEmailWithErrorHandling({
  campaignId,
  companyId,
  accessToken,
}: {
  campaignId?: number | null;
  companyId?: number | null;
  accessToken?: string | null;
}): Promise<SendCampaignResult> {
  try {
    return await sendFollowUpCampaignEmail({ campaignId, companyId, accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send follow-up email.';
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
           VALUES ($1, NULL, NULL, 'FAILED', 'FAILED', $2, NOW())`,
          [campaign.rows[0].id, toSafeUserError(message)]
        );
      }
    } catch (logError) {
      console.error('Failed to log follow-up send error:', logError);
    }

    return {
      success: false,
      error: toSafeUserError(message),
      status: 'FAILED',
      campaignId: campaignId ?? undefined,
    };
  }
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
      error: toSafeUserError(message),
      status: 'FAILED',
      campaignId: campaignId ?? undefined,
    };
  }
}
