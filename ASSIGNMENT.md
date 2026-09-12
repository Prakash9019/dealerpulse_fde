# Forward Deployed Engineer — Take-Home Assignment

## DealerPulse: Real-Time Dealership Performance Dashboard

### Context

You're a forward deployed engineer at a SaaS company that builds tools for automotive dealership networks. A dealership group (5 branches, ~30 sales reps) has asked for a dashboard that helps their CEO and branch managers understand sales performance at a glance and take action on bottlenecks.

We're providing you with a dataset (`dealership_data.json`). Your job is to build a working product — not a toy demo.

---

### The Dataset

The attached `dealership_data.json` contains 7 months of dealership data (June–December 2025):

- **5 branches** across Chennai, Bangalore, Hyderabad, and Mumbai
- **30 sales reps** (5 branch managers + 25 sales officers)
- **~500 leads** with full status histories, from "new" through "delivered" or "lost"
- **Monthly targets** per branch (units and revenue)
- **Delivery records** with timelines and delay reasons

Each lead includes a complete `status_history` array showing every stage transition with timestamps and notes, so you can reconstruct the full journey of every lead.

---

### What to Build

**A web application that lets dealership leadership understand their business and take action.**

That's intentionally broad. Here's the minimum bar and the open space:

#### Minimum Requirements (must have)

1. **Overview dashboard** — Show the vital signs of the business. What's healthy, what's not?
2. **Drill-down capability** — Users should be able to go from high-level to branch-level to rep-level
3. **At least one actionable insight** — Don't just show data. Surface something a manager would actually act on (e.g., "3 leads in Downtown haven't been contacted in 7+ days", or "Highway branch is 40% behind target with 10 days left")
4. **Filtering/time-range selection** — Let users slice the data by time period
5. **Responsive design** — Should work on both desktop and tablet

#### Open-Ended Space (this is where you differentiate)

You decide what else to build. Some directions you *could* go (don't try to do all of them):

- **Lead aging & follow-up alerts** — Which leads are going cold?
- **Conversion funnel visualization** — Where are leads dropping off, and why?
- **Forecasting** — Based on current pipeline, will branches hit their targets?
- **Comparative analytics** — How do branches/reps stack up against each other?
- **Anomaly detection** — Automatically flag unusual patterns in the data
- **What-if scenarios** — "If we improve test drive to order conversion by 10%, what's the revenue impact?"
- **AI-powered summaries** — Natural language summaries of branch/rep performance
- **Export/sharing** — Let users export views or share specific insights

---

### Evaluation Criteria

| Criteria | Weight | What we're looking for |
|---|---|---|
| **Product Thinking** | 30% | Did you build something a real user would find valuable? Are the right metrics surfaced? Does the information hierarchy make sense? |
| **Design & UX** | 25% | Is it clean, intuitive, and polished? Does it feel like a real product, not a hackathon project? Good use of visual hierarchy, loading states, empty states. |
| **Technical Quality** | 25% | Clean code structure, good component architecture, appropriate tech choices, performance with the dataset size. |
| **Insight & Storytelling** | 20% | Does the dashboard tell a story? Can a non-technical CEO look at this and understand what's happening and what to do about it? |

#### What we explicitly don't care about:
- Authentication/login (skip it — assume the user is the CEO)
- Whether you built a backend API or process JSON client-side (your call)
- Whether you used AI tools to build it (we expect you to — what matters is the output)

---

### Technical Constraints

- Must be deployable to **Vercel**
- Use any frontend framework (Next.js, React, Svelte, whatever you prefer)
- Use any charting library (Recharts, D3, Chart.js, Tremor, etc.)
- TypeScript preferred but not required

---

### Submission

1. Deploy to Vercel and **share the live link**
2. Include a **`DECISIONS.md`** in your project root explaining:
   - What you chose to build and why
   - Key product decisions and tradeoffs you made
   - What you'd build next with more time
   - Any interesting patterns you noticed in the data

**Deadline: 5 days from when you receive this assignment.**

---

### A Note on AI Tools

Use Claude Code, Cursor, Copilot, v0, or whatever tools you want. We care about your **judgment** — which features to build, how to present information, what tradeoffs to make — not whether you typed every line by hand. The best FDE is the one who ships the most valuable product the fastest, using every tool available.
