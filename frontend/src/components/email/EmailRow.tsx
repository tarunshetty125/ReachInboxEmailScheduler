import { Star } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { emailsApi } from '../../api/emails';
import type { EmailRecord } from '../../types';
import { StatusBadge } from './StatusBadge';

function plainPreview(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function EmailRow({ email }: { email: EmailRecord }): JSX.Element {
  const navigate = useNavigate();
  const [starred, setStarred] = useState(email.isStarred);
  const [updatingStar, setUpdatingStar] = useState(false);
  const toggleStar = async () => {
    if (updatingStar) return;
    setUpdatingStar(true);
    try {
      const updated = await emailsApi.setStarred(email.id, !starred);
      setStarred(updated.isStarred);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update wishlist');
    } finally {
      setUpdatingStar(false);
    }
  };
  return (
    <div className="group flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 md:px-7">
      <button type="button" onClick={() => navigate(`/email/${email.id}`)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <div className="min-w-[135px] text-sm font-semibold text-slate-800 dark:text-slate-100">To: {email.recipientEmail.split('@')[0]}</div>
        <StatusBadge email={email} />
        <div className="min-w-0 flex-1 truncate text-sm text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{email.subject}</span>
          <span className="mx-1">-</span>{plainPreview(email.bodyHtml)}
        </div>
      </button>
      <button type="button" onClick={() => void toggleStar()} disabled={updatingStar} aria-label={starred ? 'Remove from wishlist' : 'Add to wishlist'} className="rounded-md p-1 text-slate-300 transition hover:text-amber-400 disabled:opacity-50">
        <Star size={19} className={starred ? 'fill-amber-400 text-amber-400' : ''} />
      </button>
    </div>
  );
}
