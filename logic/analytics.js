/* DealerPulse analytics core.
   Layers: domain model -> analytics -> insight engine -> AI presentation.
   Everything here is a pure function of the dataset. No hardcoded findings. */

export const STAGES = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed', 'delivered'];
export const OPEN_STAGES = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed'];
export const STAGE_LABEL = {
  new: 'New', contacted: 'Contacted', test_drive: 'Test Drive',
  negotiation: 'Negotiation', order_placed: 'Order Placed', delivered: 'Delivered', lost: 'Lost'
};
export const PRIORITY_TIERS = { critical: 45, attention: 22 };
export const STAGE_WEIGHT = { new: 0.25, contacted: 0.35, test_drive: 0.55, negotiation: 0.8, order_placed: 1 };
export const SOURCE_LABEL = {
  website: 'Website', walk_in: 'Walk-in', referral: 'Referral',
  social_media: 'Social Media', phone_enquiry: 'Phone Enquiry', auto_expo: 'Auto Expo'
};
const DAY = 86400000;
export const STALE_DAYS = 8;

/* ---------- small math helpers ---------- */
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);
export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function quantile(a, q) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)));
  return s[i];
}
const div = (a, b) => (b ? a / b : 0);
const monthKey = (d) => (typeof d === 'string' ? d.slice(0, 7) : d.toISOString().slice(0, 7));
export const MONTH_LABEL = (k) => {
  const [y, m] = k.split('-');
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + " '" + y.slice(2);
};

/* Two-proportion z-test against a baseline. Used for "statistically unusual", never for causation. */
export function zProportion(x, n, p0) {
  if (!n || p0 <= 0 || p0 >= 1) return 0;
  const se = Math.sqrt((p0 * (1 - p0)) / n);
  return se ? (x / n - p0) / se : 0;
}

/* ---------- formatting ---------- */
export function fmtINR(v) {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e7) return '₹' + (v / 1e7).toFixed(a >= 1e8 ? 1 : 2) + ' Cr';
  if (a >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L';
  if (a >= 1e3) return '₹' + Math.round(v / 1e3) + 'K';
  return '₹' + Math.round(v);
}
export const fmtCr = (v) => (v / 1e7).toFixed(2) + ' Cr';
export const fmtPct = (v, dp = 1) => (v == null ? '—' : (v * 100).toFixed(dp) + '%');
export const fmtNum = (v) => (v == null ? '—' : v.toLocaleString('en-IN'));
export const fmtDays = (v) => (v == null ? '—' : (Math.round(v * 10) / 10) + 'd');
export function fmtDate(d) {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
export const fmtSigned = (v, f) => (v > 0 ? '+' : '') + f(v);

/* ---------- 1. domain model ---------- */
export function buildModel(raw, asOfISO) {
  const asOf = new Date(asOfISO || '2025-12-31T23:59:59Z');
  const branchById = {}, repById = {};
  const branches = raw.branches.map((b) => {
    const o = { ...b, managerName: null, repIds: [] };
    branchById[b.id] = o;
    return o;
  });
  const reps = raw.sales_reps.map((r) => {
    const o = {
      id: r.id, name: r.name, branchId: r.branch_id, role: r.role,
      roleLabel: r.role === 'branch_manager' ? 'Branch Manager' : 'Sales Officer',
      joined: r.joined, branchName: branchById[r.branch_id]?.name || '—'
    };
    repById[r.id] = o;
    if (r.role === 'branch_manager' && branchById[r.branch_id]) branchById[r.branch_id].managerName = r.name;
    if (branchById[r.branch_id]) branchById[r.branch_id].repIds.push(r.id);
    return o;
  });

  const deliveryByLead = {};
  raw.deliveries.forEach((d) => {
    deliveryByLead[d.lead_id] = {
      leadId: d.lead_id, orderDate: d.order_date, deliveryDate: d.delivery_date,
      daysToDeliver: d.days_to_deliver, delayReason: d.delay_reason, delayed: !!d.delay_reason
    };
  });

  const leads = raw.leads.map((l) => {
    const history = l.status_history.map((h) => ({
      status: h.status, at: new Date(h.timestamp),
      // dataset has a broken note template ("{} competitor"); repair for display only
      note: (h.note || '').replace(/\{\}/g, 'a rival')
    })).sort((a, b) => a.at - b.at);
    const stageAt = {};
    history.forEach((h) => { if (!(h.status in stageAt)) stageAt[h.status] = h.at; });
    const createdAt = new Date(l.created_at);
    const lastActivityAt = new Date(l.last_activity_at);
    const open = OPEN_STAGES.includes(l.status);
    const lostFrom = l.status === 'lost'
      ? (history.filter((h) => h.status !== 'lost').slice(-1)[0]?.status || 'new') : null;
    const delivery = deliveryByLead[l.id] || null;
    const expected = l.expected_close_date ? new Date(l.expected_close_date + 'T00:00:00Z') : null;
    return {
      id: l.id, customerName: l.customer_name, phone: l.phone, source: l.source,
      sourceLabel: SOURCE_LABEL[l.source] || l.source, model: l.model_interested,
      status: l.status, repId: l.assigned_to, repName: repById[l.assigned_to]?.name || '—',
      branchId: l.branch_id, branchName: branchById[l.branch_id]?.name || '—',
      createdAt, lastActivityAt, history, stageAt,
      reached: (s) => s in stageAt,
      dealValue: l.deal_value, lostReason: l.lost_reason, lostFrom, open,
      expectedCloseDate: expected,
      overdue: !!(expected && open && expected < asOf),
      overdueDays: expected && open && expected < asOf ? Math.floor((asOf - expected) / DAY) : 0,
      idleDays: Math.floor((asOf - lastActivityAt) / DAY),
      ageDays: Math.floor((asOf - createdAt) / DAY),
      delivery
    };
  });

  const leadById = {};
  leads.forEach((l) => { leadById[l.id] = l; });
  const deliveries = Object.values(deliveryByLead).map((d) => ({
    ...d, lead: leadById[d.leadId],
    branchId: leadById[d.leadId]?.branchId, repId: leadById[d.leadId]?.repId,
    revenue: leadById[d.leadId]?.dealValue || 0
  }));

  const months = [...new Set(raw.targets.map((t) => t.month))].sort();
  const targets = raw.targets.map((t) => ({
    branchId: t.branch_id, month: t.month, targetUnits: t.target_units, targetRevenue: t.target_revenue
  }));

  // median time from first touch to delivery -> defines when a lead cohort is "mature"
  const toDelivery = leads.filter((l) => l.stageAt.delivered)
    .map((l) => (l.stageAt.delivered - l.createdAt) / DAY);
  const maturityDays = Math.round(median(toDelivery) || 40);

  return {
    asOf, asOfLabel: fmtDate(asOf), meta: raw.metadata,
    branches, branchById, reps, repById, leads, leadById, deliveries, targets, months,
    maturityDays,
    dataStart: new Date(months[0] + '-01T00:00:00Z'),
    dataEnd: asOf
  };
}

/* ---------- 2. analytics ---------- */

export function funnel(leads) {
  const counts = STAGES.map((s) => leads.filter((l) => s in l.stageAt).length);
  return STAGES.map((s, i) => {
    const durs = i === 0 ? [] : leads
      .filter((l) => l.stageAt[STAGES[i - 1]] && l.stageAt[s])
      .map((l) => (l.stageAt[s] - l.stageAt[STAGES[i - 1]]) / DAY);
    const lostHere = leads.filter((l) => l.lostFrom === STAGES[i - 1]).length;
    return {
      stage: s, label: STAGE_LABEL[s], count: counts[i],
      shareOfTop: div(counts[i], counts[0]),
      convFromPrev: i === 0 ? 1 : div(counts[i], counts[i - 1]),
      dropOff: i === 0 ? 0 : counts[i - 1] - counts[i],
      lostHere,
      medianDays: i === 0 ? null : median(durs),
      p90Days: i === 0 ? null : quantile(durs, 0.9),
      n: i === 0 ? counts[0] : counts[i - 1]
    };
  });
}

/** Rank funnel steps by leads lost in excess of the baseline. Volume-weighted, so a
    small-sample stage cannot outrank the step where the real losses happen. */
export function stageLeaks(entityFunnel, baseFunnel, minN = 8) {
  return entityFunnel.slice(1).map((s, i) => {
    const net = baseFunnel[i + 1].convFromPrev;
    return {
      stage: s.stage, fromStage: STAGES[i], label: STAGE_LABEL[STAGES[i]] + ' → ' + s.label,
      conv: s.convFromPrev, net, gap: s.convFromPrev - net, n: s.n,
      excessLoss: s.n * (net - s.convFromPrev)
    };
  }).filter((s) => s.n >= minN).sort((a, b) => b.excessLoss - a.excessLoss);
}

export const conversion = (leads) => div(leads.filter((l) => l.status === 'delivered').length, leads.length);

/** Cohort conversion excluding leads too young to have plausibly closed. */
export function maturedConversion(leads, asOf, maturityDays) {
  const mature = leads.filter((l) => (asOf - l.createdAt) / DAY >= maturityDays);
  return { rate: conversion(mature), n: mature.length, excluded: leads.length - mature.length };
}

export const AGING_BUCKETS = [
  { key: '0-3', label: '0–3 days', min: 0, max: 3, tone: 'ok' },
  { key: '4-7', label: '4–7 days', min: 4, max: 7, tone: 'ok' },
  { key: '8-14', label: '8–14 days', min: 8, max: 14, tone: 'warn' },
  { key: '15-30', label: '15–30 days', min: 15, max: 30, tone: 'warn' },
  { key: '30+', label: '30+ days', min: 31, max: Infinity, tone: 'crit' }
];

export function aging(openLeads) {
  const buckets = AGING_BUCKETS.map((b) => {
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
    stale
  };
}

export function targetPerf(model, branchId, months) {
  const rows = model.targets.filter((t) => (!branchId || t.branchId === branchId) && months.includes(t.month));
  const targetUnits = sum(rows.map((r) => r.targetUnits));
  const targetRevenue = sum(rows.map((r) => r.targetRevenue));
  const dels = model.deliveries.filter((d) => (!branchId || d.branchId === branchId) && months.includes(monthKey(d.deliveryDate)));
  const units = dels.length, revenue = sum(dels.map((d) => d.revenue));
  const last = months[months.length - 1];
  const lastTarget = sum(model.targets.filter((t) => (!branchId || t.branchId === branchId) && t.month === last).map((r) => r.targetUnits));
  const lastUnits = model.deliveries.filter((d) => (!branchId || d.branchId === branchId) && monthKey(d.deliveryDate) === last).length;
  const prev = months[months.length - 2];
  const prevTarget = prev ? sum(model.targets.filter((t) => (!branchId || t.branchId === branchId) && t.month === prev).map((r) => r.targetUnits)) : 0;
  const prevUnits = prev ? model.deliveries.filter((d) => (!branchId || d.branchId === branchId) && monthKey(d.deliveryDate) === prev).length : 0;
  return {
    targetUnits, units, attainment: div(units, targetUnits), gapUnits: targetUnits - units,
    targetRevenue, revenue, revenueAttainment: div(revenue, targetRevenue),
    pace: div(lastUnits, lastTarget), paceMonth: last, paceUnits: lastUnits, paceTarget: lastTarget,
    paceTrend: div(lastUnits, lastTarget) - div(prevUnits, prevTarget), prevMonth: prev
  };
}

export function deliveryPerf(dels) {
  const delayed = dels.filter((d) => d.delayed);
  const reasons = {};
  delayed.forEach((d) => { reasons[d.delayReason] = (reasons[d.delayReason] || 0) + 1; });
  return {
    count: dels.length, revenue: sum(dels.map((d) => d.revenue)),
    delayedCount: delayed.length, delayRate: div(delayed.length, dels.length),
    medianDays: median(dels.map((d) => d.daysToDeliver)),
    p90Days: quantile(dels.map((d) => d.daysToDeliver), 0.9),
    reasons: Object.entries(reasons).map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  };
}

export function monthlyTrend(model, months, scope = {}) {
  return months.map((m) => {
    const dels = model.deliveries.filter((d) =>
      monthKey(d.deliveryDate) === m &&
      (!scope.branchId || d.branchId === scope.branchId) &&
      (!scope.repId || d.repId === scope.repId));
    const created = model.leads.filter((l) =>
      monthKey(l.createdAt) === m &&
      (!scope.branchId || l.branchId === scope.branchId) &&
      (!scope.repId || l.repId === scope.repId));
    const tg = model.targets.filter((t) => t.month === m && (!scope.branchId || t.branchId === scope.branchId));
    const orders = model.leads.filter((l) => l.stageAt.order_placed &&
      monthKey(l.stageAt.order_placed) === m &&
      (!scope.branchId || l.branchId === scope.branchId) &&
      (!scope.repId || l.repId === scope.repId));
    const mature = created.filter((l) => (model.asOf - l.createdAt) / DAY >= model.maturityDays);
    return {
      month: m, label: MONTH_LABEL(m),
      units: dels.length, revenue: sum(dels.map((d) => d.revenue)),
      delayed: dels.filter((d) => d.delayed).length,
      delayRate: div(dels.filter((d) => d.delayed).length, dels.length),
      medianDaysToDeliver: median(dels.map((d) => d.daysToDeliver)),
      leadsCreated: created.length,
      ordersPlaced: orders.length, ordersValue: sum(orders.map((l) => l.dealValue)),
      targetUnits: sum(tg.map((t) => t.targetUnits)),
      cohortConversion: mature.length ? conversion(mature) : null,
      cohortMature: mature.length
    };
  });
}

export function sourcePerf(leads) {
  const keys = [...new Set(leads.map((l) => l.source))];
  return keys.map((s) => {
    const ls = leads.filter((l) => l.source === s);
    const del = ls.filter((l) => l.status === 'delivered');
    return {
      source: s, label: SOURCE_LABEL[s] || s, leads: ls.length,
      delivered: del.length, conversion: div(del.length, ls.length),
      revenue: sum(del.map((l) => l.dealValue)),
      contactRate: div(ls.filter((l) => 'contacted' in l.stageAt).length, ls.length)
    };
  }).sort((a, b) => b.conversion - a.conversion);
}

export function lostReasons(leads) {
  const lost = leads.filter((l) => l.status === 'lost');
  const m = {};
  lost.forEach((l) => {
    const k = l.lostReason || 'Not recorded';
    m[k] = m[k] || { reason: k, count: 0, value: 0 };
    m[k].count++; m[k].value += l.dealValue;
  });
  return {
    total: lost.length, value: sum(lost.map((l) => l.dealValue)),
    rows: Object.values(m).sort((a, b) => b.count - a.count),
    byStage: STAGES.slice(0, 5).map((s) => ({
      stage: s, label: STAGE_LABEL[s], count: lost.filter((l) => l.lostFrom === s).length
    }))
  };
}

export function repRows(model, leads, dels) {
  const ids = [...new Set(leads.map((l) => l.repId))];
  const rows = ids.map((id) => {
    const rep = model.repById[id];
    const ls = leads.filter((l) => l.repId === id);
    const open = ls.filter((l) => l.open);
    const stale = open.filter((l) => l.idleDays >= STALE_DAYS);
    const d = dels.filter((x) => x.repId === id);
    return {
      id, name: rep?.name || id, branchId: rep?.branchId, branchName: rep?.branchName,
      role: rep?.roleLabel || '—',
      leads: ls.length,
      contacted: ls.filter((l) => 'contacted' in l.stageAt).length,
      contactRate: div(ls.filter((l) => 'contacted' in l.stageAt).length, ls.length),
      orders: ls.filter((l) => 'order_placed' in l.stageAt).length,
      delivered: ls.filter((l) => l.status === 'delivered').length,
      conversion: conversion(ls),
      pipelineValue: sum(open.map((l) => l.dealValue)),
      revenue: sum(d.map((x) => x.revenue)),
      openCount: open.length,
      staleCount: stale.length, staleValue: sum(stale.map((l) => l.dealValue)),
      lost: ls.filter((l) => l.status === 'lost').length
    };
  }).filter((r) => r.leads > 0);
  rows.sort((a, b) => b.conversion - a.conversion || b.delivered - a.delivered);
  rows.forEach((r, i) => { r.networkRank = i + 1; });
  model.branches.forEach((b) => {
    const inb = rows.filter((r) => r.branchId === b.id).sort((a, b2) => b2.conversion - a.conversion);
    inb.forEach((r, i) => { r.branchRank = i + 1; r.branchRepCount = inb.length; });
  });
  rows.forEach((r) => { r.networkRankOf = rows.length; });
  return rows;
}

/* ---------- 3. slice / context ---------- */

export const RANGE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'quarter', label: 'Last quarter' },
  { key: 'month', label: 'December 2025' }
];

