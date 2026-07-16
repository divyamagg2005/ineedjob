import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;

  console.log('OAuth callback - redirect_uri:', redirectUri);
  console.log('OAuth callback - client_id present:', !!clientId);
  console.log('OAuth callback - client_secret present:', !!clientSecret);

  try {
    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', JSON.stringify(tokens, null, 2));
      return NextResponse.redirect(new URL(`/?error=token_exchange_failed&detail=${encodeURIComponent(tokens.error || 'unknown')}`, request.url));
    }

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoRes.json();

    // Build a simple user object to store in localStorage via the client
    const userData = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
    };

    // Redirect back to home page with user data as a query param
    const encodedData = encodeURIComponent(JSON.stringify(userData));
    return NextResponse.redirect(new URL(`/?auth_data=${encodedData}`, request.url));
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.redirect(new URL(`/?error=auth_failed&detail=${encodeURIComponent(String(error))}`, request.url));
  }
}
