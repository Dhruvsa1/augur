# Augur

**Find out how often you're actually right when you feel sure.** Augur is a personal calibration trainer: you make predictions with a confidence level, and it shows you — viscerally — the gap between your confidence and your accuracy. *"When you said 90%, you were right 64% of the time."*

🔗 **Live:** https://augur.dhruvsa1.org

## The problem

Overconfidence is the most universal cognitive bias, and you can't fix what you can't see. Forecasting tools that could show it normally require predictions to *resolve* — days or weeks of waiting — so nobody sticks with them. Augur removes that wall.

## Two modes

- **Calibration Range** — a deck of verifiable questions (binary *true/false + confidence*, and numeric *90% confidence intervals*) scored **instantly** by pure math. After ~15 you already have a real Brier score and a calibration curve. No waiting, no account, **no AI needed** — works for a stranger today.
- **Live Predictions** — log a real prediction in your own words ("I'll ship by Friday — 80%"); Claude parses it into a structured, confirmable claim with a resolution date and criteria (**you're always the final arbiter** — it never auto-resolves). Resolve it later; it feeds the same curve, broken down by domain so you see *where* you're overconfident.

## The math (pure, unit-tested)

- **Brier score** `(p − outcome)²` for probabilistic predictions
- **Calibration curve** — binned stated-confidence vs empirical accuracy, with a calibration-error and signed overconfidence index
- **Numeric interval scoring** — coverage of stated X% intervals + a width/sharpness penalty so hedging isn't free
- A custom SVG **constellation curve** where your points settle onto the perfect-calibration diagonal

## Stack

- **Next.js 16** (App Router, TypeScript) on **Vercel**
- **Postgres** (Supabase) via a schema-scoped role, accessed only through server routes
- **Anthropic Claude (Opus 4.8)** for freeform→structured parsing + assisted resolution (Calibration Range needs no AI)
- 24 passing tests on the scoring core; 56-question seeded bank

## Develop

```bash
npm install
# .env.local needs DATABASE_URL (scoped Postgres role); ANTHROPIC_API_KEY only for Live Predictions
npm run dev
npm test
node --env-file=.env.local scripts/seed.mjs   # seed the question bank
```

Built by [Dhruvsai Dhulipudi](https://dhruvsa1.org).
