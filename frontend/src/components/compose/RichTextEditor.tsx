import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2 } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../ui/button';

const toolbarButton = 'h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800';

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }): JSX.Element {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Type Your Reply…' })],
    content: value,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    editorProps: { attributes: { class: 'min-h-[270px] px-6 py-5 outline-none prose-editor' } },
  });
  useEffect(() => { if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false }); }, [editor, value]);
  if (!editor) return <div className="min-h-[360px] animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-900" />;
  const action = (callback: () => void, label: string, Icon: typeof Bold) => <Button key={label} type="button" variant="ghost" size="icon" className={toolbarButton} onClick={callback} aria-label={label}><Icon size={20} /></Button>;
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900">
      <EditorContent editor={editor} />
      <div className="mx-5 mb-4 flex flex-wrap items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm dark:bg-slate-800">
        {action(() => editor.chain().focus().undo().run(), 'Undo', Undo2)} {action(() => editor.chain().focus().redo().run(), 'Redo', Redo2)}
        <span className="mx-1 h-6 border-l border-slate-200 dark:border-slate-700" />
        {action(() => editor.chain().focus().toggleBold().run(), 'Bold', Bold)} {action(() => editor.chain().focus().toggleItalic().run(), 'Italic', Italic)} {action(() => editor.chain().focus().toggleStrike().run(), 'Strikethrough', Strikethrough)}
        {action(() => editor.chain().focus().toggleBulletList().run(), 'Bulleted list', List)} {action(() => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', ListOrdered)} {action(() => editor.chain().focus().toggleBlockquote().run(), 'Quote', Quote)}
        <Button type="button" variant="ghost" size="icon" className={toolbarButton} aria-label="Underline is unavailable in the compact editor" title="Underline is unavailable in this compact editor"><UnderlineIcon size={20} /></Button>
      </div>
    </div>
  );
}