export function resolveRange(model, key, custom) {
  const end = model.asOf;
  if (key === 'custom' && custom?.from && custom?.to) {
    return { from: new Date(custom.from + 'T00:00:00Z'), to: new Date(custom.to + 'T23:59:59Z'), key, label: 'Custom' };
  }
  if (key === '30d') return { from: new Date(end - 30 * DAY), to: end, key, label: 'Last 30 days' };
  if (key === 'quarter') return { from: new Date(Date.UTC(2025, 9, 1)), to: end, key, label: 'Last quarter (Oct–Dec)' };
  if (key === 'month') return { from: new Date(Date.UTC(2025, 11, 1)), to: end, key, label: 'December 2025' };
  return { from: model.dataStart, to: end, key: 'all', label: 'All time (Jun–Dec 2025)' };
}

/** The single analytics context every screen reads from. */
export function analyze(model, filters = {}) {
  const range = resolveRange(model, filters.range || 'all', filters.custom);
  const inRange = (d) => d >= range.from && d <= range.to;
  const months = model.months.filter((m) => {
    const s = new Date(m + '-01T00:00:00Z');
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0, 23, 59, 59));
    return e >= range.from && s <= range.to;
  });
  const scopeMatch = (x) => (!filters.branchId || x.branchId === filters.branchId) && (!filters.repId || x.repId === filters.repId);

  const cohort = model.leads.filter((l) => inRange(l.createdAt) && scopeMatch(l));
  const allScoped = model.leads.filter(scopeMatch);
  const openLeads = allScoped.filter((l) => l.open);
  const dels = model.deliveries.filter((d) => inRange(new Date(d.deliveryDate + 'T12:00:00Z')) && scopeMatch(d));

  // previous equal-length window, for deltas
  const span = range.to - range.from;
  const pFrom = new Date(range.from - span - DAY), pTo = new Date(range.from - DAY);
  const prevDels = model.deliveries.filter((d) => {
    const dd = new Date(d.deliveryDate + 'T12:00:00Z');
    return dd >= pFrom && dd <= pTo && scopeMatch(d);
  });
  const prevCohort = model.leads.filter((l) => l.createdAt >= pFrom && l.createdAt <= pTo && scopeMatch(l));

  const f = funnel(cohort);
  const netFunnel = funnel(model.leads.filter((l) => inRange(l.createdAt)));
  const matured = maturedConversion(cohort, model.asOf, model.maturityDays);
  const prevMatured = maturedConversion(prevCohort, model.asOf, model.maturityDays);
  const age = aging(openLeads);
  const deliv = deliveryPerf(dels);
  const prevDeliv = deliveryPerf(prevDels);
  const trend = monthlyTrend(model, months, filters);
  const tg = targetPerf(model, filters.branchId, months);

  const branchRows = model.branches.map((b) => {
    const ls = model.leads.filter((l) => l.branchId === b.id && inRange(l.createdAt));
    const bOpen = model.leads.filter((l) => l.branchId === b.id && l.open);
    const bStale = bOpen.filter((l) => l.idleDays >= STALE_DAYS);
    const bd = model.deliveries.filter((d) => d.branchId === b.id && inRange(new Date(d.deliveryDate + 'T12:00:00Z')));
    const bt = targetPerf(model, b.id, months);
    const bf = funnel(ls);
    const bm = maturedConversion(ls, model.asOf, model.maturityDays);
    return {
      id: b.id, name: b.name, city: b.city, managerName: b.managerName,
      leads: ls.length, conversion: conversion(ls), maturedConversion: bm.rate, maturedN: bm.n,
      contactRate: bf[1].convFromPrev,
      units: bd.length, revenue: sum(bd.map((d) => d.revenue)),
      attainment: bt.attainment, pace: bt.pace, gapUnits: bt.gapUnits,
      targetUnits: bt.targetUnits, targetRevenue: bt.targetRevenue, revenueAttainment: bt.revenueAttainment,
      paceMonth: bt.paceMonth, paceUnits: bt.paceUnits, paceTarget: bt.paceTarget, paceTrend: bt.paceTrend,
      pipelineValue: sum(bOpen.map((l) => l.dealValue)),
      revenueAtRisk: sum(bStale.map((l) => l.dealValue)),
      staleCount: bStale.length, openCount: bOpen.length,
      delayRate: div(bd.filter((d) => d.delayed).length, bd.length),
      medianDaysToDeliver: median(bd.map((d) => d.daysToDeliver)),
      funnel: bf, repCount: b.repIds.length
    };
  });
  const netMatured = maturedConversion(model.leads.filter((l) => inRange(l.createdAt)), model.asOf, model.maturityDays);
  branchRows.forEach((r) => {
    r.convVsNetwork = r.maturedConversion - netMatured.rate;
    r.z = zProportion(Math.round(r.maturedConversion * r.maturedN), r.maturedN, netMatured.rate || 0.0001);
  });
  const ranked = [...branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion);
  ranked.forEach((r, i) => { r.convRank = i + 1; });
  [...branchRows].sort((a, b) => b.attainment - a.attainment).forEach((r, i) => { r.attainmentRank = i + 1; });
  branchRows.forEach((r) => {
    r.status = r.z <= -2.5 ? 'critical' : r.z <= -1.4 ? 'watch' : r.convVsNetwork > 0.03 ? 'healthy' : 'onTrack';
  });

  const reps = repRows(model, allScoped.filter((l) => inRange(l.createdAt)), dels);

  const ctx = {
    model, filters, range, months,
    scopeLabel: filters.repId ? model.repById[filters.repId]?.name
      : filters.branchId ? model.branchById[filters.branchId]?.name : 'Network',
    cohort, allScoped, openLeads, dels,
    kpi: {
      units: dels.length, prevUnits: prevDels.length,
      revenue: deliv.revenue, prevRevenue: prevDeliv.revenue,
      conversion: matured.n >= 10 ? matured.rate : null,
      prevConversion: prevMatured.n >= 10 ? prevMatured.rate : null,
      conversionN: matured.n, conversionExcluded: matured.excluded,
      conversionNote: matured.n >= 10
        ? matured.n + ' of ' + cohort.length + ' leads in range are old enough to have closed (median lead→delivery is ' + model.maturityDays + ' days)'
        : 'Too few matured leads in this window to state a conversion rate — leads need about ' + model.maturityDays + ' days to close.',
      rawConversion: conversion(cohort),
      leads: cohort.length, prevLeads: prevCohort.length,
      revenueAtRisk: age.staleValue, staleCount: age.staleCount,
      pipelineValue: age.openValue, openCount: age.openCount,
      delayRate: deliv.delayRate, prevDelayRate: prevDeliv.delayRate,
      medianDaysToDeliver: deliv.medianDays,
      avgDealValue: mean(cohort.map((l) => l.dealValue))
    },
    funnel: f, netFunnel, netMaturedConversion: netMatured.rate,
    aging: age, delivery: deliv, trend, targets: tg,
    branchRows, reps,
    sources: sourcePerf(cohort), netSources: sourcePerf(model.leads.filter((l) => inRange(l.createdAt))),
    lost: lostReasons(cohort),
    stageDurations: f.slice(1).map((s, i) => ({
      from: STAGES[i], to: s.stage, label: STAGE_LABEL[STAGES[i]] + ' → ' + STAGE_LABEL[s.stage],
      medianDays: s.medianDays, p90Days: s.p90Days, conversion: s.convFromPrev, n: s.n, dropOff: s.dropOff
    }))
  };
  ctx.actions = actionQueue(ctx);
  ctx.anomalies = detectAnomalies(ctx);
  ctx.recommendations = buildRecommendations(ctx);
  return ctx;
}

