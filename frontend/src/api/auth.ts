import { api } from './client';
import type { User } from '../types';

export const authApi = {
  currentUser: () => api<User>('/api/users/me'),
  logout: () => api<{ message: string }>('/api/auth/logout', { method: 'POST' }),
};
