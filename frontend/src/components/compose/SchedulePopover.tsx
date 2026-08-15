import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

function toInputValue(date: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function tomorrowAt(hour?: number): Date {
  const value = new Date(); value.setDate(value.getDate() + 1); value.setSeconds(0, 0); value.setHours(hour ?? value.getHours(), hour === undefined ? value.getMinutes() : 0); return value;
}

export function SchedulePopover({ selected, onClose, onSelect }: { selected: Date | null; onClose: () => void; onSelect: (date: Date) => void }): JSX.Element {
  const [value, setValue] = useState(toInputValue(selected ?? tomorrowAt(10)));
  const setQuick = (date: Date) => setValue(toInputValue(date));
  return (
    <div className="absolute right-0 top-14 z-30 w-[330px] rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Send Later</h2>
      <div className="relative mt-6"><Input type="datetime-local" value={value} min={toInputValue(new Date())} onChange={(event) => setValue(event.target.value)} className="border-b border-slate-200 bg-transparent px-0 dark:border-slate-700" /><CalendarDays className="pointer-events-none absolute right-3 top-3 text-slate-400" size={18} /></div>
      <div className="mt-4 grid gap-1 text-left text-slate-600 dark:text-slate-300">
        <button type="button" className="rounded-lg px-1 py-2 text-left hover:text-emerald-600" onClick={() => setQuick(tomorrowAt())}>Tomorrow</button>
        <button type="button" className="rounded-lg px-1 py-2 text-left hover:text-emerald-600" onClick={() => setQuick(tomorrowAt(10))}>Tomorrow, 10:00 AM</button>
        <button type="button" className="rounded-lg px-1 py-2 text-left hover:text-emerald-600" onClick={() => setQuick(tomorrowAt(11))}>Tomorrow, 11:00 AM</button>
        <button type="button" className="rounded-lg px-1 py-2 text-left hover:text-emerald-600" onClick={() => setQuick(tomorrowAt(15))}>Tomorrow, 3:00 PM</button>
      </div>
      <div className="mt-16 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" variant="outline" onClick={() => { const date = new Date(value); if (!Number.isNaN(date.getTime())) { onSelect(date); onClose(); } }}>Done</Button></div>
    </div>
  );
}
