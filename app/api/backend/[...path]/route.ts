import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiUrl } from '../../../../lib/backend-api-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESPONSE_HEADERS_TO_SKIP = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function responseCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);

  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,\s]+=)/g) : [];
}

function makeCookieSameOrigin(cookie: string) {
  // A cookie issued by the API host must belong to the Vercel/frontend host
  // and be available to every proxied endpoint, not only its old API path.
  const hostOnly = cookie.replace(/;\s*domain=[^;]+/gi, '');
  return /;\s*path=/i.test(hostOnly)
    ? hostOnly.replace(/;\s*path=[^;]*/i, '; Path=/')
    : `${hostOnly}; Path=/`;
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const safePath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const target = `${getBackendApiUrl()}/${safePath}${request.nextUrl.search}`;
  const requestHeaders = new Headers(request.headers);

  requestHeaders.delete('connection');
  requestHeaders.delete('content-length');
  requestHeaders.delete('host');

  try {
    const backendResponse = await fetch(target, {
      method: request.method,
      headers: requestHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, name) => {
      if (!RESPONSE_HEADERS_TO_SKIP.has(name.toLowerCase())) responseHeaders.append(name, value);
    });
    responseCookies(backendResponse.headers).forEach((cookie) => {
      responseHeaders.append('set-cookie', makeCookieSameOrigin(cookie));
    });

    return new NextResponse(request.method === 'HEAD' ? null : backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: 'The application service is temporarily unavailable. Please try again.' },
      { status: 502 },
    );
  }
}

type RouteContext = { params: { path: string[] } };

export function GET(request: NextRequest, { params }: RouteContext) {
  return proxyRequest(request, params.path);
}

export function POST(request: NextRequest, { params }: RouteContext) {
  return proxyRequest(request, params.path);
}

export function PUT(request: NextRequest, { params }: RouteContext) {
  return proxyRequest(request, params.path);
}

export function PATCH(request: NextRequest, { params }: RouteContext) {
  return proxyRequest(request, params.path);
}

export function DELETE(request: NextRequest, { params }: RouteContext) {
  return proxyRequest(request, params.path);
}

export function OPTIONS(request: NextRequest, { params }: RouteContext) {
  return proxyRequest(request, params.path);
}
