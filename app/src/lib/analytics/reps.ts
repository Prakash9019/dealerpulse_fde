import { STALE_DAYS, div, sum } from '../domain/model';
import type { Delivery, Lead, Model } from '../domain/types';
import { conversion } from './funnel';

export interface RepRow {
  id: string;
  name: string;
  branchId: string | undefined;
  branchName: string | undefined;
  role: string;
  leads: number;
  contacted: number;
  contactRate: number;
  orders: number;
  delivered: number;
  conversion: number;
  adjustedConversion: number;
  pipelineValue: number;
  revenue: number;
  openCount: number;
  staleCount: number;
  staleValue: number;
  lost: number;
  networkRank: number;
  branchRank: number;
  branchRepCount: number;
  networkRankOf: number;
}

export function repRows(model: Model, leads: Lead[], dels: Delivery[]): RepRow[] {
  const ids = [...new Set(leads.map((l) => l.repId))];
  const rows = ids.map((id) => {
    const rep = model.repById[id];
    const ls = leads.filter((l) => l.repId === id);
    const open = ls.filter((l) => l.open);
    const stale = open.filter((l) => l.idleDays >= STALE_DAYS);
    const d = dels.filter((x) => x.repId === id);
    const contacted = ls.filter((l) => 'contacted' in l.stageAt);
    const delivered = ls.filter((l) => l.status === 'delivered');
    return {
      id, name: rep?.name || id, branchId: rep?.branchId, branchName: rep?.branchName,
      role: rep?.roleLabel || '—',
      leads: ls.length,
      contacted: contacted.length,
      contactRate: div(contacted.length, ls.length),
      orders: ls.filter((l) => 'order_placed' in l.stageAt).length,
      delivered: delivered.length,
      conversion: conversion(ls),
      adjustedConversion: div(delivered.length, contacted.length),
      pipelineValue: sum(open.map((l) => l.dealValue)),
      revenue: sum(d.map((x) => x.revenue)),
      openCount: open.length,
      staleCount: stale.length, staleValue: sum(stale.map((l) => l.dealValue)),
      lost: ls.filter((l) => l.status === 'lost').length,
    } as RepRow;
  }).filter((r) => r.leads > 0);
  rows.sort((a, b) => b.conversion - a.conversion || b.delivered - a.delivered);
  rows.forEach((r, i) => { r.networkRank = i + 1; });
  model.branches.forEach((b) => {
    const inb = rows.filter((r) => r.branchId === b.id).sort((a, b2) => b2.conversion - a.conversion);
    inb.forEach((r, i) => { r.branchRank = i + 1; r.branchRepCount = inb.length; });
  });
  rows.forEach((r) => { r.networkRankOf = rows.length; });
  return rows;
}
