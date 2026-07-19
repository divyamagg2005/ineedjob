import { query } from '@/lib/db';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export function normalizeEmail(email?: string | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function extractUserEmailFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const values = [
    candidate.user_email,
    candidate.userEmail,
    candidate.email,
    candidate.userEmailAddress,
  ];

  for (const value of values) {
    const normalized = normalizeEmail(typeof value === 'string' ? value : null);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function getRequestUserEmail(
  request: { headers: { get(name: string): string | null } }
): string | null {
  const headerEmail = request.headers.get('x-user-email') ?? request.headers.get('x-auth-email');
  return normalizeEmail(headerEmail);
}

export function getRequestAccessToken(request: { headers: { get(name: string): string | null } }): string | null {
  const headerToken = request.headers.get('x-google-access-token') ?? request.headers.get('x-provider-token') ?? request.headers.get('authorization');
  if (!headerToken) {
    return null;
  }

  if (headerToken.toLowerCase().startsWith('bearer ')) {
    return headerToken.slice(7).trim();
  }

  return headerToken;
}

async function verifyGoogleAccessToken(accessToken?: string | null): Promise<string | null> {
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Invalid Google access token');
    }

    const userInfo = await response.json() as { email?: string | null };
    return normalizeEmail(userInfo.email);
  } catch (error) {
    console.error('Google token verification failed:', error);
    return null;
  }
}

export async function resolveAuthenticatedUserFromTrustedEmail(userEmail?: string | null): Promise<AuthenticatedUser> {
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedEmail) {
    throw new AuthError('Authentication required. Please sign in again.', 401);
  }

  const existing = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [normalizedEmail]
  );

  if (existing.rows[0]) {
    return { id: existing.rows[0].id, email: existing.rows[0].email };
  }

  const inserted = await query<{ id: string }>(
    `INSERT INTO users (id, email, created_at)
     VALUES (gen_random_uuid(), $1, NOW())
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [normalizedEmail]
  );

  if (inserted.rows[0]?.id) {
    return { id: inserted.rows[0].id, email: normalizedEmail };
  }

  const fallback = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [normalizedEmail]
  );

  if (!fallback.rows[0]) {
    throw new AuthError('Unable to create or locate the authenticated user record.', 500);
  }

  return { id: fallback.rows[0].id, email: fallback.rows[0].email };
}

export async function resolveAuthenticatedUser(userEmail?: string | null, accessToken?: string | null): Promise<AuthenticatedUser> {
  const verifiedEmail = await verifyGoogleAccessToken(accessToken);

  if (!verifiedEmail) {
    throw new AuthError('Authentication required. Please sign in again.', 401);
  }

  return resolveAuthenticatedUserFromTrustedEmail(verifiedEmail);
}

export async function getAuthenticatedUserContext(userEmail?: string | null, userId?: string | null, accessToken?: string | null): Promise<AuthenticatedUser> {
  if (!accessToken) {
    throw new AuthError('Authentication required. Please sign in again.', 401);
  }

  const resolvedUser = await resolveAuthenticatedUser(userEmail, accessToken);

  if (userId && userId !== resolvedUser.id) {
    throw new AuthError('Unauthorized access: the supplied user context does not match the authenticated account.', 403);
  }

  return resolvedUser;
}
