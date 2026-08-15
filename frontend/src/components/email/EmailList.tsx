import { MailPlus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { emailsApi } from '../../api/emails';
import type { EmailBatchListResponse } from '../../types';
import { AppleLoader } from '../shared/AppleLoader';
import { Button } from '../ui/button';
import { BatchRow } from './BatchRow';

type ListType = 'scheduled' | 'sent';
interface LayoutContext {
  refreshKey: number;
  refreshStats: () => Promise<void>;
}

export function EmailList({ type }: { type: ListType }): JSX.Element {
  const { search } = useLocation();
  const { refreshKey, refreshStats } = useOutletContext<LayoutContext>();
  const [batchData, setBatchData] = useState<EmailBatchListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailRefreshToken, setDetailRefreshToken] = useState(0);

  const load = useCallback(async (silently = false) => {
    if (!silently) {
      setLoading(true);
      setError(null);
    }
    const params = new URLSearchParams(search);
    const filter = params.get('filter');
    params.set('status', filter || (type === 'scheduled' ? 'queued,pending,sending,rate_limited' : 'sent,failed'));
    params.set('limit', '100');
    try {
      setBatchData(await emailsApi.batches(params));
      setDetailRefreshToken((value) => value + 1);
      await refreshStats();
    } catch (loadError) {
      if (!silently) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load emails');
      }
    } finally {
      if (!silently) setLoading(false);
    }
  }, [refreshStats, search, type]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  useEffect(() => {
    // This polls the dashboard view only. Email scheduling is still handled by
    // BullMQ delayed jobs and the separate worker process.
    const refreshTimer = window.setInterval(() => { void load(true); }, 10_000);
    return () => window.clearInterval(refreshTimer);
  }, [load]);

  if (loading) return <EmailListLoader />;
  if (error) return <div className="px-10 py-16"><p className="text-rose-600">{error}</p><Button className="mt-4" variant="outline" onClick={() => void load()}>Try again</Button></div>;
  if (!batchData || batchData.batches.length === 0) return <EmptyEmailList type={type} onRefresh={() => void load()} />;
  return <section aria-label={`${type} email batches`}>{batchData.batches.map((batch) => <BatchRow key={batch.batchId} batch={batch} refreshToken={detailRefreshToken} type={type} />)}</section>;
}

function EmailListLoader(): JSX.Element {
  return <div className="flex min-h-[55vh] items-center justify-center"><AppleLoader label="Loading email batches" /></div>;
}

function EmptyEmailList({ type, onRefresh }: { type: ListType; onRefresh: () => void }): JSX.Element {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950"><MailPlus size={30} /></div>
      <h2 className="mt-5 text-xl font-semibold">No {type} emails yet</h2>
      <p className="mt-2 max-w-sm text-slate-500">{type === 'scheduled' ? 'Compose an email and choose exactly when it should be sent.' : 'Emails sent through your Ethereal sender will appear here.'}</p>
      <Button variant="outline" className="mt-6" onClick={onRefresh}><RefreshCw size={16} className="mr-2" />Refresh</Button>
    </div>
  );
}
