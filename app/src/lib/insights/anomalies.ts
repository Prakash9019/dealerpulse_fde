import { MAX_ANOMALIES, MIN_RATED_LEADS, STALE_DAYS, div, mean, zProportion } from '../domain/model';
import { fmtDays, fmtINR, fmtNum, fmtPct, fmtSigned } from '../format';
import type { EvidenceItem } from '../domain/types';
import { stageLeaks } from '../analytics/funnel';
import type { Context } from '../analytics/context';

export type AnomalySeverity = 'critical' | 'risk' | 'watch' | 'opportunity';

export interface Anomaly {
  id: string;
  type: string;
  severity: AnomalySeverity;
  title: string;
  metric: string;
  expected: string;
  actual: string;
  difference: string;
  evidence: EvidenceItem[];
  explanation: string;
  impact: string;
  cta: { label: string; route: { screen: string; branchId?: string; repId?: string; tier?: string; anchor?: string } };
  /** Business-impact magnitude, in whatever unit is most meaningful for this
      anomaly type (already-computed values, not a new statistic) — used only
      as a secondary sort key within a severity tier for flood control. */
  magnitude: number;
}

export { zProportion };

export function detectAnomalies(ctx: Context): Anomaly[] {
  const out: Anomaly[] = [];
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
          weakest ? { label: 'Biggest leak', value: weakest.label + ' · ' + fmtPct(weakest.conv), note: 'network ' + fmtPct(weakest.net) + ' · ~' + Math.round(weakest.excessLoss) + ' extra leads lost' } : null,
        ].filter((x): x is EvidenceItem => !!x),
        explanation: worse && weakest
          ? 'The largest single leak is ' + weakest.label + ', running ' + fmtPct(weakest.conv) + ' against a network ' + fmtPct(weakest.net) + ' — roughly ' + Math.round(weakest.excessLoss) + ' more leads lost there than the baseline predicts' + (weakest.fromStage === 'new' ? ', before anyone reaches a showroom.' : ', which caps everything downstream.')
          : 'Conversion is above baseline across the funnel; worth studying what this branch does differently.',
        impact: worse
          ? 'At network conversion this branch would have delivered ~' + Math.round(b.leads * net) + ' units instead of ' + b.units + '.'
          : 'Contributes ' + fmtINR(b.revenue) + ' of delivered revenue.',
        cta: { label: 'Open ' + b.name, route: { screen: 'branch', branchId: b.id } },
        magnitude: Math.abs(b.z),
      });
    }
  });

  const gate = ctx.testDriveGate;
  if (gate.neverTestDriven >= 15) {
    const topBranch = gate.byBranch[0];
    out.push({
      id: 'test-drive-gate',
      type: 'Test drive gate',
      severity: gate.deliveredDespiteGate === 0 ? 'critical' : 'risk',
      title: gate.neverTestDriven + ' leads reached Contacted but never Test Drive — ' + gate.deliveredDespiteGate + ' of them ever delivered',
      metric: 'Contacted-without-test-drive leads',
      expected: '0 delivered without a test drive', actual: gate.deliveredDespiteGate + ' delivered of ' + gate.neverTestDriven,
      difference: fmtINR(gate.neverTestDrivenValue) + ' stranded before the gate',
      evidence: [
        { label: 'Never test-driven', value: fmtNum(gate.neverTestDriven), note: fmtINR(gate.neverTestDrivenValue) },
        { label: 'Delivered anyway', value: fmtNum(gate.deliveredDespiteGate), note: gate.deliveredDespiteGate === 0 ? 'confirms the gate is absolute' : 'exception to investigate' },
        ...(topBranch ? [{ label: 'Worst branch', value: topBranch.branchName, note: fmtNum(topBranch.count) + ' leads · ' + fmtINR(topBranch.value) }] : []),
      ],
      explanation: 'Test drive behaves as a hard gate rather than a soft funnel stage: of ' + gate.neverTestDriven + ' leads that got contacted but never test-driven, ' + gate.deliveredDespiteGate + ' ever closed. ' + (topBranch ? topBranch.branchName + ' carries the largest share at ' + fmtINR(topBranch.value) + '.' : ''),
      impact: fmtINR(gate.neverTestDrivenValue) + ' in deal value is effectively irretrievable until these leads are pushed into a test drive.',
      cta: { label: 'Open funnel diagnostics', route: { screen: 'funnel', anchor: 'test-drive-gate' } },
      magnitude: gate.neverTestDrivenValue,
    });
  }

  const worst = ctx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));
  ctx.netFunnel.slice(1).forEach((s, i) => {
    if (s.stage === worst.stage) {
      out.push({
        id: 'stage-' + s.stage,
        type: 'Stage conversion',
        severity: 'risk',
        title: 'Largest network leakage is ' + ctx.netFunnel[i].label + ' → ' + s.label,
        metric: 'Stage conversion',
        expected: fmtPct(mean(ctx.netFunnel.slice(1).map((x) => x.convFromPrev))) + ' (avg stage)',
        actual: fmtPct(s.convFromPrev),
        difference: s.dropOff + ' leads lost at this step',
        evidence: [
          { label: 'Entering stage', value: fmtNum(s.n) },
          { label: 'Progressing', value: fmtNum(s.count) },
          { label: 'Median time in stage', value: fmtDays(s.medianDays), note: 'p90 ' + fmtDays(s.p90Days) },
          { label: 'Lost from previous stage', value: fmtNum(s.lostHere) },
        ],
        explanation: 'Of ' + s.n + ' leads reaching ' + s.label + ', ' + s.dropOff + ' did not progress. Median dwell time before progressing is ' + fmtDays(s.medianDays) + '.',
        impact: 'Recovering 10% of this drop-off is worth about ' + fmtINR(s.dropOff * 0.1 * ctx.kpi.avgDealValue * ctx.netMaturedConversion) + ' in delivered revenue.',
        cta: { label: 'Open funnel diagnostics', route: { screen: 'funnel' } },
        magnitude: s.dropOff,
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
        { label: 'Worst case', value: ctx.actions.rows[0] ? ctx.actions.rows[0].idleDays + ' days idle' : '—', note: ctx.actions.rows[0]?.customerName },
      ],
      explanation: 'These leads are counted in pipeline but have no recorded touch. ' + ctx.actions.rows.filter((r) => r.status === 'order_placed' && r.idleDays >= STALE_DAYS).length + ' of the stale set are already at Order Placed, meaning the revenue is committed and only fulfilment is missing.',
      impact: fmtINR(crit.value) + ' of pipeline is effectively unmanaged.',
      cta: { label: 'Open Action Center', route: { screen: 'actions', tier: 'critical' } },
      magnitude: crit.value,
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
          { label: 'Delayed deliveries', value: last.delayed + ' of ' + last.units, note: fmtPct(last.delayRate, 0) },
        ],
        explanation: up
          ? 'The lift is fulfilment of orders already in the book: ' + (prev.ordersPlaced + last.ordersPlaced) + ' orders were placed across ' + prev.label + ' and ' + last.label + '. Median order-to-delivery is ' + fmtDays(last.medianDaysToDeliver) + ((last.medianDaysToDeliver ?? 0) > (prev.medianDaysToDeliver ?? 0) ? ', up from ' + fmtDays(prev.medianDaysToDeliver) + ' — throughput rose while the queue slowed.' : ' against ' + fmtDays(prev.medianDaysToDeliver) + ' in ' + prev.label + '.')
          : 'Fewer orders converted to delivery this month.',
        impact: fmtSigned(last.revenue - prev.revenue, fmtINR) + ' of delivered revenue month on month.',
        cta: { label: 'See monthly trend', route: { screen: 'overview', anchor: 'trend' } },
        magnitude: Math.abs(last.revenue - prev.revenue),
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
        ...ctx.delivery.reasons.slice(0, 3).map((r) => ({ label: r.reason, value: r.count + ' deliveries' })),
      ],
      explanation: 'Top recorded cause is “' + (ctx.delivery.reasons[0]?.reason || '—') + '” (' + (ctx.delivery.reasons[0]?.count || 0) + ' deliveries). Delay reasons are recorded per delivery, so this is observed, not inferred.',
      impact: 'Delivery slippage pushes revenue recognition into later months and raises cancellation risk on committed orders.',
      cta: { label: 'Review delivery operations', route: { screen: 'funnel', anchor: 'delivery' } },
      magnitude: ctx.delivery.delayedCount,
    });
  }

  const srcs = ctx.sources.filter((s) => s.leads >= 25);
  if (srcs.length >= 2) {
    const best = srcs[0], worstSrc = srcs[srcs.length - 1];
    if (best.conversion - worstSrc.conversion >= 0.15) {
      out.push({
        id: 'source-quality',
        type: 'Source quality',
        severity: 'watch',
        title: worstSrc.label + ' leads convert at a fraction of ' + best.label,
        metric: 'Conversion by lead source',
        expected: best.label + ' ' + fmtPct(best.conversion), actual: worstSrc.label + ' ' + fmtPct(worstSrc.conversion),
        difference: (best.conversion / (worstSrc.conversion || 0.0001)).toFixed(1) + '× gap',
        evidence: srcs.map((s) => ({ label: s.label, value: fmtPct(s.conversion), note: s.leads + ' leads · ' + fmtINR(s.revenue) })),
        explanation: 'Mix matters: ' + worstSrc.label + ' contributes ' + worstSrc.leads + ' leads but only ' + worstSrc.delivered + ' deliveries. Contact rate on that source is ' + fmtPct(worstSrc.contactRate, 0) + '.',
        impact: 'Rebalancing spend toward ' + best.label + '-like demand raises conversion without adding lead volume.',
        cta: { label: 'Compare sources', route: { screen: 'funnel', anchor: 'sources' } },
        magnitude: (best.conversion - worstSrc.conversion) * worstSrc.leads,
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
      explanation: 'Targets sum to ' + fmtNum(ctx.branchRows.reduce((s, b) => s + b.targetUnits, 0)) + ' units against ' + fmtNum(ctx.branchRows.reduce((s, b) => s + b.units, 0)) + ' delivered network-wide. Read attainment as a relative rank, not an absolute score, until targets are re-based.',
      impact: 'Absolute attainment cannot be used for incentives or forecasting in its current state.',
      cta: { label: 'Compare branches', route: { screen: 'branches' } },
      magnitude: ctx.branchRows.reduce((s, b) => s + b.targetUnits, 0) - ctx.branchRows.reduce((s, b) => s + b.units, 0),
    });
  }

  const eligible = ctx.reps.filter((r) => r.leads >= MIN_RATED_LEADS);
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
            { label: 'Branch', value: r.branchName || '—', note: 'rank ' + r.branchRank + ' of ' + r.branchRepCount },
          ],
          explanation: 'Contact rate is ' + fmtPct(r.contactRate, 0) + ' and ' + (r.leads - r.contacted) + ' assigned leads have no recorded contact event.',
          impact: 'At network conversion this book would have produced ~' + Math.round(r.leads * base) + ' deliveries instead of ' + r.delivered + '.',
          cta: { label: 'Open scorecard', route: { screen: 'rep', repId: r.id } },
          magnitude: Math.abs(z),
        });
      }
    });
  }

  const order: Record<AnomalySeverity, number> = { critical: 0, risk: 1, watch: 2, opportunity: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface RankedAnomalies {
  shown: Anomaly[];
  overflow: Anomaly[];
}

/** Display-layer flood control: severity order is preserved (and is what the
    port's test suite locks in on the raw detectAnomalies() output), with
    magnitude as a secondary sort only within a tier, then capped. Nothing is
    discarded — the rest is still reachable via `overflow`. */
export function rankAnomalies(anomalies: Anomaly[], max = MAX_ANOMALIES): RankedAnomalies {
  const order: Record<AnomalySeverity, number> = { critical: 0, risk: 1, watch: 2, opportunity: 3 };
  const ranked = [...anomalies].sort((a, b) => order[a.severity] - order[b.severity] || b.magnitude - a.magnitude);
  return { shown: ranked.slice(0, max), overflow: ranked.slice(max) };
}
