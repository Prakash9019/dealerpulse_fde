import { STAGE_LABEL, STAGES, div } from '../domain/model';
import { fmtINR, fmtPct, fmtSigned } from '../format';
import type { EvidenceItem, Route } from '../domain/types';
import type { BranchRow, Context } from '../analytics/context';
import type { RepRow } from '../analytics/reps';
import { stageLeaks } from '../analytics/funnel';
import { repSummary } from './explanations';

export interface AskAnswer {
  interpretation: string;
  answer: string;
  evidence: EvidenceItem[];
  cta?: { label: string; route: Route };
  suggestions?: boolean;
}

const NO_ANSWER: AskAnswer = {
  interpretation: 'Unrecognised question',
  answer: "I don't have enough data to answer that.",
  evidence: [],
  suggestions: true,
};

export const SAMPLE_QUESTIONS: string[] = [
  'Why is Lakeside underperforming?',
  'Which branch has the highest conversion?',
  'Which leads should we call today?',
  'How much revenue is at risk?',
  'Which sales rep is performing best?',
  "What caused December's improvement?",
  'What are the biggest delivery delays?',
  'Which lead source converts best?',
  'Where is the biggest bottleneck?',
];

function findBranch(ctx: Context, q: string): BranchRow | undefined {
  return ctx.branchRows.find((b) =>
    q.includes(b.name.toLowerCase()) ||
    q.includes(b.name.toLowerCase().replace(' toyota', '')) ||
    q.includes(b.city.toLowerCase()));
}

function findRep(ctx: Context, q: string): RepRow | undefined {
  return ctx.reps.find((r) => {
    const n = r.name.toLowerCase();
    return q.includes(n) || (q.includes(n.split(' ')[0]) && n.split(' ')[0].length > 4);
  });
}

