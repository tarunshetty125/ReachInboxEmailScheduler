import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { emailsApi } from '../../api/emails';
import type { EmailStats } from '../../types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function DashboardLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmailStats>({ scheduledCount: 0, sentCount: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const params = new URLSearchParams(location.search);
  const search = params.get('search') ?? '';
  const filter = params.get('filter') ?? '';

  const loadStats = useCallback(async () => {
    try {
      setStats(await emailsApi.stats());
    } catch {
      // The protected content handles auth/error feedback. A missing count is non-blocking.
    }
  }, []);
  useEffect(() => {
    void loadStats();
  }, [loadStats, refreshKey]);

  const changeSearch = useCallback((nextSearch: string) => {
    const next = new URLSearchParams(location.search);
    if (nextSearch) next.set('search', nextSearch);
    else next.delete('search');
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const refresh = () => {
    setRefreshKey((value) => value + 1);
    window.dispatchEvent(new CustomEvent('emails:refresh'));
  };
  const changeFilter = useCallback((nextFilter: string) => {
    const next = new URLSearchParams(location.search);
    if (nextFilter) next.set('filter', nextFilter);
    else next.delete('filter');
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:flex md:h-screen md:overflow-hidden">
      <Sidebar stats={stats} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <main className="min-w-0 flex-1 md:flex md:h-screen md:min-h-0 md:flex-col md:overflow-hidden">
        <TopBar search={search} filter={filter} sentView={location.pathname === '/sent'} onSearch={changeSearch} onFilter={changeFilter} onRefresh={refresh} />
        <div className="dashboard-email-scroll md:min-h-0 md:flex-1 md:overflow-y-scroll md:overscroll-contain">
          <Outlet context={{ refreshKey, refreshStats: loadStats }} />
        </div>
      </main>
    </div>
  );
}
