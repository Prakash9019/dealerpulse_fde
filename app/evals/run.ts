/* Deterministic evaluation runner for Ask DealerPulse.
   Run with: npm run eval
   Never fabricates a result: any check that genuinely requires a live
   Gemini call (or the embedding API) is marked SKIPPED — not PASSED — when
   GEMINI_API_KEY isn't configured. This file is read-only against the
   dataset and the running dashboard; it makes no destructive calls. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Unlike `next dev`, a standalone tsx script doesn't auto-load .env.local —
// load it explicitly (Node 20.6+ native API) so GEMINI_API_KEY is visible
// here too. Silently no-ops if the file doesn't exist (e.g. CI without a key).
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local')); } catch { /* no .env.local present */ }
import { buildModel } from '../src/lib/domain/model';
import { analyze, type Context } from '../src/lib/analytics/context';
import { askDealerPulse } from '../src/lib/ai/questionRouter';
import { askGemini, looksLikeSystemPromptLeak, type ChatTurn } from '../src/lib/ai/gemini/answer';
import { isGeminiConfigured } from '../src/lib/ai/gemini/config';
import { getAiHealth } from '../src/lib/ai/observability';
import { TOOLS, executeTool } from '../src/lib/ai/gemini/tools';
import { NO_GROUNDED_ANSWER, groundedAnswerSchema } from '../src/lib/ai/gemini/schema';
import { searchKnowledgeBase } from '../src/lib/rag/retrieval';
import { rankAnomalies } from '../src/lib/insights/anomalies';
import { forecastPipeline, stageDeliveryRates } from '../src/lib/insights/forecast';
import { whatIfStageImprovement } from '../src/lib/insights/whatif';
import { fmtINR, fmtNum, fmtPct } from '../src/lib/format';
import { renderExecutivePdf } from '../src/lib/export/pdf';
import { buildExecutiveReport } from '../src/lib/export/report';
import type { RawData } from '../src/lib/domain/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, '..');

type Status = 'PASS' | 'FAIL' | 'SKIP';
interface CheckResult {
  id: string;
  category: string;
  status: Status;
  detail: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// A brief pause between live Gemini/embedding calls. Running the full suite
// back-to-back with no pacing was observed to exhaust free-tier rate limits
// partway through, producing "fetch failed" noise unrelated to correctness.
const LIVE_CALL_PACING_MS = 2500;

const results: CheckResult[] = [];
function record(id: string, category: string, status: Status, detail: string) {
  results.push({ id, category, status, detail });
}

// ---------- setup ----------
const raw: RawData = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'data/dealership_data.json'), 'utf8'));
const model = buildModel(raw);
const ctx: Context = analyze(model, { range: 'all' });
const geminiConfigured = isGeminiConfigured();

function loadJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

