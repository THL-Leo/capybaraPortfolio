import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config/environment';
import { sanitizeError, isValidJWT, secureStorage, authRateLimiter } from '../utils/security';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor for auth token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = secureStorage.get('token');
    const storedUser = secureStorage.get('user');
    
    if (storedToken && isValidJWT(storedToken) && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.warn('Invalid stored user data, clearing localStorage');
        secureStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Rate limiting check
    if (!authRateLimiter.canMakeRequest()) {
      return { 
        success: false, 
        error: 'Too many login attempts. Please wait a moment and try again.' 
      };
    }

    try {
      const response = await axios.post(`${config.apiUrl}/api/login`, { email, password });
      const { token: newToken, user: userData } = response.data;
      
      // Validate token format
      if (!isValidJWT(newToken)) {
        throw new Error('Invalid token received from server');
      }
      
      setToken(newToken);
      setUser(userData);
      secureStorage.set('token', newToken);
      secureStorage.set('user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: sanitizeError(error.response?.data || error)
      };
    }
  };

  const register = async (email, password, invitationCode) => {
    try {
      const response = await axios.post(`${config.apiUrl}/api/register`, {
        email,
        password,
        invitationCode
      });
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    secureStorage.remove('token');
    secureStorage.remove('user');
  };

  const verifyInvitation = async (invitationCode) => {
    try {
      const response = await axios.post(`${config.apiUrl}/api/verify-invitation`, {
        invitationCode
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Invalid invitation code' 
      };
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    verifyInvitation,
    isAuthenticated: !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 