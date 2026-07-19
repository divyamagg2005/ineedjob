'use client'

import React, { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchCompanies, blacklistCompany, type Company } from '@/app/actions/companies';
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

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase();
  const config: Record<string, { label: string; className: string }> = {
    ready: { label: 'Ready', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    sent: { label: 'Sent', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
    pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    failed: { label: 'Failed', className: 'bg-red-500/15 text-red-400 border-red-500/20' },
    waiting_reply: { label: 'Waiting Reply', className: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
    replied: { label: 'Replied', className: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
    closed: { label: 'Closed', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  };
  const cfg = config[s] ?? { label: status || 'Unknown', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' };
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

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <tr>
      <td colSpan={5}>
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

export function InternshipsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [blacklistTarget, setBlacklistTarget] = useState<Company | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Emails</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <EmptyState filtered={search.length > 0} />
                ) : (
                  filtered.map((company) => (
                    <tr key={company.id} className="group transition-colors duration-150 hover:bg-white/[0.025]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.07] text-xs font-semibold text-zinc-400 select-none">
                            {company.company_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-zinc-100 truncate max-w-[200px]">
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
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="px-4 py-3.5 text-zinc-500 text-xs tabular-nums whitespace-nowrap">
                        {formatDate(company.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ActionsMenu company={company} onBlacklist={handleBlacklistRequest} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 bg-zinc-950/40">
              <p className="text-xs text-zinc-600">
                Showing <span className="text-zinc-400 font-medium">{filtered.length}</span> of{' '}
                <span className="text-zinc-400 font-medium">{companies.length}</span> companies
              </p>
            </div>
          )}
        </div>
      </section>
      <BlacklistDialog
        company={blacklistTarget}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isBlacklisting) setDialogOpen(open);
        }}
        onConfirm={handleBlacklistConfirm}
        isPending={isBlacklisting}
      />
    </>
  );
}
