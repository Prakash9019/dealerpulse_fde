export function fmtINR(v: number | null | undefined): string {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e7) return '₹' + (v / 1e7).toFixed(a >= 1e8 ? 1 : 2) + ' Cr';
  if (a >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L';
  if (a >= 1e3) return '₹' + Math.round(v / 1e3) + 'K';
  return '₹' + Math.round(v);
}

export const fmtCr = (v: number): string => (v / 1e7).toFixed(2) + ' Cr';

export const fmtPct = (v: number | null | undefined, dp = 1): string =>
  v == null ? '—' : (v * 100).toFixed(dp) + '%';

export const fmtNum = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('en-IN');

export const fmtDays = (v: number | null | undefined): string =>
  v == null ? '—' : Math.round(v * 10) / 10 + 'd';

export function fmtDate(d: string | Date): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const plural = (n: number, one: string, many?: string): string =>
  n + ' ' + (n === 1 ? one : many || one + 's');

export const fmtSigned = (v: number, f: (v: number) => string): string => (v > 0 ? '+' : '') + f(v);
