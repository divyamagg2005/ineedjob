'use server'

import { query, transaction } from '@/lib/db';
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

    const existing = await query<{ id: number }>(
      `SELECT id
       FROM companies
       WHERE id = $1
       LIMIT 1`,
      [companyId]
    );

    if (!existing.rows[0]?.id) {
      throw new Error('The selected company could not be found.');
    }

    await query(
      `SELECT blacklist_company($1, $2)`,
      [companyId, companyName]
    );
  } catch (error) {
    console.error('Error blacklisting company:', error);
    throw error;
  }
}

export type AddCompanyResult = {
  success: boolean;
  companyId?: number;
  companyName?: string;
  domain?: string | null;
  emailsFound?: number;
  emailsAdded?: number;
  alreadyExisted?: boolean;
  error?: string;
};

type HunterEmail = {
  value?: string | null;
  confidence?: number | null;
};

type HunterDomainSearchResponse = {
  data?: {
    domain?: string | null;
    organization?: string | null;
    emails?: HunterEmail[] | null;
  };
  errors?: { details?: string; id?: string }[];
};

function extractDomainFromInput(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');
    return host.includes('.') ? host : null;
  } catch {
    const cleaned = trimmed.replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(cleaned) ? cleaned : null;
  }
}

async function hunterDomainSearchOnce(
  params: { company?: string; domain?: string },
  apiKey: string,
  limit?: number,
): Promise<{ ok: boolean; status: number; body: HunterDomainSearchResponse }> {
  const search = new URLSearchParams({ api_key: apiKey });
  if (typeof limit === 'number') {
    search.set('limit', String(limit));
  }
  if (params.domain) {
    search.set('domain', params.domain);
  } else if (params.company) {
    search.set('company', params.company);
  }

  const res = await fetch(`https://api.hunter.io/v2/domain-search?${search.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const body = (await res.json().catch(() => ({}))) as HunterDomainSearchResponse;
  return { ok: res.ok, status: res.status, body };
}

async function hunterDomainSearch(params: { company?: string; domain?: string }, apiKey: string): Promise<HunterDomainSearchResponse> {
  // Don't send an explicit limit first — this lets Hunter return whatever the
  // current plan allows without rejecting the request.
  let result = await hunterDomainSearchOnce(params, apiKey);

  // Some plans reject requests when the limit exceeds their cap. If that happens,
  // parse the allowed count from the error and retry with it.
  if (!result.ok) {
    const detail = result.body?.errors?.[0]?.details ?? '';
    const capMatch = detail.match(/limited to (\d+)/i);
    if (capMatch) {
      const allowed = Number.parseInt(capMatch[1], 10);
      if (Number.isFinite(allowed) && allowed > 0) {
        result = await hunterDomainSearchOnce(params, apiKey, allowed);
      }
    }
  }

  if (!result.ok) {
    const detail = result.body?.errors?.[0]?.details;
    throw new Error(detail || `Hunter API request failed (status ${result.status}).`);
  }

  return result.body;
}

export async function addCompanyByName(
  companyNameInput: string,
  domainInput?: string | null,
  accessToken?: string | null,
): Promise<AddCompanyResult> {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const companyName = companyNameInput?.trim();
    if (!companyName) {
      return { success: false, error: 'Please enter a company name.' };
    }

    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Hunter API key is not configured.' };
    }

    // Prefer an explicit domain (from the domain field, or if the user typed a domain as the name).
    const domain = extractDomainFromInput(domainInput ?? '') ?? extractDomainFromInput(companyName);

    let hunter: HunterDomainSearchResponse;
    try {
      hunter = await hunterDomainSearch(domain ? { domain } : { company: companyName }, apiKey);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Hunter lookup failed.' };
    }

    const resolvedDomain = hunter.data?.domain ?? domain ?? null;

    const emails = Array.from(
      new Set(
        (hunter.data?.emails ?? [])
          .map((e) => e.value?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e && e.includes('@'))),
      ),
    );

    const result = await transaction(async (client) => {
      const companyResult = await client.query<{ id: number; inserted: boolean }>(
        `INSERT INTO companies (company_name, hunter_processed, status, created_at)
         VALUES ($1, true, 'NEW', NOW())
         ON CONFLICT (company_name) DO UPDATE SET hunter_processed = true
         RETURNING id, (xmax = 0) AS inserted`,
        [companyName],
      );

      const companyId = companyResult.rows[0].id;
      const alreadyExisted = !companyResult.rows[0].inserted;

      let emailsAdded = 0;
      for (const email of emails) {
        const inserted = await client.query(
          `INSERT INTO company_emails (company_id, email, source, created_at)
           VALUES ($1, $2, 'hunter', NOW())
           ON CONFLICT (company_id, email) DO NOTHING`,
          [companyId, email],
        );
        emailsAdded += inserted.rowCount ?? 0;
      }

      // Ensure the company shows up (and is sendable) for this user by creating an
      // outreach campaign row, mirroring how pipeline-discovered companies behave.
      await client.query(
        `INSERT INTO outreach_campaigns (user_id, company_id, status, created_at, updated_at)
         SELECT $1, $2, 'NEW', NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM outreach_campaigns WHERE user_id = $1 AND company_id = $2
         )`,
        [authenticatedUser.id, companyId],
      );

      return { companyId, alreadyExisted, emailsAdded };
    });

    return {
      success: true,
      companyId: result.companyId,
      companyName,
      domain: resolvedDomain,
      emailsFound: emails.length,
      emailsAdded: result.emailsAdded,
      alreadyExisted: result.alreadyExisted,
    };
  } catch (error) {
    console.error('Error adding company:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to add company.' };
  }
}
