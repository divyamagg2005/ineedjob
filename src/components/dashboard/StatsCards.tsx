'use client'

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Database, Mail, Repeat2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getHunterStatus, getDatabaseStatus, getDashboardStats } from '@/app/actions/status';
import { getStoredUser } from '@/lib/google-auth';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  isLoading?: boolean;
}

function StatCard({ title, value, hint, icon: Icon, accent, isLoading }: StatCardProps) {
  return (
    <Card className="border-white/[0.08] bg-zinc-950/70 shadow-sm shadow-black/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-400">{title}</p>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-400" /> : value}
            </div>
          </div>
          <div className={`rounded-xl border p-2 ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function StatsCards() {
  const currentUser = getStoredUser();

  const { data: hunterStatus, isLoading: isHunterLoading } = useQuery({
    queryKey: ['hunterStatus'],
    queryFn: () => getHunterStatus(),
    refetchInterval: 60000,
  });

  const { data: databaseStatus, isLoading: isDatabaseLoading } = useQuery({
    queryKey: ['databaseStatus'],
    queryFn: () => getDatabaseStatus(),
    refetchInterval: 60000,
  });

  const { data: dashboardStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['dashboardStats', currentUser?.accessToken],
    queryFn: () => getDashboardStats(currentUser?.accessToken),
    refetchInterval: 60000,
  });

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Hunter Credits"
        value={isHunterLoading ? 'Checking…' : hunterStatus?.credits ?? 'Unavailable'}
        hint="Live availability from the Hunter API"
        icon={Activity}
        accent="bg-violet-500/10 text-violet-300 border-violet-500/20"
        isLoading={isHunterLoading}
      />
      <StatCard
        title="Database Status"
        value={isDatabaseLoading ? 'Checking…' : databaseStatus?.status ?? 'Unknown'}
        hint="Lightweight RDS connectivity health check"
        icon={Database}
        accent="bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
        isLoading={isDatabaseLoading}
      />
      <StatCard
        title="Emails Sent Today"
        value={isStatsLoading ? 'Checking…' : `${dashboardStats?.emailsSentToday ?? 0}`}
        hint="Counted from the authenticated user's activity"
        icon={Mail}
        accent="bg-sky-500/10 text-sky-300 border-sky-500/20"
        isLoading={isStatsLoading}
      />
      <StatCard
        title="Follow-ups Due"
        value={isStatsLoading ? 'Checking…' : `${dashboardStats?.followUpsDue ?? 0}`}
        hint="Campaigns with follow-up due now or earlier"
        icon={Repeat2}
        accent="bg-amber-500/10 text-amber-300 border-amber-500/20"
        isLoading={isStatsLoading}
      />
    </section>
  );
}
