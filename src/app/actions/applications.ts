'use server'

import { query } from '@/lib/db';
import { AuthError, getAuthenticatedUserContext } from '@/lib/user-context';

interface InsertApplicationParams {
  accessToken?: string | null;
  company_name: string;
  recipient_email: string;
  resume_file: string | null;
}

export async function insertApplication(params: InsertApplicationParams) {
  try {
    const { accessToken, company_name, recipient_email, resume_file } = params;
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query(
      `INSERT INTO applications (user_email, company_name, recipient_email, resume_file, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [authenticatedUser.email, company_name, recipient_email, resume_file]
    );

    return { success: true, id: result.rows[0]?.id };
  } catch (error) {
    console.error('Error inserting application:', error);

    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.message,
        status: error.status,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
