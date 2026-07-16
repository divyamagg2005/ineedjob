'use client'

import React from 'react';
import { Header } from '@/components/dashboard/Header';
import { PipelineStatus } from '@/components/dashboard/PipelineStatus';
import { InternshipsTable } from '@/components/dashboard/InternshipsTable';
import { ResumeManager } from '@/components/dashboard/ResumeManager';
import { ColdEmailComposer } from '@/components/dashboard/ColdEmailComposer';
import { SendOutreach } from '@/components/dashboard/SendOutreach';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { AuthGuard } from '@/components/dashboard/AuthGuard';

export default function DashboardPage() {
  const [resumeFileName, setResumeFileName] = React.useState<string | null>(null);
  const [emailSubject, setEmailSubject] = React.useState<string>('');
  const [emailBody, setEmailBody] = React.useState<string>('');

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-10">
        <AuthGuard>
          <PipelineStatus />
          
          <InternshipsTable />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <ResumeManager onResumeUpdate={setResumeFileName} />
            <ColdEmailComposer onTemplateUpdate={(subject, body) => {
              setEmailSubject(subject);
              setEmailBody(body);
            }} />
          </div>

          <SendOutreach 
            resumeFileName={resumeFileName}
            emailSubject={emailSubject}
            emailBody={emailBody}
          />
          
          <RecentActivity />
        </AuthGuard>
      </main>
    </div>
  );
}
