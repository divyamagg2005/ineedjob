'use client'

import React from 'react';
import { Sparkles, Send, Clock3 } from 'lucide-react';

const activities = [
  { id: 1, title: 'Resume and outreach draft prepared', detail: 'Ready for the next batch of companies', time: 'Just now', tone: 'info' },
  { id: 2, title: 'Sync completed', detail: 'Latest company data refreshed from your inbox', time: '5 min ago', tone: 'success' },
  { id: 3, title: 'Follow-up reminder queued', detail: 'A campaign is due for review', time: '12 min ago', tone: 'warning' },
];

function toneClasses(tone: string) {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'warning':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    default:
      return 'border-violet-500/20 bg-violet-500/10 text-violet-300';
  }
}

export function RecentActivity() {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 p-5 shadow-sm shadow-black/20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Recent Activity</h2>
          <p className="text-sm text-zinc-500">A lightweight snapshot of the latest pipeline updates.</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-zinc-400">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-3">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className={`mt-0.5 rounded-lg border p-2 ${toneClasses(item.tone)}`}>
              {item.tone === 'warning' ? <Clock3 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
            </div>
            <span className="shrink-0 text-xs text-zinc-500">{item.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
