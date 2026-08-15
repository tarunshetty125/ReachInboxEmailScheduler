import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export function Logo({ collapsed = false }: { collapsed?: boolean }): JSX.Element {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2 text-2xl font-black tracking-[-0.16em] text-slate-950 dark:text-white', collapsed && 'md:justify-center')} aria-label="ReachInbox home">
      <span className="rounded-md bg-slate-950 px-2 py-1 text-base tracking-normal text-white dark:bg-white dark:text-slate-950">RI</span>
      <span className={cn('tracking-[-0.08em]', collapsed && 'md:hidden')}>ONB</span>
    </Link>
  );
}
