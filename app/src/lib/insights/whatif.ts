/* What-if scenario: "if we improve stage X→Y conversion by N points, what's the
   revenue impact?" A deterministic funnel re-simulation — entrants at the improved
   stage are unchanged (real, observed), only that stage's conversion rate is bumped;
   every later stage keeps its own historical conversion rate applied to the new,
   larger (or smaller) count flowing into it. No LLM: this is arithmetic over
   already-computed funnel stages. */
import type { FunnelStage } from '../analytics/funnel';

export interface WhatIfResult {
  fromLabel: string;
  toLabel: string;
  baselineConv: number;
  improvedConv: number;
  improvementPts: number;
  baselineDelivered: number;
  projectedDelivered: number;
  deltaUnits: number;
  deltaRevenue: number;
}

/** stageIndex is the position in `funnel` being entered (1..funnel.length-1) —
    e.g. stageIndex=2 means the Contacted -> Test Drive transition. */
export function whatIfStageImprovement(
  funnel: FunnelStage[],
  avgDealValue: number,
  stageIndex: number,
  improvementPts: number,
): WhatIfResult {
  const baseline = funnel[stageIndex].convFromPrev;
  const improved = Math.max(0, Math.min(1, baseline + improvementPts));

  const counts = funnel.map((s) => s.count);
  counts[stageIndex] = counts[stageIndex - 1] * improved;
  for (let j = stageIndex + 1; j < funnel.length; j++) {
    counts[j] = counts[j - 1] * funnel[j].convFromPrev;
  }

  const baselineDelivered = funnel[funnel.length - 1].count;
  const projectedDelivered = counts[counts.length - 1];
  const deltaUnits = projectedDelivered - baselineDelivered;

  return {
    fromLabel: funnel[stageIndex - 1].label,
    toLabel: funnel[stageIndex].label,
    baselineConv: baseline,
    improvedConv: improved,
    improvementPts,
    baselineDelivered,
    projectedDelivered,
    deltaUnits,
    deltaRevenue: deltaUnits * avgDealValue,
  };
}
