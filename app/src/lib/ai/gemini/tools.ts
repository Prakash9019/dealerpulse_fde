/* Controlled, read-only tools exposed to Gemini via function calling. Every
   tool is a thin wrapper over the existing analytics engine (getContext / lib
   functions) — the model never touches the dataset directly, never gets a
   database or filesystem handle, and every argument is validated with zod
   before use. Unknown ids return a typed error object rather than throwing
   into the model loop, and there is no mutation path anywhere in this file. */
import { z } from 'zod';
import { getContext, getModel } from '../../data';
import { rankAnomalies } from '../../insights/anomalies';
import { forecastPipeline, stageDeliveryRates } from '../../insights/forecast';
import { whatIfStageImprovement } from '../../insights/whatif';
import { searchKnowledgeBase } from '../../rag/retrieval';
import type { Filters } from '../../domain/types';

const RANGE_PROP = { type: 'string', description: 'Range preset: all, 30d, quarter, or month' };
const BRANCH_PROP = { type: 'string', description: "Branch id (e.g. B1) or branch name (e.g. 'Lakeside Toyota' or just 'Lakeside') — either works." };
const REP_PROP = { type: 'string', description: "Sales rep id (e.g. SR2) or rep name (e.g. 'Meera Menon') — either works." };

/** Resolves a branch id OR a branch name (full, partial, or with/without
    "Toyota") to the canonical id. Without this, the model only ever sees
    branch/rep NAMES in a user's question (it has no id lookup of its own)
    and — observed in live testing — will sometimes skip the tool call
    entirely and fabricate plausible-looking numbers rather than guess an id.
    Falls through to the raw input on no match, so the downstream ctx lookup
    still returns a clean {error:'not_found'} rather than this function
    silently swallowing a genuinely bad id. */
function resolveBranchId(needle: string | null | undefined): string | undefined {
  if (!needle) return needle ?? undefined;
  const n = needle.trim().toLowerCase();
  const branches = getModel().branches;
  const exact = branches.find((b) => b.id.toLowerCase() === n);
  if (exact) return exact.id;
  const byName = branches.find((b) => {
    const full = b.name.toLowerCase();
    const short = full.replace(/\s+toyota$/, '');
    return full === n || short === n || full.includes(n) || n.includes(short);
  });
  return byName ? byName.id : needle;
}

function resolveRepId(needle: string | null | undefined): string | undefined {
  if (!needle) return needle ?? undefined;
  const n = needle.trim().toLowerCase();
  const reps = getModel().reps;
  const exact = reps.find((r) => r.id.toLowerCase() === n);
  if (exact) return exact.id;
  const byName = reps.find((r) => {
    const full = r.name.toLowerCase();
    const first = full.split(' ')[0];
    return full === n || full.includes(n) || (n.includes(first) && first.length > 3);
  });
  return byName ? byName.id : needle;
}

const filtersSchema = z.object({
  range: z.string().nullish(),
  branchId: z.string().nullish(),
  repId: z.string().nullish(),
});

function toFilters(f: z.infer<typeof filtersSchema>): Filters {
  return { range: f.range || 'all', branchId: resolveBranchId(f.branchId), repId: resolveRepId(f.repId) };
}

