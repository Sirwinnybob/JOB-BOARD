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
  getAll: () => api.get('/pdfs'),
  upload: (file, onProgress) => {
    const formData = new FormData();
    formData.append('pdf', file);
    return api.post('/pdfs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  delete: (id) => api.delete(`/pdfs/${id}`),
  reorder: (pdfs) => api.put('/pdfs/reorder', { pdfs }),
  updateLabels: (id, labelIds) => api.put(`/pdfs/${id}/labels`, { labelIds }),
};

export const labelAPI = {
  getAll: () => api.get('/labels'),
  create: (name, color) => api.post('/labels', { name, color }),
  delete: (id) => api.delete(`/labels/${id}`),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (settings) => api.put('/settings', settings),
};

export default api;
