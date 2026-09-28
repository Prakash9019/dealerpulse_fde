# Architecture summary (reusable across this session)

**Stack**: Next.js 16 (App Router, TS) + React 19 + Tailwind v4 + recharts + zod, deployed to Vercel.
No database — `data/dealership_data.json` (~510 leads) is loaded once and run through a pure-function
pipeline in-memory, memoized by filter key. Optional secondary backend: `ai-service/` (Python, FastAPI +
LangGraph ReAct agent), only used if `AI_SERVICE_URL` is set; it has no data of its own and calls back
into the Next.js `/api/tools/execute` for numbers.

**Folder structure**:
- `app/src/app/` — routes (`page.tsx`, `loading.tsx` per screen) and API handlers at `app/api/<name>/route.ts`
- `app/src/components/<feature>/` — one folder per screen (`branches`, `reps`, `funnel`, `compare`, `leads`,
  `models`, `overlays`, `overview`, `layout`, `ui` for shared primitives)
- `app/src/lib/domain` (model + types) → `lib/analytics` (funnel/aging/targets/reps/etc., pure functions) →
  `lib/insights` (anomalies, priority, forecast, recommendations) → `lib/ai` (rule-based explanations +
  optional Gemini) → consumed by Server Components. `lib/export`, `lib/rag` are side pipelines.
- Tests: `app/src/lib/__tests__/*.test.ts`; AI eval fixtures in `app/evals/`; Python tests in `ai-service/tests/`.

**Conventions**: feature folders mirrored 1:1 between `components/<feature>` and route `app/<feature>`;
one `route.ts` per API endpoint; `lib/analytics` and `lib/insights` are pure functions, no classes;
`lib/analytics/context.ts:analyze()` is the single computed-context entry point every screen reads from;
named constants over magic numbers (e.g. `STALE_DAYS`, `MIN_RATED_LEADS`).

**End-to-end trace (Lead "Why?" explanation)**: `WhyButton`/`LeadDrawer` (component) → `POST /api/lead`
(`app/api/lead/route.ts`) → `getModel()`/`getContext()` (`lib/data.ts`, builds/memoizes the model from the
static JSON) → `priorityRefs()` (`lib/insights/priority.ts`) → `leadExplanation()` (`lib/ai/explanations.ts`,
rule-based, no LLM) → JSON response rendered back in the drawer. Same shape for every screen: UI → route
handler → `lib/data` → analytics/insights → (optional AI) → JSON.

**Testing**: Vitest (`npm test`), config aliases `@` → `src`, specs colocated in `lib/__tests__/`, named
`<area>.test.ts`. AI answer-quality checked separately via `npm run eval` (deterministic, skips instead of
faking a pass when no API key is set). Python side uses pytest under `ai-service/tests/`.

Full detail lives in `../ARCHITECTURE.md` and `DECISIONS.md` — this file is just the fast-recall summary.