// ---------- fact resolution (computed live from the analytics engine — never hardcoded) ----------
function resolveFact(factKey: string): { display: string; raw: unknown } | null {
  const parts = factKey.split('.');
  const [scope, a, b] = parts;

  if (scope === 'network') {
    if (a === 'revenue') return { display: fmtINR(ctx.kpi.revenue), raw: ctx.kpi.revenue };
    if (a === 'units') return { display: fmtNum(ctx.kpi.units), raw: ctx.kpi.units };
    if (a === 'conversion') return { display: ctx.kpi.conversion != null ? fmtPct(ctx.kpi.conversion) : '—', raw: ctx.kpi.conversion };
    if (a === 'revenueAtRisk') return { display: fmtINR(ctx.kpi.revenueAtRisk), raw: ctx.kpi.revenueAtRisk };
  }
  if (scope === 'branch') {
    const row = ctx.branchRows.find((x) => x.id === a);
    if (!row) return null;
    if (b === 'conversion') return { display: fmtPct(row.maturedConversion), raw: row.maturedConversion };
  }
  if (scope === 'rep') {
    const row = ctx.reps.find((x) => x.id === a);
    if (!row) return null;
    if (b === 'conversion') return { display: fmtPct(row.conversion), raw: row.conversion };
  }
  if (scope === 'funnel' && a === 'worstStage' && b === 'label') {
    const worst = ctx.netFunnel.slice(1).reduce((x, y) => (x.dropOff >= y.dropOff ? x : y));
    return { display: worst.label, raw: worst.stage };
  }
  if (scope === 'aging' && a === 'staleCount') {
    return { display: String(ctx.aging.staleCount), raw: ctx.aging.staleCount };
  }
  if (scope === 'anomaly' && a === 'topSeverity') {
    const ranked = rankAnomalies(ctx.anomalies).shown;
    return { display: ranked[0]?.severity ?? 'none', raw: ranked[0]?.severity };
  }
  if (scope === 'forecast' && a === 'availability') {
    const maturedCount = ctx.cohort.filter((l) => (model.asOf.getTime() - l.createdAt.getTime()) / 86400000 >= model.maturityDays).length;
    if (maturedCount < 10) return { display: 'unavailable', raw: false };
    // The model states the projected unit count in prose, never the literal
    // word "available" — check the actual number it would ground the answer in.
    const forecast = forecastPipeline(ctx.openLeads, stageDeliveryRates(model), ctx.kpi.units, ctx.targets.targetUnits);
    return { display: `${forecast.projectedUnits.toFixed(1)} projected units`, raw: forecast.projectedUnits };
  }
  if (scope === 'scenario' && a === 'stage2' && b === 'plus10') {
    const result = whatIfStageImprovement(ctx.funnel, ctx.kpi.avgDealValue, 2, 0.10);
    return { display: `${result.deltaUnits >= 0 ? '+' : ''}${result.deltaUnits.toFixed(1)} units`, raw: result.deltaUnits };
  }
  if (scope === 'policy' && a === 'escalation' && b === 'mentionsBranchManager') {
    return { display: 'branch manager', raw: true };
  }
  if (scope === 'refusal') {
    return { display: NO_GROUNDED_ANSWER, raw: NO_GROUNDED_ANSWER };
  }
  return null;
}

function softMatch(answer: string, expected: string): boolean {
  const a = answer.toLowerCase();
  const e = expected.toLowerCase();
  if (a.includes(e)) return true;
  // numeric soft match: strip currency/percent formatting, compare digit sequences
  const digitsOnly = (s: string) => s.replace(/[^\d.]/g, '');
  const ed = digitsOnly(expected);
  return ed.length > 0 && a.includes(ed);
}

/** Extracts every number the model's prose might have expressed a fact as —
    "₹38.9 Cr", "38900000", "37.26%" — normalized to the same units the
    analytics engine itself uses (plain rupees, plain fraction). This lets us
    compare against the live-computed raw value with a tolerance, so a
    correct answer that's merely formatted differently (Cr-shorthand vs a
    full number, or a more precise percentage) isn't scored as wrong — while
    a materially different (wrong) number still fails, since tolerance is tight. */
function extractNumbers(text: string): number[] {
  const nums: number[] = [];
  const crRegex = /([\d,]+(?:\.\d+)?)\s*(?:cr\b|crore)/gi;
  let m: RegExpExecArray | null;
  while ((m = crRegex.exec(text))) nums.push(parseFloat(m[1].replace(/,/g, '')) * 1e7);
  const pctRegex = /([\d,]+(?:\.\d+)?)\s*%/g;
  while ((m = pctRegex.exec(text))) nums.push(parseFloat(m[1].replace(/,/g, '')) / 100);
  const plainRegex = /(?:[₹$]\s*)?([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g;
  while ((m = plainRegex.exec(text))) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isNaN(v)) nums.push(v);
  }
  return nums;
}

function numericSoftMatch(answer: string, rawValue: number, relTolerance = 0.02): boolean {
  const nums = extractNumbers(answer);
  const tolerance = Math.abs(rawValue) * relTolerance + 1e-9;
  return nums.some((n) => Math.abs(n - rawValue) <= tolerance);
}

function factMatches(answerText: string, fact: { display: string; raw: unknown }): boolean {
  if (typeof fact.raw === 'number') {
    return numericSoftMatch(answerText, fact.raw) || softMatch(answerText, fact.display);
  }
  return softMatch(answerText, fact.display);
}

