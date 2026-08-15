import { AppleLoader } from './AppleLoader';

export function FullPageSpinner(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
      <AppleLoader />
    </div>
  );
}
