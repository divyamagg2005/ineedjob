'use server'

import { query } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';
import { ALLOWED_RESUME_MIME_TYPES, MAX_RESUME_SIZE_BYTES, buildResumeObjectKey, deleteResumeFromS3, uploadResumeToS3 } from '@/lib/s3';

export interface ResumeUploadResult {
  success: boolean;
  error?: string;
  objectKey?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
}

function parseFormDataFile(formData: FormData): { file: File; companyId: number } {
  const file = formData.get('file');
  const companyIdValue = formData.get('companyId');

  if (!(file instanceof File)) {
    throw new Error('Invalid file.');
  }

  if (typeof companyIdValue !== 'string' || !companyIdValue) {
    throw new Error('Missing company selection.');
  }

  const companyId = Number(companyIdValue);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error('Invalid company selection.');
  }

  return { file, companyId };
}

export async function uploadResumeForCompany(formData: FormData, accessToken?: string | null): Promise<ResumeUploadResult> {
  try {
    const { file, companyId } = parseFormDataFile(formData);
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      throw new Error('File is too large. Maximum size is 5MB.');
    }

    if (!ALLOWED_RESUME_MIME_TYPES.has(file.type)) {
      throw new Error('Only PDF resumes are supported.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfSignature = buffer.subarray(0, 5).toString('latin1');
    if (pdfSignature !== '%PDF-') {
      throw new Error('Invalid PDF file content.');
    }

    const companyResult = await query<{ id: number; company_name: string }>(
      `SELECT id, company_name FROM companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );

    if (!companyResult.rows[0]) {
      throw new Error('Company not found.');
    }

    const objectKey = buildResumeObjectKey(authenticatedUser.id, companyId, file.name);

    const maybeExisting = await query<{ id: number; resume_url: string | null }>(
      `SELECT id, resume_url FROM outreach_campaigns WHERE user_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [authenticatedUser.id, companyId]
    );

    const previousObjectKey = maybeExisting.rows[0]?.resume_url ?? null;

    let databaseUpdated = false;

    try {
      await uploadResumeToS3({
        buffer,
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        objectKey,
      });

      const campaignId = maybeExisting.rows[0]?.id;

      if (campaignId) {
        await query(
          `UPDATE outreach_campaigns SET resume_url = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
          [objectKey, campaignId, authenticatedUser.id]
        );
      } else {
        await query(
          `INSERT INTO outreach_campaigns (user_id, company_id, status, resume_url, created_at, updated_at)
           VALUES ($1, $2, 'DRAFT', $3, NOW(), NOW())`,
          [authenticatedUser.id, companyId, objectKey]
        );
      }

      databaseUpdated = true;
    } catch (error) {
      try {
        await deleteResumeFromS3(objectKey);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded resume after database failure.', cleanupError);
      }
      throw error;
    }

    if (databaseUpdated && previousObjectKey && previousObjectKey !== objectKey) {
      try {
        await deleteResumeFromS3(previousObjectKey);
      } catch (cleanupError) {
        console.error('Failed to delete previous resume object after replacement.', cleanupError);
      }
    }

    return {
      success: true,
      objectKey,
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      size: file.size,
    };
  } catch (error) {
    console.error('Resume upload failed:', error);
    const message = error instanceof Error ? error.message : 'Unexpected upload failure.';
    return {
      success: false,
      error: message,
    };
  }
}

export async function removeResumeForCompany(companyId: number, accessToken?: string | null): Promise<ResumeUploadResult> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);
    const existing = await query<{ id: number; resume_url: string | null }>(
      `SELECT id, resume_url FROM outreach_campaigns WHERE user_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [authenticatedUser.id, companyId]
    );

    if (!existing.rows[0]) {
      return { success: true };
    }

    await deleteResumeFromS3(existing.rows[0].resume_url);
    await query(
      `UPDATE outreach_campaigns SET resume_url = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
      [existing.rows[0].id, authenticatedUser.id]
    );

    return { success: true };
  } catch (error) {
    console.error('Resume removal failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error.',
    };
  }
}
