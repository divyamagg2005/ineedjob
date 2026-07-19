'use server'

import { query } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export type Company = {
  id: number;
  company_name: string;
  status: string | null;
  created_at: string | null;
  email_count: number;
  has_resume: boolean;
  followup_count: number;
  last_sent_at: string | null;
  next_followup_at: string | null;
};

export async function fetchCompanies(accessToken?: string | null): Promise<Company[]> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const result = await query<{
      id: number;
      company_name: string;
      status: string | null;
      created_at: string | null;
      email_count: string;
      has_resume: boolean;
      followup_count: string;
      last_sent_at: string | null;
      next_followup_at: string | null;
    }>(
      `SELECT 
        c.id,
        c.company_name,
        COALESCE(
          (
            SELECT oc.status
            FROM outreach_campaigns oc
            WHERE oc.user_id = $1
              AND oc.company_id = c.id
            ORDER BY oc.created_at DESC, oc.id DESC
            LIMIT 1
          ),
          c.status
        ) AS status,
        c.created_at,
        COALESCE(COUNT(ce.id), 0)::text as email_count,
        COALESCE(
          (
            SELECT oc.followup_count
            FROM outreach_campaigns oc
            WHERE oc.user_id = $1
              AND oc.company_id = c.id
            ORDER BY oc.created_at DESC, oc.id DESC
            LIMIT 1
          ),
          0
        )::text AS followup_count,
        (
          SELECT oc.last_sent_at
          FROM outreach_campaigns oc
          WHERE oc.user_id = $1
            AND oc.company_id = c.id
          ORDER BY oc.created_at DESC, oc.id DESC
          LIMIT 1
        ) AS last_sent_at,
        (
          SELECT oc.next_followup_at
          FROM outreach_campaigns oc
          WHERE oc.user_id = $1
            AND oc.company_id = c.id
          ORDER BY oc.created_at DESC, oc.id DESC
          LIMIT 1
        ) AS next_followup_at,
        EXISTS (
          SELECT 1
          FROM outreach_campaigns oc
          WHERE oc.user_id = $1
            AND oc.company_id = c.id
            AND oc.resume_url IS NOT NULL
        ) AS has_resume
       FROM companies c
       LEFT JOIN outreach_campaigns oc ON oc.user_id = $1 AND oc.company_id = c.id
       LEFT JOIN company_emails ce ON c.id = ce.company_id
       GROUP BY c.id, c.company_name, c.status, c.created_at
       ORDER BY c.created_at DESC NULLS LAST`,
      [authenticatedUser.id]
    );

    return result.rows.map(row => ({
      ...row,
      email_count: parseInt(row.email_count, 10) || 0,
      followup_count: parseInt(row.followup_count, 10) || 0,
      has_resume: Boolean(row.has_resume),
    }));
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw error;
  }
}

export async function blacklistCompany(companyId: number, companyName: string, accessToken?: string | null): Promise<void> {
  try {
    await getAuthenticatedUserContext(undefined, undefined, accessToken);

    // Call the stored procedure to blacklist the company
    await query(
      `SELECT blacklist_company($1, $2)`,
      [companyId, companyName]
    );
  } catch (error) {
    console.error('Error blacklisting company:', error);
    throw error;
  }
}
