import { cn } from '../../utils/cn';

export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }): JSX.Element {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return src ? (
    <img src={src} alt={name} className={cn('h-10 w-10 rounded-full object-cover', className)} referrerPolicy="no-referrer" />
  ) : (
    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 font-semibold text-white', className)}>{initial}</div>
  );
}
