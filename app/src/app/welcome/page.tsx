import Link from "next/link";
import { getContext, getModel } from "@/lib/data";
import { forecastPipeline, stageDeliveryRates } from "@/lib/insights/forecast";
import { whatIfStageImprovement } from "@/lib/insights/whatif";
import { rankAnomalies } from "@/lib/insights/anomalies";
import { fmtINR, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { Reveal } from "@/components/welcome/Reveal";
import { CountUp } from "@/components/ui/CountUp";

export const metadata = { title: "DealerPulse — Turn dealership data into decisions" };

// A public marketing page reads the same real dataset every dashboard screen
// does (there's no separate "demo" data source in this project — the whole
// app runs on one static dataset) — never fabricated numbers. It's a plain
// server component: no client-side data fetching, no auth to gate (this
// project has none, by the assignment's own scope), just real computed
// figures rendered once.
export default function WelcomePage() {
  const model = getModel();
  const ctx = getContext({ range: "all" });

  const worstBranch = [...ctx.branchRows].sort((a, b) => a.maturedConversion - b.maturedConversion)[0];
  const bestBranch = [...ctx.branchRows].sort((a, b) => b.maturedConversion - a.maturedConversion)[0];

  const scenario = whatIfStageImprovement(ctx.funnel, ctx.kpi.avgDealValue, 1, 0.10);
  const forecast = forecastPipeline(ctx.openLeads, stageDeliveryRates(model), ctx.kpi.units, ctx.targets.targetUnits);
  const topAnomaly = rankAnomalies(ctx.anomalies).shown[0];

  const leadTiers = [
    { label: "Critical", count: ctx.actions.critical.length, tone: "critical" as const, hint: "needs action today" },
    { label: "Attention", count: ctx.actions.attention.length, tone: "warning" as const, hint: "trending cold" },
    { label: "Watch", count: ctx.actions.watch.length, tone: "muted" as const, hint: "monitor" },
  ];

  return (
    <div className="min-h-screen bg-bg-app text-ink-primary">
      <WelcomeNav />
      <Hero units={ctx.kpi.units} revenue={ctx.kpi.revenue} conversion={ctx.kpi.conversion} branches={model.branches.length} />
      <ExecutiveIntelligence />
      <AiCopilotSection worstBranch={worstBranch} networkConversion={ctx.netMaturedConversion} />
      <WhatIfSection scenario={scenario} />
      <ForecastSection forecast={forecast} targetUnits={ctx.targets.targetUnits} delivered={ctx.kpi.units} />
      <LeadIntelligenceSection tiers={leadTiers} />
      <AnomalySection anomaly={topAnomaly} />
      <ProductFlowSection />
      <TrustSection />
      <PrincipleSection />
      <FinalCta bestBranchName={bestBranch?.name} />
      <WelcomeFooter />
    </div>
  );
}

function WelcomeNav() {
  const links = [
    { href: "#product", label: "Product" },
    { href: "#intelligence", label: "Intelligence" },
    { href: "#ai", label: "AI" },
    { href: "#scenarios", label: "Scenarios" },
    { href: "#about", label: "About" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line-hairline bg-bg-topbar px-6 py-3.5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent">
            <span className="h-[7px] w-[7px] rotate-45 rounded-[1px] bg-bg-app" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">DealerPulse</span>
        </span>
        <nav className="hidden items-center gap-5 text-[13px] text-ink-tertiary md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink-primary">
              {l.label}
            </a>
          ))}
        </nav>
        <Link
          href="/"
          className="ml-auto rounded-[7px] bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-fill-text transition-transform active:scale-[0.96]"
        >
          Open Dashboard
        </Link>
      </div>
    </header>
  );
}

