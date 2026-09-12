import { STAGE_LABEL, STAGES, div, median, quantile } from '../domain/model';
import type { Lead, StageKey } from '../domain/types';

const DAY = 86400000;

export interface FunnelStage {
  stage: StageKey;
  label: string;
  count: number;
  shareOfTop: number;
  convFromPrev: number;
  dropOff: number;
  lostHere: number;
  medianDays: number | null;
  p90Days: number | null;
  n: number;
}

export function funnel(leads: Lead[]): FunnelStage[] {
  const counts = STAGES.map((s) => leads.filter((l) => s in l.stageAt).length);
  return STAGES.map((s, i) => {
    const durs = i === 0 ? [] : leads
      .filter((l) => l.stageAt[STAGES[i - 1]] && l.stageAt[s])
      .map((l) => (l.stageAt[s]!.getTime() - l.stageAt[STAGES[i - 1]]!.getTime()) / DAY);
    const lostHere = leads.filter((l) => l.lostFrom === STAGES[i - 1]).length;
    return {
      stage: s, label: STAGE_LABEL[s], count: counts[i],
      shareOfTop: div(counts[i], counts[0]),
      convFromPrev: i === 0 ? 1 : div(counts[i], counts[i - 1]),
      dropOff: i === 0 ? 0 : counts[i - 1] - counts[i],
      lostHere,
      medianDays: i === 0 ? null : median(durs),
      p90Days: i === 0 ? null : quantile(durs, 0.9),
      n: i === 0 ? counts[0] : counts[i - 1],
    };
  });
}

export interface StageLeak {
  stage: StageKey;
  fromStage: StageKey;
  label: string;
  conv: number;
  net: number;
  gap: number;
  n: number;
  excessLoss: number;
}

/** Rank funnel steps by leads lost in excess of the baseline. Volume-weighted, so a
    small-sample stage cannot outrank the step where the real losses happen. */
export function stageLeaks(entityFunnel: FunnelStage[], baseFunnel: FunnelStage[], minN = 8): StageLeak[] {
  return entityFunnel.slice(1).map((s, i) => {
    const net = baseFunnel[i + 1].convFromPrev;
    return {
      stage: s.stage, fromStage: STAGES[i], label: STAGE_LABEL[STAGES[i]] + ' → ' + s.label,
      conv: s.convFromPrev, net, gap: s.convFromPrev - net, n: s.n,
      excessLoss: s.n * (net - s.convFromPrev),
    };
  }).filter((s) => s.n >= minN).sort((a, b) => b.excessLoss - a.excessLoss);
}

export const conversion = (leads: Lead[]): number =>
  div(leads.filter((l) => l.status === 'delivered').length, leads.length);

export interface MaturedConversion {
  rate: number;
  n: number;
  excluded: number;
}

/** Cohort conversion excluding leads too young to have plausibly closed. */
export function maturedConversion(leads: Lead[], asOf: Date, maturityDays: number): MaturedConversion {
  const mature = leads.filter((l) => (asOf.getTime() - l.createdAt.getTime()) / DAY >= maturityDays);
  return { rate: conversion(mature), n: mature.length, excluded: leads.length - mature.length };
}
