'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { GoogleUser, getStoredUser, clearUser, getGoogleLoginUrl } from '@/lib/google-auth';

export function Header() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
    setUser(getStoredUser());
  }, []);

  const handleSignIn = useCallback(() => {
    window.location.href = getGoogleLoginUrl();
  }, []);

  const handleSignOut = useCallback(() => {
    clearUser();
    window.location.reload();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] flex h-14 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-md shadow-violet-600/30">
            <span className="text-xs font-bold text-white tracking-tight">IN</span>
          </div>
          <span className="font-semibold text-white tracking-tight">ineedjob</span>
          <span className="hidden md:inline-block text-zinc-600 text-sm font-normal">/ Outreach</span>
        </div>
        
        <div className="flex items-center gap-4">
          {isClient ? (
            user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end text-sm">
                  <span className="font-medium leading-none text-zinc-200">{user.name}</span>
                  <span className="text-zinc-500 text-xs">{user.email}</span>
                </div>
                {user.picture ? (
                  <img src={user.picture} alt="Avatar" className="h-8 w-8 rounded-full border border-white/10" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                    <span className="text-xs text-violet-300">{user.name?.[0] || 'U'}</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignIn}
                className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white text-xs"
              >
                Sign In with Google
              </Button>
            )
          ) : (
            <div className="h-8 w-32 bg-white/5 animate-pulse rounded-md"></div>
          )}
        </div>
      </div>
    </header>
  );
}
