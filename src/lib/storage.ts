const KEY = 'llmviz.apiKey.v1';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setApiKey(value: string): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* private mode or quota — ignore */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
