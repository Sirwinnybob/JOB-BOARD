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
  upload: (file, onProgress, uploadToPending = true, targetPosition = null, skipOcr = false) => {
    const formData = new FormData();
    formData.append('pdf', file);
    if (!uploadToPending) {
      formData.append('is_pending', '0');
    }
    if (targetPosition !== null) {
      formData.append('position', targetPosition.toString());
    }
    if (skipOcr) {
      formData.append('skip_ocr', '1');
    }
    return api.post('/pdfs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  delete: (id) => api.delete(`/pdfs/${id}`),
  reorder: (pdfs) => api.put('/pdfs/reorder', { pdfs }),
  updateLabels: (id, labels) => api.put(`/pdfs/${id}/labels`, { labels }),
  updateMetadata: (id, metadata) => api.put(`/pdfs/${id}/metadata`, metadata),
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

export const ocrAPI = {
  getRegions: async () => {
    const response = await api.get('/ocr-regions');
    return response.data;
  },
  updateRegion: async (fieldName, region) => {
    const response = await api.put(`/ocr-regions/${fieldName}`, region);
    return response.data;
  },
  testOCR: async (imageFile, region) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('x', region.x.toString());
    formData.append('y', region.y.toString());
    formData.append('width', region.width.toString());
    formData.append('height', region.height.toString());

    const response = await api.post('/ocr-test', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  uploadTestImage: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await api.post('/ocr-test-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getTestImage: async () => {
    try {
      const response = await api.get('/ocr-test-image', {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
  deleteTestImage: async () => {
    const response = await api.delete('/ocr-test-image');
    return response.data;
  },
};

export const alertAPI = {
  broadcast: (message) => api.post('/alerts/broadcast', { message }),
};

export default api;