/* ---------- 4. insight engine: priority scoring ---------- */

/** Raw business exposure: value x urgency x stage proximity to revenue x risk flags. */
export function priorityRaw(lead, refs) {
  const valueF = Math.min(2.4, Math.max(0.35, lead.dealValue / (refs.medianDealValue || 1)));
  const idleF = Math.min(5, Math.log2(1 + lead.idleDays / 3.5));
  const stageF = STAGE_WEIGHT[lead.status] || 0.3;
  let riskF = 1;
  const risks = [];
  if (lead.overdue) { riskF *= 1.25; risks.push('Past expected close date by ' + lead.overdueDays + ' days'); }
  if (refs.weakBranches && refs.weakBranches.includes(lead.branchId)) { riskF *= 1.12; risks.push('Branch converting below network baseline'); }
  if (lead.idleDays >= 30) { riskF *= 1.15; risks.push('Idle for over a month'); }
  return { raw: valueF * idleF * stageF * riskF, valueF, idleF, stageF, riskF, risks };
}

/** Shared reference set. rawMax normalises the score across the whole open book, so
    scores stay strictly ordered (no ceiling) and are stable under filtering. */
export function priorityRefs(model, branchRows) {
  const refs = {
    medianDealValue: median(model.leads.map((l) => l.dealValue)) || 1,
    weakBranches: (branchRows || []).filter((b) => b.z <= -2).map((b) => b.id),
    rawMax: 1
  };
  const open = model.leads.filter((l) => l.open);
  refs.rawMax = Math.max(0.001, ...open.map((l) => priorityRaw(l, refs).raw));
  return refs;
}

/** Priority score, 1-100, normalised against the strongest case in the open book. */
export function priorityScore(lead, refs) {
  const p = priorityRaw(lead, refs);
  const score = Math.max(1, Math.min(100, Math.round((p.raw / (refs.rawMax || 1)) * 100)));
  return { ...p, score };
}

export function actionQueue(ctx) {
  const model = ctx.model;
  const refs = priorityRefs(model, ctx.branchRows);
  const rows = ctx.openLeads.map((l) => {
    const p = priorityScore(l, refs);
    const tier = p.score >= PRIORITY_TIERS.critical ? 'critical' : p.score >= PRIORITY_TIERS.attention ? 'attention' : 'watch';
    return {
      ...l, ...p, tier,
      reason: leadReason(l, p),
      suggestedAction: l.status === 'order_placed'
        ? (l.idleDays >= 30 ? 'Escalate to delivery ops' : 'Confirm delivery date')
        : l.status === 'negotiation' ? 'Close with a firm offer'
        : l.status === 'test_drive' ? 'Follow up post test-drive'
        : l.status === 'new' ? 'Make first contact' : 'Re-engage and qualify'
    };
  }).sort((a, b) => b.score - a.score);
  return {
    rows,
    critical: rows.filter((r) => r.tier === 'critical'),
    attention: rows.filter((r) => r.tier === 'attention'),
    watch: rows.filter((r) => r.tier === 'watch'),
    totalValue: sum(rows.map((r) => r.dealValue)),
    criticalValue: sum(rows.filter((r) => r.tier === 'critical').map((r) => r.dealValue))
  };
}

/** AI lead explanation — assembled only from fields that exist on the lead. */
export function leadReason(lead, p) {
  const parts = [];
  if (lead.status === 'order_placed') parts.push('Order placed ' + lead.idleDays + ' days ago with no recorded activity since');
  else parts.push(STAGE_LABEL[lead.status] + ' stage, no activity for ' + lead.idleDays + ' days');
  parts.push('deal value ' + fmtINR(lead.dealValue));
  if (lead.overdue) parts.push('expected close was ' + lead.overdueDays + ' days ago');
  return parts.join(' · ');
}

export function leadExplanation(lead, refs) {
  const p = priorityScore(lead, refs);
  const drivers = [
    { label: 'Deal value', detail: fmtINR(lead.dealValue) + (lead.dealValue > refs.medianDealValue ? ' — above the ' + fmtINR(refs.medianDealValue) + ' network median' : ' — below the network median'), weight: p.valueF },
    { label: 'Days idle', detail: lead.idleDays + ' days since last recorded activity (' + fmtDate(lead.lastActivityAt) + ')', weight: p.idleF / 4 * 2 },
    { label: 'Stage', detail: STAGE_LABEL[lead.status] + (lead.status === 'order_placed' ? ' — revenue already committed, only delivery remains' : ' — still mid-funnel'), weight: p.stageF * 2 }
  ];
  const headline = lead.status === 'order_placed'
    ? 'High priority: the customer has already placed an order worth ' + fmtINR(lead.dealValue) + ' and the lead has been inactive for ' + lead.idleDays + ' days.'
    : 'Priority ' + p.score + ': ' + fmtINR(lead.dealValue) + ' at ' + STAGE_LABEL[lead.status] + ', inactive ' + lead.idleDays + ' days.';
  return { score: p.score, headline, drivers, risks: p.risks };
}

/* ---------- 5. anomaly detection ---------- */

