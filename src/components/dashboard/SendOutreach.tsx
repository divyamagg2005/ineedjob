'use client'

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Users, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

import { getStoredUser } from '@/lib/google-auth';
import { sendEmail } from '@/app/actions/email';
import { insertApplication } from '@/app/actions/applications';
import { loadCompanyRecipients, sendBatchRecipientInitialCampaign } from '@/app/actions/outreach-batch';

interface SendOutreachProps {
  resumeFileName: string | null;
  emailSubject: string;
  emailBody: string;
}

interface RecipientOption {
  email: string;
  recruiterEmailId?: number | null;
  source?: string | null;
  verified?: boolean | null;
}

interface BatchRecipientStatus {
  status: 'queued' | 'sending' | 'sent' | 'failed';
  message?: string;
}

export function SendOutreach({ resumeFileName, emailSubject, emailBody }: SendOutreachProps) {
  const [isSending, setIsSending] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [availableRecipients, setAvailableRecipients] = useState<RecipientOption[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchCompanyId, setBatchCompanyId] = useState<number | null>(null);
  const [batchStatuses, setBatchStatuses] = useState<Record<string, BatchRecipientStatus>>({});
  const [batchSummary, setBatchSummary] = useState({ total: 0, successful: 0, failed: 0 });

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

  const handleViewRecipients = async () => {
    if (!companyName.trim()) {
      toast.error('Please enter a company name before viewing available recipients.');
      return;
    }

    setIsLoadingRecipients(true);
    try {
      const user = getStoredUser();
      if (!user?.accessToken) {
        toast.error('Missing Google Access Token. Please sign out and sign in again.');
        return;
      }

      const result = await loadCompanyRecipients(companyName.trim(), user.accessToken);
      if (!result.success) {
        toast.error(result.error ?? 'Unable to load recipients for this company.');
        setAvailableRecipients([]);
        setSelectedRecipients([]);
        setBatchCompanyId(null);
        return;
      }

      const recipients = result.recipients ?? [];
      setAvailableRecipients(recipients);
      setSelectedRecipients(recipients.map((recipient) => recipient.email));
      setBatchCompanyId(result.companyId ?? null);
      setBatchStatuses({});
      setBatchSummary({ total: 0, successful: 0, failed: 0 });

      if (recipients.length === 0) {
        toast.message('No recipients are currently available for this company.');
      } else {
        toast.success(`Loaded ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} for ${companyName.trim()}.`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to load available recipients.');
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  const toggleRecipient = (email: string) => {
    setSelectedRecipients((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email]
    );
  };

  const selectAllRecipients = () => {
    setSelectedRecipients(availableRecipients.map((recipient) => recipient.email));
  };

  const clearRecipientSelection = () => {
    setSelectedRecipients([]);
  };

  const handleBatchSend = async () => {
    const recipientsToSend = availableRecipients.filter((recipient) => selectedRecipients.includes(recipient.email));

    if (recipientsToSend.length === 0) {
      toast.error('Select at least one recipient before sending.');
      return;
    }

    if (!emailSubject || !emailBody) {
      toast.error('Please draft an email subject and body in the composer first.');
      return;
    }

    const user = getStoredUser();
    if (!user?.accessToken) {
      toast.error('Missing Google Access Token. Please sign out and sign in again.');
      return;
    }

    setIsBatchSending(true);
    setBatchStatuses(Object.fromEntries(recipientsToSend.map((recipient) => [recipient.email, { status: 'queued' as const }])));
    setBatchSummary({ total: recipientsToSend.length, successful: 0, failed: 0 });

    let successful = 0;
    let failed = 0;

    for (const recipient of recipientsToSend) {
      setBatchStatuses((current) => ({
        ...current,
        [recipient.email]: { status: 'sending', message: 'Sending...' },
      }));

      const result = await sendBatchRecipientInitialCampaign({
        companyId: batchCompanyId,
        recipientEmail: recipient.email,
        emailSubject,
        emailBody,
        accessToken: user.accessToken,
      });

      const isSuccess = Boolean(result.success && result.status !== 'DUPLICATE');
      const nextStatus: BatchRecipientStatus = {
        status: isSuccess ? 'sent' : 'failed',
        message: isSuccess ? 'Sent successfully' : result.error ?? 'Failed to send',
      };

      setBatchStatuses((current) => ({
        ...current,
        [recipient.email]: nextStatus,
      }));

      if (isSuccess) {
        successful += 1;
      } else {
        failed += 1;
      }

      setBatchSummary({ total: recipientsToSend.length, successful, failed });

      if (recipient !== recipientsToSend[recipientsToSend.length - 1]) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
    }

    setIsBatchSending(false);
    if (failed > 0) {
      toast.error(`Batch complete: ${successful} sent, ${failed} failed.`);
    } else {
      toast.success(`Batch complete: ${successful} sent successfully.`);
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

        <div className="mt-8 border-t border-border/70 pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Batch send to selected recruiters</h3>
              <p className="text-sm text-muted-foreground mt-1">
                View recipients for the company, choose each address, and send them independently using the same draft.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={handleViewRecipients} disabled={isLoadingRecipients || !companyName.trim()}>
              {isLoadingRecipients ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              View available recipients
            </Button>
          </div>

          {availableRecipients.length > 0 ? (
            <div className="mt-5 rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{availableRecipients.length} recipients loaded</p>
                  <p className="text-sm text-muted-foreground">Choose recipients individually, or select all at once.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllRecipients}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearRecipientSelection}>
                    Deselect All
                  </Button>
                  <Button type="button" size="sm" onClick={handleBatchSend} disabled={isBatchSending}>
                    {isBatchSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send to Selected Recipients
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {availableRecipients.map((recipient) => {
                  const isSelected = selectedRecipients.includes(recipient.email);
                  const status = batchStatuses[recipient.email];
                  return (
                    <label key={recipient.email} className="flex items-start gap-3 rounded-md border border-border/60 bg-card/60 p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecipient(recipient.email)}
                        className="mt-1 h-4 w-4 rounded border-border"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{recipient.email}</span>
                          {recipient.verified ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600">Verified</span> : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {recipient.source ? `Source: ${recipient.source}` : 'Imported recipient'}
                        </div>
                      </div>
                      <div className="flex min-w-[90px] items-center justify-end gap-2 text-sm">
                        {status ? (
                          <>
                            {status.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                            <span className="capitalize">{status.status}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Queued</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Total selected: {selectedRecipients.length}</span>
                <span>Successful: {batchSummary.successful}</span>
                <span>Failed: {batchSummary.failed}</span>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              View recipients for the company to enable individual selection and batch sending.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
