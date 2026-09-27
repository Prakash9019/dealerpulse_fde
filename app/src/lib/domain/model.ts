/* DealerPulse domain model. Layers: domain model -> analytics -> insight engine -> AI presentation.
   Everything is a pure function of the dataset. No hardcoded findings. */
import { fmtDate, monthsBehindLive } from '../format';
import type {
  Branch, Delivery, HistoryEntry, Lead, Model, RawData, Rep, StageKey, Target,
} from './types';

export const STAGES: StageKey[] = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed', 'delivered'];
export const OPEN_STAGES: StageKey[] = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed'];

export const STAGE_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', test_drive: 'Test Drive',
  negotiation: 'Negotiation', order_placed: 'Order Placed', delivered: 'Delivered', lost: 'Lost',
};

export const PRIORITY_TIERS = { critical: 45, attention: 22 };

/** Flood-control cap on how many anomaly cards surface by default (section: "do
    not flood the user with low-value anomalies"). The rest stay available via
    an overflow disclosure, never hidden permanently. */
export const MAX_ANOMALIES = 6;

export const STAGE_WEIGHT: Record<string, number> = {
  new: 0.25, contacted: 0.35, test_drive: 0.55, negotiation: 0.8, order_placed: 1,
};

export const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', walk_in: 'Walk-in', referral: 'Referral',
  social_media: 'Social Media', phone_enquiry: 'Phone Enquiry', auto_expo: 'Auto Expo',
};

const DAY = 86400000;
export const STALE_DAYS = 8;

/** Below this many leads, a rep's raw conversion rate is noise (one delivery
    swings it by 10+ points) — the anomaly gate already refuses to judge a rep
    this thin; the UI should refuse to display a number for one too, per the
    same "don't fake a rate from an inadequate sample" rule the network KPI
    already follows (see `maturedConversion`'s n>=10 floor). */
export const MIN_RATED_LEADS = 10;

/* ---------- small math helpers ---------- */
export const sum = (a: number[]): number => a.reduce((s, x) => s + x, 0);
export const mean = (a: number[]): number => (a.length ? sum(a) / a.length : 0);

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(a: number[], q: number): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)));
  return s[i];
}

export const div = (a: number, b: number): number => (b ? a / b : 0);

export const monthKey = (d: string | Date): string =>
  typeof d === 'string' ? d.slice(0, 7) : d.toISOString().slice(0, 7);

export const MONTH_LABEL = (k: string): string => {
  const [y, m] = k.split('-');
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + " '" + y.slice(2);
};

/** Two-proportion z-test against a baseline. Used for "statistically unusual", never for causation. */
export function zProportion(x: number, n: number, p0: number): number {
  if (!n || p0 <= 0 || p0 >= 1) return 0;
  const se = Math.sqrt((p0 * (1 - p0)) / n);
  return se ? (x / n - p0) / se : 0;
}

