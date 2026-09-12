import { div } from '../domain/model';
import { fmtINR, fmtPct } from '../format';
import type { Route } from '../domain/types';
import { stageLeaks } from '../analytics/funnel';
import type { Context } from '../analytics/context';

export interface BriefFinding {
  tone: 'positive' | 'negative';
  text: string;
  route: Route;
}

export interface ExecutiveBrief {
  headline: string;
  findings: BriefFinding[];
  action: string;
  actionCta: { label: string; route: Route };
  problemCta: { label: string; route: Route };
}

export function executiveBrief(ctx: Context): ExecutiveBrief {
  const t = ctx.trend, last = t[t.length - 1], prev = t[t.length - 2];
  const weak = ctx.branchRows.filter((b) => b.z <= -2).sort((a, b) => a.z - b.z)[0];
  const best = [...ctx.branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion)[0];
  const momentum = last && prev && prev.units ? div(last.units - prev.units, prev.units) : 0;

  const headline = (momentum >= 0.15
    ? last.label + ' delivery momentum is strong'
    : momentum <= -0.15 ? last.label + ' deliveries slipped' : 'Network delivery volume is steady')
    + (weak ? ', but ' + weak.name + ' remains the largest performance gap' : '')
    + (ctx.aging.staleValue > 0 ? ' and ' + fmtINR(ctx.aging.staleValue) + ' of pipeline has gone quiet.' : '.');

  const findings: BriefFinding[] = [];
  if (last && prev) findings.push({
    tone: momentum >= 0 ? 'positive' : 'negative',
    text: last.label + ' delivered ' + last.units + ' units (' + fmtINR(last.revenue) + '), ' +
      (momentum >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(momentum * 100)) + '% on ' + prev.label +
      '. Median order-to-delivery moved to ' + (last.medianDaysToDeliver ?? '—') + 'd and ' + last.delayed + ' of ' + last.units + ' deliveries carried a delay reason.',
    route: { screen: 'overview', anchor: 'trend' },
  });
  if (weak) {
    const wl = stageLeaks(weak.funnel, ctx.netFunnel)[0];
    findings.push({
      tone: 'negative',
      text: weak.name + ' converts ' + fmtPct(weak.maturedConversion) + ' of leads to delivery against a network ' +
        fmtPct(ctx.netMaturedConversion) + '.' + (wl ? ' The largest leak is ' + wl.label + ' at ' + fmtPct(wl.conv) +
        ' versus ' + fmtPct(wl.net) + ' network' + (wl.fromStage === 'new' ? ', so volume is lost before anyone sees a car.' : ', which caps every stage after it.') : ''),
      route: { screen: 'branch', branchId: weak.id },
    });
  }
  findings.push({
    tone: 'negative',
    text: ctx.aging.staleCount + ' open leads worth ' + fmtINR(ctx.aging.staleValue) + ' have had no activity for 8+ days, including ' +
      ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= 8).length + ' already at Order Placed — revenue committed, delivery unmanaged.',
    route: { screen: 'actions', tier: 'critical' },
  });
  if (best && best.z >= 1) findings.push({
    tone: 'positive',
    text: best.name + ' leads the network at ' + fmtPct(best.maturedConversion) + ' conversion on ' + best.leads +
      ' leads. Its New → Contacted rate is ' + fmtPct(best.funnel[1].convFromPrev) + ' — the practice worth copying.',
    route: { screen: 'branch', branchId: best.id },
  });

  const topRec = ctx.recommendations[0];
  return {
    headline,
    findings: findings.slice(0, 3),
    action: topRec ? topRec.action : 'Review the prioritised action queue.',
    actionCta: topRec ? topRec.cta : { label: 'Open Action Center', route: { screen: 'actions' } },
    problemCta: weak ? { label: 'View problem', route: { screen: 'branch', branchId: weak.id } }
      : { label: 'View funnel', route: { screen: 'funnel' } },
  };
}
