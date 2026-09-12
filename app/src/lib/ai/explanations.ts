import { MONTH_LABEL, STAGE_LABEL, STALE_DAYS, div, sum } from '../domain/model';
import { fmtDays, fmtINR, fmtPct, fmtSigned, plural } from '../format';
import type { Lead, Route } from '../domain/types';
import { funnel, stageLeaks } from '../analytics/funnel';
import { largestFunnelDeviation } from '../analytics/deviation';
import type { Context } from '../analytics/context';
import { type PriorityRefs, priorityScore } from '../insights/priority';

export interface WhyPoint {
  text: string;
  value: string;
}

export interface WhyExplanation {
  title: string;
  points: WhyPoint[];
  cta: { label: string; route: Route };
}

export function whyExplanation(ctx: Context, key: string): WhyExplanation {
  const K = ctx.kpi, t = ctx.trend, last = t[t.length - 1], prev = t[t.length - 2];
  const weak = ctx.branchRows.filter((b) => b.z <= -2).sort((a, b) => a.z - b.z)[0];
  const worstFunnel = ctx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));
  const wi = ctx.netFunnel.indexOf(worstFunnel);
  const map: Record<string, () => WhyExplanation> = {
    units: () => ({
      title: 'Why did units move?',
      points: [
        last && prev ? { text: last.label + ': ' + last.units + ' units vs ' + prev.units + ' in ' + prev.label, value: fmtSigned(last.units - prev.units, (v) => v + ' units') } : null,
        { text: 'Units are counted on delivery date, so this month reflects orders placed a median ' + fmtDays(ctx.delivery.medianDays) + ' earlier', value: fmtDays(ctx.delivery.medianDays) },
        { text: 'Open orders awaiting delivery', value: ctx.openLeads.filter((l) => l.status === 'order_placed').length + ' leads' },
      ].filter((x): x is WhyPoint => !!x),
      cta: { label: 'See monthly trend', route: { screen: 'overview', anchor: 'trend' } },
    }),
    revenue: () => ({
      title: 'Why is revenue at this level?',
      points: [
        { text: 'Delivered units in period', value: K.units + '' },
        { text: 'Average delivered deal value', value: fmtINR(div(K.revenue, K.units)) },
        { text: 'Best contributing branch', value: [...ctx.branchRows].sort((a, b) => b.revenue - a.revenue)[0]?.name + ' · ' + fmtINR([...ctx.branchRows].sort((a, b) => b.revenue - a.revenue)[0]?.revenue || 0) },
        { text: 'Revenue is recognised on delivery, so delayed deliveries shift it later', value: fmtPct(ctx.delivery.delayRate, 0) + ' delayed' },
      ],
      cta: { label: 'Branch contribution', route: { screen: 'branches' } },
    }),
    conversion: () => ({
      title: 'Why is conversion where it is?',
      points: [
        { text: 'Largest network leak: ' + ctx.netFunnel[wi - 1].label + ' → ' + worstFunnel.label + ' · ' + worstFunnel.dropOff + ' leads lost', value: fmtPct(worstFunnel.convFromPrev) },
        weak ? { text: weak.name + ' drags the network average down', value: fmtPct(weak.maturedConversion) + ' vs ' + fmtPct(ctx.netMaturedConversion) } : null,
        { text: 'Leads too young to have closed are excluded from this rate', value: K.conversionExcluded + ' of ' + (K.conversionN + K.conversionExcluded) },
        { text: 'Stale open leads still in the funnel', value: ctx.aging.staleCount + ' leads · ' + fmtINR(ctx.aging.staleValue) },
      ].filter((x): x is WhyPoint => !!x),
      cta: { label: 'Funnel diagnostics', route: { screen: 'funnel' } },
    }),
    risk: () => ({
      title: 'Why is this revenue at risk?',
      points: [
        { text: 'Open leads with no activity for 8+ days', value: ctx.aging.staleCount + ' leads' },
        { text: 'Of those, already at Order Placed', value: ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).length + ' leads · ' + fmtINR(sum(ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).map((r) => r.dealValue))) },
        { text: 'Idle 30+ days', value: ctx.aging.buckets[4].count + ' leads · ' + fmtINR(ctx.aging.buckets[4].value) },
        { text: 'Share of open pipeline value at risk', value: fmtPct(div(ctx.aging.staleValue, ctx.aging.openValue), 0) },
      ],
      cta: { label: 'Open Action Center', route: { screen: 'actions', tier: 'critical' } },
    }),
    attainment: () => ({
      title: 'Why is target attainment so low?',
      points: [
        { text: 'Targets in period', value: ctx.targets.targetUnits + ' units' },
        { text: 'Delivered', value: ctx.targets.units + ' units' },
        { text: 'Every branch sits far below 100%, which points at target calibration rather than performance', value: 'max ' + fmtPct(Math.max(...ctx.branchRows.map((b) => b.attainment)), 0) },
        { text: 'Use relative rank and month-on-month pace instead', value: ctx.targets.paceMonth ? MONTH_LABEL(ctx.targets.paceMonth) + ' pace ' + fmtPct(ctx.targets.pace, 0) : '—' },
      ],
      cta: { label: 'Compare branches', route: { screen: 'branches' } },
    }),
    delay: () => ({
      title: 'Why are deliveries late?',
      points: [
        { text: 'Deliveries with a recorded delay reason', value: ctx.delivery.delayedCount + ' of ' + ctx.delivery.count },
        ...ctx.delivery.reasons.slice(0, 3).map((r) => ({ text: r.reason, value: r.count + ' deliveries' })),
        { text: 'Median order → delivery', value: fmtDays(ctx.delivery.medianDays) + ' (p90 ' + fmtDays(ctx.delivery.p90Days) + ')' },
      ],
      cta: { label: 'Delivery operations', route: { screen: 'funnel', anchor: 'delivery' } },
    }),
    pipeline: () => ({
      title: 'What is in open pipeline?',
      points: [
        { text: 'Open leads', value: ctx.aging.openCount + ' · ' + fmtINR(ctx.aging.openValue) },
        ...ctx.aging.buckets.map((b) => ({ text: 'Idle ' + b.label, value: b.count + ' · ' + fmtINR(b.value) })),
      ],
      cta: { label: 'Prioritised queue', route: { screen: 'actions' } },
    }),
  };
  return (map[key] || map.conversion)();
}

