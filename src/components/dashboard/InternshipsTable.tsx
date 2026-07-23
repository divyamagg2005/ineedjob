'use client'

import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Mail,
  Ban,
  Building2,
  Loader2,
  AlertTriangle,
  FileText,
  Send,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchCompanies, blacklistCompany, type Company } from '@/app/actions/companies';
import { saveDraftForCompany, loadDraftForCompany } from '@/app/actions/campaign-drafts';
import { uploadResumeForCompany, getResumeDownloadUrl } from '@/app/actions/resumes';
import { getCompanyOutreachHistory, type CompanyOutreachHistoryRow } from '@/app/actions/outreach-history';
import { loadCompanyRecipients } from '@/app/actions/outreach-batch';
import { getStoredUser } from '@/lib/google-auth';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function getFollowUpStatusText(company: Company): string {
  if (company.followup_count >= 5) {
    return 'Follow-up lifecycle complete';
  }

  if (!company.next_followup_at) {
    return 'Follow-up not scheduled';
  }

  const next = new Date(company.next_followup_at);
  const now = new Date();
  const diffMs = next.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86_400_000);

  if (diffDays <= 0) {
    return 'Follow-up Due';
  }
  if (diffDays === 1) {
    return 'Follow-up available tomorrow';
  }
  return `Follow-up available in ${diffDays} days`;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase().trim();
  const config: Record<string, { label: string; className: string }> = {
    new: { label: 'New', className: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
    draft: { label: 'Draft', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    queued: { label: 'Queued', className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    sending: { label: 'Sending', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
    sent: { label: 'Sent', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
    'partially sent': { label: 'Partially Sent', className: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20' },
    'partially_sent': { label: 'Partially Sent', className: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20' },
    failed: { label: 'Failed', className: 'bg-red-500/15 text-red-400 border-red-500/20' },
    completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    follow_up_due: { label: 'Follow-Up Due', className: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
    followup_due: { label: 'Follow-Up Due', className: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
    ready: { label: 'Ready', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    waiting_reply: { label: 'Waiting Reply', className: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
    replied: { label: 'Replied', className: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
    closed: { label: 'Closed', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  };
  const cfg = config[s] ?? { label: status || 'New', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.06]">
      {[40, 16, 24, 20, 12].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className={`h-4 w-${w} rounded bg-white/[0.06] animate-pulse`} />
        </td>
      ))}
    </tr>
  );
}

interface ActionsMenuProps {
  company: Company;
  onBlacklist: (company: Company) => void;
}

function ActionsMenu({ company, onBlacklist }: ActionsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`Actions for ${company.company_name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[160px] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 p-1 shadow-2xl shadow-black/40 animate-in fade-in-0 zoom-in-95"
        >
          <DropdownMenu.Item
            onSelect={() => toast.info(`Viewing emails for ${company.company_name}`)}
            className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none transition-colors hover:bg-white/[0.06] focus:bg-white/[0.06]"
          >
            <Mail className="h-3.5 w-3.5 text-zinc-400" />
            View Emails
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />
          <DropdownMenu.Item
            onSelect={() => onBlacklist(company)}
            className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 outline-none transition-colors hover:bg-red-500/10 focus:bg-red-500/10"
          >
            <Ban className="h-3.5 w-3.5" />
            Blacklist Company
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface BlacklistDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

function BlacklistDialog({ company, open, onOpenChange, onConfirm, isPending }: BlacklistDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 shadow-2xl shadow-black/50 animate-in fade-in-0 zoom-in-95 focus:outline-none"
          aria-describedby="blacklist-description"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <Dialog.Title className="text-lg font-semibold text-white mb-2">
            Blacklist Company
          </Dialog.Title>
          <Dialog.Description id="blacklist-description" asChild>
            <div className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to blacklist{' '}
              <span className="font-medium text-zinc-200">{company?.company_name}</span>?
              <div className="mt-3 space-y-1.5">
                <p className="text-zinc-500 text-xs mb-2">This action will:</p>
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>Remove all recruiter email addresses</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>Remove the company from the dashboard</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>Prevent future processing for this company</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-zinc-500">This action cannot be undone automatically.</p>
            </div>
          </Dialog.Description>
          <div className="flex gap-3 justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10" disabled={isPending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={onConfirm} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg shadow-red-900/30 min-w-[140px]">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Blacklisting…
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  Blacklist Company
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HistoryDialog({
  company,
  open,
  onOpenChange,
  rows,
  isLoading,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CompanyOutreachHistoryRow[];
  isLoading: boolean;
}) {
  if (!open || !company) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 shadow-2xl shadow-black/50 focus:outline-none">
          <div className="mb-5">
            <Dialog.Title className="text-lg font-semibold text-white">Send history for {company.company_name}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-zinc-500">
              Recipient-level send attempts and their current status.
            </Dialog.Description>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 text-sm text-zinc-400">Loading history…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.04] p-4 text-sm text-zinc-400">No send history has been recorded for this company yet.</div>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-lg border border-white/[0.08]">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Recipient</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Message ID</th>
                    <th className="px-3 py-2">Thread ID</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-zinc-950/40">
                  {rows.map((row, index) => (
                    <tr key={`${row.campaignId}-${row.recipientEmail ?? 'unknown'}-${index}`} className="align-top">
                      <td className="px-3 py-2 text-zinc-200">{row.recipientEmail || '—'}</td>
                      <td className="px-3 py-2 text-zinc-300">{row.logStatus || row.campaignStatus || 'NEW'}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.gmailMessageId || '—'}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.gmailThreadId || '—'}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.errorMessage || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <Building2 className="h-7 w-7 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">
            {filtered ? 'No matching companies' : 'No companies available'}
          </p>
          <p className="text-xs text-zinc-600 max-w-[240px] leading-relaxed">
            {filtered ? 'Try adjusting your search query.' : 'Companies discovered by the pipeline will appear here.'}
          </p>
        </div>
      </td>
    </tr>
  );
}

interface DraftComposerProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onSent: () => void;
}

type ComposerStep = 'compose' | 'pick-recipient';

// Random delay between individual sends: 15–50 seconds
const getRandomSendDelay = () => Math.floor(Math.random() * (50000 - 15000 + 1)) + 15000;

interface SendProgress {
  email: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
}

function DraftComposer({ company, open, onOpenChange, onSaved, onSent }: DraftComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [step, setStep] = useState<ComposerStep>('compose');
  const [recipients, setRecipients] = useState<{ email: string; source: string | null; verified: boolean | null }[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendProgress[]>([]);
  const [sendComplete, setSendComplete] = useState(false);

  const currentUser = getStoredUser();

  const resetDraftForm = useCallback(() => {
    setSubject('');
    setBody('');
    setError(null);
    setHasLoaded(false);
    setStep('compose');
    setRecipients([]);
    setSelectedEmails(new Set());
    setSendProgress([]);
    setSendComplete(false);
  }, []);

  React.useEffect(() => {
    if (!open || !company) return;
    const loadDraft = async () => {
      resetDraftForm();
      setIsLoading(true);
      try {
        const result = await loadDraftForCompany(company.id, currentUser?.accessToken);
        if (result.success) {
          setSubject(result.subject ?? '');
          setBody(result.body ?? '');
        } else {
          setError(result.error ?? 'Unable to load draft.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load draft.');
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    };
    loadDraft();
  }, [company?.id, currentUser?.accessToken, open, resetDraftForm]);

  const handleSave = async () => {
    if (!company || isSaving || isLoading) return;
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setError('Please enter both a subject and email body before saving.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveDraftForCompany({ companyId: company.id, subject: trimmedSubject, body: trimmedBody }, currentUser?.accessToken);
      if (!result.success) throw new Error(result.error ?? 'Unable to save draft.');
      toast.success('Draft saved successfully.');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProceedToRecipient = async () => {
    if (!company || isSaving || isLoading) return;
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setError('Please enter both a subject and email body before sending.');
      return;
    }
    if (!currentUser?.accessToken) {
      setError('You must be signed in to send emails.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saveResult = await saveDraftForCompany({ companyId: company.id, subject: trimmedSubject, body: trimmedBody }, currentUser.accessToken);
      if (!saveResult.success) throw new Error(saveResult.error ?? 'Unable to save draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    setIsLoadingRecipients(true);
    try {
      const result = await loadCompanyRecipients(company.company_name, currentUser.accessToken);
      const list = (result.recipients ?? []).map((r) => ({
        email: r.email,
        source: r.source ?? null,
        verified: r.verified ?? null,
      }));
      const seen = new Set<string>();
      const deduped = list.filter((r) => {
        const key = r.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setRecipients(deduped);
      // Pre-select first by default
      if (deduped.length > 0) {
        setSelectedEmails(new Set([deduped[0].email]));
      }
      setStep('pick-recipient');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load recipients.');
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmails.size === recipients.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(recipients.map((r) => r.email)));
    }
  };

  const handleConfirmSend = async () => {
    if (!company || !currentUser?.accessToken || isSending) return;
    if (selectedEmails.size === 0) {
      setError('Please select at least one recipient.');
      return;
    }

    const toSend = recipients.filter((r) => selectedEmails.has(r.email));
    const isBatch = toSend.length > 1;

    // Initialise progress
    setSendProgress(toSend.map((r) => ({ email: r.email, status: 'pending' })));
    setIsSending(true);
    setError(null);

    let sentCount = 0;

    for (let i = 0; i < toSend.length; i++) {
      const recipient = toSend[i];

      // Mark as sending
      setSendProgress((prev) => prev.map((p) => p.email === recipient.email ? { ...p, status: 'sending' } : p));

      try {
        const response = await fetch('/api/outreach/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-google-access-token': currentUser.accessToken,
          },
          body: JSON.stringify({ companyId: company.id, recipientEmail: recipient.email, followUp: false }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error ?? 'Failed to send email.');

        setSendProgress((prev) => prev.map((p) => p.email === recipient.email ? { ...p, status: 'sent' } : p));
        sentCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send.';
        setSendProgress((prev) => prev.map((p) => p.email === recipient.email ? { ...p, status: 'failed', error: msg } : p));
      }

      // Delay between sends (skip after last one)
      if (isBatch && i < toSend.length - 1) {
        const delay = getRandomSendDelay();
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setIsSending(false);
    setSendComplete(true);

    if (sentCount > 0) {
      toast.success(sentCount === 1
        ? `Email sent to ${toSend[0].email}.`
        : `${sentCount} of ${toSend.length} emails sent to ${company.company_name}.`
      );
      onSent();
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (isSending) return; // block closing while sending
    if (!nextOpen) resetDraftForm();
    onOpenChange(nextOpen);
  };

  if (!open || !company) return null;

  const allSelected = recipients.length > 0 && selectedEmails.size === recipients.length;
  const someSelected = selectedEmails.size > 0 && !allSelected;

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 shadow-2xl shadow-black/50 focus:outline-none">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">
                {step === 'compose' ? 'Email Draft' : sendComplete ? 'Send Complete' : 'Select Recipients'}
              </Dialog.Title>
              <p className="mt-1 text-sm text-zinc-500">
                {step === 'compose'
                  ? `Compose a draft for ${company.company_name}.`
                  : sendComplete
                    ? `Finished sending to ${company.company_name}.`
                    : `Choose one or more recipients at ${company.company_name}. Emails are sent individually with a delay.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {step === 'pick-recipient' && !isSending && !sendComplete && (
                <button
                  onClick={() => { setStep('compose'); setError(null); }}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-white/[0.08] transition-colors"
                >
                  ← Back
                </button>
              )}
              <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-400">
                {step === 'compose' ? (hasLoaded ? 'Step 1 of 2' : 'Loading...') : 'Step 2 of 2'}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          {/* Step 1: Compose */}
          {step === 'compose' && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Company Name</label>
                <Input value={company.company_name} readOnly className="bg-white/[0.04] border-white/[0.08] text-zinc-200" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter a subject"
                  className="bg-white/[0.04] border-white/[0.08] text-zinc-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Email Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your outreach email"
                  rows={10}
                  className="min-h-[220px] w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/40"
                />
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-zinc-400">
                <span className="font-medium text-zinc-300">Resume:</span>{' '}
                {company.has_resume ? 'Attached' : 'No resume attached yet'}
              </div>
            </div>
          )}

          {/* Step 2: Pick recipients or show progress */}
          {step === 'pick-recipient' && (
            <div className="space-y-3">
              {isLoadingRecipients ? (
                <div className="flex items-center gap-2 py-8 justify-center text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading recipients…
                </div>
              ) : recipients.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.04] p-6 text-center text-sm text-zinc-500">
                  No email addresses found for {company.company_name}.
                </div>
              ) : (
                <>
                  {/* Sending progress view */}
                  {(isSending || sendComplete) && sendProgress.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500 mb-1">
                        {isSending
                          ? `Sending ${sendProgress.filter(p => p.status === 'sent' || p.status === 'sending').length} of ${sendProgress.length}… Please keep this dialog open.`
                          : `Done — ${sendProgress.filter(p => p.status === 'sent').length} sent, ${sendProgress.filter(p => p.status === 'failed').length} failed.`}
                      </p>
                      {isSending && selectedEmails.size > 1 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                          Sending with a random 15–50s delay between emails to avoid spam detection.
                        </div>
                      )}
                      <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                        {sendProgress.map((p) => (
                          <div key={p.email} className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                            p.status === 'sent' ? 'border-emerald-500/20 bg-emerald-500/10' :
                            p.status === 'failed' ? 'border-red-500/20 bg-red-500/10' :
                            p.status === 'sending' ? 'border-violet-500/30 bg-violet-500/10' :
                            'border-white/[0.08] bg-white/[0.03]'
                          }`}>
                            <span className={`font-medium truncate ${
                              p.status === 'sent' ? 'text-emerald-300' :
                              p.status === 'failed' ? 'text-red-300' :
                              p.status === 'sending' ? 'text-violet-300' : 'text-zinc-400'
                            }`}>{p.email}</span>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {p.status === 'pending' && <span className="text-xs text-zinc-500">Waiting…</span>}
                              {p.status === 'sending' && <><Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" /><span className="text-xs text-violet-400">Sending…</span></>}
                              {p.status === 'sent' && <span className="text-xs font-medium text-emerald-400">✓ Sent</span>}
                              {p.status === 'failed' && <span className="text-xs text-red-400 text-right max-w-[200px] truncate" title={p.error}>✕ {p.error ?? 'Failed'}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Select all row */}
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-zinc-500">
                          {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} found — select to send individually with a random 15–50s delay between each.
                        </p>
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="text-xs text-violet-400 hover:text-violet-300 transition-colors shrink-0 ml-4"
                        >
                          {allSelected ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>

                      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                        {recipients.map((r, i) => {
                          const isChecked = selectedEmails.has(r.email);
                          return (
                            <button
                              key={`${r.email}-${i}`}
                              type="button"
                              onClick={() => toggleEmail(r.email)}
                              className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                                isChecked
                                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <div className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                                  isChecked ? 'border-violet-500 bg-violet-500' : 'border-zinc-600'
                                }`}>
                                  {isChecked && (
                                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span className="font-medium">{r.email}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {r.verified && (
                                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                                    Verified
                                  </span>
                                )}
                                {r.source && (
                                  <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[11px] text-zinc-500">
                                    {r.source}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Summary bar */}
                      {selectedEmails.size > 0 && (
                        <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
                          {selectedEmails.size === 1
                            ? <>Sending to: <span className="font-medium text-zinc-200">{[...selectedEmails][0]}</span></>
                            : <><span className="font-medium text-zinc-200">{selectedEmails.size} recipients</span> selected — emails sent one at a time with a random 15–50s gap between each.</>
                          }
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              className="border-white/[0.08] bg-white/[0.04] text-zinc-300"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSending}
            >
              {sendComplete ? 'Close' : 'Cancel'}
            </Button>

            {step === 'compose' && (
              <>
                <Button
                  variant="outline"
                  className="border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
                  onClick={handleSave}
                  disabled={isSaving || isSending || isLoading}
                >
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Draft'}
                </Button>
                <Button
                  className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-900/30"
                  onClick={handleProceedToRecipient}
                  disabled={isSaving || isSending || isLoading || isLoadingRecipients}
                >
                  {isSaving || isLoadingRecipients
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</>
                    : <><Send className="mr-2 h-4 w-4" /> Send Email…</>}
                </Button>
              </>
            )}

            {step === 'pick-recipient' && !sendComplete && (
              <Button
                className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-900/30"
                onClick={handleConfirmSend}
                disabled={isSending || selectedEmails.size === 0 || recipients.length === 0}
              >
                {isSending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  : selectedEmails.size > 1
                    ? <><Send className="mr-2 h-4 w-4" /> Send to {selectedEmails.size} Recipients</>
                    : <><Send className="mr-2 h-4 w-4" /> Confirm & Send</>}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const FOLLOW_UP_MAX_ATTEMPTS = 5;

interface FollowUpResult {
  email: string;
  success: boolean;
  error?: string;
}

interface FollowUpComposerProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

function FollowUpComposer({ company, open, onOpenChange, onSent }: FollowUpComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FollowUpResult[] | null>(null);

  const currentUser = getStoredUser();

  React.useEffect(() => {
    if (open) {
      setSubject('');
      setBody('');
      setError(null);
      setResults(null);
      setIsSending(false);
    }
  }, [open, company?.id]);

  if (!open || !company) return null;

  const attemptsUsed = company.followup_count ?? 0;
  const attemptsRemaining = Math.max(0, FOLLOW_UP_MAX_ATTEMPTS - attemptsUsed);

  const handleSend = async () => {
    if (isSending) return;
    if (!currentUser?.accessToken) {
      setError('You must be signed in to send follow-ups.');
      return;
    }
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError('Please write a follow-up message before sending.');
      return;
    }

    setIsSending(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-google-access-token': currentUser.accessToken,
        },
        body: JSON.stringify({
          companyId: company.id,
          followUp: true,
          followUpSubject: subject.trim() || null,
          followUpBody: trimmedBody,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to send follow-up email.');
      }

      setResults(Array.isArray(result?.results) ? result.results : []);
      const sentCount = Number(result?.sentCount ?? 0);
      const total = Number(result?.totalRecipients ?? 0);
      if (sentCount > 0) {
        toast.success(
          sentCount === total
            ? `Follow-up ${result?.followUpNumber ?? ''} sent to ${sentCount} recipient${sentCount === 1 ? '' : 's'} at ${company.company_name}.`
            : `${sentCount} of ${total} follow-ups sent to ${company.company_name}.`
        );
        onSent();
      } else {
        toast.error('No follow-ups could be sent.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.';
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (isSending) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 shadow-2xl shadow-black/50 focus:outline-none">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">Send Follow-Up</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500">
                Write a new message to send to everyone who received your initial email at {company.company_name}.
              </Dialog.Description>
            </div>
            <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-400 shrink-0">
              {attemptsRemaining} of {FOLLOW_UP_MAX_ATTEMPTS} left
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
            {getFollowUpStatusText(company)} · You can send up to {FOLLOW_UP_MAX_ATTEMPTS} follow-ups, one per week.
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          {results ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 mb-1">
                {results.filter((r) => r.success).length} sent, {results.filter((r) => !r.success).length} failed.
              </p>
              <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                {results.map((r) => (
                  <div
                    key={r.email}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                      r.success ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'
                    }`}
                  >
                    <span className={`font-medium truncate ${r.success ? 'text-emerald-300' : 'text-red-300'}`}>{r.email}</span>
                    <span className={`text-xs shrink-0 ml-3 ${r.success ? 'text-emerald-400' : 'text-red-400'}`} title={r.error}>
                      {r.success ? '✓ Sent' : `✕ ${r.error ?? 'Failed'}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Subject <span className="text-zinc-500">(optional)</span></label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Leave blank to auto-generate a follow-up subject"
                  className="bg-white/[0.04] border-white/[0.08] text-zinc-200"
                  disabled={isSending}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Follow-Up Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your follow-up message"
                  rows={9}
                  disabled={isSending}
                  className="min-h-[200px] w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/40 disabled:opacity-60"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              className="border-white/[0.08] bg-white/[0.04] text-zinc-300"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSending}
            >
              {results ? 'Close' : 'Cancel'}
            </Button>
            {!results && (
              <Button
                className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-900/30"
                onClick={handleSend}
                disabled={isSending || attemptsRemaining === 0}
              >
                {isSending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  : <><Send className="mr-2 h-4 w-4" /> Send Follow-Up</>}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function InternshipsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [blacklistTarget, setBlacklistTarget] = useState<Company | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingCompanyId, setUploadingCompanyId] = useState<number | null>(null);
  const [resumeAttachedCompanyIds, setResumeAttachedCompanyIds] = useState<Record<number, boolean>>({});
  const [composerCompany, setComposerCompany] = useState<Company | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [followUpCompany, setFollowUpCompany] = useState<Company | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloadingCompanyId, setDownloadingCompanyId] = useState<number | null>(null);
  const [historyCompany, setHistoryCompany] = useState<Company | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<CompanyOutreachHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingCompanyId, setPendingCompanyId] = useState<number | null>(null);

  const currentUser = getStoredUser();

  const { data: companies = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['companies', currentUser?.email, currentUser?.userId],
    queryFn: () => fetchCompanies(currentUser?.accessToken),
  });

  const { mutate: doBlacklist, isPending: isBlacklisting } = useMutation({
    mutationFn: (company: Company) => blacklistCompany(company.id, company.company_name, currentUser?.accessToken),
    onSuccess: () => {
      toast.success('Company blacklisted successfully.');
      setDialogOpen(false);
      setBlacklistTarget(null);
      queryClient.invalidateQueries({ queryKey: ['companies', currentUser?.email, currentUser?.userId] });
    },
    onError: (err) => {
      const msg = (err as Error)?.message ?? 'Unknown error';
      toast.error(`Failed to blacklist company: ${msg}`);
      console.error('[blacklist]', err);
    },
  });

  const handleBlacklistRequest = useCallback((company: Company) => {
    setBlacklistTarget(company);
    setDialogOpen(true);
  }, []);

  const handleBlacklistConfirm = useCallback(() => {
    if (blacklistTarget) doBlacklist(blacklistTarget);
  }, [blacklistTarget, doBlacklist]);

  const filtered = companies.filter((c) =>
    c.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedCompanies = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const handleResumeClick = useCallback((companyId: number) => {
    setPendingCompanyId(companyId);
    fileInputRef.current?.click();
  }, []);

  const handleResumeDownload = useCallback(async (company: Company) => {
    if (downloadingCompanyId !== null) return;
    setDownloadingCompanyId(company.id);
    try {
      const result = await getResumeDownloadUrl(company.id, currentUser?.accessToken);
      if (!result.success || !result.url) {
        throw new Error(result.error ?? 'Could not generate download link.');
      }
      // Open the presigned URL in a new tab — browser will trigger the download
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed.';
      toast.error(message);
    } finally {
      setDownloadingCompanyId(null);
    }
  }, [currentUser?.accessToken, downloadingCompanyId]);

  const handleEmailClick = useCallback((company: Company) => {
    setComposerCompany(company);
    setComposerOpen(true);
  }, []);

  const handleOpenHistory = useCallback(async (company: Company) => {
    setHistoryCompany(company);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await getCompanyOutreachHistory(company.id, currentUser?.accessToken);
      setHistoryRows(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load send history.';
      toast.error(message);
      console.error('[history]', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentUser?.accessToken]);

  const handleFollowUpClick = useCallback((company: Company) => {
    setFollowUpCompany(company);
    setFollowUpOpen(true);
  }, []);

  const handleResumeSelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    const companyId = pendingCompanyId;

    if (!selectedFile || companyId === null) {
      setPendingCompanyId(null);
      return;
    }

    setUploadingCompanyId(companyId);
    setPendingCompanyId(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('companyId', String(companyId));

      const result = await uploadResumeForCompany(formData, currentUser?.accessToken);

      if (!result.success) {
        throw new Error(result.error || 'Resume upload failed.');
      }

      setResumeAttachedCompanyIds((prev) => ({ ...prev, [companyId]: true }));
      toast.success(`Resume attached for ${companies.find((item) => item.id === companyId)?.company_name || 'the selected company'}.`);
      queryClient.invalidateQueries({ queryKey: ['companies', currentUser?.email, currentUser?.userId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      toast.error(message);
      console.error('[resume-upload]', error);
    } finally {
      setUploadingCompanyId(null);
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [companies, currentUser?.accessToken, currentUser?.email, currentUser?.userId, pendingCompanyId, queryClient]);

  React.useEffect(() => {
    if (!isLoading) {
      console.log('[InternshipsTable] companies:', companies);
      if (isError) console.error('[InternshipsTable] error:', error);
    }
  }, [companies, isLoading, isError, error]);

  return (
    <>
      <section className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight text-white">Companies</h2>
              {!isLoading && (
                <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-xs font-medium text-zinc-400">
                  {filtered.length}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Companies extracted from your Gmail inbox.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
              <Input
                placeholder="Search companies…"
                className="pl-8 h-8 text-xs bg-white/[0.04] border-white/[0.08] placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search companies"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 shrink-0"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh companies list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden shadow-xl shadow-black/20">
          {isError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Failed to load companies:{' '}
                <span className="font-mono text-xs">{(error as Error)?.message ?? 'Unknown error'}</span>
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Companies table">
              <thead className="sticky top-0 z-10 border-b border-white/[0.07] bg-zinc-950/80 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap w-full">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Emails Found</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Resume</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <EmptyState filtered={search.length > 0} />
                ) : (
                  pagedCompanies.map((company) => (
                    <tr key={company.id} className="group transition-colors duration-150 hover:bg-white/[0.025]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] text-xs font-semibold text-zinc-400 select-none">
                            {company.company_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-zinc-100 truncate max-w-[220px]">
                            {company.company_name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="tabular-nums text-zinc-300 font-medium">
                          {company.email_count ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {resumeAttachedCompanyIds[company.id] || company.has_resume ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                              onClick={() => handleResumeDownload(company)}
                              disabled={downloadingCompanyId === company.id}
                              title="Download resume"
                            >
                              {downloadingCompanyId === company.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />}
                              {downloadingCompanyId === company.id ? 'Loading…' : 'Download'}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                              onClick={() => handleResumeClick(company.id)}
                              disabled={uploadingCompanyId === company.id}
                              title="Replace resume"
                            >
                              {uploadingCompanyId === company.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <FileText className="h-3 w-3" />}
                              {uploadingCompanyId === company.id ? 'Uploading…' : 'Replace'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                            onClick={() => handleResumeClick(company.id)}
                            disabled={uploadingCompanyId === company.id}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {uploadingCompanyId === company.id ? 'Uploading...' : 'Upload Resume'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
                          onClick={() => handleEmailClick(company)}
                          disabled={savingDraft}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {company.status?.toLowerCase() === 'draft' ? 'Edit Email' : 'Write Email'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="mr-2 hidden text-right text-[11px] text-zinc-500 xl:block">
                            {getFollowUpStatusText(company)}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
                            onClick={() => handleOpenHistory(company)}
                          >
                            History
                          </Button>
                          {(() => {
                            const followUpComplete = company.followup_count >= 5;
                            const notSentYet = !company.last_sent_at;
                            const notDueYet = Boolean(
                              company.last_sent_at &&
                              company.next_followup_at &&
                              new Date(company.next_followup_at) > new Date()
                            );
                            const disabled = followUpComplete || notSentYet || notDueYet;
                            return (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={
                                  disabled
                                    ? 'h-8 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'
                                    : 'h-8 border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
                                }
                                onClick={() => handleFollowUpClick(company)}
                                disabled={disabled}
                                title={notSentYet ? 'Send the initial email before following up.' : undefined}
                              >
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                {followUpComplete ? 'Follow Up Complete' : 'Follow Up'}
                              </Button>
                            );
                          })()}
                          <ActionsMenu company={company} onBlacklist={handleBlacklistRequest} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-2.5 bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-600">
                Showing <span className="text-zinc-400 font-medium">{Math.min(filtered.length, safePage * pageSize)}</span> of{' '}
                <span className="text-zinc-400 font-medium">{filtered.length}</span> matching companies
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
                  Previous
                </Button>
                <span className="text-xs text-zinc-500">Page {safePage} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-8 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleResumeSelection}
      />
      <DraftComposer
        company={composerCompany}
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) {
            setComposerCompany(null);
          }
        }}
        onSaved={() => {
          setSavingDraft(false);
          queryClient.invalidateQueries({ queryKey: ['companies', currentUser?.email, currentUser?.userId] });
        }}
        onSent={() => {
          queryClient.invalidateQueries({ queryKey: ['companies', currentUser?.email, currentUser?.userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }}
      />
      <FollowUpComposer
        company={followUpCompany}
        open={followUpOpen}
        onOpenChange={(open) => {
          setFollowUpOpen(open);
          if (!open) {
            setFollowUpCompany(null);
          }
        }}
        onSent={() => {
          queryClient.invalidateQueries({ queryKey: ['companies', currentUser?.email, currentUser?.userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }}
      />
      <BlacklistDialog
        company={blacklistTarget}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isBlacklisting) setDialogOpen(open);
        }}
        onConfirm={handleBlacklistConfirm}
        isPending={isBlacklisting}
      />
      <HistoryDialog
        company={historyCompany}
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) {
            setHistoryCompany(null);
            setHistoryRows([]);
          }
        }}
        rows={historyRows}
        isLoading={historyLoading}
      />
    </>
  );
}
