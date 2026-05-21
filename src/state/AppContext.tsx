import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isAuthenticated, login as doLogin, logout as doLogout, UNAUTHORIZED_EVENT } from '../lib/llm';
import { SESSION_KEY } from '../lib/storage';

interface AppState {
  /** True once the workshop password has been accepted and the token is valid. */
  authed: boolean;
  /** Exchange the workshop password for a session token. Throws LlmError on failure. */
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => isAuthenticated());

  useEffect(() => {
    // Cross-tab sync: reflect login/logout that happened in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) setAuthed(isAuthenticated());
    };
    // The proxy rejected our token mid-session (expired) — drop back to login.
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener('storage', onStorage);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const login = useCallback(async (password: string) => {
    await doLogin(password);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setAuthed(false);
  }, []);

  const value = useMemo(() => ({ authed, login, logout }), [authed, login, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
