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
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchCompanies, blacklistCompany, type Company } from '@/app/actions/companies';
import { saveDraftForCompany, loadDraftForCompany } from '@/app/actions/campaign-drafts';
import { uploadResumeForCompany } from '@/app/actions/resumes';
import { getCompanyOutreachHistory, type CompanyOutreachHistoryRow } from '@/app/actions/outreach-history';
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
}

function DraftComposer({ company, open, onOpenChange, onSaved }: DraftComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const currentUser = getStoredUser();

  const resetDraftForm = useCallback(() => {
    setSubject('');
    setBody('');
    setError(null);
    setHasLoaded(false);
  }, []);

  React.useEffect(() => {
    if (!open || !company) {
      return;
    }

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
      if (!result.success) {
        throw new Error(result.error ?? 'Unable to save draft.');
      }

      toast.success('Draft saved successfully.');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDraftForm();
    }
    onOpenChange(nextOpen);
  };

  if (!open || !company) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 shadow-2xl shadow-black/50 focus:outline-none">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">Email Draft</Dialog.Title>
              <p className="mt-1 text-sm text-zinc-500">Compose a draft for {company.company_name}.</p>
            </div>
            <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-400">
              {hasLoaded ? 'Loaded' : 'Loading...'}
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          ) : null}

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

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300" onClick={() => handleDialogOpenChange(false)} disabled={isSaving || isLoading}>
              Cancel
            </Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Draft'}
            </Button>
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
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingCompanyId, setSendingCompanyId] = useState<number | null>(null);
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

  const handleSendClick = useCallback(async (company: Company) => {
    if (!currentUser?.accessToken || sendingCompanyId !== null) {
      return;
    }

    const confirmed = window.confirm(`Send the outreach email for ${company.company_name}?`);
    if (!confirmed) {
      return;
    }

    const isFollowUpEligible = Boolean(
      company.last_sent_at &&
      company.followup_count < 5 &&
      (!company.next_followup_at || new Date(company.next_followup_at) <= new Date())
    );

    setSendingCompanyId(company.id);
    try {
      const response = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-google-access-token': currentUser.accessToken,
        },
        body: JSON.stringify({ campaignId: null, companyId: company.id, followUp: isFollowUpEligible }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to send email.');
      }

      toast.success(isFollowUpEligible ? `Follow-up sent successfully to ${company.company_name}.` : `Email sent successfully to ${company.company_name}.`);
      queryClient.invalidateQueries({ queryKey: ['companies', currentUser?.email, currentUser?.userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['hunterStatus'] });
      queryClient.invalidateQueries({ queryKey: ['databaseStatus'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      toast.error(message);
      console.error('[send-mail]', error);
    } finally {
      setSendingCompanyId(null);
    }
  }, [currentUser?.accessToken, currentUser?.email, currentUser?.userId, queryClient, sendingCompanyId]);

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
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
                          onClick={() => handleResumeClick(company.id)}
                          disabled={uploadingCompanyId === company.id}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {uploadingCompanyId === company.id
                            ? 'Uploading...'
                            : resumeAttachedCompanyIds[company.id] || company.has_resume
                              ? 'Resume Attached'
                              : 'Upload Resume'}
                        </button>
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
                          {(company.followup_count >= 5 || (company.last_sent_at && company.next_followup_at && new Date(company.next_followup_at) > new Date())) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
                              disabled
                            >
                              {company.followup_count >= 5 ? 'Follow Up Complete' : 'Follow Up'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                              onClick={() => handleSendClick(company)}
                              disabled={sendingCompanyId === company.id}
                            >
                              {sendingCompanyId === company.id ? (
                                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...</>
                              ) : (
                                <><Send className="mr-1.5 h-3.5 w-3.5" /> Follow Up</>
                              )}
                            </Button>
                          )}
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
