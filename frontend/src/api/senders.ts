import { api } from './client';
import type { Sender } from '../types';

export const sendersApi = {
  list: () => api<Sender[]>('/api/senders'),
  create: (name: string, aliasEmail?: string) => api<Sender>('/api/senders', { method: 'POST', body: JSON.stringify({ name, aliasEmail }) }),
  updateHourlyLimit: (id: string, hourlyLimit: number) => api<Sender>(`/api/senders/${id}/hourly-limit`, { method: 'PATCH', body: JSON.stringify({ hourlyLimit }) }),
};
