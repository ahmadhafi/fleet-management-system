const TOKEN_STORAGE_KEY = 'fms_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const normalizedPath = path.startsWith('http') || path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(normalizedPath, {
    cache: 'no-store',
    ...options,
    headers,
  });

  const rawText = await res.text().catch(() => '');
  let data: any = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      const trimmed = rawText.trim();
      if (trimmed && !trimmed.startsWith('<')) {
        data = { error: trimmed.slice(0, 300) };
      } else if (trimmed.startsWith('<')) {
        data = {
          error:
            res.status === 404
              ? 'Requested service endpoint was not found. Please refresh the page.'
              : `Server returned status ${res.status}. Please try again.`,
        };
      }
    }
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
