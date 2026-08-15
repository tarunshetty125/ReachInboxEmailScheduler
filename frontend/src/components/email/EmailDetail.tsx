import DOMPurify from 'dompurify';
import { ArrowLeft, Archive, ExternalLink, File, Paperclip, Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { emailsApi } from '../../api/emails';
import { attachmentsApi } from '../../api/attachments';
import type { EmailRecord } from '../../types';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { StatusBadge } from './StatusBadge';
import { useAuth } from '../../contexts/AuthContext';

export function EmailDetail(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState<EmailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingStar, setUpdatingStar] = useState(false);
  useEffect(() => {
    if (!id) return;
    void emailsApi.detail(id).then(setEmail).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load email'));
  }, [id]);
  if (error) return <main className="p-10"><p className="text-rose-600">{error}</p></main>;
  if (!email) return <div className="p-10 text-slate-400">Loading email…</div>;
  const safeHtml = DOMPurify.sanitize(email.bodyHtml, { USE_PROFILES: { html: true } });
  const timestamp = email.sentAt ?? email.scheduledAt;
  const toggleStar = async () => {
    if (updatingStar) return;
    setUpdatingStar(true);
    try {
      setEmail(await emailsApi.setStarred(email.id, !email.isStarred));
    } catch (starError) {
      setError(starError instanceof Error ? starError.message : 'Could not update wishlist');
    } finally {
      setUpdatingStar(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-5 dark:border-slate-800 md:px-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft /></Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-medium md:text-3xl">{email.subject}</h1>
        <Button variant="ghost" size="icon" aria-label={email.isStarred ? 'Remove from wishlist' : 'Add to wishlist'} onClick={() => void toggleStar()} disabled={updatingStar}><Star className={email.isStarred ? 'fill-amber-400 text-amber-400' : ''} /></Button><Button variant="ghost" size="icon" aria-label="Archive"><Archive /></Button><Button variant="ghost" size="icon" aria-label="Delete"><Trash2 /></Button>{user && <><span aria-hidden="true" className="mx-1 h-7 w-px bg-slate-200 dark:bg-slate-700" /><Avatar src={user.avatarUrl} name={user.name} className="h-9 w-9" /></>}
      </header>
      <article className="mx-auto max-w-5xl px-5 py-12 md:px-10">
        <div className="flex items-start gap-4">
          <Avatar name={email.sender.name} className="h-12 w-12 text-lg" />
          <div className="min-w-0 flex-1"><p className="font-semibold">{email.sender.name} <span className="font-normal text-slate-400">&lt;{email.sender.email}&gt;</span></p><p className="mt-1 text-sm text-slate-500">to {email.recipientEmail}</p></div>
          <div className="text-right text-sm text-slate-500"><p>{format(new Date(timestamp), 'MMM d, h:mm a')}</p><div className="mt-2"><StatusBadge email={email} /></div></div>
        </div>
        <div className="prose prose-slate mt-10 max-w-none dark:prose-invert prose-img:rounded-xl" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        {email.attachments.length > 0 && <section className="mt-10"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Paperclip size={19} />Attachments</h2><div className="flex flex-wrap gap-4">{email.attachments.map((attachment) => {
          const isImage = attachment.mimeType.startsWith('image/');
          const isVideo = attachment.mimeType.startsWith('video/');
          const previewUrl = attachmentsApi.previewUrl(attachment.id);
          return <article key={attachment.id} className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            {isImage ? <img src={previewUrl} alt={attachment.fileName} className="h-32 w-full object-cover" /> : isVideo ? <video controls preload="metadata" src={previewUrl} className="h-32 w-full bg-black object-contain" /> : <div className="flex h-32 items-center justify-center"><File className="text-slate-400" size={32} /></div>}
            <div className="p-3"><p className="truncate text-sm font-medium" title={attachment.fileName}>{attachment.fileName}</p><a href={attachmentsApi.downloadUrl(attachment.id)} className="mt-2 inline-block text-sm text-emerald-600 hover:underline">Download</a></div>
          </article>;
        })}</div></section>}
        {email.etherealUrl && <a href={email.etherealUrl} target="_blank" rel="noreferrer" className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:underline">Open Ethereal preview <ExternalLink size={15} /></a>}
        {email.errorMessage && <p className="mt-8 rounded-xl bg-rose-50 p-4 text-rose-700 dark:bg-rose-950 dark:text-rose-300">Delivery error: {email.errorMessage}</p>}
      </article>
    </main>
  );
}
