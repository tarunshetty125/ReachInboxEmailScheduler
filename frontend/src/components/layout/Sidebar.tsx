import { ChevronDown, Clock3, LogOut, MailCheck, PanelLeftClose, PanelLeftOpen, PencilLine, Plus } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { EmailStats } from '../../types';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';

export function Sidebar({ stats, collapsed, onCollapsedChange }: { stats: EmailStats; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }): JSX.Element {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return <></>;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };
  const navigation = [
    { to: '/scheduled', label: 'Scheduled', icon: Clock3, count: stats.scheduledCount },
    { to: '/sent', label: 'Sent', icon: MailCheck, count: stats.sentCount },
  ];

  return (
    <aside className={cn('flex w-full shrink-0 flex-col border-b border-slate-100 bg-white p-5 transition-[width,padding] duration-200 dark:border-slate-800 dark:bg-slate-950 md:h-screen md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r', collapsed ? 'md:w-24 md:p-3' : 'md:w-[340px]')}>
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className={cn('text-xl font-black tracking-[-0.08em] text-slate-950 dark:text-white', collapsed && 'md:hidden')} aria-label="ReachInbox home">ONB</Link>
        <Button type="button" variant="ghost" size="icon" onClick={() => onCollapsedChange(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="ml-auto shrink-0">
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </Button>
      </div>
      <div className="relative mt-5">
        <button onClick={() => setMenuOpen((open) => !open)} className={cn('flex w-full items-center gap-3 rounded-2xl bg-slate-100 p-3 text-left transition hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800', collapsed && 'md:justify-center md:p-2')} aria-label="Account menu" title={collapsed ? user.name : undefined}>
          <Avatar src={user.avatarUrl} name={user.name} />
          <span className={cn('min-w-0 flex-1', collapsed && 'md:hidden')}>
            <span className="block truncate font-semibold text-slate-900 dark:text-white">{user.name}</span>
            <span className="block truncate text-sm text-slate-400">{user.email}</span>
          </span>
          <ChevronDown size={18} className={cn('text-slate-400 transition', menuOpen && 'rotate-180', collapsed && 'md:hidden')} />
        </button>
        {menuOpen && (
          <div className={cn('absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-soft dark:border-slate-700 dark:bg-slate-900', collapsed && 'md:left-full md:top-0 md:ml-2 md:mt-0 md:w-48')}>
            <Button variant="ghost" className="w-full justify-start" onClick={() => void handleSignOut()}>
              <LogOut size={17} className="mr-2" /> Sign out
            </Button>
          </div>
        )}
      </div>
      <Link to="/compose" className={cn('mt-4 flex h-12 items-center justify-center gap-2 rounded-full border border-emerald-500 font-medium text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950', collapsed && 'md:mx-auto md:w-12 md:rounded-xl')} title={collapsed ? 'Compose' : undefined}>
        <PencilLine size={18} /><span className={cn(collapsed && 'md:hidden')}>Compose</span><Plus size={14} className={cn('hidden lg:block', collapsed && 'md:hidden')} />
      </Link>
      <p className={cn('mt-8 px-3 text-xs font-medium uppercase tracking-wide text-slate-400', collapsed && 'md:hidden')}>Core</p>
      <nav className="mt-2 flex gap-2 md:flex-col">
        {navigation.map(({ to, label, icon: Icon, count }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn('flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-slate-600 transition dark:text-slate-300', collapsed && 'md:justify-center md:px-0', isActive && 'bg-emerald-100 font-semibold text-slate-800 dark:bg-emerald-950 dark:text-emerald-200')}
            title={collapsed ? label : undefined}
          >
            <Icon size={20} />
            <span className={cn(collapsed && 'md:hidden')}>{label}</span>
            <span className={cn('ml-auto text-sm font-normal text-slate-400', collapsed && 'md:hidden')}>{count}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
