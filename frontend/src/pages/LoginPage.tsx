import { Chrome, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { googleLoginUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/layout/Logo';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function LoginPage(): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (!loading && user) return <Navigate to="/scheduled" replace />;
  const oauthError = new URLSearchParams(location.search).get('error');
  return (
    <main className="min-h-screen bg-white px-5 text-slate-900 dark:bg-slate-950 dark:text-white"><div className="mx-auto flex max-w-7xl items-center justify-between py-6"><Logo /><ThemeToggle /></div><div className="flex min-h-[calc(100vh-100px)] items-center justify-center pb-20"><section className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-12"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950"><Sparkles /></div><h1 className="mt-6 text-center text-4xl font-semibold">Login</h1><p className="mt-3 text-center text-slate-500">Welcome back to a calmer sending workflow.</p>{oauthError && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-center text-sm text-rose-600 dark:bg-rose-950 dark:text-rose-300">Google sign-in did not complete. Please try again.</p>}<a href={googleLoginUrl} className="mt-8 block"><Button className="h-14 w-full bg-emerald-100 text-slate-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-white dark:hover:bg-emerald-800"><Chrome className="mr-3 text-emerald-600" />Login with Google</Button></a><div className="my-7 flex items-center gap-4 text-sm text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or sign up through email<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div><div className="space-y-4 opacity-80"><div className="relative"><Mail className="absolute left-4 top-3 text-slate-400" size={18} /><Input disabled placeholder="Email ID" className="pl-11" /></div><div className="relative"><LockKeyhole className="absolute left-4 top-3 text-slate-400" size={18} /><Input disabled type="password" placeholder="Password" className="pl-11" /></div><Button disabled className="h-14 w-full">Login</Button></div><p className="mt-6 text-center text-xs text-slate-400">Google OAuth is the only supported authentication method for this assignment.</p></section></div></main>
  );
}