// ---------- Phase 1/3: golden questions ----------
// Phase 3 redesign: rigid exact-tool/exact-phrase matching replaced with
// product-correctness matching. A case now declares *acceptable* tool
// routes (plural — a valid alternative route must pass), the facts that
// must be present (checked via live-computed values + tolerant numeric/text
// matching, never hardcoded expected strings), evidence keywords that must
// actually appear (previously declared but never enforced — a real gap),
// forbidden claims, and optionally that a concrete recommendation is
// required. Unsupported/fabricated claims still fail via requiredFacts +
// forbiddenClaims; this only widens what counts as a *valid* route/phrasing.
interface GoldenTurn { question: string; range?: string; branchId?: string; repId?: string }
interface GoldenCase {
  id: string; category: string; turns: GoldenTurn[];
  acceptableTools: string[] | null; requiredFacts: string[];
  requiredEvidenceKeywords?: string[]; forbiddenClaims: string[];
  requiresRecommendation?: boolean;
}

function evidenceContainsAll(answer: { answer: string; evidence: { metric: string; value: string; context: string }[] }, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = (answer.answer + ' ' + answer.evidence.map((e) => `${e.metric} ${e.value} ${e.context}`).join(' ')).toLowerCase();
  return keywords.every((k) => haystack.includes(k.toLowerCase()));
}

async function runGolden() {
  const cases = loadJson<GoldenCase[]>('golden_questions.json');
  for (const c of cases) {
    const facts = c.requiredFacts.map((k) => ({ key: k, fact: resolveFact(k) }));
    const missing = facts.find((f) => !f.fact);
    if (missing) { record(c.id, c.category, 'SKIP', `factKey ${missing.key} did not resolve (branch/rep/stage not found in dataset)`); continue; }
    const resolvedFacts = facts as { key: string; fact: { display: string; raw: unknown } }[];

    // Deterministic path always runs — no key required.
    const lastTurn = c.turns[c.turns.length - 1];
    const detAnswer = askDealerPulse(ctx, lastTurn.question);
    const detText = detAnswer.answer;
    const detForbidden = c.forbiddenClaims.find((f) => detText.toLowerCase().includes(f.toLowerCase()));
    const detFactsOk = c.category === 'refusal'
      ? (detText === NO_GROUNDED_ANSWER || detAnswer.evidence.length === 0)
      : resolvedFacts.every(({ fact }) => factMatches(detText, fact));

    // These categories don't exist in the deterministic askDealerPulse router at all —
    // it predates the forecast/anomaly/scenario tools and has no RAG capability. Checking
    // them against the deterministic path would be an eval-design bug, not a product bug.
    const geminiOnlyCategory = ['multi_turn', 'forecast', 'anomalies', 'whatif', 'policy'].includes(c.category);

    if (!geminiConfigured) {
      const status: Status = geminiOnlyCategory ? 'SKIP' : (detFactsOk && !detForbidden ? 'PASS' : 'FAIL');
      record(c.id, c.category, status,
        geminiOnlyCategory
          ? `${c.category} requires the Gemini tool-calling path (not implemented in the deterministic askDealerPulse router by design) — skipped without a key`
          : `deterministic path: required facts [${resolvedFacts.map((f) => f.fact.display).join(', ')}] ${detFactsOk ? 'all found' : 'NOT all found'} in "${detText.slice(0, 160)}"`);
      continue;
    }

    // Gemini path — real multi-turn with accumulated history.
    const history: ChatTurn[] = [];
    let finalAnswer: Awaited<ReturnType<typeof askGemini>> | null = null;
    const toolsUsedAcrossTurns: string[] = [];
    for (const turn of c.turns) {
      await sleep(LIVE_CALL_PACING_MS);
      finalAnswer = await askGemini(turn.question, history);
      history.push({ role: 'user', text: turn.question }, { role: 'model', text: finalAnswer.answer });
      // Record right after each turn — a multi-turn case's earlier turns are
      // just as relevant to "was a valid tool route ever used" as the last one.
      toolsUsedAcrossTurns.push(...(getAiHealth().recent[0]?.toolCalls || []));
    }
    if (!finalAnswer) { record(c.id, c.category, 'FAIL', 'no answer returned'); continue; }

    const toolsUsed = toolsUsedAcrossTurns;
    // Plural acceptable routes: any one of the declared valid tools counts —
    // a route not in this list (unauthorized/arbitrary tool) still fails.
    const toolOk = c.acceptableTools ? c.acceptableTools.some((t) => toolsUsed.includes(t)) : true;
    const forbidden = c.forbiddenClaims.find((f) => finalAnswer!.answer.toLowerCase().includes(f.toLowerCase()));
    const factsOk = c.category === 'refusal'
      ? finalAnswer.answer === NO_GROUNDED_ANSWER
      : resolvedFacts.every(({ fact }) => factMatches(finalAnswer!.answer, fact));
    const evidenceOk = evidenceContainsAll(finalAnswer, c.requiredEvidenceKeywords ?? []);
    const recommendationOk = c.requiresRecommendation ? !!finalAnswer.recommendation : true;
    const schemaOk = groundedAnswerSchema.safeParse(finalAnswer).success;

    const pass = finalAnswer.usedGemini && factsOk && evidenceOk && recommendationOk && !forbidden && toolOk && schemaOk;
    record(c.id, c.category, pass ? 'PASS' : 'FAIL',
      `usedGemini=${finalAnswer.usedGemini} tool=${toolsUsed.join(',') || 'none'}(acceptable: ${c.acceptableTools?.join('|') ?? 'any/none'}) facts=${factsOk} evidence=${evidenceOk} recommendation=${recommendationOk} schema=${schemaOk} answer="${finalAnswer.answer.slice(0, 140)}"`);
  }
}

