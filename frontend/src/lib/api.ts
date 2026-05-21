import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      Cookies.remove('user');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put('/auth/change-password', data),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  getOne: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.put(`/users/${id}`, data),
  remove: (id: number) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
  getManagers: () => api.get('/users/managers'),
};

export const productsApi = {
  getAll: (params?: object) => api.get('/products', { params }),
  getOne: (id: number) => api.get(`/products/${id}`),
  create: (data: object) => api.post('/products', data),
  update: (id: number, data: object) => api.put(`/products/${id}`, data),
  remove: (id: number) => api.delete(`/products/${id}`),
  adjustStock: (id: number, data: object) => api.post(`/products/${id}/stock`, data),
  getLowStock: () => api.get('/products/low-stock'),
  importCSV: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const salesApi = {
  getAll: (params?: object) => api.get('/sales', { params }),
  getOne: (id: number) => api.get(`/sales/${id}`),
  create: (data: object) => api.post('/sales', data),
  getDailySummary: (params?: object) => api.get('/sales/daily-summary', { params }),
};

export const expensesApi = {
  getAll: (params?: object) => api.get('/expenses', { params }),
  getOne: (id: number) => api.get(`/expenses/${id}`),
  create: (data: object) => api.post('/expenses', data),
  update: (id: number, data: object) => api.put(`/expenses/${id}`, data),
  remove: (id: number) => api.delete(`/expenses/${id}`),
  getCategories: () => api.get('/expenses/categories'),
  getApprovalRequests: (params?: object) => api.get('/expenses/approval-requests', { params }),
  reviewRequest: (id: number, data: { action: 'approve' | 'reject'; review_note?: string }) =>
    api.put(`/expenses/approval-requests/${id}`, data),
  getMyRequests: () => api.get('/expenses/my-requests'),
};

export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getSellerDashboard: () => api.get('/analytics/seller-dashboard'),
  getReport: (params?: object) => api.get('/analytics/report', { params }),
  getSellers: () => api.get('/analytics/sellers'),
};

export const auditApi = {
  getAll: (params?: object) => api.get('/audit', { params }),
  getModules: () => api.get('/audit/modules'),
};

export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data: object) => api.post('/categories', data),
};

export default api;
