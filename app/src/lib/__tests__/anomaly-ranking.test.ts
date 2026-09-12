import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildModel } from '../domain/model';
import { analyze } from '../analytics/context';
import { rankAnomalies } from '../insights/anomalies';
import type { RawData } from '../domain/types';

const raw: RawData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/dealership_data.json'), 'utf8'));
const model = buildModel(raw);
const ctx = analyze(model, { range: 'all' });

describe('rankAnomalies', () => {
  it('caps shown anomalies at the configured max, keeping the rest in overflow', () => {
    const { shown, overflow } = rankAnomalies(ctx.anomalies, 3);
    expect(shown.length).toBeLessThanOrEqual(3);
    expect(shown.length + overflow.length).toBe(ctx.anomalies.length);
  });

  it('never drops an anomaly — shown + overflow together equal the full set', () => {
    const { shown, overflow } = rankAnomalies(ctx.anomalies);
    const ids = new Set([...shown, ...overflow].map((a) => a.id));
    expect(ids.size).toBe(ctx.anomalies.length);
  });

  it('keeps severity order across the tier boundary, using magnitude only within a tier', () => {
    const order: Record<string, number> = { critical: 0, risk: 1, watch: 2, opportunity: 3 };
    const { shown } = rankAnomalies(ctx.anomalies, ctx.anomalies.length);
    for (let i = 1; i < shown.length; i++) {
      expect(order[shown[i].severity]).toBeGreaterThanOrEqual(order[shown[i - 1].severity]);
    }
  });

  it('within the same severity tier, ranks by magnitude descending', () => {
    const { shown } = rankAnomalies(ctx.anomalies, ctx.anomalies.length);
    for (let i = 1; i < shown.length; i++) {
      if (shown[i].severity === shown[i - 1].severity) {
        expect(shown[i].magnitude).toBeLessThanOrEqual(shown[i - 1].magnitude);
      }
    }
  });
});
