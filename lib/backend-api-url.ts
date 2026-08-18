import 'server-only';

const LOCAL_API_URL = 'http://localhost:4000/api';

/**
 * The backend address is intentionally resolved only on the server. API_URL is
 * preferred for deployments, while NEXT_PUBLIC_API_URL remains supported so
 * existing Vercel environments continue to work without an immediate rename.
 */
export function getBackendApiUrl() {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || LOCAL_API_URL).replace(/\/+$/, '');
}