export interface BranchSummary {
  performance: string;
  problem: string;
  opportunity: string;
  action: string;
  ctas: { label: string; route: Route }[];
}

export function branchSummary(ctx: Context, branchId: string): BranchSummary | null {
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
      { label: 'Branch funnel vs network', route: { screen: 'funnel', branchId } },
    ],
  };
}

export interface RepSummary {
  headline: string;
  strength: string;
  risk: string;
  action: string;
}

export function repSummary(ctx: Context, repId: string): RepSummary | null {
  const r = ctx.reps.find((x) => x.id === repId);
  if (!r) return null;
  const branch = ctx.branchRows.find((b) => b.id === r.branchId);
  const leads = ctx.allScoped.filter((l) => l.repId === repId);
  const f = funnel(leads);
  const notPastContacted = leads.filter((l) => l.reached('contacted') && !l.reached('test_drive')).length;
  const neverContacted = leads.filter((l) => !l.reached('contacted')).length;
  const gap = r.conversion - (branch ? branch.maturedConversion : 0);
  const stageGaps = f.slice(1).map((s, i) => ({
    label: f[i].label + ' → ' + s.label, conv: s.convFromPrev,
    branch: branch ? branch.funnel[i + 1].convFromPrev : 0, n: s.n,
  })).filter((s) => s.n >= 5);
  const worst = [...stageGaps].sort((a, b) => (a.conv - a.branch) - (b.conv - b.branch))[0];
  const strongest = [...stageGaps].sort((a, b) => (b.conv - b.branch) - (a.conv - a.branch))[0];
  const parts: string[] = [];
  parts.push('Conversion is ' + fmtPct(r.conversion) + ', ' +
    (gap >= 0.02 ? 'above' : gap <= -0.02 ? 'below' : 'in line with') + ' the ' + fmtPct(branch ? branch.maturedConversion : 0) + ' branch average');
  if (worst && worst.conv < worst.branch - 0.05) parts.push('the widest gap is at ' + worst.label + ' (' + fmtPct(worst.conv) + ' vs branch ' + fmtPct(worst.branch) + ')');
  if (neverContacted) parts.push(neverContacted + ' of ' + leads.length + ' assigned leads have no recorded contact event');
  else if (notPastContacted) parts.push(notPastContacted + ' leads stopped at Contacted');
  return {
    headline: parts.join('; ') + '.',
    strength: strongest && strongest.conv > strongest.branch
      ? strongest.label + ' at ' + fmtPct(strongest.conv) + ' beats the branch (' + fmtPct(strongest.branch) + ').'
      : r.delivered ? plural(r.delivered, 'delivery', 'deliveries') + ' worth ' + fmtINR(r.revenue) + ' in this period.' : 'No deliveries in this period.',
    risk: r.staleCount ? plural(r.staleCount, 'open lead') + ' worth ' + fmtINR(r.staleValue) + ' with no activity for 8+ days.' : 'No stale leads in this book — nothing to chase.',
    action: r.staleCount ? 'Work the ' + plural(r.staleCount, 'stale lead') + ' first — highest value first.'
      : neverContacted ? 'Contact the ' + neverContacted + ' untouched leads within 24 hours.'
        : 'Maintain cadence; no structural gap detected.',
  };
}

