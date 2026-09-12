import { div, median, quantile, sum } from '../domain/model';
import type { Delivery } from '../domain/types';

export interface DelayReasonRow {
  reason: string;
  count: number;
}

export interface DeliveryPerf {
  count: number;
  revenue: number;
  delayedCount: number;
  delayRate: number;
  medianDays: number | null;
  p90Days: number | null;
  reasons: DelayReasonRow[];
}

export function deliveryPerf(dels: Delivery[]): DeliveryPerf {
  const delayed = dels.filter((d) => d.delayed);
  const reasons: Record<string, number> = {};
  delayed.forEach((d) => {
    const key = d.delayReason as string;
    reasons[key] = (reasons[key] || 0) + 1;
  });
  return {
    count: dels.length, revenue: sum(dels.map((d) => d.revenue)),
    delayedCount: delayed.length, delayRate: div(delayed.length, dels.length),
    medianDays: median(dels.map((d) => d.daysToDeliver)),
    p90Days: quantile(dels.map((d) => d.daysToDeliver), 0.9),
    reasons: Object.entries(reasons).map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
