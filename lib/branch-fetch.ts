export function selectedBranchHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const branch = window.localStorage.getItem('tii_selected_branch') || '';
  return branch ? { 'X-Branch-Id': branch } : {};
}
