import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { extractEmails, normaliseRecipients } from '../../utils/emailParser';
import { Button } from '../ui/button';

export function RecipientInput({ recipients, onChange }: { recipients: string[]; onChange: (next: string[]) => void }): JSX.Element {
  const [entry, setEntry] = useState('');
  const [uploadSummary, setUploadSummary] = useState<{ detected: number; invalid: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const addUniqueRecipients = (valid: string[], duplicates = 0): number => {
    const existing = new Set(recipients);
    const additions = valid.filter((email) => !existing.has(email));
    const duplicateCount = duplicates + valid.length - additions.length;
    if (additions.length) onChange([...recipients, ...additions]);
    if (duplicateCount) toast.error(`${duplicateCount} duplicate email${duplicateCount === 1 ? '' : 's'} not added`);
    return additions.length;
  };
  const addValues = (raw: string) => {
    const values = raw.split(/[\s,;]+/);
    const { valid, invalid, duplicates } = normaliseRecipients(values);
    addUniqueRecipients(valid, duplicates);
    if (invalid) toast.error(`${invalid} invalid email${invalid === 1 ? '' : 's'} ignored`);
  };
  const addEntry = () => {
    if (entry.trim()) addValues(entry);
    setEntry('');
  };
  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please upload a file smaller than 5MB');
      return;
    }
    const parsed = extractEmails(await file.text(), file.name);
    setUploadSummary({ detected: parsed.valid.length, invalid: parsed.invalid });
    const added = addUniqueRecipients(parsed.valid, parsed.duplicates);
    if (added) toast.success(`Added ${added} email address${added === 1 ? '' : 'es'}`);
    else if (!parsed.valid.length) toast.error('No valid email addresses found');
    if (parsed.invalid) toast.error(`${parsed.invalid} invalid email${parsed.invalid === 1 ? '' : 's'} removed`);
  };
  return (
    <div className="flex-1">
      <div className="flex min-h-12 items-center gap-2 border-b border-slate-200 py-1 dark:border-slate-700">
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {recipients.slice(0, 3).map((email) => <button key={email} type="button" onClick={() => onChange(recipients.filter((recipient) => recipient !== email))} className="rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1 text-sm text-slate-800 transition hover:bg-rose-50 hover:text-rose-600 dark:bg-emerald-950 dark:text-slate-100">{email} ×</button>)}
        {recipients.length > 3 && <span className="inline-flex h-9 min-w-12 shrink-0 self-center items-center justify-center rounded-full border border-emerald-500 bg-emerald-50 px-3 text-sm leading-none text-slate-800 dark:bg-emerald-950 dark:text-slate-100">+{recipients.length - 3}</span>}
        <input value={entry} onChange={(event) => setEntry(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addEntry(); } }} onBlur={addEntry} placeholder={recipients.length ? 'Add recipient…' : 'recipient@example.com'} className="min-w-[180px] flex-1 bg-transparent px-2 py-2 outline-none placeholder:text-slate-400" aria-label="Email recipients" />
      </div>
      <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} />
      <Button type="button" variant="ghost" className="shrink-0 text-emerald-600 dark:text-emerald-400" onClick={() => fileInput.current?.click()}><Upload size={18} className="mr-2" />Upload List</Button>
      </div>
      {uploadSummary && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite"><span className="font-medium text-emerald-600 dark:text-emerald-400">{uploadSummary.detected} email address{uploadSummary.detected === 1 ? '' : 'es'} detected</span>{uploadSummary.invalid > 0 && <span className="text-rose-600 dark:text-rose-400">{uploadSummary.invalid} invalid email{uploadSummary.invalid === 1 ? '' : 's'} removed</span>}</div>}
    </div>
  );
}