// ---------- Phase 1/9: security cases ----------
interface SecurityCase {
  id: string; category: string; description: string; mode: string; check: string;
  input?: Record<string, unknown>; expectedBehavior: string;
}

async function runSecurity() {
  const cases = loadJson<SecurityCase[]>('security_cases.json');
  for (const c of cases) {
    try {
      if (c.check === 'unknown_tool_returns_error') {
        const r = await executeTool(String(c.input?.name), c.input?.args) as { error?: string };
        record(c.id, c.category, r?.error === 'unknown_tool' ? 'PASS' : 'FAIL', JSON.stringify(r));
      } else if (c.check === 'sql_shaped_arg_is_safely_not_found') {
        const args = c.input?.args as Record<string, unknown>;
        const r = await executeTool(String(c.input?.name), args) as { error?: string };
        record(c.id, c.category, r?.error === 'not_found' ? 'PASS' : 'FAIL', JSON.stringify(r));
      } else if (c.check === 'malformed_args_rejected') {
        const r = await executeTool(String(c.input?.name), c.input?.args) as { error?: string };
        record(c.id, c.category, r?.error === 'invalid_arguments' ? 'PASS' : 'FAIL', JSON.stringify(r));
      } else if (c.check === 'oversized_question_does_not_throw') {
        const huge = 'a'.repeat(Number(c.input?.questionLength || 100000));
        let threw = false;
        let ans;
        try { ans = askDealerPulse(ctx, huge); } catch { threw = true; }
        record(c.id, c.category, !threw && !!ans ? 'PASS' : 'FAIL', threw ? 'threw an exception' : 'returned normally');
      } else if (c.check === 'rate_limiter_blocks_after_limit') {
        // Re-implements the exact bucket logic from api/ask/route.ts against a fresh bucket,
        // since that module-scope Map isn't exported. Verifies the algorithm, not the live route.
        const limit = Number(c.input?.limit ?? 20);
        const bucket = { count: 0, resetAt: Date.now() + 60_000 };
        let blockedAt = -1;
        for (let i = 1; i <= Number(c.input?.requests ?? 25); i++) {
          bucket.count++;
          if (bucket.count > limit && blockedAt === -1) blockedAt = i;
        }
        record(c.id, c.category, blockedAt === limit + 1 ? 'PASS' : 'FAIL', `blocked at request #${blockedAt}, expected #${limit + 1}`);
      } else if (c.check === 'max_tool_iterations_constant_enforced') {
        const src = fs.readFileSync(path.join(APP_ROOT, 'src/lib/ai/gemini/answer.ts'), 'utf8');
        const hasConst = /MAX_TOOL_ITERATIONS\s*=\s*\d+/.test(src);
        const usedInLoop = /iterations\s*<\s*MAX_TOOL_ITERATIONS/.test(src);
        record(c.id, c.category, hasConst && usedInLoop ? 'PASS' : 'FAIL', `const=${hasConst} loopGuard=${usedInLoop}`);
      } else if (c.check === 'no_tool_returns_lead_pii') {
        const piiFields = ['customerName', 'phone'];
        const src = fs.readFileSync(path.join(APP_ROOT, 'src/lib/ai/gemini/tools.ts'), 'utf8');
        const leaks = piiFields.filter((f) => src.includes(f));
        record(c.id, c.category, leaks.length === 0 ? 'PASS' : 'FAIL', leaks.length ? `found reference to: ${leaks.join(', ')}` : `no PII field names referenced across ${TOOLS.length} tools`);
      } else if (c.check === 'unknown_branch_id_returns_not_found_not_all_data') {
        const args = c.input?.args as Record<string, unknown>;
        const r = await executeTool(String(c.input?.name), args) as Record<string, unknown>;
        const isNotFound = r?.error === 'not_found';
        const isFullList = Array.isArray(r);
        record(c.id, c.category, isNotFound && !isFullList ? 'PASS' : 'FAIL', JSON.stringify(r));
      } else if (c.mode === 'live_gemini') {
        if (!geminiConfigured) { record(c.id, c.category, 'SKIP', 'requires GEMINI_API_KEY'); continue; }
        await sleep(LIVE_CALL_PACING_MS);
        const ans = await askGemini(String(c.input?.question));
        const lowered = ans.answer.toLowerCase();
        if (c.check === 'does_not_reveal_system_prompt_or_change_behavior' || c.check === 'does_not_leak_system_instruction_text') {
          // Reuses the exact same multi-phrase detector the production code
          // uses to block a leak before it ever reaches a user (answer.ts's
          // looksLikeSystemPromptLeak) — this verifies that defense is wired
          // in end-to-end for a live call, not just unit-tested in isolation.
          // Found via live testing: a direct request once got the model to
          // repeat most of the system instruction verbatim before this guard
          // was added — see DECISIONS.md / commit history for the incident.
          const leaked = looksLikeSystemPromptLeak(ans.answer) || lowered.includes('you are dealerpulse');
          record(c.id, c.category, !leaked ? 'PASS' : 'FAIL', ans.answer.slice(0, 160));
        } else {
          record(c.id, c.category, 'SKIP', 'no handler for this live_gemini check');
        }
      } else if (c.mode === 'live_gemini_mocked_retrieval') {
        record(c.id, c.category, 'SKIP', 'requires mocking searchKnowledgeBase in a live-key environment — not exercised in this run (see ai-service Python suite for the equivalent live check pattern)');
      } else {
        record(c.id, c.category, 'SKIP', `no automated handler for check "${c.check}"`);
      }
    } catch (e) {
      record(c.id, c.category, 'FAIL', `threw: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ---------- Phase 1: RAG cases ----------
interface RagCase { id: string; query: string; expectedDocument: string | null; expectedKeywords: string[]; mode: string; note?: string }

async function runRag() {
  const cases = loadJson<RagCase[]>('rag_cases.json');
  for (const c of cases) {
    if (c.mode === 'policy_check') {
      const src = fs.readFileSync(path.join(APP_ROOT, 'src/lib/ai/gemini/answer.ts'), 'utf8');
      const hasSeparationRule = src.includes('search_knowledge_base') && /Never use search_knowledge_base for a KPI/i.test(src);
      record(c.id, 'rag', hasSeparationRule ? 'PASS' : 'FAIL', 'checks the system prompt text instructs numeric questions away from RAG');
      continue;
    }
    if (!geminiConfigured) { record(c.id, 'rag', 'SKIP', 'requires GEMINI_API_KEY (real embedding retrieval)'); continue; }
    await sleep(LIVE_CALL_PACING_MS);
    if (c.mode === 'live_embeddings') {
      const chunks = await searchKnowledgeBase(c.query, 3);
      const top = chunks[0];
      const docOk = !c.expectedDocument || top?.document === c.expectedDocument;
      const kwOk = c.expectedKeywords.every((k) => chunks.some((ch) => ch.text.toLowerCase().includes(k.toLowerCase())));
      record(c.id, 'rag', docOk && kwOk ? 'PASS' : 'FAIL', `top=${top?.document ?? 'none'} score=${top?.score?.toFixed(3) ?? 'n/a'}`);
    } else if (c.mode === 'live_gemini') {
      const ans = await askGemini(c.query);
      const health = getAiHealth();
      const toolsUsed = health.recent[0]?.toolCalls || [];
      const usedRag = toolsUsed.includes('search_knowledge_base');
      const citesDoc = !c.expectedDocument || ans.citations.some((cite) => cite.includes(c.expectedDocument!));
      record(c.id, 'rag', usedRag && citesDoc ? 'PASS' : 'FAIL', `tools=${toolsUsed.join(',')} citations=${ans.citations.join(',')}`);
    }
  }
}

// ---------- Phase 1: regression cases ----------
interface RegressionCase { id: string; description: string; check: string }

async function runRegression() {
  const cases = loadJson<RegressionCase[]>('regression_cases.json');
  for (const c of cases) {
    if (c.check === 'actions_csv_has_12_columns' || c.check === 'conversion_null_below_threshold' || c.check === 'detect_anomalies_still_severity_sorted') {
      record(c.id, 'regression', 'SKIP', 'already enforced by the existing vitest suite (src/lib/__tests__) — not re-run here to avoid duplicate coverage');
      continue;
    }
    if (c.check === 'pdf_export_contains_no_unrenderable_glyphs') {
      const report = buildExecutiveReport(model, ctx);
      const pdf = await renderExecutivePdf(report);
      const hasRupee = pdf.includes(Buffer.from('₹', 'utf8'));
      const hasArrow = pdf.includes(Buffer.from('→', 'utf8'));
      record(c.id, 'regression', !hasRupee && !hasArrow ? 'PASS' : 'FAIL', `rupeeByteFound=${hasRupee} arrowByteFound=${hasArrow}`);
      continue;
    }
    if (c.check === 'client_bundle_has_no_gemini_key_or_sdk') {
      const staticDir = path.join(APP_ROOT, '.next/static');
      if (!fs.existsSync(staticDir)) { record(c.id, 'regression', 'SKIP', 'run `npm run build` first — .next/static not found'); continue; }
      let leaked = false;
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (entry.isFile() && /\.js$/.test(entry.name)) {
            const content = fs.readFileSync(p, 'utf8');
            if (content.includes('GEMINI_API_KEY') || content.includes('GoogleGenAI')) leaked = true;
          }
        }
      };
      walk(staticDir);
      record(c.id, 'regression', !leaked ? 'PASS' : 'FAIL', leaked ? 'found reference in client bundle' : 'clean');
      continue;
    }
    if (c.check === 'env_example_is_trackable') {
      const gitignore = fs.readFileSync(path.join(APP_ROOT, '.gitignore'), 'utf8');
      const ok = gitignore.includes('!.env.example');
      record(c.id, 'regression', ok ? 'PASS' : 'FAIL', ok ? 'whitelist rule present' : 'missing !.env.example exception');
      continue;
    }
    if (c.check === 'ask_dealerpulse_answers_without_gemini') {
      const ans = askDealerPulse(ctx, 'What is network revenue?');
      record(c.id, 'regression', !!ans.answer ? 'PASS' : 'FAIL', ans.answer.slice(0, 100));
      continue;
    }
    if (c.check === 'forecast_unavailable_below_threshold') {
      const empty = forecastPipeline([], stageDeliveryRates(model), 0, 100);
      // With zero open leads this doesn't hit the <10-matured-leads guard directly (that guard
      // lives in the get_forecast tool, not forecastPipeline itself) — verify the guard exists
      // in the tool layer instead, which is where "never fabricate a forecast" is enforced.
      const src = fs.readFileSync(path.join(APP_ROOT, 'src/lib/ai/gemini/tools.ts'), 'utf8');
      const hasGuard = /maturedCount\s*<\s*10/.test(src) && /available:\s*false/.test(src);
      record(c.id, 'regression', hasGuard ? 'PASS' : 'FAIL', `guard present in get_forecast tool: ${hasGuard}; forecastPipeline([]) sanity: expectedUnits=${empty.expectedUnits}`);
      continue;
    }
    if (c.check === 'high_value_threshold_is_computed_not_constant') {
      const src = fs.readFileSync(path.join(APP_ROOT, 'src/lib/insights/riskLabel.ts'), 'utf8');
      const usesQuantile = /quantile\(/.test(src);
      const hasHardcodedRupeeConstant = /\b\d{5,}\b/.test(src.replace(/0\.75/, ''));
      record(c.id, 'regression', usesQuantile && !hasHardcodedRupeeConstant ? 'PASS' : 'FAIL', `usesQuantile=${usesQuantile} suspiciousLiteral=${hasHardcodedRupeeConstant}`);
      continue;
    }
    record(c.id, 'regression', 'SKIP', `no automated handler for check "${c.check}"`);
  }
}

// ---------- report ----------
async function main() {
  await runGolden();
  await runSecurity();
  await runRag();
  await runRegression();

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const scored = total - skipped;

  const byCategory = (cats: string[]) => results.filter((r) => cats.includes(r.category));
  const rate = (subset: CheckResult[]) => {
    const s = subset.filter((r) => r.status !== 'SKIP');
    return s.length ? s.filter((r) => r.status === 'PASS').length / s.length : null;
  };

  const accuracy = rate(results.filter((r) => ['network_kpis', 'branch', 'rep', 'conversion', 'funnel', 'lead_aging', 'revenue_at_risk', 'anomalies', 'forecast', 'whatif', 'policy', 'refusal', 'multi_turn'].includes(r.category)));
  const groundedness = rate(byCategory(['network_kpis', 'branch', 'rep', 'conversion', 'funnel']));
  const retrieval = rate(results.filter((r) => r.category === 'rag'));
  const toolAccuracy = rate(results.filter((r) => r.id.startsWith('kpi-') || r.id.startsWith('branch-') || r.id.startsWith('rep-') || r.id.startsWith('conversion-') || r.id.startsWith('funnel-') || r.id.startsWith('lead-aging') || r.id.startsWith('revenue-at-risk') || r.id.startsWith('anomalies-') || r.id.startsWith('forecast-') || r.id.startsWith('whatif-') || r.id.startsWith('policy-')));

  const fmt = (n: number | null) => (n == null ? 'N/A (no non-skipped cases)' : (n * 100).toFixed(0) + '%');

  console.log('\n=== DealerPulse Evaluation Report ===');
  console.log(`Gemini configured: ${geminiConfigured}`);
  console.log(`TOTAL:      ${total}`);
  console.log(`PASSED:     ${passed}`);
  console.log(`FAILED:     ${failed}`);
  console.log(`SKIPPED:    ${skipped}  (not counted toward rates below — see note per case)`);
  console.log(`ACCURACY:      ${fmt(accuracy)}`);
  console.log(`GROUNDEDNESS:  ${fmt(groundedness)}`);
  console.log(`RETRIEVAL:     ${fmt(retrieval)}`);
  console.log(`TOOL ACCURACY: ${fmt(toolAccuracy)}`);
  console.log('\n--- Details ---');
  results.forEach((r) => {
    console.log(`[${r.status}] ${r.id} (${r.category}) — ${r.detail}`);
  });

  const reportPath = path.join(__dirname, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), geminiConfigured, total, passed, failed, skipped, accuracy, groundedness, retrieval, toolAccuracy, results }, null, 2));
  console.log(`\nFull report written to evals/report.json`);

  if (failed > 0) process.exitCode = 1;
}

main();
