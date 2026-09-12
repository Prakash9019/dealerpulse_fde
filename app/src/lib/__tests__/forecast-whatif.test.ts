/* Tests for the two newly-added open-ended features: pipeline forecasting and the
   what-if funnel simulator. Same pattern as analytics.test.ts — assertions recompute
   expectations independently where practical, or check invariants the implementation
   must satisfy regardless of the exact dataset. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../domain/model';
import { analyze } from '../analytics/context';
import { forecastPipeline, stageDeliveryRates } from '../insights/forecast';
import { whatIfStageImprovement } from '../insights/whatif';
import type { RawData } from '../domain/types';

const raw: RawData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../data/dealership_data.json'), 'utf8'),
);
const model = buildModel(raw);
const ctx = analyze(model, { range: 'all' });

describe('forecast', () => {
  it('stage delivery rates rise the closer a stage is to revenue', () => {
    const rates = stageDeliveryRates(model);
    expect(rates.order_placed!).toBeGreaterThan(rates.negotiation!);
    expect(rates.negotiation!).toBeGreaterThan(rates.new!);
    Object.values(rates).forEach((r) => {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    });
  });

  it('order-placed leads carry a near-certain delivery rate', () => {
    const rates = stageDeliveryRates(model);
    expect(rates.order_placed!).toBeGreaterThan(0.7);
  });

  it('expected units is additive across leads and bounded by open count', () => {
    const rates = stageDeliveryRates(model);
    const forecast = forecastPipeline(ctx.openLeads, rates, ctx.kpi.units, ctx.targets.targetUnits);
    expect(forecast.expectedUnits).toBeGreaterThanOrEqual(0);
    expect(forecast.expectedUnits).toBeLessThanOrEqual(forecast.openCount);
    expect(forecast.projectedUnits).toBe(forecast.currentUnits + forecast.expectedUnits);
  });

  it('expected revenue matches a manual per-lead sum with synthetic rates', () => {
    const leads = ctx.openLeads.slice(0, 5);
    const rates = { new: 0.1, contacted: 0.2, test_drive: 0.3, negotiation: 0.5, order_placed: 0.9 };
    const forecast = forecastPipeline(leads, rates, 0, 0);
    const manual = leads.reduce((s, l) => s + (rates[l.status as keyof typeof rates] ?? 0) * l.dealValue, 0);
    expect(Math.abs(forecast.expectedRevenue - manual)).toBeLessThan(1);
  });

  it('projected attainment is null without a target, defined with one', () => {
    const rates = stageDeliveryRates(model);
    const noTarget = forecastPipeline(ctx.openLeads, rates, ctx.kpi.units, 0);
    expect(noTarget.projectedAttainment).toBeNull();
    const withTarget = forecastPipeline(ctx.openLeads, rates, ctx.kpi.units, 100);
    expect(withTarget.projectedAttainment).toBe(withTarget.projectedUnits / 100);
  });
});

describe('what-if', () => {
  it('zero improvement reproduces the actual observed delivered count', () => {
    const r = whatIfStageImprovement(ctx.netFunnel, ctx.kpi.avgDealValue, 1, 0);
    expect(Math.abs(r.projectedDelivered - r.baselineDelivered)).toBeLessThan(1e-6);
    expect(r.deltaUnits).toBeCloseTo(0, 6);
  });

  it('a positive improvement at a stage with headroom increases projected deliveries', () => {
    const r = whatIfStageImprovement(ctx.netFunnel, ctx.kpi.avgDealValue, 1, 0.1);
    expect(r.improvedConv).toBeGreaterThan(r.baselineConv);
    expect(r.deltaUnits).toBeGreaterThan(0);
    expect(r.projectedDelivered).toBeGreaterThan(r.baselineDelivered);
  });

  it('improved conversion is clamped to 100%', () => {
    const r = whatIfStageImprovement(ctx.netFunnel, ctx.kpi.avgDealValue, 1, 5);
    expect(r.improvedConv).toBeLessThanOrEqual(1);
  });

  it('delta revenue equals delta units times average deal value', () => {
    const r = whatIfStageImprovement(ctx.netFunnel, ctx.kpi.avgDealValue, 2, 0.15);
    expect(r.deltaRevenue).toBeCloseTo(r.deltaUnits * ctx.kpi.avgDealValue, 6);
  });

  it('labels the transition being simulated', () => {
    const r = whatIfStageImprovement(ctx.netFunnel, ctx.kpi.avgDealValue, 2, 0.1);
    expect(r.fromLabel).toBe('Contacted');
    expect(r.toLabel).toBe('Test Drive');
  });
});
