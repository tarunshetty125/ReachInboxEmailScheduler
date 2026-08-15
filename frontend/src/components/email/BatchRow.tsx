import { ChevronDown, ChevronUp, Clock3, LoaderCircle, Send, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { emailsApi } from '../../api/emails';
import type { EmailBatchSummary, EmailListResponse } from '../../types';
import { EmailRow } from './EmailRow';
import { Button } from '../ui/button';

const PAGE_SIZE = 100;
const statusesForView = {
  scheduled: 'queued,pending,sending,rate_limited',
  sent: 'sent,failed',
} as const;

function plainPreview(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatGap(delayMs: number): string {
  if (delayMs % 60_000 === 0) {
    const minutes = delayMs / 60_000;
    return `1 email every ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const seconds = delayMs / 1_000;
  return `1 email every ${seconds} second${seconds === 1 ? '' : 's'}`;
}

function formatWhen(value: string | null): string {
  if (!value) return 'No remaining scheduled emails';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function BatchRow({ batch, refreshToken, type }: { batch: EmailBatchSummary; refreshToken: number; type: 'scheduled' | 'sent' }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<EmailListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const sent = batch.statusCounts.sent ?? 0;
  const active = (batch.statusCounts.pending ?? 0) + (batch.statusCounts.queued ?? 0) + (batch.statusCounts.sending ?? 0) + (batch.statusCounts.rate_limited ?? 0);
  const senderLabel = batch.sender.aliasEmail
    ? `${batch.sender.aliasEmail} → ${batch.sender.email}`
    : batch.sender.email;

  const loadDetails = useCallback(async (silently = false) => {
    if (!silently) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({
        batchId: batch.batchId,
        status: statusesForView[type],
        page: `${page}`,
        limit: `${PAGE_SIZE}`,
      });
      const result = await emailsApi.list(params);
      setDetails(result);
      const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
    } catch (loadError) {
      if (!silently) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load recipient emails');
      }
    } finally {
      if (!silently) setLoading(false);
    }
  }, [batch.batchId, page, type]);

  const toggle = async () => {
    const shouldExpand = !expanded;
    setExpanded(shouldExpand);
    if (!shouldExpand || details || loading) return;
    await loadDetails();
  };

  const hasLoadedDetails = details !== null;
  useEffect(() => {
    if (expanded && hasLoadedDetails) void loadDetails(true);
  }, [expanded, hasLoadedDetails, loadDetails, refreshToken]);

  return (
    <section className="border-b border-slate-100 dark:border-slate-800">
      <button type="button" onClick={() => void toggle()} className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900 md:px-7" aria-expanded={expanded}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Users size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{batch.subject}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Batch · {batch.emailCount} recipient{batch.emailCount === 1 ? '' : 's'}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{plainPreview(batch.bodyHtml)}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{sent} sent · {active} active</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Next: {formatWhen(batch.nextScheduledAt)}</p>
        </div>
        {expanded ? <ChevronUp className="shrink-0 text-slate-400" size={18} /> : <ChevronDown className="shrink-0 text-slate-400" size={18} />}
      </button>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-slate-50 px-4 py-1.5 text-xs dark:bg-slate-900/60 md:px-7">
        <p className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-300"><Send size={14} className="shrink-0 text-emerald-600" /><span className="max-w-[340px] truncate" title={senderLabel}>From: {senderLabel}</span></p>
        <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><Clock3 size={14} className="shrink-0 text-emerald-600" />Gap: {formatGap(batch.effectiveDelayBetweenMs)}</p>
        <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><Users size={14} className="shrink-0 text-emerald-600" />Limit: {batch.hourlyLimit} emails/hour</p>
      </div>

      {expanded && <div className="border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
        <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:px-7">{type === 'scheduled' ? 'Active recipient emails' : 'Sent recipient emails'} {details ? `(${details.total})` : ''}</p>
        {loading && <div className="flex items-center gap-2 px-4 pb-3 text-xs text-slate-400 md:px-7"><LoaderCircle className="animate-spin" size={15} />Loading recipients…</div>}
        {error && <p className="px-4 pb-3 text-xs text-rose-600 md:px-7">{error}</p>}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {details?.emails.map((email) => <EmailRow key={email.id} email={email} />)}
          {details && <BatchPagination details={details} onPageChange={setPage} />}
        </div>
      </div>}
    </section>
  );
}

function BatchPagination({ details, onPageChange }: { details: EmailListResponse; onPageChange: (page: number) => void }): JSX.Element | null {
  const totalPages = Math.max(1, Math.ceil(details.total / details.limit));
  if (details.total <= details.limit) return null;
  const first = (details.page - 1) * details.limit + 1;
  const last = Math.min(details.page * details.limit, details.total);

  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 md:px-7">
      <span>Showing {first}–{last} of {details.total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={details.page === 1} onClick={() => onPageChange(details.page - 1)}>Previous</Button>
        <span className="min-w-20 text-center">Page {details.page} of {totalPages}</span>
        <Button type="button" size="sm" variant="ghost" disabled={details.page === totalPages} onClick={() => onPageChange(details.page + 1)}>Next</Button>
      </div>
    </div>
  );
}
