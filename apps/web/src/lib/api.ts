const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type Role = 'ADMIN' | 'STAFF' | 'MEMBER';

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  memberId?: string | null;
  name?: string;
  photoUrl?: string | null;
};

type ApiOptions = RequestInit & { token?: string | null };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  const token = options.token ?? (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.message
        ? Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message
        : message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return (await res.text()) as T;
}

export async function downloadApiFile(path: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Export failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function dashboardPath(role: Role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'STAFF') return '/staff';
  return '/member';
}
