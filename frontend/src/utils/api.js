import axios from 'axios';

const API_BASE = '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  },
  isAuthenticated: () => !!localStorage.getItem('token'),
};

export const pdfAPI = {
  getAll: (includePending = false) => api.get('/pdfs', { params: { includePending } }),
  upload: (file, onProgress, uploadToPending = true, targetPosition = null) => {
    const formData = new FormData();
    formData.append('pdf', file);
    if (!uploadToPending) {
      formData.append('is_pending', '0');
    }
    if (targetPosition !== null) {
      formData.append('position', targetPosition.toString());
    }
    return api.post('/pdfs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  delete: (id) => api.delete(`/pdfs/${id}`),
  reorder: (pdfs) => api.put('/pdfs/reorder', { pdfs }),
  updateLabels: (id, labelIds) => api.put(`/pdfs/${id}/labels`, { labelIds }),
  updateMetadata: (id, job_number, construction_method) => api.put(`/pdfs/${id}/metadata`, { job_number, construction_method }),
  createPlaceholder: (position) => api.post('/pdfs/placeholder', { position }),
  updateStatus: (id, is_pending) => api.put(`/pdfs/${id}/status`, { is_pending }),
};

export const labelAPI = {
  getAll: () => api.get('/labels'),
  create: (name, color) => api.post('/labels', { name, color }),
  update: (id, name, color) => api.put(`/labels/${id}`, { name, color }),
  delete: (id) => api.delete(`/labels/${id}`),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (settings) => api.put('/settings', settings),
};

export default api;