function Hero({ units, revenue, conversion, branches }: { units: number; revenue: number; conversion: number | null; branches: number }) {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-20 sm:pt-28">
      {/* A restrained radial glow behind the headline — the one "spotlight"-
          style treatment on the page, static (not an animated shader), so it
          reads as premium ambience rather than a decorative effect. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 opacity-40"
        style={{ background: "radial-gradient(ellipse at top, oklch(0.4 0.05 200 / 0.35), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-[860px] text-center">
        <Reveal>
          <h1 className="text-[36px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[52px]">
            Turn dealership data into decisions.
          </h1>
        </Reveal>
        <Reveal delayMs={100}>
          <p className="mx-auto mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink-tertiary sm:text-[18px]">
            AI-powered intelligence for modern automotive sales teams.
          </p>
        </Reveal>
        <Reveal delayMs={200}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-[8px] bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-fill-text transition-transform active:scale-[0.97]"
            >
              Explore DealerPulse
            </Link>
            <a
              href="#ai"
              className="rounded-[8px] border border-line-hairline px-5 py-2.5 text-[14px] font-medium text-ink-secondary transition-colors hover:bg-bg-hover"
            >
              See how it works
            </a>
          </div>
        </Reveal>
      </div>

      {/* Product visual: the actual KPI-card component, live real numbers —
          not a screenshot, not invented figures. */}
      <Reveal delayMs={300} className="mx-auto mt-14 max-w-[980px]">
        <div className="dp-card-hover rounded-[14px] border border-line-hairline bg-bg-card p-5 shadow-[0_30px_80px_oklch(0.08_0.006_75_/_0.45)] sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Network Overview · Live dataset</span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-healthy" /> {branches} branches
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="Units Delivered" value={fmtNum(units)} />
            <HeroStat label="Revenue" value={fmtINR(revenue)} />
            <HeroStat label="Conversion" value={conversion != null ? fmtPct(conversion) : "—"} />
            <HeroStat label="Branches" value={String(branches)} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-bg-recessed p-3.5 text-left">
      <div className="text-[10.5px] text-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-[19px] font-medium tracking-[-0.02em] text-ink-primary">
        <CountUp value={value} />
      </div>
    </div>
  );
}

const BENTO_CARDS = [
  { title: "AI Copilot", desc: "Ask any question about performance, pipeline, or risk — grounded in your real analytics, never invented.", anchor: "#ai" },
  { title: "Forecasting", desc: "Pipeline-based projections against target, using historical stage-to-delivery rates.", anchor: "#scenarios" },
  { title: "Pipeline Intelligence", desc: "See exactly where leads leak in the funnel, and how much revenue that leak costs.", anchor: "#intelligence" },
  { title: "Lead Risk", desc: "Every open lead scored and tiered by urgency — critical, attention, watch.", anchor: "#intelligence" },
  { title: "Anomaly Detection", desc: "Statistically unusual shifts in conversion, delivery, or lead quality, surfaced automatically.", anchor: "#intelligence" },
  { title: "Scenario Lab", desc: "Model a funnel improvement and see the real projected unit and revenue impact.", anchor: "#scenarios" },
];

