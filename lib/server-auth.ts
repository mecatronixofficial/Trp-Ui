import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiUrl } from './backend-api-url';

export async function getAdminUser(request: NextRequest): Promise<{ user: any; error: null } | { user: null; error: NextResponse }> {
  try {
    const response = await fetch(`${getBackendApiUrl()}/auth/me`, {
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 || response.status === 429
        ? response.status
        : 502;
      const message = status === 401
        ? 'Unauthorized'
        : status === 403
          ? 'Forbidden'
          : status === 429
            ? 'Too many requests. Please try again shortly.'
          : 'Authentication service unavailable';
      const headers = new Headers();
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) headers.set('retry-after', retryAfter);
      return { user: null, error: NextResponse.json({ message }, { status, headers }) };
    }
    const user = await response.json();
    if (!['admin', 'super_admin'].includes(user?.role)) {
      return { user: null, error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
    }
    return { user, error: null };
  } catch {
    return { user: null, error: NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 }) };
  }
}

export async function requireAdmin(request: NextRequest) {
  const result = await getAdminUser(request);
  return result.error;
}