export interface ToolDef {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  run: (args: unknown) => unknown | Promise<unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: 'get_network_kpis',
    description: 'Network-wide KPIs: units delivered, revenue, lead-to-delivery conversion, revenue at risk, for a given range.',
    parametersJsonSchema: { type: 'object', properties: { range: RANGE_PROP } },
    run: (args) => {
      const { range } = z.object({ range: z.string().nullish() }).parse(args ?? {});
      const ctx = getContext({ range: range || 'all' });
      // rawConversion (unmatured cohort) is deliberately withheld — it's the
      // exact trap the product's own "Analytics decisions that matter" #1
      // warns about (a young cohort looks artificially weak). kpi.conversion
      // is already the canonical matured-cohort rate; exposing both invites
      // the model to pick the wrong one.
      const { rawConversion: _rawConversion, ...kpi } = ctx.kpi;
      return { kpi, rangeLabel: ctx.range.label, dataAsOf: getModel().asOfLabel };
    },
  },
  {
    name: 'get_branch_performance',
    description: 'Full performance metrics for one branch: conversion, units, revenue, target attainment, pipeline, stale leads, funnel, and the list of reps assigned to this branch with their individual conversion/leads/delivered/stale figures (use this — not a guess — to answer "which reps are affected" for a branch).',
    parametersJsonSchema: { type: 'object', properties: { branchId: BRANCH_PROP, range: RANGE_PROP }, required: ['branchId'] },
    run: (args) => {
      const { branchId, range } = z.object({ branchId: z.string(), range: z.string().nullish() }).parse(args);
      const resolvedId = resolveBranchId(branchId);
      const ctx = getContext({ range: range || 'all' });
      const row = ctx.branchRows.find((b) => b.id === resolvedId);
      if (!row) return { error: 'not_found', branchId };
      // Same trap as get_network_kpis: row.conversion is the raw (unmatured)
      // rate. Replace it with the canonical maturedConversion so there is
      // only ever one "conversion" figure for the model to read — observed
      // live to otherwise sometimes pick the raw figure for a branch with a
      // younger lead mix, materially understating its real performance.
      const { conversion: _rawConversion, ...rest } = row;
      // A branch-level question ("which reps are affected?") has no other
      // tool that can answer it — get_rep_performance requires already
      // knowing a specific rep's id/name. Without this, the model has no
      // grounded way to answer and correctly (but unhelpfully) declines.
      // Reusing the reps already computed for this context, scoped here,
      // is not new data — just exposing an existing join.
      const reps = ctx.reps
        .filter((r) => r.branchId === resolvedId)
        .map((r) => ({ id: r.id, name: r.name, conversion: r.conversion, leads: r.leads, delivered: r.delivered, staleCount: r.staleCount, staleValue: r.staleValue }));
      return { ...rest, conversion: row.maturedConversion, reps };
    },
  },
  {
    name: 'get_rep_performance',
    description: 'Performance metrics for one sales rep: conversion, leads handled, orders, delivered, pipeline, stale leads.',
    parametersJsonSchema: { type: 'object', properties: { repId: REP_PROP, range: RANGE_PROP }, required: ['repId'] },
    run: (args) => {
      const { repId, range } = z.object({ repId: z.string(), range: z.string().nullish() }).parse(args);
      const resolvedId = resolveRepId(repId);
      const ctx = getContext({ range: range || 'all' });
      const row = ctx.reps.find((r) => r.id === resolvedId);
      return row ?? { error: 'not_found', repId };
    },
  },
  {
    name: 'get_funnel_metrics',
    description: 'Funnel stage-by-stage volume, conversion, drop-off, median and p90 duration, optionally scoped to a branch or rep.',
    parametersJsonSchema: { type: 'object', properties: { range: RANGE_PROP, branchId: BRANCH_PROP, repId: REP_PROP } },
    run: (args) => {
      const f = filtersSchema.parse(args ?? {});
      const ctx = getContext(toFilters(f));
      return { funnel: ctx.funnel, network: ctx.netFunnel };
    },
  },
  {
    name: 'get_lead_aging',
    description: 'Lead aging buckets (0-3, 4-7, 8-14, 15-30, 30+ days idle) and stale-lead totals, optionally scoped to a branch or rep.',
    parametersJsonSchema: { type: 'object', properties: { range: RANGE_PROP, branchId: BRANCH_PROP, repId: REP_PROP } },
    run: (args) => {
      const f = filtersSchema.parse(args ?? {});
      return getContext(toFilters(f)).aging;
    },
  },
  {
    name: 'get_revenue_at_risk',
    description: 'Revenue at risk from stale/idle open leads, optionally scoped to a branch or rep.',
    parametersJsonSchema: { type: 'object', properties: { range: RANGE_PROP, branchId: BRANCH_PROP, repId: REP_PROP } },
    run: (args) => {
      const f = filtersSchema.parse(args ?? {});
      const ctx = getContext(toFilters(f));
      return { revenueAtRisk: ctx.kpi.revenueAtRisk, staleCount: ctx.kpi.staleCount, criticalTierValue: ctx.actions.criticalValue };
    },
  },
  {
    name: 'get_forecast',
    description: 'Pipeline forecast (expected units/revenue from the current open pipeline) against target, optionally scoped to a branch. Returns available:false when there is not enough matured historical data.',
    parametersJsonSchema: { type: 'object', properties: { range: RANGE_PROP, branchId: BRANCH_PROP } },
    run: (args) => {
      const f = z.object({ range: z.string().nullish(), branchId: z.string().nullish() }).parse(args ?? {});
      const model = getModel();
      const ctx = getContext({ range: f.range || 'all', branchId: resolveBranchId(f.branchId) });
      const maturedCount = ctx.cohort.filter((l) => (model.asOf.getTime() - l.createdAt.getTime()) / 86400000 >= model.maturityDays).length;
      if (maturedCount < 10) {
        return { available: false, reason: 'insufficient historical signal — fewer than 10 matured leads in scope' };
      }
      return { available: true, ...forecastPipeline(ctx.openLeads, stageDeliveryRates(model), ctx.kpi.units, ctx.targets.targetUnits) };
    },
  },
  {
    name: 'get_anomalies',
    description: 'Ranked anomalies (critical/risk/watch/opportunity) detected in the current data, capped to the highest-impact ones, optionally scoped.',
    parametersJsonSchema: { type: 'object', properties: { range: RANGE_PROP, branchId: BRANCH_PROP, repId: REP_PROP } },
    run: (args) => {
      const f = filtersSchema.parse(args ?? {});
      return rankAnomalies(getContext(toFilters(f)).anomalies).shown;
    },
  },
  {
    name: 'run_scenario',
    description: 'Simulate improving conversion at one funnel-stage transition by N percentage points and project the unit/revenue impact. Read-only simulation — never changes real data.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        stageIndex: { type: 'integer', description: '1-based funnel transition: 1=New→Contacted, 2=Contacted→TestDrive, 3=TestDrive→Negotiation, 4=Negotiation→OrderPlaced, 5=OrderPlaced→Delivered' },
        improvementPts: { type: 'number', description: 'Improvement in percentage points, e.g. 10 for +10pts (can be negative)' },
        branchId: BRANCH_PROP,
        range: RANGE_PROP,
      },
      required: ['stageIndex', 'improvementPts'],
    },
    run: (args) => {
      const a = z.object({
        stageIndex: z.number().int().min(1).max(5),
        improvementPts: z.number().min(-50).max(50),
        branchId: z.string().nullish(),
        range: z.string().nullish(),
      }).parse(args);
      const ctx = getContext({ range: a.range || 'all', branchId: resolveBranchId(a.branchId) });
      if (a.stageIndex >= ctx.funnel.length) return { error: 'invalid_stage', stageIndex: a.stageIndex };
      return whatIfStageImprovement(ctx.funnel, ctx.kpi.avgDealValue, a.stageIndex, a.improvementPts / 100);
    },
  },
  {
    name: 'search_knowledge_base',
    description: 'Search internal reference documents (escalation SOP, metrics glossary, anomaly-detection methodology) for policy/process questions. Do NOT use this for KPI or numeric questions — use the analytics tools for those. Returns document/section/text for citation.',
    parametersJsonSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The policy or process question to search for' } },
      required: ['query'],
    },
    run: async (args) => {
      const { query } = z.object({ query: z.string() }).parse(args);
      const results = await searchKnowledgeBase(query);
      if (!results.length) return { found: false };
      return { found: true, results };
    },
  },
];

export function findTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** Executes a tool by name with unvalidated model-supplied args. Never throws
    into the caller — invalid args or an unknown tool name become a typed
    error object the model can see and recover from. */
export async function executeTool(name: string, args: unknown): Promise<unknown> {
  const tool = findTool(name);
  if (!tool) return { error: 'unknown_tool', name };
  try {
    return await tool.run(args);
  } catch (e) {
    return { error: 'invalid_arguments', name, message: e instanceof Error ? e.message : String(e) };
  }
}
