import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white dark:focus:ring-emerald-950',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
