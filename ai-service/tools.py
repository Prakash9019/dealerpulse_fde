"""Read-only LangChain tools for the DealerPulse agent. Every tool is a thin
HTTP wrapper that calls back into the Next.js app's /api/tools/execute
endpoint, which runs the exact same validated analytics functions the
in-process TypeScript Gemini integration uses (src/lib/ai/gemini/tools.ts).
This service never re-implements analytics, never reads dealership_data.json
directly, and never gets a database handle — it can only ask the app to run
one of a fixed, named, read-only tool and gets back a JSON result."""
from typing import Optional

import httpx
from langchain_core.tools import tool

from config import NEXT_APP_URL


def _call_tool(name: str, args: dict) -> dict:
    try:
        resp = httpx.post(
            f"{NEXT_APP_URL}/api/tools/execute",
            json={"name": name, "args": args},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json().get("result", {"error": "empty_response"})
    except httpx.HTTPError as e:
        return {"error": "tool_unreachable", "name": name, "message": str(e)}


@tool
def get_network_kpis(range: Optional[str] = None) -> dict:
    """Network-wide KPIs: units delivered, revenue, lead-to-delivery conversion, revenue at risk, for a given range (all, 30d, quarter, month)."""
    return _call_tool("get_network_kpis", {"range": range})


@tool
def get_branch_performance(branchId: str, range: Optional[str] = None) -> dict:
    """Full performance metrics for one branch: conversion, units, revenue, target attainment, pipeline, stale leads, funnel, and the list of reps assigned to this branch with their individual conversion/leads/delivered/stale figures (use this — not a guess — to answer "which reps are affected" for a branch). branchId may be an id (e.g. B1) or a plain branch name (e.g. 'Lakeside Toyota' or 'Lakeside')."""
    return _call_tool("get_branch_performance", {"branchId": branchId, "range": range})


@tool
def get_rep_performance(repId: str, range: Optional[str] = None) -> dict:
    """Performance metrics for one sales rep: conversion, leads handled, orders, delivered, pipeline, stale leads. repId may be an id (e.g. SR2) or a plain rep name (e.g. 'Meera Menon')."""
    return _call_tool("get_rep_performance", {"repId": repId, "range": range})


@tool
def get_funnel_metrics(range: Optional[str] = None, branchId: Optional[str] = None, repId: Optional[str] = None) -> dict:
    """Funnel stage-by-stage volume, conversion, drop-off, median and p90 duration, optionally scoped to a branch or rep."""
    return _call_tool("get_funnel_metrics", {"range": range, "branchId": branchId, "repId": repId})


@tool
def get_lead_aging(range: Optional[str] = None, branchId: Optional[str] = None, repId: Optional[str] = None) -> dict:
    """Lead aging buckets (0-3, 4-7, 8-14, 15-30, 30+ days idle) and stale-lead totals, optionally scoped."""
    return _call_tool("get_lead_aging", {"range": range, "branchId": branchId, "repId": repId})


@tool
def get_revenue_at_risk(range: Optional[str] = None, branchId: Optional[str] = None, repId: Optional[str] = None) -> dict:
    """Revenue at risk from stale/idle open leads, optionally scoped."""
    return _call_tool("get_revenue_at_risk", {"range": range, "branchId": branchId, "repId": repId})


@tool
def get_forecast(range: Optional[str] = None, branchId: Optional[str] = None) -> dict:
    """Pipeline forecast against target, optionally scoped to a branch. Returns available:false when there isn't enough matured historical data — never fabricate a forecast."""
    return _call_tool("get_forecast", {"range": range, "branchId": branchId})


@tool
def get_anomalies(range: Optional[str] = None, branchId: Optional[str] = None, repId: Optional[str] = None) -> dict:
    """Ranked, capped anomalies (critical/risk/watch/opportunity) detected in the current data, optionally scoped."""
    return _call_tool("get_anomalies", {"range": range, "branchId": branchId, "repId": repId})


@tool
def run_scenario(stageIndex: int, improvementPts: float, branchId: Optional[str] = None, range: Optional[str] = None) -> dict:
    """Simulate improving conversion at one funnel-stage transition (1=New->Contacted .. 5=OrderPlaced->Delivered) by N percentage points. Read-only simulation, never changes real data."""
    return _call_tool("run_scenario", {"stageIndex": stageIndex, "improvementPts": improvementPts, "branchId": branchId, "range": range})


ALL_TOOLS = [
    get_network_kpis,
    get_branch_performance,
    get_rep_performance,
    get_funnel_metrics,
    get_lead_aging,
    get_revenue_at_risk,
    get_forecast,
    get_anomalies,
    run_scenario,
]
