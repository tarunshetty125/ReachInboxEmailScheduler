import { ArrowLeft, Clock3, Paperclip, Plus, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { attachmentsApi } from '../api/attachments';
import { emailsApi } from '../api/emails';
import { sendersApi } from '../api/senders';
import { AttachmentPreview, type ComposedAttachment } from '../components/compose/AttachmentPreview';
import { RecipientInput } from '../components/compose/RecipientInput';
import { RichTextEditor } from '../components/compose/RichTextEditor';
import { SchedulePopover } from '../components/compose/SchedulePopover';
import { Avatar } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import type { Sender } from '../types';

export function ComposePage(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('50');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<ComposedAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);
  const [aliasEmail, setAliasEmail] = useState('');
  const [creatingSender, setCreatingSender] = useState(false);
  const attachmentInput = useRef<HTMLInputElement>(null);

  useEffect(() => { void sendersApi.list().then((items) => { setSenders(items); setSenderId(items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? ''); }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load senders')); }, []);
  const selectedSender = useMemo(() => senders.find((sender) => sender.id === senderId), [senderId, senders]);
  useEffect(() => { if (selectedSender) setHourlyLimit(String(selectedSender.hourlyLimit)); }, [selectedSender]);
  const senderLabel = (sender: Sender) => sender.aliasEmail ?? `${sender.name || 'My workspace'} · Ethereal test sender`;
  const createSender = async () => {
    if (!user) return;
    setCreatingSender(true);
    try {
      const sender = await sendersApi.create(user.name, aliasEmail.trim());
      setSenders((items) => [...items, sender]);
      setSenderId(sender.id);
      setAliasEmail('');
      setSenderDialogOpen(false);
      toast.success('A new private Ethereal sender was mapped to this alias');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create sender'); } finally { setCreatingSender(false); }
  };
  const uploadAttachments = async (fileList: FileList | null) => {
    const selectedFiles = fileList ? Array.from(fileList) : [];
    if (!selectedFiles.length) return;
    const selectedFileKey = (file: File) => `${file.name}:${file.size}:${file.type}`;
    const existingFileKeys = new Set(attachments.map((attachment) => `${attachment.fileName}:${attachment.size}:${attachment.mimeType}`));
    const selectedFileKeys = new Set<string>();
    const files = selectedFiles.filter((file) => {
      const key = selectedFileKey(file);
      if (existingFileKeys.has(key) || selectedFileKeys.has(key)) return false;
      selectedFileKeys.add(key);
      return true;
    });
    const duplicates = selectedFiles.length - files.length;
    if (duplicates) toast.error(`${duplicates} duplicate attachment${duplicates === 1 ? '' : 's'} not added`);
    if (!files.length) return;
    if (attachments.length + files.length > 5) { toast.error('You can attach up to 5 files per scheduled email.'); return; }
    if (files.some((file) => file.size > 25 * 1024 * 1024)) { toast.error('Each attachment must be 25MB or smaller.'); return; }
    setUploadingAttachments(true);
    try {
      const uploaded = await attachmentsApi.upload(files);
      setAttachments((current) => [...current, ...uploaded.map((attachment, index) => ({ ...attachment, localPreviewUrl: URL.createObjectURL(files[index]) }))]);
      toast.success(`${uploaded.length} attachment${uploaded.length === 1 ? '' : 's'} added`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not upload attachment'); } finally { setUploadingAttachments(false); }
  };
  const removeAttachment = async (attachment: ComposedAttachment) => {
    try {
      await attachmentsApi.remove(attachment.id);
      if (attachment.localPreviewUrl) URL.revokeObjectURL(attachment.localPreviewUrl);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove attachment'); }
  };
  const submit = async () => {
    if (uploadingAttachments) { toast.error('Wait for attachment uploads to finish.'); return; }
    const hasText = bodyHtml.replace(/<[^>]+>/g, '').trim().length > 0;
    if (!senderId || !recipients.length || !subject.trim() || !hasText) { toast.error('Add a sender, recipient, subject, and message before scheduling.'); return; }
    const delay = Number(delaySeconds); const limit = Number(hourlyLimit);
    if (!Number.isInteger(delay) || delay < 0 || !Number.isInteger(limit) || limit < 1) { toast.error('Delay must be 0 or more; hourly limit must be at least 1.'); return; }
    setSubmitting(true);
    try {
      if (selectedSender && limit !== selectedSender.hourlyLimit) {
        const updatedSender = await sendersApi.updateHourlyLimit(selectedSender.id, limit);
        setSenders((items) => items.map((sender) => sender.id === updatedSender.id ? updatedSender : sender));
      }
      const result = await emailsApi.schedule({ senderId, recipients, subject, bodyHtml, scheduledAt: (scheduledAt ?? new Date()).toISOString(), delayBetweenMs: delay * 1_000, attachmentIds: attachments.map((attachment) => attachment.id) });
      toast.success(`${result.emailCount} email${result.emailCount === 1 ? '' : 's'} scheduled`);
      navigate('/scheduled');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not schedule emails'); } finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100"><header className="flex items-center gap-2 border-b border-slate-100 px-5 py-5 dark:border-slate-800 md:px-10"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft /></Button><h1 className="flex-1 text-2xl font-medium md:text-3xl">Compose New Email</h1>{user && <><span aria-hidden="true" className="mx-1 h-7 w-px bg-slate-200 dark:bg-slate-700" /><Avatar src={user.avatarUrl} name={user.name} className="h-9 w-9" /></>}<Button type="button" variant="ghost" size="icon" className="relative" onClick={() => attachmentInput.current?.click()} disabled={uploadingAttachments || attachments.length >= 5} aria-label="Attach files" title="Attach files"><Paperclip className="text-emerald-500" />{attachments.length > 0 && <span className="absolute bottom-0 right-0 grid h-4 min-w-4 place-items-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold leading-none text-slate-700 dark:bg-slate-800 dark:text-slate-100">{attachments.length}</span>}</Button><input ref={attachmentInput} type="file" multiple className="hidden" onChange={(event) => { void uploadAttachments(event.target.files); event.currentTarget.value = ''; }} /><div className="relative"><Button variant="ghost" size="icon" onClick={() => setSchedulerOpen((open) => !open)} aria-label="Schedule send"><Clock3 className="text-emerald-500" /></Button>{schedulerOpen && <SchedulePopover selected={scheduledAt} onClose={() => setSchedulerOpen(false)} onSelect={setScheduledAt} />}</div><Button variant="outline" className="rounded-full px-6" onClick={() => void submit()} disabled={submitting || uploadingAttachments}><Send size={17} className="mr-2" />{submitting ? 'Scheduling…' : scheduledAt ? 'Send Later' : 'Send'}</Button></header>
      <form className="mx-auto max-w-6xl px-5 py-10 md:px-10" onSubmit={(event) => { event.preventDefault(); void submit(); }}><div className="grid gap-x-6 gap-y-5 sm:grid-cols-[65px_1fr]"><label className="pt-3 font-medium">From</label><div className="flex gap-2"><select value={senderId} onChange={(event) => setSenderId(event.target.value)} className="h-12 max-w-full rounded-xl border-0 bg-slate-100 px-4 text-lg outline-none dark:bg-slate-900"><option value="">Select sender</option>{senders.map((sender) => <option value={sender.id} key={sender.id}>{senderLabel(sender)}</option>)}</select><Button type="button" variant="ghost" onClick={() => setSenderDialogOpen(true)} title="Create a fresh Ethereal sender mapped to an alias"><Plus size={18} /> <span className="ml-1 hidden sm:inline">New sender</span></Button></div><label className="pt-3 font-medium">To</label><RecipientInput recipients={recipients} onChange={setRecipients} /><label className="pt-3 font-medium">Subject</label><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="border-b border-slate-200 bg-transparent px-3 text-lg dark:border-slate-700" /></div>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3"><label className="flex items-center gap-3 font-medium">Delay between emails <Input aria-label="Delay in seconds" type="number" min="0" value={delaySeconds} onChange={(event) => setDelaySeconds(event.target.value)} className="w-24 bg-white text-center dark:bg-slate-900" /><span className="text-sm font-normal text-slate-400">seconds</span></label><label className="flex items-center gap-3 font-medium">Sender hourly limit <Input aria-label="Sender hourly limit" type="number" min="1" max="1000" value={hourlyLimit} onChange={(event) => setHourlyLimit(event.target.value)} className="w-24 bg-white text-center dark:bg-slate-900" /></label>{scheduledAt && <button type="button" onClick={() => setScheduledAt(null)} className="rounded-full bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Scheduled for {scheduledAt.toLocaleString()} ×</button>}</div>
        <div className="mt-6"><RichTextEditor value={bodyHtml} onChange={setBodyHtml} /></div><AttachmentPreview attachments={attachments} uploading={uploadingAttachments} onAttach={() => attachmentInput.current?.click()} onRemove={(attachment) => void removeAttachment(attachment)} />{selectedSender && <p className="mt-4 text-sm text-slate-400">{selectedSender.aliasEmail ? `${selectedSender.aliasEmail} is mapped to a private Ethereal sender (${selectedSender.email}).` : `${senderLabel(selectedSender)} · test address: ${selectedSender.email}`}</p>}</form>
      {senderDialogOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5" role="dialog" aria-modal="true" aria-labelledby="sender-dialog-title"><form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900" onSubmit={(event) => { event.preventDefault(); void createSender(); }}><div className="flex items-start justify-between gap-4"><div><h2 id="sender-dialog-title" className="text-xl font-semibold">Create sender alias</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Every alias creates a brand-new private Ethereal account. Even the same alias entered twice is mapped to a different internal mailbox.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setSenderDialogOpen(false)} aria-label="Close"><X size={18} /></Button></div><label className="mt-6 block text-sm font-medium">Alias email<Input required type="email" value={aliasEmail} onChange={(event) => setAliasEmail(event.target.value)} placeholder="tarun@eternalmail.io" className="mt-2" /></label><p className="mt-3 text-xs leading-5 text-slate-400">This is a clean dashboard label. Ethereal uses the newly created internal address to deliver the test email.</p><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setSenderDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={creatingSender}>{creatingSender ? 'Creating…' : 'Create sender'}</Button></div></form></div>}
    </main>
  );
}
