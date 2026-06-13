import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, getCsrfToken } from '@/api/client';
import type { HomeResponse, User } from '@/api/types';

interface AuthContextValue {
  user: User | null;
  csrfToken: string | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSessionExpiry = useCallback(async () => {
    setUser(null);
    setCsrfToken(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    const token = getCsrfToken();
    if (token) {
      try {
        await apiFetch('/logout', { method: 'POST' });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(handleSessionExpiry, 15 * 60 * 1000);
  }, [handleSessionExpiry]);

  const startInactivityMonitoring = useCallback(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const onActivity = () => resetInactivityTimer();
    events.forEach((e) => document.addEventListener(e, onActivity, true));
    resetInactivityTimer();
    return () => events.forEach((e) => document.removeEventListener(e, onActivity, true));
  }, [resetInactivityTimer]);

  useEffect(() => {
    const check = async () => {
      try {
        const token = getCsrfToken();
        if (token) {
          setCsrfToken(token);
          const data = await apiFetch<HomeResponse>('/home');
          setUser(data.user);
          startInactivityMonitoring();
        }
      } catch {
        /* no session */
      } finally {
        setLoading(false);
      }
    };
    check();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [startInactivityMonitoring]);

  const login = useCallback(
    (userData: User) => {
      setUser(userData);
      setCsrfToken(getCsrfToken());
      startInactivityMonitoring();
    },
    [startInactivityMonitoring],
  );

  const logout = useCallback(async () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    try {
      await apiFetch('/logout', { method: 'POST' });
    } catch {
      /* ignore */
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      csrfToken,
      loading,
      login,
      logout,
      isAuthenticated: () => !!(user && csrfToken),
    }),
    [user, csrfToken, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
