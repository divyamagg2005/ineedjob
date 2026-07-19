'use client'

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { getStoredUser } from '@/lib/google-auth';
import { sendEmail } from '@/app/actions/email';
import { insertApplication } from '@/app/actions/applications';

interface SendOutreachProps {
  resumeFileName: string | null;
  emailSubject: string;
  emailBody: string;
}

export function SendOutreach({ resumeFileName, emailSubject, emailBody }: SendOutreachProps) {
  const [isSending, setIsSending] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !recipientEmail) {
      toast.error('Please enter the company name and recipient email.');
      return;
    }
    if (!emailSubject || !emailBody) {
      toast.error('Please draft an email subject and body in the composer first.');
      return;
    }

    setIsSending(true);
    try {
      const user = getStoredUser();
      
      if (!user?.accessToken) {
        toast.error('Missing Google Access Token. Please sign out and sign in again.');
        setIsSending(false);
        return;
      }

      // 1. Send the email via Google
      const res = await sendEmail({
        providerToken: user.accessToken,
        to: recipientEmail,
        subject: emailSubject,
        body: emailBody,
        senderEmail: user.email
      });

      if (!res.success) {
        toast.error('Failed to send email: ' + res.error);
        setIsSending(false);
        return;
      }

      // 2. Log it into PostgreSQL `applications` table
      const dbResult = await insertApplication({
        accessToken: user.accessToken,
        company_name: companyName,
        recipient_email: recipientEmail,
        resume_file: resumeFileName || null
      });

      if (!dbResult.success) {
        console.error('Database error:', dbResult.error);
        toast.warning('Email was sent, but failed to log to database.');
      } else {
        toast.success(`Successfully dispatched email to ${companyName}!`);
        // clear form
        setCompanyName('');
        setRecipientEmail('');
      }
    } catch (error) {
      console.error(error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="bg-card border-primary/20 shadow-sm relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
      <CardContent className="p-6 relative z-10">
        <form onSubmit={handleSend} className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1 w-full">
            <h2 className="text-lg font-semibold tracking-tight">Manual Dispatch</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Enter recipient details to send your drafted email and attach your uploaded resume link.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Company Name</label>
                <Input 
                  placeholder="e.g. Google" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Recipient Email</label>
                <Input 
                  type="email"
                  placeholder="recruiter@google.com" 
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${emailSubject ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="text-muted-foreground">Template:</span> 
                <span className="font-medium truncate max-w-[200px]">{emailSubject || 'No subject drafted'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${resumeFileName ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="text-muted-foreground">Resume:</span> 
                <span className="font-medium truncate max-w-[200px]">{resumeFileName || 'None uploaded'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button type="submit" className="w-full md:w-auto shadow-sm" disabled={isSending}>
              {isSending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Dispatch Email</>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
