import axios from 'axios';
import { config } from '../config/environment';
import { secureStorage, isValidJWT } from './security';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: config.apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (requestConfig) => {
    const token = secureStorage.get('token');
    if (token && isValidJWT(token)) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      secureStorage.remove('token');
      secureStorage.remove('user');
      
      // Avoid redirect loops - only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api; 