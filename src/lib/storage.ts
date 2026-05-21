/** localStorage key for the workshop session token (exported for cross-tab sync). */
export const SESSION_KEY = 'llmviz.session.v1';
const LAST_MODULE = 'llmviz.lastModule.v1';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(value: string): void {
  try {
    localStorage.setItem(SESSION_KEY, value);
  } catch {
    /* private mode or quota — ignore */
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getLastModuleId(): string | null {
  try {
    return localStorage.getItem(LAST_MODULE);
  } catch {
    return null;
  }
}

export function setLastModuleId(id: string): void {
  try {
    localStorage.setItem(LAST_MODULE, id);
  } catch {
    /* ignore */
  }
}
