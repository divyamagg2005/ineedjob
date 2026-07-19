'use server'

import { query, testConnection } from '@/lib/db';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export async function getHunterStatus() {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    return { status: 'Missing Key', credits: null };
  }

  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${apiKey}`, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    
    if (!res.ok) {
      return { status: 'Error', credits: null };
    }

    const data = await res.json();
    const used = data?.data?.requests?.searches?.used || 0;
    const available = data?.data?.requests?.searches?.available || 0;

    return { 
      status: 'Connected', 
      credits: `${used} / ${available}` 
    };
  } catch (error) {
    return { status: 'Disconnected', credits: null };
  }
}

export async function getDatabaseStatus() {
  try {
    const isConnected = await testConnection();

    if (!isConnected) {
      return { status: 'Error' };
    }

    return { status: 'Connected' };
  } catch (error) {
    return { status: 'Disconnected' };
  }
}

export async function getDashboardStats(accessToken?: string | null) {
  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, accessToken);

    const [emailsSentTodayResult, followUpsDueResult] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM applications
         WHERE lower(user_email) = lower($1)
           AND created_at >= date_trunc('day', now())
           AND created_at < date_trunc('day', now()) + interval '1 day'`,
        [authenticatedUser.email]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM outreach_campaigns
         WHERE user_id = $1
           AND next_followup_at IS NOT NULL
           AND next_followup_at <= NOW()`,
        [authenticatedUser.id]
      ),
    ]);

    return {
      emailsSentToday: parseInt(emailsSentTodayResult.rows[0]?.count || '0', 10),
      followUpsDue: parseInt(followUpsDueResult.rows[0]?.count || '0', 10),
    };
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    return {
      emailsSentToday: 0,
      followUpsDue: 0,
    };
  }
}