export function detectAnomalies(ctx) {
  const out = [];
  const net = ctx.netMaturedConversion;

  ctx.branchRows.forEach((b) => {
    if (b.maturedN >= 20 && Math.abs(b.z) >= 2) {
      const worse = b.z < 0;
      const leaks = stageLeaks(b.funnel, ctx.netFunnel);
      const weakest = worse ? leaks[0] : null;
      out.push({
        id: 'branch-conv-' + b.id,
        type: 'Branch conversion',
        severity: worse ? (b.z <= -3 ? 'critical' : 'risk') : 'opportunity',
        title: b.name + (worse ? ' converts materially below the network baseline' : ' converts materially above the network baseline'),
        metric: 'Lead → delivery conversion',
        expected: fmtPct(net), actual: fmtPct(b.maturedConversion),
        difference: fmtSigned(b.maturedConversion - net, (v) => (v * 100).toFixed(1) + ' pts'),
        evidence: [
          { label: 'Branch conversion', value: fmtPct(b.maturedConversion), note: b.maturedN + ' matured leads' },
          { label: 'Network baseline', value: fmtPct(net) },
          { label: 'z-score vs baseline', value: b.z.toFixed(1) },
          weakest ? { label: 'Biggest leak', value: weakest.label + ' · ' + fmtPct(weakest.conv), note: 'network ' + fmtPct(weakest.net) + ' · ~' + Math.round(weakest.excessLoss) + ' extra leads lost' } : null
        ].filter(Boolean),
        explanation: worse && weakest
          ? 'The largest single leak is ' + weakest.label + ', running ' + fmtPct(weakest.conv) + ' against a network ' + fmtPct(weakest.net) + ' — roughly ' + Math.round(weakest.excessLoss) + ' more leads lost there than the baseline predicts' + (weakest.fromStage === 'new' ? ', before anyone reaches a showroom.' : ', which caps everything downstream.')
          : 'Conversion is above baseline across the funnel; worth studying what this branch does differently.',
        impact: worse
          ? 'At network conversion this branch would have delivered ~' + Math.round(b.leads * net) + ' units instead of ' + b.units + '.'
          : 'Contributes ' + fmtINR(b.revenue) + ' of delivered revenue.',
        cta: { label: 'Open ' + b.name, route: { screen: 'branch', branchId: b.id } }
      });
    }
  });

  ctx.netFunnel.slice(1).forEach((s, i) => {
    const worst = ctx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));
    if (s.stage === worst.stage) {
      out.push({
        id: 'stage-' + s.stage,
        type: 'Stage conversion',
        severity: 'risk',
        title: 'Largest network leakage is ' + STAGE_LABEL[STAGES[i]] + ' → ' + s.label,
        metric: 'Stage conversion',
        expected: fmtPct(mean(ctx.netFunnel.slice(1).map((x) => x.convFromPrev))) + ' (avg stage)',
        actual: fmtPct(s.convFromPrev),
        difference: s.dropOff + ' leads lost at this step',
        evidence: [
          { label: 'Entering stage', value: fmtNum(s.n) },
          { label: 'Progressing', value: fmtNum(s.count) },
          { label: 'Median time in stage', value: fmtDays(s.medianDays), note: 'p90 ' + fmtDays(s.p90Days) },
          { label: 'Lost from previous stage', value: fmtNum(s.lostHere) }
        ],
        explanation: 'Of ' + s.n + ' leads reaching ' + STAGE_LABEL[STAGES[i]] + ', ' + s.dropOff + ' did not progress. Median dwell time before progressing is ' + fmtDays(s.medianDays) + '.',
        impact: 'Recovering 10% of this drop-off is worth about ' + fmtINR(s.dropOff * 0.1 * ctx.kpi.avgDealValue * ctx.netMaturedConversion) + ' in delivered revenue.',
        cta: { label: 'Open funnel diagnostics', route: { screen: 'funnel' } }
      });
    }
  });

  const crit = ctx.aging.buckets[4];
  if (crit.count) {
    out.push({
      id: 'aging-30',
      type: 'Lead aging',
      severity: 'critical',
      title: crit.count + ' open leads have had no activity for 30+ days',
      metric: 'Idle open pipeline',
      expected: '0 leads idle 30+ days', actual: crit.count + ' leads · ' + fmtINR(crit.value),
      difference: fmtPct(div(crit.count, ctx.aging.openCount)) + ' of open pipeline by count',
      evidence: [
        { label: 'Idle 30+ days', value: crit.count + ' leads', note: fmtINR(crit.value) },
        { label: 'Idle 8+ days', value: ctx.aging.staleCount + ' leads', note: fmtINR(ctx.aging.staleValue) },
        { label: 'Total open pipeline', value: ctx.aging.openCount + ' leads', note: fmtINR(ctx.aging.openValue) },
        { label: 'Worst case', value: (ctx.actions.rows[0] ? ctx.actions.rows[0].idleDays + ' days idle' : '—'), note: ctx.actions.rows[0]?.customerName }
      ],
      explanation: 'These leads are counted in pipeline but have no recorded touch. ' + ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).length + ' of the stale set are already at Order Placed, meaning the revenue is committed and only fulfilment is missing.',
      impact: fmtINR(crit.value) + ' of pipeline is effectively unmanaged.',
      cta: { label: 'Open Action Center', route: { screen: 'actions', tier: 'critical' } }
    });
  }

  const t = ctx.trend;
  if (t.length >= 2) {
    const last = t[t.length - 1], prev = t[t.length - 2];
    if (prev.units && Math.abs(div(last.units - prev.units, prev.units)) >= 0.25) {
      const up = last.units > prev.units;
      out.push({
        id: 'trend-units',
        type: 'Delivery volume',
        severity: up ? 'opportunity' : 'risk',
        title: last.label + ' deliveries ' + (up ? 'rose' : 'fell') + ' ' + Math.abs(Math.round(div(last.units - prev.units, prev.units) * 100)) + '% versus ' + prev.label,
        metric: 'Units delivered', expected: prev.units + ' (' + prev.label + ')', actual: last.units + ' (' + last.label + ')',
        difference: fmtSigned(last.units - prev.units, (v) => v + ' units'),
        evidence: [
          { label: last.label + ' units', value: fmtNum(last.units), note: fmtINR(last.revenue) },
          { label: prev.label + ' units', value: fmtNum(prev.units), note: fmtINR(prev.revenue) },
          { label: 'Median order → delivery', value: fmtDays(last.medianDaysToDeliver), note: prev.label + ': ' + fmtDays(prev.medianDaysToDeliver) },
          { label: 'Delayed deliveries', value: last.delayed + ' of ' + last.units, note: fmtPct(last.delayRate, 0) }
        ],
        explanation: up
          ? 'The lift is fulfilment of orders already in the book: ' + (prev.ordersPlaced + last.ordersPlaced) + ' orders were placed across ' + prev.label + ' and ' + last.label + '. Median order-to-delivery is ' + fmtDays(last.medianDaysToDeliver) + (last.medianDaysToDeliver > prev.medianDaysToDeliver ? ', up from ' + fmtDays(prev.medianDaysToDeliver) + ' — throughput rose while the queue slowed.' : ' against ' + fmtDays(prev.medianDaysToDeliver) + ' in ' + prev.label + '.')
          : 'Fewer orders converted to delivery this month.',
        impact: fmtSigned(last.revenue - prev.revenue, fmtINR) + ' of delivered revenue month on month.',
        cta: { label: 'See monthly trend', route: { screen: 'overview', anchor: 'trend' } }
      });
    }
  }

  if (ctx.delivery.count >= 15 && ctx.delivery.delayRate >= 0.35) {
    const first = t.find((m) => m.units >= 5);
    out.push({
      id: 'delivery-delay',
      type: 'Delivery delay',
      severity: ctx.delivery.delayRate >= 0.45 ? 'risk' : 'watch',
      title: fmtPct(ctx.delivery.delayRate, 0) + ' of deliveries in this period carried a delay reason',
      metric: 'Delivery delay rate',
      expected: first ? fmtPct(first.delayRate, 0) + ' in ' + first.label : '—',
      actual: fmtPct(ctx.delivery.delayRate, 0),
      difference: ctx.delivery.delayedCount + ' of ' + ctx.delivery.count + ' deliveries',
      evidence: [
        { label: 'Median order → delivery', value: fmtDays(ctx.delivery.medianDays), note: 'p90 ' + fmtDays(ctx.delivery.p90Days) },
        ...ctx.delivery.reasons.slice(0, 3).map((r) => ({ label: r.reason, value: r.count + ' deliveries' }))
      ],
      explanation: 'Top recorded cause is “' + (ctx.delivery.reasons[0]?.reason || '—') + '” (' + (ctx.delivery.reasons[0]?.count || 0) + ' deliveries). Delay reasons are recorded per delivery, so this is observed, not inferred.',
      impact: 'Delivery slippage pushes revenue recognition into later months and raises cancellation risk on committed orders.',
      cta: { label: 'Review delivery operations', route: { screen: 'funnel', anchor: 'delivery' } }
    });
  }

  const srcs = ctx.sources.filter((s) => s.leads >= 25);
  if (srcs.length >= 2) {
    const best = srcs[0], worst = srcs[srcs.length - 1];
    if (best.conversion - worst.conversion >= 0.15) {
      out.push({
        id: 'source-quality',
        type: 'Source quality',
        severity: 'watch',
        title: worst.label + ' leads convert at a fraction of ' + best.label,
        metric: 'Conversion by lead source',
        expected: best.label + ' ' + fmtPct(best.conversion), actual: worst.label + ' ' + fmtPct(worst.conversion),
        difference: ((best.conversion / (worst.conversion || 0.0001))).toFixed(1) + '× gap',
        evidence: srcs.map((s) => ({ label: s.label, value: fmtPct(s.conversion), note: s.leads + ' leads · ' + fmtINR(s.revenue) })),
        explanation: 'Mix matters: ' + worst.label + ' contributes ' + worst.leads + ' leads but only ' + worst.delivered + ' deliveries. Contact rate on that source is ' + fmtPct(worst.contactRate, 0) + '.',
        impact: 'Rebalancing spend toward ' + best.label + '-like demand raises conversion without adding lead volume.',
        cta: { label: 'Compare sources', route: { screen: 'funnel', anchor: 'sources' } }
      });
    }
  }

  const allAtt = ctx.branchRows.map((b) => b.attainment);
  if (allAtt.length && Math.max(...allAtt) < 0.35) {
    out.push({
      id: 'target-calibration',
      type: 'Target pace',
      severity: 'watch',
      title: 'Monthly targets look mis-calibrated across every branch',
      metric: 'Target attainment',
      expected: '80–120% for a usable target', actual: fmtPct(Math.max(...allAtt), 0) + ' at the best branch',
      difference: 'All ' + allAtt.length + ' branches under ' + fmtPct(Math.max(...allAtt) + 0.02, 0),
      evidence: ctx.branchRows.map((b) => ({ label: b.name, value: fmtPct(b.attainment, 0), note: b.units + ' of ' + b.targetUnits + ' units' })),
      explanation: 'Targets sum to ' + fmtNum(sum(ctx.branchRows.map((b) => b.targetUnits))) + ' units against ' + fmtNum(sum(ctx.branchRows.map((b) => b.units))) + ' delivered network-wide. Read attainment as a relative rank, not an absolute score, until targets are re-based.',
      impact: 'Absolute attainment cannot be used for incentives or forecasting in its current state.',
      cta: { label: 'Compare branches', route: { screen: 'branches' } }
    });
  }

  const eligible = ctx.reps.filter((r) => r.leads >= 10);
  if (eligible.length >= 5) {
    const base = ctx.netMaturedConversion;
    eligible.forEach((r) => {
      const z = zProportion(r.delivered, r.leads, base || 0.0001);
      if (z <= -2.6) {
        out.push({
          id: 'rep-conv-' + r.id,
          type: 'Rep conversion',
          severity: 'risk',
          title: r.name + ' converts ' + fmtPct(r.conversion) + ' on ' + r.leads + ' leads',
          metric: 'Rep lead → delivery conversion',
          expected: fmtPct(base), actual: fmtPct(r.conversion),
          difference: fmtSigned(r.conversion - base, (v) => (v * 100).toFixed(1) + ' pts'),
          evidence: [
            { label: 'Leads handled', value: fmtNum(r.leads) },
            { label: 'Contact rate', value: fmtPct(r.contactRate, 0) },
            { label: 'Orders / delivered', value: r.orders + ' / ' + r.delivered },
            { label: 'Branch', value: r.branchName, note: 'rank ' + r.branchRank + ' of ' + r.branchRepCount }
          ],
          explanation: 'Contact rate is ' + fmtPct(r.contactRate, 0) + ' and ' + (r.leads - r.contacted) + ' assigned leads have no recorded contact event.',
          impact: 'At network conversion this book would have produced ~' + Math.round(r.leads * base) + ' deliveries instead of ' + r.delivered + '.',
          cta: { label: 'Open scorecard', route: { screen: 'rep', repId: r.id } }
        });
      }
    });
  }

  const order = { critical: 0, risk: 1, watch: 2, opportunity: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ---------- 6. recommendations ---------- */

export function buildRecommendations(ctx) {
  const recs = [];
  const staleOrders = ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= 30);
  if (staleOrders.length) {
    recs.push({
      id: 'rec-stale-orders', horizon: 'Today',
      problem: staleOrders.length + ' placed orders worth ' + fmtINR(sum(staleOrders.map((r) => r.dealValue))) + ' have been idle 30+ days',
      evidence: [
        { label: 'Orders idle 30+ days', value: staleOrders.length + '' },
        { label: 'Committed value', value: fmtINR(sum(staleOrders.map((r) => r.dealValue))) },
        { label: 'Longest idle', value: staleOrders[0] ? Math.max(...staleOrders.map((r) => r.idleDays)) + ' days' : '—' }
      ],
      impact: 'Revenue already won but not recognised; each is a cancellation risk.',
      action: 'Assign an owner per order, confirm allocation and delivery date, and log the touch today.',
      cta: { label: 'Work the queue', route: { screen: 'actions', tier: 'critical' } }
    });
  }
  const weak = ctx.branchRows.filter((b) => b.z <= -2).sort((a, b) => a.z - b.z)[0];
  if (weak) {
    const g = stageLeaks(weak.funnel, ctx.netFunnel)[0];
    recs.push({
      id: 'rec-weak-branch', horizon: 'This week',
      problem: weak.name + ' converts ' + fmtPct(weak.maturedConversion) + ' against a network ' + fmtPct(ctx.netMaturedConversion),
      evidence: [
        g ? { label: 'Biggest leak', value: g.label, note: fmtPct(g.conv) + ' vs network ' + fmtPct(g.net) + ' · ~' + Math.round(g.excessLoss) + ' extra leads lost' } : null,
        { label: 'Leads in period', value: fmtNum(weak.leads) },
        { label: 'Units delivered', value: fmtNum(weak.units), note: 'network rank ' + weak.convRank + ' of ' + ctx.branchRows.length },
        { label: 'Lost from first two stages', value: fmtNum(weak.funnel[0].count - weak.funnel[2].count) + ' leads' }
      ].filter(Boolean),
      impact: 'Closing the gap to network conversion is worth roughly ' +
        fmtINR((weak.leads * ctx.netMaturedConversion - weak.units) * ctx.kpi.avgDealValue) + ' of delivered revenue over this period.',
      action: g && g.fromStage === 'new'
        ? 'Fix first response at ' + weak.name + ': enforce a same-day contact SLA and re-route unworked new leads.'
        : 'Run a stage review at ' + weak.name + ' focused on ' + (g ? g.label : 'the funnel') + '.',
      cta: { label: 'Open ' + weak.name, route: { screen: 'branch', branchId: weak.id } }
    });
  }
  const worstStage = ctx.stageDurations.filter((s) => s.n >= 20).sort((a, b) => (b.medianDays || 0) - (a.medianDays || 0))[0];
  if (worstStage) {
    recs.push({
      id: 'rec-bottleneck', horizon: 'This month',
      problem: worstStage.label + ' takes a median of ' + fmtDays(worstStage.medianDays),
      evidence: [
        { label: 'Median days', value: fmtDays(worstStage.medianDays), note: 'p90 ' + fmtDays(worstStage.p90Days) },
        { label: 'Stage conversion', value: fmtPct(worstStage.conversion) },
        { label: 'Leads entering', value: fmtNum(worstStage.n) },
        { label: 'Not progressing', value: fmtNum(worstStage.dropOff) }
      ],
      impact: 'Every day removed here pulls revenue forward and reduces the window for competitors.',
      action: 'Set a target dwell time for ' + worstStage.label + ' and review deals that exceed p90 weekly.',
      cta: { label: 'Stage bottlenecks', route: { screen: 'funnel', anchor: 'bottlenecks' } }
    });
  }
  if (ctx.delivery.delayRate >= 0.3 && ctx.delivery.reasons.length) {
    recs.push({
      id: 'rec-delivery', horizon: 'This month',
      problem: fmtPct(ctx.delivery.delayRate, 0) + ' delivery delay rate, median order-to-delivery ' + fmtDays(ctx.delivery.medianDays),
      evidence: ctx.delivery.reasons.slice(0, 4).map((r) => ({ label: r.reason, value: r.count + ' deliveries' })),
      impact: 'Delayed deliveries defer ' + fmtINR(ctx.delivery.revenue * ctx.delivery.delayRate) + ' of recognised revenue in this period.',
      action: 'Attack the top recorded cause — “' + ctx.delivery.reasons[0].reason + '” — with a named owner and a weekly clearance target.',
      cta: { label: 'Delivery detail', route: { screen: 'funnel', anchor: 'delivery' } }
    });
  }
  const weakSrc = ctx.sources.filter((s) => s.leads >= 25).slice(-1)[0];
  const bestSrc = ctx.sources.filter((s) => s.leads >= 25)[0];
  if (weakSrc && bestSrc && bestSrc.conversion - weakSrc.conversion >= 0.15) {
    recs.push({
      id: 'rec-source', horizon: 'Next quarter',
      problem: weakSrc.label + ' converts ' + fmtPct(weakSrc.conversion) + ' versus ' + fmtPct(bestSrc.conversion) + ' for ' + bestSrc.label,
      evidence: [
        { label: weakSrc.label, value: fmtPct(weakSrc.conversion), note: weakSrc.leads + ' leads → ' + weakSrc.delivered + ' deliveries' },
        { label: bestSrc.label, value: fmtPct(bestSrc.conversion), note: bestSrc.leads + ' leads → ' + bestSrc.delivered + ' deliveries' },
        { label: 'Revenue difference', value: fmtINR(bestSrc.revenue - weakSrc.revenue) }
      ],
      impact: 'Lead mix is a lever that does not require more headcount.',
      action: 'Qualify ' + weakSrc.label + ' enquiries before assignment, and shift budget toward channels with ' + bestSrc.label + '-level intent.',
      cta: { label: 'Source comparison', route: { screen: 'funnel', anchor: 'sources' } }
    });
  }
  return recs;
}

