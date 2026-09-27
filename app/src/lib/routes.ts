import type { Route } from './domain/types';

/** Every CTA in the product carries a route object rather than a string, so navigation
    targets are data. This resolves one to a real Next.js href, preserving the active range. */
export function routeHref(route: Route, currentRange?: string | null): string {
  const qs = new URLSearchParams();
  if (currentRange && currentRange !== 'all') qs.set('range', currentRange);
  if (route.tier) qs.set('tier', route.tier);
  if (route.scope) qs.set('scope', route.scope);
  if (route.anchor) qs.set('a', route.anchor);
  if (route.branchId && (route.screen === 'actions' || route.screen === 'funnel')) qs.set('branch', route.branchId);
  if (route.repId && (route.screen === 'actions' || route.screen === 'funnel')) qs.set('rep', route.repId);

  let base = '/';
  switch (route.screen) {
    case 'overview': base = '/'; break;
    case 'branches': base = '/branches'; break;
    case 'branch': base = route.branchId ? `/branches/${route.branchId}` : '/branches'; break;
    case 'rep': base = route.repId ? `/reps/${route.repId}` : '/branches'; break;
    case 'actions': base = '/actions'; break;
    case 'funnel': base = '/funnel'; break;
    case 'models': base = '/models'; break;
    case 'leads': base = '/leads'; break;
    case 'compare': base = '/compare'; break;
    default: base = '/';
  }
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}
