/* Pipeline forecast: "based on current pipeline, will we hit target?"
   Grounded in historical stage-to-delivery rates, not a guess — for each open stage,
   what fraction of matured leads that ever reached that stage went on to be delivered.
   No LLM, no trend extrapolation on noise: this is the same rules-based approach as
   the rest of the AI layer, just answering a forward-looking question. */
import { OPEN_STAGES, sum } from '../domain/model';
import type { Lead, Model, StageKey } from '../domain/types';

const DAY = 86400000;

export type StageDeliveryRates = Partial<Record<StageKey, number>>;

/** P(eventually delivered | reached stage X), computed over matured leads only —
    a fresh "new" lead created yesterday hasn't had time to resolve, so including it
    would understate every stage's true conversion odds. */
export function stageDeliveryRates(model: Model): StageDeliveryRates {
  const matured = model.leads.filter((l) => (model.asOf.getTime() - l.createdAt.getTime()) / DAY >= model.maturityDays);
  const rates: StageDeliveryRates = {};
  for (const s of OPEN_STAGES) {
    const reached = matured.filter((l) => s in l.stageAt);
    const delivered = reached.filter((l) => l.status === 'delivered');
    rates[s] = reached.length ? delivered.length / reached.length : 0;
  }
  return rates;
}

export interface PipelineForecast {
  openCount: number;
  openValue: number;
  expectedUnits: number;
  expectedRevenue: number;
  currentUnits: number;
  targetUnits: number;
  projectedUnits: number;
  projectedAttainment: number | null;
  currentAttainment: number | null;
}

/** Expected additional units/revenue from the CURRENT open book, using each lead's
    stage to look up its historical odds of eventually being delivered. Additive
    across leads (linearity of expectation) — no simulation needed. */
export function forecastPipeline(
  openLeads: Lead[],
  rates: StageDeliveryRates,
  currentUnits: number,
  targetUnits: number,
): PipelineForecast {
  let expectedUnits = 0;
  let expectedRevenue = 0;
  openLeads.forEach((l) => {
    const p = rates[l.status as StageKey] ?? 0;
    expectedUnits += p;
    expectedRevenue += p * l.dealValue;
  });
  const projectedUnits = currentUnits + expectedUnits;
  return {
    openCount: openLeads.length,
    openValue: sum(openLeads.map((l) => l.dealValue)),
    expectedUnits,
    expectedRevenue,
    currentUnits,
    targetUnits,
    projectedUnits,
    projectedAttainment: targetUnits ? projectedUnits / targetUnits : null,
    currentAttainment: targetUnits ? currentUnits / targetUnits : null,
  };
}
