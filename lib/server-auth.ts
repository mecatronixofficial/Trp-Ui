import { NextRequest, NextResponse } from 'next/server';

export async function requireAdmin(request: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  try {
    const response = await fetch(`${apiBase}/auth/me`, {
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store',
    });
    if (!response.ok) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const user = await response.json();
    if (!['admin', 'super_admin'].includes(user?.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }
}
