import { STALE_DAYS, div, sum } from '../domain/model';
import type { Lead } from '../domain/types';

export type AgingTone = 'ok' | 'warn' | 'crit';

export interface AgingBucketDef {
  key: string;
  label: string;
  min: number;
  max: number;
  tone: AgingTone;
}

export const AGING_BUCKETS: AgingBucketDef[] = [
  { key: '0-3', label: '0–3 days', min: 0, max: 3, tone: 'ok' },
  { key: '4-7', label: '4–7 days', min: 4, max: 7, tone: 'ok' },
  { key: '8-14', label: '8–14 days', min: 8, max: 14, tone: 'warn' },
  { key: '15-30', label: '15–30 days', min: 15, max: 30, tone: 'warn' },
  { key: '30+', label: '30+ days', min: 31, max: Infinity, tone: 'crit' },
];

export interface AgingBucket extends AgingBucketDef {
  count: number;
  value: number;
  leads: Lead[];
}

export interface Aging {
  buckets: AgingBucket[];
  openCount: number;
  openValue: number;
  staleCount: number;
  staleValue: number;
  staleShare: number;
  stale: Lead[];
}

export function aging(openLeads: Lead[]): Aging {
  const buckets: AgingBucket[] = AGING_BUCKETS.map((b) => {
    const ls = openLeads.filter((l) => l.idleDays >= b.min && l.idleDays <= b.max);
    return { ...b, count: ls.length, value: sum(ls.map((l) => l.dealValue)), leads: ls };
  });
  const stale = openLeads.filter((l) => l.idleDays >= STALE_DAYS);
  return {
    buckets,
    openCount: openLeads.length,
    openValue: sum(openLeads.map((l) => l.dealValue)),
    staleCount: stale.length,
    staleValue: sum(stale.map((l) => l.dealValue)),
    staleShare: div(stale.length, openLeads.length),
    stale,
  };
}