/* ---------- domain model ---------- */
export function buildModel(raw: RawData, asOfISO?: string): Model {
  const asOf = new Date(asOfISO || '2025-12-31T23:59:59Z');
  const branchById: Record<string, Branch> = {};
  const repById: Record<string, Rep> = {};

  const branches: Branch[] = raw.branches.map((b) => {
    const o: Branch = { ...b, managerName: null, repIds: [] };
    branchById[b.id] = o;
    return o;
  });

  const reps: Rep[] = raw.sales_reps.map((r) => {
    const o: Rep = {
      id: r.id, name: r.name, branchId: r.branch_id, role: r.role,
      roleLabel: r.role === 'branch_manager' ? 'Branch Manager' : 'Sales Officer',
      joined: r.joined, branchName: branchById[r.branch_id]?.name || '—',
    };
    repById[r.id] = o;
    if (r.role === 'branch_manager' && branchById[r.branch_id]) branchById[r.branch_id].managerName = r.name;
    if (branchById[r.branch_id]) branchById[r.branch_id].repIds.push(r.id);
    return o;
  });

  const deliveryByLead: Record<string, Delivery> = {};
  raw.deliveries.forEach((d) => {
    deliveryByLead[d.lead_id] = {
      leadId: d.lead_id, orderDate: d.order_date, deliveryDate: d.delivery_date,
      daysToDeliver: d.days_to_deliver, delayReason: d.delay_reason, delayed: !!d.delay_reason,
      revenue: 0,
    };
  });

  const leads: Lead[] = raw.leads.map((l) => {
    const history: HistoryEntry[] = l.status_history.map((h) => ({
      status: h.status, at: new Date(h.timestamp),
      // dataset has a broken note template ("{} competitor"); repair for display only
      note: (h.note || '').replace(/\{\}/g, 'a rival'),
    })).sort((a, b) => a.at.getTime() - b.at.getTime());

    const stageAt: Partial<Record<StageKey, Date>> = {};
    history.forEach((h) => {
      if (!(h.status in stageAt)) (stageAt as Record<string, Date>)[h.status] = h.at;
    });

    const createdAt = new Date(l.created_at);
    const lastActivityAt = new Date(l.last_activity_at);
    const open = (OPEN_STAGES as string[]).includes(l.status);
    const lostFrom = l.status === 'lost'
      ? ((history.filter((h) => h.status !== 'lost').slice(-1)[0]?.status as StageKey) || 'new')
      : null;
    const delivery = deliveryByLead[l.id] || null;
    const expected = l.expected_close_date ? new Date(l.expected_close_date + 'T00:00:00Z') : null;

    return {
      id: l.id, customerName: l.customer_name, phone: l.phone, source: l.source,
      sourceLabel: SOURCE_LABEL[l.source] || l.source, model: l.model_interested,
      status: l.status, repId: l.assigned_to, repName: repById[l.assigned_to]?.name || '—',
      branchId: l.branch_id, branchName: branchById[l.branch_id]?.name || '—',
      createdAt, lastActivityAt, history, stageAt,
      reached: (s: string) => s in stageAt,
      dealValue: l.deal_value, lostReason: l.lost_reason, lostFrom, open,
      expectedCloseDate: expected,
      overdue: !!(expected && open && expected < asOf),
      overdueDays: expected && open && expected < asOf ? Math.floor((asOf.getTime() - expected.getTime()) / DAY) : 0,
      idleDays: Math.floor((asOf.getTime() - lastActivityAt.getTime()) / DAY),
      ageDays: Math.floor((asOf.getTime() - createdAt.getTime()) / DAY),
      delivery,
    };
  });

  const leadById: Record<string, Lead> = {};
  leads.forEach((l) => { leadById[l.id] = l; });

  const deliveries: Delivery[] = Object.values(deliveryByLead).map((d) => ({
    ...d,
    lead: leadById[d.leadId],
    branchId: leadById[d.leadId]?.branchId,
    repId: leadById[d.leadId]?.repId,
    revenue: leadById[d.leadId]?.dealValue || 0,
  }));

  const months = [...new Set(raw.targets.map((t) => t.month))].sort();
  const targets: Target[] = raw.targets.map((t) => ({
    branchId: t.branch_id, month: t.month, targetUnits: t.target_units, targetRevenue: t.target_revenue,
  }));

  // median time from first touch to delivery -> defines when a lead cohort is "mature"
  const toDelivery = leads
    .filter((l) => l.stageAt.delivered)
    .map((l) => (l.stageAt.delivered!.getTime() - l.createdAt.getTime()) / DAY);
  const maturityDays = Math.round(median(toDelivery) || 40);

  const monthsBehind = monthsBehindLive(asOf);
  const asOfLabel = fmtDate(asOf) + (monthsBehind >= 1 ? ` · ${monthsBehind} month${monthsBehind === 1 ? '' : 's'} behind live` : '');

  return {
    asOf, asOfLabel, meta: raw.metadata,
    branches, branchById, reps, repById, leads, leadById, deliveries, targets, months,
    maturityDays,
    dataStart: new Date(months[0] + '-01T00:00:00Z'),
    dataEnd: asOf,
  };
}
