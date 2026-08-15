import { API_URL, api } from './client';
import type { Attachment } from '../types';

export const attachmentsApi = {
  upload: async (files: File[]): Promise<Attachment[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await api<{ attachments: Attachment[] }>('/api/attachments', { method: 'POST', body: formData });
    return response.attachments;
  },
  remove: (id: string) => api<void>(`/api/attachments/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: string) => `${API_URL}/api/attachments/${id}/download`,
  previewUrl: (id: string) => `${API_URL}/api/attachments/${id}/download?disposition=inline`,
};