export interface LeadDriver {
  label: string;
  detail: string;
  weight: number;
}

export interface LeadExplanationResult {
  score: number;
  headline: string;
  drivers: LeadDriver[];
  risks: string[];
  businessImpact: string;
}

export function leadExplanation(lead: Lead, refs: PriorityRefs): LeadExplanationResult {
  const p = priorityScore(lead, refs);
  const drivers: LeadDriver[] = [
    { label: 'Deal value', detail: fmtINR(lead.dealValue) + (lead.dealValue > refs.medianDealValue ? ' — above the ' + fmtINR(refs.medianDealValue) + ' network median' : ' — below the network median'), weight: p.valueF },
    { label: 'Days idle', detail: lead.idleDays + ' days since last recorded activity (' + lead.lastActivityAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) + ')', weight: (p.idleF / 4) * 2 },
    { label: 'Stage', detail: STAGE_LABEL[lead.status] + (lead.status === 'order_placed' ? ' — revenue already committed, only delivery remains' : ' — still mid-funnel'), weight: p.stageF * 2 },
  ];
  const headline = lead.status === 'order_placed'
    ? 'High priority: the customer has already placed an order worth ' + fmtINR(lead.dealValue) + ' and the lead has been inactive for ' + lead.idleDays + ' days.'
    : 'Priority ' + p.score + ': ' + fmtINR(lead.dealValue) + ' at ' + STAGE_LABEL[lead.status] + ', inactive ' + lead.idleDays + ' days.';
  const businessImpact = lead.status === 'order_placed'
    ? fmtINR(lead.dealValue) + ' of committed revenue is exposed to cancellation risk the longer this sits unmanaged.'
    : lead.overdue
      ? fmtINR(lead.dealValue) + ' of pipeline value has already missed its expected close date by ' + lead.overdueDays + ' days.'
      : fmtINR(lead.dealValue) + ' of pipeline value is at risk of going cold the longer it sits at ' + STAGE_LABEL[lead.status] + '.';
  return { score: p.score, headline, drivers, risks: p.risks, businessImpact };
}

export interface FunnelSummary {
  whatHappened: string;
  why: string;
  impact: string;
  whatNext: string;
  cta: { label: string; route: Route };
}

/** Structured WHAT/WHY/IMPACT/WHAT NEXT summary, grounded entirely in
    largestFunnelDeviation() + stageLeaks() — no figure here is invented. */
export function funnelSummary(ctx: Context): FunnelSummary {
  const worst = ctx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));
  const deviation = largestFunnelDeviation(ctx.branchRows, ctx.reps, ctx.allScoped, ctx.netFunnel);

  const whatHappened = 'Network-wide, the largest leakage is ' + worst.label + ' at ' + fmtPct(worst.convFromPrev) +
    ' conversion — ' + worst.dropOff + ' of ' + worst.n + ' leads did not progress.';

  const why = deviation
    ? deviation.entityName + ' (' + (deviation.entityType === 'branch' ? 'branch' : 'rep') + ') has the single worst stage-level gap in the network: ' +
      deviation.leak.label + ' running ' + fmtPct(deviation.leak.conv) + ' against a ' + fmtPct(deviation.leak.net) + ' baseline.'
    : 'No single entity stands out beyond the network-wide pattern at current sample sizes.';

  const impact = deviation
    ? 'About ' + Math.round(deviation.leak.excessLoss) + ' more leads are lost at this step than the baseline predicts — worth ' +
      fmtINR(deviation.leak.excessLoss * ctx.kpi.avgDealValue * ctx.netMaturedConversion) + ' in forgone delivered revenue if closed at the network rate.'
    : 'Recovering 10% of the network drop-off is worth about ' + fmtINR(worst.dropOff * 0.1 * ctx.kpi.avgDealValue * ctx.netMaturedConversion) + ' in delivered revenue.';

  const whatNext = deviation
    ? 'Focus first-response and follow-up discipline on ' + deviation.leak.label + ' at ' + deviation.entityName + ' before addressing the network-wide pattern.'
    : 'Address ' + worst.label + ' network-wide — it is the single largest leakage point.';

  return {
    whatHappened, why, impact, whatNext,
    cta: deviation && deviation.entityType === 'branch'
      ? { label: 'Open ' + deviation.entityName, route: { screen: 'branch', branchId: deviation.entityId } }
      : deviation && deviation.entityType === 'rep'
        ? { label: 'Open ' + deviation.entityName + "'s scorecard", route: { screen: 'rep', repId: deviation.entityId } }
        : { label: 'Open Funnel Diagnostics', route: { screen: 'funnel' } },
  };
}
