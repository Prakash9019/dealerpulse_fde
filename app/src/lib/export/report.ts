/* Shared content builder for the Executive PDF (section 35) and the Weekly
   Executive Summary (section 20) — one source of truth for "what goes in the
   report," fed to a PDF renderer, an XLSX writer, and the /weekly on-screen
   view. Every field here is read from the already-computed Context; nothing
   is invented for the report specifically. */
import { rankAnomalies } from '../insights/anomalies';
import { executiveBrief } from '../ai/executiveBrief';
import { forecastPipeline, stageDeliveryRates } from '../insights/forecast';
import { fmtINR, fmtNum, fmtPct } from '../format';
import type { Context } from '../analytics/context';
import type { Model } from '../domain/types';

export interface ReportBranchRow {
  name: string;
  city: string;
  conversion: string;
  units: number;
  revenue: string;
  attainment: string;
  status: string;
}

export interface ExecutiveReport {
  generatedAt: string;
  dataAsOf: string;
  rangeLabel: string;
  headline: string;
  findings: { tone: string; text: string }[];
  doNext: string;
  kpis: { label: string; value: string }[];
  topRisks: { title: string; explanation: string; impact: string }[];
  topOpportunities: { title: string; explanation: string; impact: string }[];
  forecast: { available: boolean; text: string };
  branches: ReportBranchRow[];
  funnelSummary: string;
  recommendedActions: { horizon: string; problem: string; action: string }[];
}

export function buildExecutiveReport(model: Model, ctx: Context): ExecutiveReport {
  const brief = executiveBrief(ctx);
  const ranked = rankAnomalies(ctx.anomalies).shown;
  const risks = ranked.filter((a) => a.severity === 'critical' || a.severity === 'risk');
  const opportunities = ranked.filter((a) => a.severity === 'opportunity');

  const maturedCount = ctx.cohort.filter((l) => (model.asOf.getTime() - l.createdAt.getTime()) / 86400000 >= model.maturityDays).length;
  let forecastText: string;
  let forecastAvailable = false;
  if (maturedCount < 10) {
    forecastText = 'Forecast unavailable — insufficient historical signal.';
  } else {
    const forecast = forecastPipeline(ctx.openLeads, stageDeliveryRates(model), ctx.kpi.units, ctx.targets.targetUnits);
    forecastAvailable = true;
    forecastText = `${fmtNum(ctx.openLeads.length)} open leads worth ${fmtINR(forecast.openValue)} are expected to yield ~${forecast.expectedUnits.toFixed(1)} more units (~${fmtINR(forecast.expectedRevenue)}), projecting ${forecast.projectedUnits.toFixed(1)} units against a target of ${fmtNum(forecast.targetUnits)}.`;
  }

  const worstFunnelStage = ctx.netFunnel.slice(1).reduce((a, b) => (a.dropOff >= b.dropOff ? a : b));

  return {
    generatedAt: new Date().toISOString(),
    dataAsOf: model.asOfLabel,
    rangeLabel: ctx.range.label,
    headline: brief.headline,
    findings: brief.findings.map((f) => ({ tone: f.tone, text: f.text })),
    doNext: brief.action,
    kpis: [
      { label: 'Units Delivered', value: fmtNum(ctx.kpi.units) },
      { label: 'Revenue', value: fmtINR(ctx.kpi.revenue) },
      { label: 'Lead → Delivery Conversion', value: ctx.kpi.conversion != null ? fmtPct(ctx.kpi.conversion) : '—' },
      { label: 'Revenue At Risk', value: fmtINR(ctx.kpi.revenueAtRisk) },
    ],
    topRisks: risks.slice(0, 5).map((a) => ({ title: a.title, explanation: a.explanation, impact: a.impact })),
    topOpportunities: opportunities.slice(0, 5).map((a) => ({ title: a.title, explanation: a.explanation, impact: a.impact })),
    forecast: { available: forecastAvailable, text: forecastText },
    branches: [...ctx.branchRows]
      .sort((a, b) => b.maturedConversion - a.maturedConversion)
      .map((b) => ({
        name: b.name, city: b.city, conversion: fmtPct(b.maturedConversion), units: b.units,
        revenue: fmtINR(b.revenue), attainment: fmtPct(b.attainment, 0), status: b.status,
      })),
    funnelSummary: `Largest network leakage is ${worstFunnelStage.label} at ${fmtPct(worstFunnelStage.convFromPrev)} conversion — ${worstFunnelStage.dropOff} of ${worstFunnelStage.n} leads did not progress.`,
    recommendedActions: ctx.recommendations.slice(0, 5).map((r) => ({ horizon: r.horizon, problem: r.problem, action: r.action })),
  };
}
