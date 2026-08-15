import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
type Size = 'default' | 'sm' | 'icon';

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50',
        {
          default: 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600',
          outline: 'border border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950',
          ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
          destructive: 'bg-rose-500 text-white hover:bg-rose-600',
        }[variant],
        { default: 'h-10 px-4', sm: 'h-8 px-3 text-sm', icon: 'h-10 w-10 p-0' }[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
