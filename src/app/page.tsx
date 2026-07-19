'use client'

import React from 'react';
import { Header } from '@/components/dashboard/Header';
import { InternshipsTable } from '@/components/dashboard/InternshipsTable';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { AuthGuard } from '@/components/dashboard/AuthGuard';
import { StatsCards } from '@/components/dashboard/StatsCards';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-8">
        <AuthGuard>
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Internship Outreach Dashboard</h1>
              <p className="text-sm text-zinc-500">Monitor talent pipeline health, recent activity, and the companies you are preparing to contact.</p>
            </div>
            <StatsCards />
          </div>

          <InternshipsTable />

          <RecentActivity />
        </AuthGuard>
      </main>
    </div>
  );
}
