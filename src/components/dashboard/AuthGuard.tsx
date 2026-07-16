'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { GoogleUser, getStoredUser, storeUser, getGoogleLoginUrl } from '@/lib/google-auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
    
    // Process URL parameters if present (OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const authData = params.get('auth_data');
    if (authData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(authData)) as GoogleUser;
        storeUser(parsed);
        window.history.replaceState({}, '', '/');
        setUser(parsed);
        return;
      } catch {
        // ignore
      }
    }
    
    // Otherwise load from local storage
    setUser(getStoredUser());
  }, []);

  const handleSignIn = useCallback(() => {
    window.location.href = getGoogleLoginUrl();
  }, []);

  // Show nothing while resolving client state to prevent hydration mismatch
  if (!isClient) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh] px-4">
        {/* Subtle grid background */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px]" />
        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[500px] h-[300px] bg-violet-600/10 rounded-full blur-[120px]" />

        <div className="max-w-sm w-full text-center">
          {/* Logo mark */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 shadow-lg shadow-violet-600/30">
              <span className="text-sm font-bold text-white tracking-tight">IN</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ineedjob</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 shadow-2xl">
            {/* Icon */}
            <div className="mx-auto mb-6 w-14 h-14 rounded-2xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-violet-400" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Sign in to continue
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              Connect your Google account to grant Gmail access and manage your internship outreach pipeline.
            </p>

            <Button
              size="lg"
              className="w-full bg-white hover:bg-zinc-100 text-zinc-900 font-semibold shadow-lg shadow-black/20 transition-all duration-150 flex items-center justify-center gap-3"
              onClick={handleSignIn}
            >
              {/* Google G SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <p className="mt-6 text-xs text-zinc-600">
              By signing in, you agree to allow ineedjob to send emails on your behalf via Gmail.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
