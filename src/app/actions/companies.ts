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
    }>(
      `SELECT 
        c.id,
        c.company_name,
        c.status,
        c.created_at,
        COALESCE(COUNT(ce.id), 0)::text as email_count,
        EXISTS (
          SELECT 1
          FROM outreach_campaigns oc
          WHERE oc.user_id = $1
            AND oc.company_id = c.id
            AND oc.resume_url IS NOT NULL
        ) AS has_resume
       FROM companies c
       LEFT JOIN company_emails ce ON c.id = ce.company_id
       GROUP BY c.id, c.company_name, c.status, c.created_at
       ORDER BY c.created_at DESC NULLS LAST`,
      [authenticatedUser.id]
    );

    return result.rows.map(row => ({
      ...row,
      email_count: parseInt(row.email_count, 10) || 0,
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
