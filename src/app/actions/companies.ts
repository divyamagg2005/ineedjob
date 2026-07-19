'use server'

import { query } from '@/lib/db';
import { AuthError, getAuthenticatedUserContext } from '@/lib/user-context';

export type Company = {
  id: number;
  company_name: string;
  status: string | null;
  created_at: string | null;
  email_count: number;
};

export async function fetchCompanies(accessToken?: string | null): Promise<Company[]> {
  try {
    await getAuthenticatedUserContext(undefined, undefined, accessToken);

    // Fetch companies with a count of related company_emails rows
    const result = await query<{
      id: number;
      company_name: string;
      status: string | null;
      created_at: string | null;
      email_count: string;
    }>(
      `SELECT 
        c.id,
        c.company_name,
        c.status,
        c.created_at,
        COALESCE(COUNT(ce.id), 0)::text as email_count
       FROM companies c
       LEFT JOIN company_emails ce ON c.id = ce.company_id
       GROUP BY c.id, c.company_name, c.status, c.created_at
       ORDER BY c.created_at DESC NULLS LAST`
    );

    return result.rows.map(row => ({
      ...row,
      email_count: parseInt(row.email_count, 10) || 0,
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
