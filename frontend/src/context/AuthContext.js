import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';

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
  const [csrfToken, setCsrfToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Function to get CSRF token from cookie
  const getCsrfToken = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf_access_token') {
        return value;
      }
    }
    return null;
  };

  // Function to reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      console.log('Session expired due to inactivity');
      handleSessionExpiry();
    }, 15 * 60 * 1000);
  }, []);

  // Function to check if session is still valid
  const checkSessionValidity = async () => {
    const token = getCsrfToken();
    if (!token) {
      // No CSRF token means no session
      if (user) {
        console.log('Session expired - no CSRF token found');
        handleSessionExpiry();
      }
      return false;
    }

    try {
      const response = await fetch('/home', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': token,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update user data if it changed
        if (data.user && (!user || user.id !== data.user.id)) {
          setUser(data.user);
        }
        return true;
      } else if (response.status === 401) {
        // Token expired or invalid
        console.log('Session expired - 401 response');
        handleSessionExpiry();
        return false;
      }
    } catch (error) {
      console.error('Session check failed:', error);
      return false;
    }
    
    return false;
  };

  // Handle session expiry
  const handleSessionExpiry = async () => {
    console.log('Session expired due to inactivity - logging out...');
    
    // Clear frontend state immediately
    setUser(null);
    setCsrfToken(null);
    
    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    // Call backend logout to invalidate JWT token
    try {
      const token = getCsrfToken();
      if (token) {
        await fetch('/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-CSRF-TOKEN': token,
            'Content-Type': 'application/json',
          },
        });
        console.log('Backend logout successful - JWT token invalidated');
      }
    } catch (error) {
      console.error('Backend logout failed during inactivity expiry:', error);
    }
    
    // Let ProtectedRoute handle the redirect automatically
    console.log('Session expired - user will be redirected to login');
  };

  // Start inactivity monitoring
  const startInactivityMonitoring = useCallback(() => {
    // Set up activity event listeners
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };
    
    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });
    
    // Start the initial timer
    resetInactivityTimer();
    
    // Return cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [resetInactivityTimer]);

  // Stop inactivity monitoring
  const stopInactivityMonitoring = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Check if user is already logged in by trying to access a protected route
    const checkAuthStatus = async () => {
      try {
        const token = getCsrfToken();
        if (token) {
          setCsrfToken(token);
          // Try to get user info to verify authentication
          const response = await fetch('/home', {
            method: 'GET',
            credentials: 'include', // Include cookies
            headers: {
              'X-CSRF-TOKEN': token,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            // Start monitoring inactivity for existing user
            startInactivityMonitoring();
          }
        }
      } catch (error) {
        console.log('No existing session found');
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    const token = getCsrfToken();
    setCsrfToken(token);
    startInactivityMonitoring();
  }, [startInactivityMonitoring]);

  const logout = useCallback(async () => {
    // Stop inactivity monitoring
    stopInactivityMonitoring();
    
    try {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  }, [csrfToken, stopInactivityMonitoring]);

  const isAuthenticated = () => {
    return !!(user && csrfToken);
  };

  const value = useMemo(() => ({
    user,
    csrfToken,
    login,
    logout,
    isAuthenticated,
    loading
  }), [user, csrfToken, login, logout, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
