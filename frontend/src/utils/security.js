// Security utilities for production-level application

/**
 * Sanitize error messages to prevent information leakage
 */
export const sanitizeError = (error) => {
  // In development, show full error details
  if (process.env.NODE_ENV === 'development') {
    return error.message || 'An error occurred';
  }
  
  // In production, show generic messages to prevent information leakage
  const safeMessages = {
    'Network Error': 'Unable to connect to server. Please check your connection.',
    'timeout': 'Request timed out. Please try again.',
    'Request failed with status code 401': 'Authentication failed. Please log in again.',
    'Request failed with status code 403': 'Access denied.',
    'Request failed with status code 404': 'Resource not found.',
    'Request failed with status code 500': 'Server error. Please try again later.'
  };
  
  const errorMessage = error.message || '';
  return safeMessages[errorMessage] || 'An unexpected error occurred. Please try again.';
};

/**
 * Validate JWT token format (basic check)
 */
export const isValidJWT = (token) => {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
};

/**
 * Secure localStorage operations with error handling
 */
export const secureStorage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to store item in localStorage:', error);
    }
  },
  
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Failed to retrieve item from localStorage:', error);
      return null;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove item from localStorage:', error);
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }
};

/**
 * Rate limiting for API calls (basic client-side protection)
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
}

export const authRateLimiter = new RateLimiter(5, 60000); // 5 auth attempts per minute 