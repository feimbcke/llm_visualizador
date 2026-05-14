import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearApiKey, getApiKey, setApiKey as persistKey } from '../lib/storage';

interface AppState {
  apiKey: string | null;
  saveApiKey: (key: string) => void;
  removeApiKey: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() => getApiKey());

  // Cross-tab sync: if the user clears the key in another tab, reflect it here.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'llmviz.apiKey.v1') setApiKey(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const saveApiKey = useCallback((key: string) => {
    persistKey(key);
    setApiKey(key);
  }, []);

  const removeApiKey = useCallback(() => {
    clearApiKey();
    setApiKey(null);
  }, []);

  const value = useMemo(
    () => ({ apiKey, saveApiKey, removeApiKey }),
    [apiKey, saveApiKey, removeApiKey],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
