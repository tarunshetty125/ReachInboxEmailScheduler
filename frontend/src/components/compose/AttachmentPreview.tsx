import { File, Image as ImageIcon, LoaderCircle, Paperclip, Trash2, Video } from 'lucide-react';
import type { Attachment } from '../../types';
import { Button } from '../ui/button';

export interface ComposedAttachment extends Attachment {
  localPreviewUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({
  attachments,
  uploading,
  onAttach,
  onRemove,
}: {
  attachments: ComposedAttachment[];
  uploading: boolean;
  onAttach: () => void;
  onRemove: (attachment: ComposedAttachment) => void;
}): JSX.Element {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Files are saved and included with every scheduled email.</p>
        <Button type="button" variant="ghost" className="shrink-0 text-emerald-600 dark:text-emerald-400" onClick={onAttach} disabled={uploading || attachments.length >= 5}>
          {uploading ? <LoaderCircle className="mr-2 animate-spin" size={17} /> : <Paperclip className="mr-2" size={17} />}
          {uploading ? 'Uploading…' : 'Attach files'}
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4">
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith('image/');
            const isVideo = attachment.mimeType.startsWith('video/');
            const hasMediaPreview = Boolean(attachment.localPreviewUrl && (isImage || isVideo));
            return (
              <article key={attachment.id} className="relative w-44 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex h-24 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {isImage && attachment.localPreviewUrl ? <img src={attachment.localPreviewUrl} alt={attachment.fileName} className="h-full w-full object-cover" /> : null}
                  {isVideo && attachment.localPreviewUrl ? <video src={attachment.localPreviewUrl} className="h-full w-full object-cover" muted /> : null}
                  {!hasMediaPreview ? (isImage ? <ImageIcon className="text-emerald-600" /> : isVideo ? <Video className="text-emerald-600" /> : <File className="text-slate-400" />) : null}
                </div>
                <div className="p-3"><p className="truncate text-sm font-medium" title={attachment.fileName}>{attachment.fileName}</p><p className="mt-1 text-xs text-slate-400">{formatFileSize(attachment.size)}</p></div>
                <button type="button" className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-600 shadow transition hover:text-rose-600 dark:bg-slate-950/90 dark:text-slate-200" onClick={() => onRemove(attachment)} aria-label={`Remove ${attachment.fileName}`}><Trash2 size={14} /></button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
