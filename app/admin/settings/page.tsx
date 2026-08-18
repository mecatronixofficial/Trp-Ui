import { redirect } from 'next/navigation';

// The combined Settings page was split into two — Admin Profile and Company
// Profile — each its own route. Anything still pointing at the bare
// /admin/settings URL (an old bookmark, a stale link) lands on the admin's
// own profile rather than a dead page.
export default function SettingsIndexPage() {
  redirect('/admin/settings/profile');
}