export function askDealerPulse(ctx: Context, question: string): AskAnswer {
  const q = (question || '').toLowerCase().trim();
  if (!q) return NO_ANSWER;
  const has = (...w: string[]) => w.some((x) => q.includes(x));
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
        { label: 'Units delivered', value: branch.units + '', baseline: 'rank ' + branch.convRank + ' of ' + ctx.branchRows.length },
        { label: 'Revenue at risk', value: fmtINR(branch.revenueAtRisk), baseline: branch.staleCount + ' stale leads' },
      ],
      cta: { label: 'View ' + branch.name + ' funnel', route: { screen: 'funnel', branchId: branch.id } },
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
        { label: 'Delivery delay rate', value: fmtPct(branch.delayRate, 0), baseline: 'network ' + fmtPct(ctx.delivery.delayRate, 0) },
      ],
      cta: { label: 'Open ' + branch.name, route: { screen: 'branch', branchId: branch.id } },
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
      cta: { label: 'Open ' + b.name, route: { screen: 'branch', branchId: b.id } },
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
      cta: { label: 'Open Action Center', route: { screen: 'actions', tier: 'critical' } },
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
        { label: 'Total open pipeline', value: fmtINR(ctx.aging.openValue), baseline: ctx.aging.openCount + ' leads' },
      ],
      cta: { label: 'Work the queue', route: { screen: 'actions', tier: 'critical' } },
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
        { label: 'Stale leads', value: rep.staleCount + '', baseline: fmtINR(rep.staleValue) },
      ],
      cta: { label: 'Open scorecard', route: { screen: 'rep', repId: rep.id } },
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
      cta: { label: 'Open scorecard', route: { screen: 'rep', repId: r.id } },
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
        { label: last.label + ' units', value: last.units + '', baseline: prev.label + ': ' + prev.units },
        { label: last.label + ' revenue', value: fmtINR(last.revenue), baseline: prev.label + ': ' + fmtINR(prev.revenue) },
        { label: 'New leads created', value: last.leadsCreated + '', baseline: prev.label + ': ' + prev.leadsCreated },
        { label: 'Orders placed', value: last.ordersPlaced + '', baseline: prev.label + ': ' + prev.ordersPlaced },
        { label: 'Delayed deliveries', value: last.delayed + ' of ' + last.units, baseline: fmtPct(last.delayRate, 0) + ' — up from ' + fmtPct(prev.delayRate, 0), bad: last.delayRate > prev.delayRate },
      ],
      cta: { label: 'See monthly trend', route: { screen: 'overview', anchor: 'trend' } },
    };
  }
  // sources — checked before "deliver" and "conversion" below since a source
  // question ("which lead source converts best") also contains "convert".
  if (has('source', 'channel', 'walk', 'website', 'referral', 'social')) {
    const s = ctx.sources;
    return {
      interpretation: 'Compare lead → delivery conversion by source',
      answer: s[0].label + ' converts best at ' + fmtPct(s[0].conversion) + ' (' + s[0].leads + ' leads → ' + s[0].delivered +
        ' deliveries), while ' + s[s.length - 1].label + ' converts ' + fmtPct(s[s.length - 1].conversion) + '.',
      evidence: s.map((x) => ({ label: x.label, value: fmtPct(x.conversion), baseline: x.leads + ' leads · ' + fmtINR(x.revenue), bad: x.conversion < ctx.netMaturedConversion * 0.6 })),
      cta: { label: 'Source comparison', route: { screen: 'funnel', anchor: 'sources' } },
    };
  }
  // conversion — checked before "deliver" below, since a conversion question
  // phrased as "lead to delivery conversion" contains "delivery" and would
  // otherwise be swallowed by the broader delivery-delay branch.
  if (has('conversion', 'convert')) {
    return {
      interpretation: 'Network lead → delivery conversion for the selected period',
      answer: 'The network converts ' + fmtPct(ctx.kpi.conversion) + ' of leads to delivery (' + ctx.kpi.conversionN +
        ' matured leads; ' + ctx.kpi.conversionExcluded + ' too recent to judge).',
      evidence: ctx.branchRows.map((b) => ({ label: b.name, value: fmtPct(b.maturedConversion), baseline: b.leads + ' leads', bad: b.z <= -2 })),
      cta: { label: 'Funnel diagnostics', route: { screen: 'funnel' } },
    };
  }
  // lead aging — checked before "revenue / units" below, since that branch's
  // broad "how many" keyword would otherwise swallow "how many leads are stale".
  if (has('stale', 'idle', 'inactive', 'aging')) {
    return {
      interpretation: 'Count open leads by days since last activity',
      answer: ctx.aging.staleCount + ' open leads worth ' + fmtINR(ctx.aging.staleValue) + ' have been inactive for 8+ days, of which ' +
        ctx.aging.buckets[4].count + ' have been quiet for over 30 days.',
      evidence: ctx.aging.buckets.map((b) => ({ label: 'Idle ' + b.label, value: b.count + ' leads', baseline: fmtINR(b.value), bad: b.tone === 'crit' })),
      cta: { label: 'Open Action Center', route: { screen: 'actions' } },
    };
  }
  // revenue / units headline — checked before "deliver" below, since
  // "delivered" (this branch's own keyword) is itself a substring match for
  // "deliver", so a plain units/revenue question would otherwise be
  // swallowed by the delivery-delay branch.
  if (has('revenue', 'sales', 'units', 'delivered', 'how many')) {
    return {
      interpretation: 'Delivered units and revenue for the selected period',
      answer: ctx.kpi.units + ' units delivered worth ' + fmtINR(ctx.kpi.revenue) + ' in ' + ctx.range.label.toLowerCase() + '.',
      evidence: [...ctx.branchRows].sort((a, b) => b.revenue - a.revenue).map((b) => ({ label: b.name, value: fmtINR(b.revenue), baseline: b.units + ' units' })),
      cta: { label: 'Branch performance', route: { screen: 'branches' } },
    };
  }
  // delivery delays
  if (has('deliver', 'delay', 'late')) {
    return {
      interpretation: 'Aggregate recorded delivery delay reasons and order-to-delivery time',
      answer: ctx.delivery.delayedCount + ' of ' + ctx.delivery.count + ' deliveries (' + fmtPct(ctx.delivery.delayRate, 0) +
        ') carry a recorded delay reason. The largest single cause is “' + (ctx.delivery.reasons[0]?.reason || '—') +
        '” with ' + (ctx.delivery.reasons[0]?.count || 0) + ' deliveries. Median order-to-delivery is ' + (ctx.delivery.medianDays ?? '—') + 'd.',
      evidence: [
        ...ctx.delivery.reasons.map((r) => ({ label: r.reason, value: r.count + ' deliveries', baseline: fmtPct(div(r.count, ctx.delivery.count), 0) + ' of all' })),
        { label: 'Median / p90 order → delivery', value: (ctx.delivery.medianDays ?? '—') + 'd / ' + (ctx.delivery.p90Days ?? '—') + 'd' },
      ],
      cta: { label: 'Delivery operations', route: { screen: 'funnel', anchor: 'delivery' } },
    };
  }
  // bottleneck
  if (has('bottleneck', 'slow', 'stuck', 'stage', 'funnel', 'leak', 'drop')) {
    const byTime = [...ctx.stageDurations].filter((s) => s.n >= 15).sort((a, b) => (b.medianDays || 0) - (a.medianDays || 0))[0];
    const byConv = [...ctx.stageDurations].filter((s) => s.n >= 15).sort((a, b) => a.conversion - b.conversion)[0];
    return {
      interpretation: 'Rank funnel stages by median duration and conversion',
      answer: byTime.label + ' is the slowest step at a median ' + (byTime.medianDays ?? '—') + 'd (p90 ' + (byTime.p90Days ?? '—') +
        'd), while the biggest volume leak is ' + byConv.label + ' at ' + fmtPct(byConv.conversion) + ' conversion — ' + byConv.dropOff + ' leads lost.',
      evidence: ctx.stageDurations.map((s) => ({ label: s.label, value: fmtPct(s.conversion), baseline: 'median ' + (s.medianDays ?? '—') + 'd · ' + s.dropOff + ' lost' })),
      cta: { label: 'Funnel diagnostics', route: { screen: 'funnel', anchor: 'bottlenecks' } },
    };
  }
  if (has('target', 'attainment', 'quota')) {
    return {
      interpretation: 'Target attainment with calibration context',
      answer: 'The network delivered ' + ctx.targets.units + ' units against a target of ' + ctx.targets.targetUnits +
        ' (' + fmtPct(ctx.targets.attainment, 0) + '). Every branch is far below 100%, so attainment should be read as a relative rank rather than an absolute score.',
      evidence: [...ctx.branchRows].sort((a, b) => b.attainment - a.attainment).map((b) => ({ label: b.name, value: fmtPct(b.attainment, 0), baseline: b.units + ' units, gap ' + b.gapUnits })),
      cta: { label: 'Compare branches', route: { screen: 'branches' } },
    };
  }
  if (has('lost', 'lose', 'why do we lose')) {
    const l = ctx.lost;
    return {
      interpretation: 'Aggregate recorded lost reasons',
      answer: l.total + ' leads worth ' + fmtINR(l.value) + ' were marked lost. The most common recorded reason is “' +
        l.rows[0].reason + '” (' + l.rows[0].count + ' leads).',
      evidence: l.rows.slice(0, 6).map((r) => ({ label: r.reason, value: r.count + ' leads', baseline: fmtINR(r.value) })),
      cta: { label: 'Lost reason analysis', route: { screen: 'branches' } },
    };
  }
  return NO_ANSWER;
}
