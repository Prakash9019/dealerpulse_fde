import { cache } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { buildModel } from './domain/model';
import { analyze } from './analytics/context';
import type { Filters, Model, RawData } from './domain/types';
import type { Context } from './analytics/context';

/** One static JSON read, memoised for the life of the server process. No database. */
export const getModel = cache((): Model => {
  const raw: RawData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/dealership_data.json'), 'utf8'),
  );
  return buildModel(raw);
});

/** Memoised per request by filter key — analyze() costs a few ms on 510 leads. */
export const getContext = cache((filters: Filters): Context => analyze(getModel(), filters));

export type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseFilters(sp: SearchParams, extra: Filters = {}): Filters {
  return {
    range: one(sp.range) || 'all',
    branchId: one(sp.branch) || extra.branchId,
    repId: one(sp.rep) || extra.repId,
    custom: sp.from && sp.to ? { from: one(sp.from), to: one(sp.to) } : undefined,
  };
}
