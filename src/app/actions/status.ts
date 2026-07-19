'use server'

import { query, testConnection } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';

const hunterCache = new Map<string, { expiresAt: number; value: any }>();
const HUNTER_CACHE_TTL_MS = 60_000;

function getCachedHunterValue<T>(key: string): T | null {
  const cached = hunterCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    hunterCache.delete(key);
    return null;
  }

  return cached.value as T;
}

function setCachedHunterValue(key: string, value: any) {
  hunterCache.set(key, {
    expiresAt: Date.now() + HUNTER_CACHE_TTL_MS,
    value,
  });
}

export async function getHunterStatus() {
  const cacheKey = 'hunter-account-status';
  const cached = getCachedHunterValue<{ status: string; credits: string | null; used: number | null; remaining: number | null; limit: number | null; error?: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    const value = { status: 'Missing Key', credits: null, used: null, remaining: null, limit: null, error: 'Hunter API key is not configured.' };
    setCachedHunterValue(cacheKey, value);
    return value;
  }

  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${apiKey}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const value = { status: 'Error', credits: null, used: null, remaining: null, limit: null, error: 'Hunter API request failed.' };
      setCachedHunterValue(cacheKey, value);
      return value;
    }

    const data = await res.json();
    const creditsUsage = data?.data?.requests?.credits;
    const searchUsage = data?.data?.requests?.searches;
    const used = typeof creditsUsage?.used === 'number' ? creditsUsage.used : (typeof searchUsage?.used === 'number' ? searchUsage.used : 0);
    const remaining = typeof creditsUsage?.remaining === 'number' ? creditsUsage.remaining : null;
    const limit = typeof creditsUsage?.available === 'number' ? Math.round(creditsUsage.available + (creditsUsage.used ?? 0)) : null;
    const value = {
      status: 'Connected',
      credits: remaining !== null && creditsUsage?.available !== undefined ? `${used} / ${Math.round(creditsUsage.available)}` : remaining !== null ? `${remaining}` : null,
      used,
      remaining,
      limit,
    };
    setCachedHunterValue(cacheKey, value);
    return value;
  } catch (error) {
    const value = { status: 'Disconnected', credits: null, used: null, remaining: null, limit: null, error: 'Hunter API is unavailable.' };
    setCachedHunterValue(cacheKey, value);
    return value;
  }
}

export async function getDatabaseStatus() {
  try {
    const isConnected = await testConnection();

    if (!isConnected) {
      return { status: 'Unavailable', message: 'Database health check failed.' };
    }

    return { status: 'Connected', message: 'Database responded successfully.' };
  } catch (error) {
    return { status: 'Unavailable', message: 'Database health check failed.' };
  }
}

export async function getDashboardStats(accessToken?: string | null) {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const dailyLimit = Number.parseInt(process.env.EMAIL_DAILY_LIMIT || '', 10);
    const dailyLimitValue = Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : null;

    const startOfDay = `date_trunc('day', timezone('UTC', now()))`;
    const endOfDay = `date_trunc('day', timezone('UTC', now())) + interval '1 day'`;

    const [emailsSentTodayResult, followUpsDueResult] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM email_logs el
         JOIN outreach_campaigns oc ON oc.id = el.campaign_id
         WHERE oc.user_id = $1
           AND UPPER(COALESCE(el.status, '')) = 'SENT'
           AND el.sent_at >= ${startOfDay}
           AND el.sent_at < ${endOfDay}`,
        [authenticatedUser.id]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM outreach_campaigns
         WHERE user_id = $1
           AND followup_count < 5
           AND COALESCE(UPPER(status), '') <> 'COMPLETED'
           AND next_followup_at IS NOT NULL
           AND next_followup_at <= NOW()`,
        [authenticatedUser.id]
      ),
    ]);

    return {
      emailsSentToday: parseInt(emailsSentTodayResult.rows[0]?.count || '0', 10),
      dailyLimit: dailyLimitValue,
      followUpsDue: parseInt(followUpsDueResult.rows[0]?.count || '0', 10),
    };
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    return {
      emailsSentToday: 0,
      dailyLimit: null,
      followUpsDue: 0,
    };
  }
}
