import { fmtDays, fmtINR, fmtPct } from '../format';
import type { EvidenceItem, Route } from '../domain/types';
import { stageLeaks } from '../analytics/funnel';
import type { Context } from '../analytics/context';

export interface Recommendation {
  id: string;
  horizon: 'Today' | 'This week' | 'This month' | 'Next quarter';
  problem: string;
  evidence: EvidenceItem[];
  impact: string;
  action: string;
  cta: { label: string; route: Route };
}

export function buildRecommendations(ctx: Context): Recommendation[] {
  const recs: Recommendation[] = [];

  const staleOrders = ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= 30);
  if (staleOrders.length) {
    recs.push({
      id: 'rec-stale-orders', horizon: 'Today',
      problem: staleOrders.length + ' placed orders worth ' + fmtINR(staleOrders.reduce((s, r) => s + r.dealValue, 0)) + ' have been idle 30+ days',
      evidence: [
        { label: 'Orders idle 30+ days', value: staleOrders.length + '' },
        { label: 'Committed value', value: fmtINR(staleOrders.reduce((s, r) => s + r.dealValue, 0)) },
        { label: 'Longest idle', value: staleOrders[0] ? Math.max(...staleOrders.map((r) => r.idleDays)) + ' days' : '—' },
      ],
      impact: 'Revenue already won but not recognised; each is a cancellation risk.',
      action: 'Assign an owner per order, confirm allocation and delivery date, and log the touch today.',
      cta: { label: 'Work the queue', route: { screen: 'actions', tier: 'critical' } },
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
        { label: 'Leads in period', value: weak.leads + '' },
        { label: 'Units delivered', value: weak.units + '', note: 'network rank ' + weak.convRank + ' of ' + ctx.branchRows.length },
        { label: 'Lost from first two stages', value: weak.funnel[0].count - weak.funnel[2].count + ' leads' },
      ].filter((x): x is EvidenceItem => !!x),
      impact: 'Closing the gap to network conversion is worth roughly ' +
        fmtINR((weak.leads * ctx.netMaturedConversion - weak.units) * ctx.kpi.avgDealValue) + ' of delivered revenue over this period.',
      action: g && g.fromStage === 'new'
        ? 'Fix first response at ' + weak.name + ': enforce a same-day contact SLA and re-route unworked new leads.'
        : 'Run a stage review at ' + weak.name + ' focused on ' + (g ? g.label : 'the funnel') + '.',
      cta: { label: 'Open ' + weak.name, route: { screen: 'branch', branchId: weak.id } },
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
        { label: 'Leads entering', value: worstStage.n + '' },
        { label: 'Not progressing', value: worstStage.dropOff + '' },
      ],
      impact: 'Every day removed here pulls revenue forward and reduces the window for competitors.',
      action: 'Set a target dwell time for ' + worstStage.label + ' and review deals that exceed p90 weekly.',
      cta: { label: 'Stage bottlenecks', route: { screen: 'funnel', anchor: 'bottlenecks' } },
    });
  }

  if (ctx.delivery.delayRate >= 0.3 && ctx.delivery.reasons.length) {
    recs.push({
      id: 'rec-delivery', horizon: 'This month',
      problem: fmtPct(ctx.delivery.delayRate, 0) + ' delivery delay rate, median order-to-delivery ' + fmtDays(ctx.delivery.medianDays),
      evidence: ctx.delivery.reasons.slice(0, 4).map((r) => ({ label: r.reason, value: r.count + ' deliveries' })),
      impact: 'Delayed deliveries defer ' + fmtINR(ctx.delivery.revenue * ctx.delivery.delayRate) + ' of recognised revenue in this period.',
      action: 'Attack the top recorded cause — “' + ctx.delivery.reasons[0].reason + '” — with a named owner and a weekly clearance target.',
      cta: { label: 'Delivery detail', route: { screen: 'funnel', anchor: 'delivery' } },
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
        { label: 'Revenue difference', value: fmtINR(bestSrc.revenue - weakSrc.revenue) },
      ],
      impact: 'Lead mix is a lever that does not require more headcount.',
      action: 'Qualify ' + weakSrc.label + ' enquiries before assignment, and shift budget toward channels with ' + bestSrc.label + '-level intent.',
      cta: { label: 'Source comparison', route: { screen: 'funnel', anchor: 'sources' } },
    });
  }

  return recs;
}
