'use client'

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type Activity = { id: number; time: string; action: string; company: string; status: string; };
const activities: Activity[] = [];

export function RecentActivity() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Recent Activity</h2>
        <p className="text-sm text-muted-foreground">Chronological log of system actions.</p>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground text-xs">{item.time}</TableCell>
                <TableCell className="font-medium">{item.action}</TableCell>
                <TableCell>{item.company}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={item.status === 'Success' ? 'secondary' : 'destructive'} className="text-[10px]">
                    {item.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
