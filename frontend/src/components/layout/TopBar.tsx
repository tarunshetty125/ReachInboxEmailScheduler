import { Filter, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ThemeToggle } from '../shared/ThemeToggle';

export function TopBar({ search, filter, sentView, onSearch, onFilter, onRefresh }: { search: string; filter: string; sentView: boolean; onSearch: (search: string) => void; onFilter: (filter: string) => void; onRefresh: () => void }): JSX.Element {
  const [value, setValue] = useState(search);
  const [filterOpen, setFilterOpen] = useState(false);
  const { user } = useAuth();
  useEffect(() => setValue(search), [search]);
  const filters = sentView ? [['', 'All sent'], ['sent', 'Sent'], ['failed', 'Failed']] : [['', 'All scheduled'], ['queued', 'Queued'], ['sending', 'Sending'], ['rate_limited', 'Rate limited']];
  return (
    <div className="flex shrink-0 items-center gap-1.5 px-4 py-3 md:px-7">
      <div className="relative max-w-4xl flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
        <Input aria-label="Search scheduled emails" value={value} onChange={(event) => { setValue(event.target.value); onSearch(event.target.value); }} placeholder="Search" className="h-10 rounded-full pl-10" />
      </div>
      <div className="relative"><Button variant="ghost" size="icon" aria-label="Filter emails" onClick={() => setFilterOpen((open) => !open)} className={filter ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950' : ''}><Filter size={20} /></Button>{filterOpen && <div className="absolute right-0 z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => { onFilter(value); setFilterOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${filter === value ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : ''}`}>{label}</button>)}</div>}</div>
      <Button variant="ghost" size="icon" aria-label="Refresh emails" onClick={onRefresh}><RefreshCw size={20} /></Button>
      <ThemeToggle />
      {user && <Avatar src={user.avatarUrl} name={user.name} className="ml-1 h-9 w-9" />}
    </div>
  );
}