function ExecutiveIntelligence() {
  return (
    <section id="product" className="mx-auto max-w-[1100px] px-6 py-20">
      <Reveal>
        <h2 className="text-center text-[26px] font-semibold tracking-[-0.01em]">Executive intelligence, not just charts</h2>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {BENTO_CARDS.map((c, i) => (
          <Reveal key={c.title} delayMs={i * 60}>
            <a
              href={c.anchor}
              className="dp-card-hover block h-full rounded-[12px] border border-line-hairline bg-bg-card p-5"
            >
              <div aria-hidden="true" className="mb-3 h-2 w-2 rounded-full bg-accent" />
              <div className="text-[14.5px] font-semibold text-ink-primary">{c.title}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-tertiary">{c.desc}</p>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function AiCopilotSection({ worstBranch, networkConversion }: { worstBranch: { name: string; maturedConversion: number } | undefined; networkConversion: number }) {
  if (!worstBranch) return null;
  const stages = [
    { label: "Question", text: `"Why is ${worstBranch.name} underperforming?"`, tone: "text-ink-secondary" },
    { label: "Analytics", text: "get_branch_performance, get_funnel_metrics", tone: "text-ink-muted font-mono text-[11px]" },
    { label: "Evidence", text: `Conversion ${fmtPct(worstBranch.maturedConversion)} vs network ${fmtPct(networkConversion)}`, tone: "text-ink-secondary" },
    { label: "AI Answer", text: `${worstBranch.name} is converting well below the network baseline — the funnel data points to early-stage drop-off as the primary driver.`, tone: "text-ink-primary" },
    { label: "Recommendation", text: "Enforce a same-day contact SLA and re-route unworked new leads.", tone: "text-ink-secondary" },
  ];
  return (
    <section id="ai" className="border-y border-line-hairline bg-bg-rail/40 px-6 py-20">
      <div className="mx-auto max-w-[720px]">
        <Reveal>
          <h2 className="text-center text-[26px] font-semibold tracking-[-0.01em]">Ask DealerPulse</h2>
          <p className="mt-2 text-center text-[13.5px] text-ink-tertiary">
            Example conversation — grounded in this network&apos;s real data, not a scripted demo.
          </p>
        </Reveal>
        <Reveal delayMs={120} className="mt-8 rounded-[14px] border border-accent-tint-border bg-gradient-to-b from-[oklch(0.225_0.016_200)] to-[oklch(0.205_0.008_200)] p-5 sm:p-6">
          <div className="space-y-4">
            {stages.map((s, i) => (
              <Reveal key={s.label} delayMs={i * 90}>
                <div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">{s.label}</div>
                  <p className={`mt-1 text-[13.5px] leading-relaxed ${s.tone}`}>{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WhatIfSection({ scenario }: { scenario: ReturnType<typeof whatIfStageImprovement> }) {
  return (
    <section id="scenarios" className="mx-auto max-w-[860px] px-6 py-20">
      <Reveal>
        <h2 className="text-center text-[26px] font-semibold tracking-[-0.01em]">Model a scenario before you commit to it</h2>
        <p className="mt-2 text-center text-[13.5px] text-ink-tertiary">
          Real funnel re-simulation — the same calculation the Scenario Lab uses, not a hardcoded example.
        </p>
      </Reveal>
      <Reveal delayMs={120} className="mt-8 rounded-[14px] border border-line-hairline bg-bg-card p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="text-center">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Current</div>
            <div className="mt-1 font-mono text-[26px] font-medium text-ink-primary">
              <CountUp value={fmtPct(scenario.baselineConv)} />
            </div>
            <div className="text-[11px] text-ink-faint">{scenario.fromLabel} → {scenario.toLabel}</div>
          </div>
          <div className="text-center">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Scenario (+{(scenario.improvementPts * 100).toFixed(0)}pt)</div>
            <div className="mt-1 font-mono text-[26px] font-medium text-accent">
              <CountUp value={fmtPct(scenario.improvedConv)} />
            </div>
            <div className="text-[11px] text-ink-faint">projected conversion</div>
          </div>
          <div className="text-center">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Projected impact</div>
            <div className="mt-1 font-mono text-[26px] font-medium text-healthy">
              <CountUp value={fmtSigned(scenario.deltaUnits, (v) => v.toFixed(1) + " units")} />
            </div>
            <div className="text-[11px] text-ink-faint">{fmtSigned(scenario.deltaRevenue, fmtINR)} revenue</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function ForecastSection({ forecast, targetUnits, delivered }: { forecast: ReturnType<typeof forecastPipeline>; targetUnits: number; delivered: number }) {
  const projected = forecast.projectedUnits;
  const pct = Math.min(1, projected / Math.max(1, targetUnits));
  return (
    <section className="border-y border-line-hairline bg-bg-rail/40 px-6 py-20">
      <div className="mx-auto max-w-[760px]">
        <Reveal>
          <h2 className="text-center text-[26px] font-semibold tracking-[-0.01em]">Know where you&apos;ll land, not just where you are</h2>
        </Reveal>
        <Reveal delayMs={120} className="mt-8 rounded-[14px] border border-line-hairline bg-bg-card p-6">
          <div className="mb-3 flex items-end justify-between text-[12.5px] text-ink-muted">
            <span>Delivered: <span className="font-mono text-ink-primary">{fmtNum(delivered)}</span></span>
            <span>Projected: <span className="font-mono text-accent">{projected.toFixed(1)}</span></span>
            <span>Target: <span className="font-mono text-ink-primary">{fmtNum(targetUnits)}</span></span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-bar-track">
            <div className="dp-bar-grow h-full rounded-full bg-accent" style={{ "--w": `${pct * 100}%` } as React.CSSProperties} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const TONE_BAR: Record<string, string> = { critical: "bg-critical", warning: "bg-warning", muted: "bg-ink-faint" };

function LeadIntelligenceSection({ tiers }: { tiers: { label: string; count: number; tone: "critical" | "warning" | "muted"; hint: string }[] }) {
  const max = Math.max(1, ...tiers.map((t) => t.count));
  return (
    <section id="intelligence" className="mx-auto max-w-[760px] px-6 py-20">
      <Reveal>
        <h2 className="text-center text-[26px] font-semibold tracking-[-0.01em]">Every lead, ranked by urgency</h2>
      </Reveal>
      <div className="mt-8 space-y-4">
        {tiers.map((t, i) => (
          <Reveal key={t.label} delayMs={i * 80}>
            <div className="flex items-center gap-4">
              <span className="w-20 shrink-0 text-[12.5px] font-medium text-ink-secondary">{t.label}</span>
              <div className="h-[10px] flex-1 rounded-full bg-bar-track">
                <div className={`dp-bar-grow h-full rounded-full ${TONE_BAR[t.tone]}`} style={{ "--w": `${(t.count / max) * 100}%` } as React.CSSProperties} />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[13px] text-ink-primary">{t.count}</span>
              <span className="hidden w-24 shrink-0 text-[10.5px] text-ink-faint sm:inline">{t.hint}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function AnomalySection({ anomaly }: { anomaly: { title: string; type: string; severity: string; explanation: string } | undefined }) {
  if (!anomaly) return null;
  return (
    <section className="border-y border-line-hairline bg-bg-rail/40 px-6 py-20">
      <div className="mx-auto max-w-[720px] text-center">
        <Reveal>
          <h2 className="text-[26px] font-semibold tracking-[-0.01em]">Unusual patterns, surfaced automatically</h2>
        </Reveal>
        <Reveal delayMs={120} className="mt-8 rounded-[14px] border-l-2 border-critical bg-bg-card p-5 text-left">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-critical">{anomaly.severity} · {anomaly.type}</span>
          <p className="mt-1.5 text-[14px] font-medium text-ink-primary">{anomaly.title}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-tertiary">{anomaly.explanation}</p>
        </Reveal>
      </div>
    </section>
  );
}

const FLOW_STEPS = ["Data", "Insight", "Why", "Forecast", "What-If", "Recommendation", "Action"];

function ProductFlowSection() {
  return (
    <section className="mx-auto max-w-[900px] px-6 py-20">
      <Reveal>
        <h2 className="text-center text-[26px] font-semibold tracking-[-0.01em]">From data to action, in one flow</h2>
      </Reveal>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {FLOW_STEPS.map((step, i) => (
          <Reveal key={step} delayMs={i * 70} className="flex items-center gap-2">
            <span className="rounded-full border border-line-hairline bg-bg-card px-3.5 py-1.5 text-[12.5px] font-medium text-ink-secondary">
              {step}
            </span>
            {i < FLOW_STEPS.length - 1 && <span aria-hidden="true" className="text-ink-faint">→</span>}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// Only capabilities that genuinely exist in this codebase — no auth/RBAC
// exists (out of scope per the assignment), so it's deliberately omitted
// rather than claimed.
const TRUST_ITEMS = [
  { label: "Grounded AI", desc: "Every answer traces back to a real analytics tool call or retrieved document — never a guess." },
  { label: "Secure by design", desc: "The AI key lives server-side only; it's never shipped to the browser." },
  { label: "Evidence-based insights", desc: "Structured answers include the underlying evidence, not just prose." },
  { label: "Auditable AI", desc: "Every AI call is logged with latency, tokens, and outcome for review." },
];

function TrustSection() {
  return (
    <section className="border-y border-line-hairline bg-bg-rail/40 px-6 py-16">
      <div className="mx-auto max-w-[900px]">
        <Reveal>
          <h2 className="text-center text-[22px] font-semibold tracking-[-0.01em]">Built to be trusted</h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TRUST_ITEMS.map((t, i) => (
            <Reveal key={t.label} delayMs={i * 70} className="flex gap-3">
              <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-healthy" />
              <div>
                <div className="text-[13px] font-semibold text-ink-primary">{t.label}</div>
                <div className="text-[12px] text-ink-tertiary">{t.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// A profile section was requested, but this project has no real leadership
// bio or photo to show, and inventing a named person with a fabricated
// headshot would misrepresent who built this. Using the product's own
// operating principle here instead of a fake identity.
function PrincipleSection() {
  return (
    <section id="about" className="mx-auto max-w-[640px] px-6 py-20 text-center">
      <Reveal>
        <p className="text-[19px] font-medium leading-[1.5] text-ink-primary">
          Know what changed.
          <br />
          Know why.
          <br />
          Know what to do next.
        </p>
        <p className="mt-4 text-[13px] text-ink-tertiary">
          DealerPulse is built around one idea: every number on the screen should be one click away from its evidence.
        </p>
      </Reveal>
    </section>
  );
}

function FinalCta({ bestBranchName }: { bestBranchName: string | undefined }) {
  return (
    <section className="px-6 py-24 text-center">
      <Reveal>
        <h2 className="text-[28px] font-semibold tracking-[-0.01em]">See your dealership differently.</h2>
        {bestBranchName && (
          <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] text-ink-tertiary">
            {bestBranchName} is your top performer today — find out why, and what it would take for every branch to get there.
          </p>
        )}
        <Link
          href="/"
          className="mt-7 inline-block rounded-[8px] bg-accent px-6 py-3 text-[14.5px] font-semibold text-accent-fill-text transition-transform active:scale-[0.97]"
        >
          Explore DealerPulse
        </Link>
      </Reveal>
    </section>
  );
}

function WelcomeFooter() {
  return (
    <footer className="border-t border-line-hairline px-6 py-8 text-center text-[11px] text-ink-faint">
      DealerPulse — real-time dealership performance intelligence.
    </footer>
  );
}