/* ---------- 7. AI presentation: executive brief ---------- */

export function executiveBrief(ctx) {
  const t = ctx.trend, last = t[t.length - 1], prev = t[t.length - 2];
  const weak = ctx.branchRows.filter((b) => b.z <= -2).sort((a, b) => a.z - b.z)[0];
  const best = [...ctx.branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion)[0];
  const momentum = last && prev && prev.units ? div(last.units - prev.units, prev.units) : 0;

  const headline = (momentum >= 0.15
    ? last.label + ' delivery momentum is strong'
    : momentum <= -0.15 ? last.label + ' deliveries slipped' : 'Network delivery volume is steady')
    + (weak ? ', but ' + weak.name + ' remains the largest performance gap' : '')
    + (ctx.aging.staleValue > 0 ? ' and ' + fmtINR(ctx.aging.staleValue) + ' of pipeline has gone quiet.' : '.');

  const findings = [];
  if (last && prev) findings.push({
    tone: momentum >= 0 ? 'positive' : 'negative',
    text: last.label + ' delivered ' + last.units + ' units (' + fmtINR(last.revenue) + '), ' +
      (momentum >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(momentum * 100)) + '% on ' + prev.label +
      '. Median order-to-delivery moved to ' + fmtDays(last.medianDaysToDeliver) + ' and ' + last.delayed + ' of ' + last.units + ' deliveries carried a delay reason.',
    route: { screen: 'overview', anchor: 'trend' }
  });
  if (weak) {
    const wl = stageLeaks(weak.funnel, ctx.netFunnel)[0];
    findings.push({
      tone: 'negative',
      text: weak.name + ' converts ' + fmtPct(weak.maturedConversion) + ' of leads to delivery against a network ' +
        fmtPct(ctx.netMaturedConversion) + '.' + (wl ? ' The largest leak is ' + wl.label + ' at ' + fmtPct(wl.conv) +
        ' versus ' + fmtPct(wl.net) + ' network' + (wl.fromStage === 'new' ? ', so volume is lost before anyone sees a car.' : ', which caps every stage after it.') : ''),
      route: { screen: 'branch', branchId: weak.id }
    });
  }
  findings.push({
    tone: 'negative',
    text: ctx.aging.staleCount + ' open leads worth ' + fmtINR(ctx.aging.staleValue) + ' have had no activity for 8+ days, including ' +
      ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).length + ' already at Order Placed — revenue committed, delivery unmanaged.',
    route: { screen: 'actions', tier: 'critical' }
  });
  if (best && best.z >= 1) findings.push({
    tone: 'positive',
    text: best.name + ' leads the network at ' + fmtPct(best.maturedConversion) + ' conversion on ' + best.leads +
      ' leads. Its New → Contacted rate is ' + fmtPct(best.funnel[1].convFromPrev) + ' — the practice worth copying.',
    route: { screen: 'branch', branchId: best.id }
  });

  const topRec = ctx.recommendations[0];
  return {
    headline,
    findings: findings.slice(0, 3),
    action: topRec ? topRec.action : 'Review the prioritised action queue.',
    actionCta: topRec ? topRec.cta : { label: 'Open Action Center', route: { screen: 'actions' } },
    problemCta: weak ? { label: 'View problem', route: { screen: 'branch', branchId: weak.id } }
      : { label: 'View funnel', route: { screen: 'funnel' } }
  };
}

