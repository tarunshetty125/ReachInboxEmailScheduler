import { Clock3, CircleAlert, Send, TimerReset } from 'lucide-react';
import { format } from 'date-fns';
import type { EmailRecord } from '../../types';
import { cn } from '../../utils/cn';

export function StatusBadge({ email }: { email: EmailRecord }): JSX.Element {
  if (email.status === 'sent') {
    return <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800"><Send size={13} /> Sent</span>;
  }
  if (email.status === 'failed') {
    return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300"><CircleAlert size={13} /> Failed</span>;
  }
  if (email.status === 'rate_limited') {
    return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300"><TimerReset size={13} /> Deferred</span>;
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300')}>
      <Clock3 size={13} /> {format(new Date(email.scheduledAt), 'EEE h:mm:ss a')}
    </span>
  );
}
