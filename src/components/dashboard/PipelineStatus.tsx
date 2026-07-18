'use client'

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getHunterStatus, getDatabaseStatus } from '@/app/actions/status';

export function PipelineStatus() {
  const { data: hunterStatus, isLoading: isHunterLoading } = useQuery({
    queryKey: ['hunterStatus'],
    queryFn: () => getHunterStatus(),
    refetchInterval: 60000, // Refetch every minute
  });

  const { data: databaseStatus, isLoading: isDatabaseLoading } = useQuery({
    queryKey: ['databaseStatus'],
    queryFn: () => getDatabaseStatus(),
    refetchInterval: 60000,
  });

  const statuses = [
    { 
      name: 'Hunter API', 
      icon: Search, 
      status: isHunterLoading ? 'Checking...' : (hunterStatus?.credits ? `Credits: ${hunterStatus.credits}` : hunterStatus?.status || 'Unknown'), 
      active: hunterStatus?.status === 'Connected' 
    },
    { 
      name: 'PostgreSQL RDS', 
      icon: Database, 
      status: isDatabaseLoading ? 'Checking...' : (databaseStatus?.status || 'Unknown'), 
      active: databaseStatus?.status === 'Connected' 
    },
  ];

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Pipeline Status</h2>
        <p className="text-sm text-muted-foreground">Real-time status of backend services.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        {statuses.map((s, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="flex items-center justify-between w-full">
                <s.icon className="h-5 w-5 text-muted-foreground" />
                <div className={`h-2 w-2 rounded-full ${s.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
              </div>
              <div className="mt-2">
                <div className="font-medium text-sm leading-none">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.status}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