export function branchSummary(ctx, branchId) {
  const b = ctx.branchRows.find((x) => x.id === branchId);
  if (!b) return null;
  const reps = ctx.reps.filter((r) => r.branchId === branchId);
  const bestRep = [...reps].sort((x, y) => y.conversion - x.conversion)[0];
  const worstRep = [...reps].filter((r) => r.leads >= 8).sort((x, y) => x.conversion - y.conversion)[0];
  const leaks = stageLeaks(b.funnel, ctx.netFunnel);
  const worstStage = leaks[0] && leaks[0].excessLoss >= 3 && leaks[0].gap <= -0.05 ? leaks[0] : null;
  const bestStage = [...leaks].sort((a, c) => c.gap - a.gap)[0];
  const netDelay = ctx.delivery.delayRate;
  return {
    performance: b.name + ' delivered ' + b.units + ' units (' + fmtINR(b.revenue) + ') from ' + b.leads +
      ' leads, converting ' + fmtPct(b.maturedConversion) + ' — rank ' + b.convRank + ' of ' + ctx.branchRows.length +
      ' on conversion' + (bestStage && bestStage.gap > 0.03 ? '. Strongest step is ' + bestStage.label + ' at ' + fmtPct(bestStage.conv) + ' against a network ' + fmtPct(bestStage.net) + '.' : '.'),
    problem: worstStage
      ? worstStage.label + ' runs ' + fmtPct(worstStage.conv) + ' versus a network ' + fmtPct(worstStage.net) + ' — about ' + Math.round(worstStage.excessLoss) + ' leads lost beyond baseline, the branch\'s biggest leak.'
      : b.delayRate > netDelay + 0.1
        ? 'Delivery delay rate is ' + fmtPct(b.delayRate, 0) + ' against a network ' + fmtPct(netDelay, 0) + ', with a median order-to-delivery of ' + fmtDays(b.medianDaysToDeliver) + '.'
        : b.staleCount ? plural(b.staleCount, 'open lead') + ' worth ' + fmtINR(b.revenueAtRisk) + ' gone quiet for 8+ days.'
          : 'No stage is materially below the network baseline.',
    opportunity: bestRep
      ? bestRep.name + ' converts ' + fmtPct(bestRep.conversion) + ' on ' + bestRep.leads + ' leads' +
        (worstRep && worstRep.id !== bestRep.id ? ', while ' + worstRep.name + ' converts ' + fmtPct(worstRep.conversion) + ' on ' + worstRep.leads + '. Levelling the bottom half to branch average adds roughly ' + Math.max(1, Math.round((b.maturedConversion - worstRep.conversion) * worstRep.leads)) + (Math.max(1, Math.round((b.maturedConversion - worstRep.conversion) * worstRep.leads)) === 1 ? ' unit.' : ' units.') : '.')
      : 'No rep-level data in this period.',
    action: b.staleCount
      ? 'Clear the ' + b.staleCount + ' stale leads (' + fmtINR(b.revenueAtRisk) + ') this week, starting with the highest-value orders.'
      : 'Hold the current process and monitor ' + (worstStage ? worstStage.label : 'the funnel') + '.',
    ctas: [
      { label: 'Stale leads at this branch', route: { screen: 'actions', branchId } },
      { label: 'Branch funnel vs network', route: { screen: 'funnel', branchId } }
    ]
  };
}

export function repSummary(ctx, repId) {
  const r = ctx.reps.find((x) => x.id === repId);
  if (!r) return null;
  const branch = ctx.branchRows.find((b) => b.id === r.branchId);
  const leads = ctx.allScoped.filter((l) => l.repId === repId);
  const f = funnel(leads);
  const notPastContacted = leads.filter((l) => l.reached('contacted') && !l.reached('test_drive')).length;
  const neverContacted = leads.filter((l) => !l.reached('contacted')).length;
  const gap = r.conversion - (branch ? branch.maturedConversion : 0);
  const stageGaps = f.slice(1).map((s, i) => ({
    label: STAGE_LABEL[STAGES[i]] + ' → ' + s.label, conv: s.convFromPrev,
    branch: branch ? branch.funnel[i + 1].convFromPrev : 0, n: s.n
  })).filter((s) => s.n >= 5);
  const worst = [...stageGaps].sort((a, b) => (a.conv - a.branch) - (b.conv - b.branch))[0];
  const strongest = [...stageGaps].sort((a, b) => (b.conv - b.branch) - (a.conv - a.branch))[0];
  const parts = [];
  parts.push('Conversion is ' + fmtPct(r.conversion) + ', ' +
    (gap >= 0.02 ? 'above' : gap <= -0.02 ? 'below' : 'in line with') + ' the ' + fmtPct(branch ? branch.maturedConversion : 0) + ' branch average');
  if (worst && worst.conv < worst.branch - 0.05) parts.push('the widest gap is at ' + worst.label + ' (' + fmtPct(worst.conv) + ' vs branch ' + fmtPct(worst.branch) + ')');
  if (neverContacted) parts.push(neverContacted + ' of ' + leads.length + ' assigned leads have no recorded contact event');
  else if (notPastContacted) parts.push(notPastContacted + ' leads stopped at Contacted');
  return {
    headline: parts.join('; ') + '.',
    strength: strongest && strongest.conv > strongest.branch
      ? strongest.label + ' at ' + fmtPct(strongest.conv) + ' beats the branch (' + fmtPct(strongest.branch) + ').'
      : (r.delivered ? plural(r.delivered, 'delivery', 'deliveries') + ' worth ' + fmtINR(r.revenue) + ' in this period.' : 'No deliveries in this period.'),
    risk: r.staleCount ? plural(r.staleCount, 'open lead') + ' worth ' + fmtINR(r.staleValue) + ' with no activity for 8+ days.' : 'No stale leads in this book — nothing to chase.',
    action: r.staleCount ? 'Work the ' + plural(r.staleCount, 'stale lead') + ' first — highest value first.'
      : neverContacted ? 'Contact the ' + neverContacted + ' untouched leads within 24 hours.'
        : 'Maintain cadence; no structural gap detected.'
  };
}

/* ---------- 8. "Why?" explanations ---------- */

export function whyExplanation(ctx, key) {
  const K = ctx.kpi, t = ctx.trend, last = t[t.length - 1], prev = t[t.length - 2];
  const weak = ctx.branchRows.filter((b) => b.z <= -2).sort((a, b) => a.z - b.z)[0];
  const worstFunnel = ctx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));
  const wi = ctx.netFunnel.indexOf(worstFunnel);
  const map = {
    units: () => ({
      title: 'Why did units move?',
      points: [
        last && prev ? { text: last.label + ': ' + last.units + ' units vs ' + prev.units + ' in ' + prev.label, value: fmtSigned(last.units - prev.units, (v) => v + ' units') } : null,
        { text: 'Units are counted on delivery date, so this month reflects orders placed a median ' + fmtDays(ctx.delivery.medianDays) + ' earlier', value: fmtDays(ctx.delivery.medianDays) },
        { text: 'Open orders awaiting delivery', value: ctx.openLeads.filter((l) => l.status === 'order_placed').length + ' leads' }
      ].filter(Boolean),
      cta: { label: 'See monthly trend', route: { screen: 'overview', anchor: 'trend' } }
    }),
    revenue: () => ({
      title: 'Why is revenue at this level?',
      points: [
        { text: 'Delivered units in period', value: fmtNum(K.units) },
        { text: 'Average delivered deal value', value: fmtINR(div(K.revenue, K.units)) },
        { text: 'Best contributing branch', value: [...ctx.branchRows].sort((a, b) => b.revenue - a.revenue)[0]?.name + ' · ' + fmtINR([...ctx.branchRows].sort((a, b) => b.revenue - a.revenue)[0]?.revenue || 0) },
        { text: 'Revenue is recognised on delivery, so delayed deliveries shift it later', value: fmtPct(ctx.delivery.delayRate, 0) + ' delayed' }
      ],
      cta: { label: 'Branch contribution', route: { screen: 'branches' } }
    }),
    conversion: () => ({
      title: 'Why is conversion where it is?',
      points: [
        { text: 'Largest network leak: ' + STAGE_LABEL[STAGES[wi - 1]] + ' → ' + worstFunnel.label + ' · ' + worstFunnel.dropOff + ' leads lost', value: fmtPct(worstFunnel.convFromPrev) },
        weak ? { text: weak.name + ' drags the network average down', value: fmtPct(weak.maturedConversion) + ' vs ' + fmtPct(ctx.netMaturedConversion) } : null,
        { text: 'Leads too young to have closed are excluded from this rate', value: K.conversionExcluded + ' of ' + (K.conversionN + K.conversionExcluded) },
        { text: 'Stale open leads still in the funnel', value: ctx.aging.staleCount + ' leads · ' + fmtINR(ctx.aging.staleValue) }
      ].filter(Boolean),
      cta: { label: 'Funnel diagnostics', route: { screen: 'funnel' } }
    }),
    risk: () => ({
      title: 'Why is this revenue at risk?',
      points: [
        { text: 'Open leads with no activity for 8+ days', value: ctx.aging.staleCount + ' leads' },
        { text: 'Of those, already at Order Placed', value: ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).length + ' leads · ' + fmtINR(sum(ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).map((r) => r.dealValue))) },
        { text: 'Idle 30+ days', value: ctx.aging.buckets[4].count + ' leads · ' + fmtINR(ctx.aging.buckets[4].value) },
        { text: 'Share of open pipeline value at risk', value: fmtPct(div(ctx.aging.staleValue, ctx.aging.openValue), 0) }
      ],
      cta: { label: 'Open Action Center', route: { screen: 'actions', tier: 'critical' } }
    }),
    attainment: () => ({
      title: 'Why is target attainment so low?',
      points: [
        { text: 'Targets in period', value: fmtNum(ctx.targets.targetUnits) + ' units' },
        { text: 'Delivered', value: fmtNum(ctx.targets.units) + ' units' },
        { text: 'Every branch sits far below 100%, which points at target calibration rather than performance', value: 'max ' + fmtPct(Math.max(...ctx.branchRows.map((b) => b.attainment)), 0) },
        { text: 'Use relative rank and month-on-month pace instead', value: ctx.targets.paceMonth ? MONTH_LABEL(ctx.targets.paceMonth) + ' pace ' + fmtPct(ctx.targets.pace, 0) : '—' }
      ],
      cta: { label: 'Compare branches', route: { screen: 'branches' } }
    }),
    delay: () => ({
      title: 'Why are deliveries late?',
      points: [
        { text: 'Deliveries with a recorded delay reason', value: ctx.delivery.delayedCount + ' of ' + ctx.delivery.count },
        ...ctx.delivery.reasons.slice(0, 3).map((r) => ({ text: r.reason, value: r.count + ' deliveries' })),
        { text: 'Median order → delivery', value: fmtDays(ctx.delivery.medianDays) + ' (p90 ' + fmtDays(ctx.delivery.p90Days) + ')' }
      ],
      cta: { label: 'Delivery operations', route: { screen: 'funnel', anchor: 'delivery' } }
    }),
    pipeline: () => ({
      title: 'What is in open pipeline?',
      points: [
        { text: 'Open leads', value: ctx.aging.openCount + ' · ' + fmtINR(ctx.aging.openValue) },
        ...ctx.aging.buckets.map((b) => ({ text: 'Idle ' + b.label, value: b.count + ' · ' + fmtINR(b.value) }))
      ],
      cta: { label: 'Prioritised queue', route: { screen: 'actions' } }
    })
  };
  return (map[key] || map.conversion)();
}

/* ---------- 9. Ask DealerPulse: deterministic question router ---------- */

const NO_ANSWER = {
  interpretation: 'Unrecognised question',
  answer: "I don't have enough data to answer that.",
  evidence: [],
  suggestions: true
};

export const SAMPLE_QUESTIONS = [
  'Why is Lakeside underperforming?',
  'Which branch has the highest conversion?',
  'Which leads should we call today?',
  'How much revenue is at risk?',
  'Which sales rep is performing best?',
  "What caused December's improvement?",
  'What are the biggest delivery delays?',
  'Which lead source converts best?',
  'Where is the biggest bottleneck?'
];

function findBranch(ctx, q) {
  return ctx.branchRows.find((b) =>
    q.includes(b.name.toLowerCase()) ||
    q.includes(b.name.toLowerCase().replace(' toyota', '')) ||
    q.includes(b.city.toLowerCase()));
}
function findRep(ctx, q) {
  return ctx.reps.find((r) => {
    const n = r.name.toLowerCase();
    return q.includes(n) || q.includes(n.split(' ')[0]) && n.split(' ')[0].length > 4;
  });
}

export function askDealerPulse(ctx, question) {
  const q = (question || '').toLowerCase().trim();
  if (!q) return NO_ANSWER;
  const has = (...w) => w.some((x) => q.includes(x));
  const branch = findBranch(ctx, q);
  const rep = findRep(ctx, q);

  // branch diagnosis
  if (branch && has('why', 'underperform', 'problem', 'wrong', 'struggl', 'bad')) {
    const gaps = stageLeaks(branch.funnel, ctx.netFunnel, 5);
    const worst = gaps[0];
    const below = branch.maturedConversion < ctx.netMaturedConversion;
    return {
      interpretation: 'Diagnose ' + branch.name + ' conversion against the network baseline',
      answer: branch.name + ' converts ' + fmtPct(branch.maturedConversion) + ' of leads to delivery versus ' +
        fmtPct(ctx.netMaturedConversion) + ' across the network' +
        (below && worst ? '. The largest leak is ' + worst.label + ', running ' + fmtPct(worst.conv) + ' against a network ' + fmtPct(worst.net) + ' — about ' + Math.round(worst.excessLoss) + ' more leads lost there than baseline predicts' + (worst.fromStage === 'new' ? ', before anyone reaches a showroom.' : ', capping every stage downstream.') : '.'),
      evidence: [
        ...[...gaps].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)).map((g) => ({ label: g.label, value: fmtPct(g.conv), baseline: 'network ' + fmtPct(g.net), bad: g.gap < -0.08 })),
        { label: 'Units delivered', value: fmtNum(branch.units), baseline: 'rank ' + branch.convRank + ' of ' + ctx.branchRows.length },
        { label: 'Revenue at risk', value: fmtINR(branch.revenueAtRisk), baseline: branch.staleCount + ' stale leads' }
      ],
      cta: { label: 'View ' + branch.name + ' funnel', route: { screen: 'funnel', branchId: branch.id } }
    };
  }
  if (branch) {
    return {
      interpretation: branch.name + ' performance snapshot',
      answer: branch.name + ' (' + branch.city + ') delivered ' + branch.units + ' units worth ' + fmtINR(branch.revenue) +
        ' from ' + branch.leads + ' leads, converting ' + fmtPct(branch.maturedConversion) + ' — rank ' + branch.convRank + ' of ' + ctx.branchRows.length + '.',
      evidence: [
        { label: 'Conversion', value: fmtPct(branch.maturedConversion), baseline: 'network ' + fmtPct(ctx.netMaturedConversion) },
        { label: 'Units / revenue', value: branch.units + ' · ' + fmtINR(branch.revenue) },
        { label: 'Open pipeline', value: fmtINR(branch.pipelineValue), baseline: branch.openCount + ' leads' },
        { label: 'Delivery delay rate', value: fmtPct(branch.delayRate, 0), baseline: 'network ' + fmtPct(ctx.delivery.delayRate, 0) }
      ],
      cta: { label: 'Open ' + branch.name, route: { screen: 'branch', branchId: branch.id } }
    };
  }
  // best / worst branch
  if (has('branch') && has('highest', 'best', 'top', 'lowest', 'worst')) {
    const asc = has('lowest', 'worst');
    const sorted = [...ctx.branchRows].sort((a, b) => (asc ? a.maturedConversion - b.maturedConversion : b.maturedConversion - a.maturedConversion));
    const b = sorted[0];
    return {
      interpretation: 'Rank branches by lead → delivery conversion',
      answer: b.name + ' has the ' + (asc ? 'lowest' : 'highest') + ' conversion at ' + fmtPct(b.maturedConversion) +
        ', against a network average of ' + fmtPct(ctx.netMaturedConversion) + '.',
      evidence: sorted.map((x) => ({ label: x.name, value: fmtPct(x.maturedConversion), baseline: x.units + ' units · ' + fmtINR(x.revenue), bad: x.z <= -2 })),
      cta: { label: 'Open ' + b.name, route: { screen: 'branch', branchId: b.id } }
    };
  }
  // leads to call
  if (has('call', 'chase', 'follow up', 'work today', 'which leads', 'priorit')) {
    const top = ctx.actions.rows.slice(0, 5);
    return {
      interpretation: 'Rank open leads by priority score (value × idle time × stage × risk)',
      answer: 'Start with ' + ctx.actions.critical.length + ' critical leads worth ' + fmtINR(ctx.actions.criticalValue) +
        '. The single highest-priority lead is ' + (top[0] ? top[0].customerName + ' at ' + top[0].branchName + ' — ' + fmtINR(top[0].dealValue) + ' at ' + STAGE_LABEL[top[0].status] + ', idle ' + top[0].idleDays + ' days.' : 'none.'),
      evidence: top.map((l) => ({ label: l.customerName + ' · ' + l.branchName, value: fmtINR(l.dealValue), baseline: STAGE_LABEL[l.status] + ' · idle ' + l.idleDays + 'd · P' + l.score })),
      cta: { label: 'Open Action Center', route: { screen: 'actions', tier: 'critical' } }
    };
  }
  // revenue at risk
  if (has('at risk', 'risk') && has('revenue', 'much', 'money', 'value')) {
    return {
      interpretation: 'Sum deal value of open leads with no activity for 8+ days',
      answer: fmtINR(ctx.aging.staleValue) + ' across ' + ctx.aging.staleCount + ' open leads has had no recorded activity for 8+ days — ' +
        fmtPct(div(ctx.aging.staleValue, ctx.aging.openValue), 0) + ' of total open pipeline value.',
      evidence: [
        ...ctx.aging.buckets.slice(2).map((b) => ({ label: 'Idle ' + b.label, value: fmtINR(b.value), baseline: b.count + ' leads', bad: b.key === '30+' })),
        { label: 'Total open pipeline', value: fmtINR(ctx.aging.openValue), baseline: ctx.aging.openCount + ' leads' }
      ],
      cta: { label: 'Work the queue', route: { screen: 'actions', tier: 'critical' } }
    };
  }
  // rep
  if (rep) {
    const s = repSummary(ctx, rep.id);
    return {
      interpretation: rep.name + ' scorecard summary',
      answer: rep.name + ' (' + rep.branchName + ') handled ' + rep.leads + ' leads, delivered ' + rep.delivered +
        ' and converts ' + fmtPct(rep.conversion) + '. ' + (s ? s.headline : ''),
      evidence: [
        { label: 'Conversion', value: fmtPct(rep.conversion), baseline: 'network ' + fmtPct(ctx.netMaturedConversion) },
        { label: 'Contact rate', value: fmtPct(rep.contactRate, 0) },
        { label: 'Orders / delivered', value: rep.orders + ' / ' + rep.delivered },
        { label: 'Stale leads', value: rep.staleCount + '', baseline: fmtINR(rep.staleValue) }
      ],
      cta: { label: 'Open scorecard', route: { screen: 'rep', repId: rep.id } }
    };
  }
  if (has('rep', 'sales person', 'salesperson', 'officer', 'performer')) {
    const asc = has('worst', 'lowest', 'poor');
    const pool = ctx.reps.filter((r) => r.leads >= 10);
    const sorted = [...pool].sort((a, b) => (asc ? a.conversion - b.conversion : b.conversion - a.conversion));
    const r = sorted[0];
    if (!r) return NO_ANSWER;
    return {
      interpretation: 'Rank reps with 10+ leads by conversion',
      answer: r.name + ' at ' + r.branchName + ' is the ' + (asc ? 'weakest' : 'strongest') + ' performer, converting ' +
        fmtPct(r.conversion) + ' of ' + r.leads + ' leads into ' + r.delivered + ' deliveries (' + fmtINR(r.revenue) + ').',
      evidence: sorted.slice(0, 5).map((x) => ({ label: x.name + ' · ' + x.branchName, value: fmtPct(x.conversion), baseline: x.leads + ' leads → ' + x.delivered + ' delivered' })),
      cta: { label: 'Open scorecard', route: { screen: 'rep', repId: r.id } }
    };
  }
  // december / month improvement
  if (has('december', 'improve', 'momentum', 'last month', 'caused')) {
    const t = ctx.trend, last = t[t.length - 1], prev = t[t.length - 2];
    if (!last || !prev) return NO_ANSWER;
    return {
      interpretation: 'Compare ' + last.label + ' delivery throughput with ' + prev.label,
      answer: last.label + ' delivered ' + last.units + ' units (' + fmtINR(last.revenue) + ') against ' + prev.units +
        ' in ' + prev.label + ' — ' + fmtSigned(Math.round(div(last.units - prev.units, prev.units) * 100), (v) => v + '%') +
        '. It is fulfilment of orders already in the book rather than new demand: new leads created moved ' +
        prev.leadsCreated + ' → ' + last.leadsCreated + ', while orders placed across the two prior months (' +
        (t[t.length - 3] ? t[t.length - 3].ordersPlaced + ' + ' : '') + prev.ordersPlaced +
        ') fed the delivery queue. Delay rate moved ' + fmtPct(prev.delayRate, 0) + ' → ' + fmtPct(last.delayRate, 0) +
        '.',
      evidence: [
        { label: last.label + ' units', value: fmtNum(last.units), baseline: prev.label + ': ' + prev.units },
        { label: last.label + ' revenue', value: fmtINR(last.revenue), baseline: prev.label + ': ' + fmtINR(prev.revenue) },
        { label: 'New leads created', value: fmtNum(last.leadsCreated), baseline: prev.label + ': ' + prev.leadsCreated },
        { label: 'Orders placed', value: fmtNum(last.ordersPlaced), baseline: prev.label + ': ' + prev.ordersPlaced },
        { label: 'Delayed deliveries', value: last.delayed + ' of ' + last.units, baseline: fmtPct(last.delayRate, 0) + ' — up from ' + fmtPct(prev.delayRate, 0), bad: last.delayRate > prev.delayRate }
      ],
      cta: { label: 'See monthly trend', route: { screen: 'overview', anchor: 'trend' } }
    };
  }
  // delivery delays
  if (has('deliver', 'delay', 'late')) {
    return {
      interpretation: 'Aggregate recorded delivery delay reasons and order-to-delivery time',
      answer: ctx.delivery.delayedCount + ' of ' + ctx.delivery.count + ' deliveries (' + fmtPct(ctx.delivery.delayRate, 0) +
        ') carry a recorded delay reason. The largest single cause is “' + (ctx.delivery.reasons[0]?.reason || '—') +
        '” with ' + (ctx.delivery.reasons[0]?.count || 0) + ' deliveries. Median order-to-delivery is ' + fmtDays(ctx.delivery.medianDays) + '.',
      evidence: [
        ...ctx.delivery.reasons.map((r) => ({ label: r.reason, value: r.count + ' deliveries', baseline: fmtPct(div(r.count, ctx.delivery.count), 0) + ' of all' })),
        { label: 'Median / p90 order → delivery', value: fmtDays(ctx.delivery.medianDays) + ' / ' + fmtDays(ctx.delivery.p90Days) }
      ],
      cta: { label: 'Delivery operations', route: { screen: 'funnel', anchor: 'delivery' } }
    };
  }
  // sources
  if (has('source', 'channel', 'walk', 'website', 'referral', 'social')) {
    const s = ctx.sources;
    return {
      interpretation: 'Compare lead → delivery conversion by source',
      answer: s[0].label + ' converts best at ' + fmtPct(s[0].conversion) + ' (' + s[0].leads + ' leads → ' + s[0].delivered +
        ' deliveries), while ' + s[s.length - 1].label + ' converts ' + fmtPct(s[s.length - 1].conversion) + '.',
      evidence: s.map((x) => ({ label: x.label, value: fmtPct(x.conversion), baseline: x.leads + ' leads · ' + fmtINR(x.revenue), bad: x.conversion < ctx.netMaturedConversion * 0.6 })),
      cta: { label: 'Source comparison', route: { screen: 'funnel', anchor: 'sources' } }
    };
  }
  // bottleneck
  if (has('bottleneck', 'slow', 'stuck', 'stage', 'funnel', 'leak', 'drop')) {
    const byTime = [...ctx.stageDurations].filter((s) => s.n >= 15).sort((a, b) => (b.medianDays || 0) - (a.medianDays || 0))[0];
    const byConv = [...ctx.stageDurations].filter((s) => s.n >= 15).sort((a, b) => a.conversion - b.conversion)[0];
    return {
      interpretation: 'Rank funnel stages by median duration and conversion',
      answer: byTime.label + ' is the slowest step at a median ' + fmtDays(byTime.medianDays) + ' (p90 ' + fmtDays(byTime.p90Days) +
        '), while the biggest volume leak is ' + byConv.label + ' at ' + fmtPct(byConv.conversion) + ' conversion — ' + byConv.dropOff + ' leads lost.',
      evidence: ctx.stageDurations.map((s) => ({ label: s.label, value: fmtPct(s.conversion), baseline: 'median ' + fmtDays(s.medianDays) + ' · ' + s.dropOff + ' lost' })),
      cta: { label: 'Funnel diagnostics', route: { screen: 'funnel', anchor: 'bottlenecks' } }
    };
  }
  // conversion / revenue / units headline
  if (has('conversion', 'convert')) {
    return {
      interpretation: 'Network lead → delivery conversion for the selected period',
      answer: 'The network converts ' + fmtPct(ctx.kpi.conversion) + ' of leads to delivery (' + ctx.kpi.conversionN +
        ' matured leads; ' + ctx.kpi.conversionExcluded + ' too recent to judge).',
      evidence: ctx.branchRows.map((b) => ({ label: b.name, value: fmtPct(b.maturedConversion), baseline: b.leads + ' leads', bad: b.z <= -2 })),
      cta: { label: 'Funnel diagnostics', route: { screen: 'funnel' } }
    };
  }
  if (has('revenue', 'sales', 'units', 'delivered', 'how many')) {
    return {
      interpretation: 'Delivered units and revenue for the selected period',
      answer: ctx.kpi.units + ' units delivered worth ' + fmtINR(ctx.kpi.revenue) + ' in ' + ctx.range.label.toLowerCase() + '.',
      evidence: [...ctx.branchRows].sort((a, b) => b.revenue - a.revenue).map((b) => ({ label: b.name, value: fmtINR(b.revenue), baseline: b.units + ' units' })),
      cta: { label: 'Branch performance', route: { screen: 'branches' } }
    };
  }
  if (has('target', 'attainment', 'quota')) {
    return {
      interpretation: 'Target attainment with calibration context',
      answer: 'The network delivered ' + ctx.targets.units + ' units against a target of ' + ctx.targets.targetUnits +
        ' (' + fmtPct(ctx.targets.attainment, 0) + '). Every branch is far below 100%, so attainment should be read as a relative rank rather than an absolute score.',
      evidence: [...ctx.branchRows].sort((a, b) => b.attainment - a.attainment).map((b) => ({ label: b.name, value: fmtPct(b.attainment, 0), baseline: b.units + ' units, gap ' + b.gapUnits })),
      cta: { label: 'Compare branches', route: { screen: 'branches' } }
    };
  }
  if (has('stale', 'idle', 'inactive', 'aging')) {
    return {
      interpretation: 'Count open leads by days since last activity',
      answer: ctx.aging.staleCount + ' open leads worth ' + fmtINR(ctx.aging.staleValue) + ' have been inactive for 8+ days, of which ' +
        ctx.aging.buckets[4].count + ' have been quiet for over 30 days.',
      evidence: ctx.aging.buckets.map((b) => ({ label: 'Idle ' + b.label, value: b.count + ' leads', baseline: fmtINR(b.value), bad: b.tone === 'crit' })),
      cta: { label: 'Open Action Center', route: { screen: 'actions' } }
    };
  }
  if (has('lost', 'lose', 'why do we lose')) {
    const l = ctx.lost;
    return {
      interpretation: 'Aggregate recorded lost reasons',
      answer: l.total + ' leads worth ' + fmtINR(l.value) + ' were marked lost. The most common recorded reason is “' +
        l.rows[0].reason + '” (' + l.rows[0].count + ' leads).',
      evidence: l.rows.slice(0, 6).map((r) => ({ label: r.reason, value: r.count + ' leads', baseline: fmtINR(r.value) })),
      cta: { label: 'Lost reason analysis', route: { screen: 'branches' } }
    };
  }
  return NO_ANSWER;
}

/* ---------- 10. CSV export ---------- */
export function actionsCsv(rows) {
  const head = ['Lead ID', 'Customer', 'Model', 'Branch', 'Rep', 'Stage', 'Deal Value (INR)', 'Days Idle', 'Priority', 'Tier', 'Reason', 'Suggested Action'];
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return [head.join(','), ...rows.map((r) => [
    r.id, r.customerName, r.model, r.branchName, r.repName, STAGE_LABEL[r.status],
    r.dealValue, r.idleDays, r.score, r.tier, r.reason, r.suggestedAction
  ].map(esc).join(','))].join('\n');
}
