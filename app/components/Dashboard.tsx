'use client'

import { useEffect, useState } from 'react'
import type { CalibrationDashboard } from '@/lib/data'
import { calibrationVerdict } from '@/lib/scoring'
import { ConstellationCurve } from './ConstellationCurve'

export function Dashboard({
  owner,
  onStartRange,
}: {
  owner: string
  onStartRange: () => void
}) {
  const [data, setData] = useState<CalibrationDashboard | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!owner) return
    setData(null)
    setErr(null)
    fetch(`/api/stats?owner=${owner}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e) => setErr(e.message))
  }, [owner])

  if (err) {
    return (
      <Panel>
        <p className="text-bad">Couldn’t load your reading: {err}</p>
      </Panel>
    )
  }
  if (!data) {
    return (
      <Panel>
        <div className="flex justify-center gap-1.5">
          <span className="thinking-dot h-2 w-2 rounded-full bg-gold" />
          <span className="thinking-dot h-2 w-2 rounded-full bg-gold" />
          <span className="thinking-dot h-2 w-2 rounded-full bg-gold" />
        </div>
        <p className="mt-4 text-center text-ivory-soft">Reading the stars…</p>
      </Panel>
    )
  }

  const { overall, byDomain, intervals, surprises, counts, brierOverTime } = data
  const total = counts.range + counts.predictionsResolved

  if (total === 0) {
    return (
      <Panel>
        <p className="font-display text-2xl text-ivory">Your chart is still dark.</p>
        <p className="mt-2 text-ivory-soft">
          Answer a handful of calibration questions and your constellation will appear
          here — stated confidence against how often you’re actually right.
        </p>
        <button
          onClick={onStartRange}
          className="mt-6 rounded-md bg-gold px-5 py-2.5 text-sm font-medium text-void hover:bg-gold-soft"
        >
          Answer some questions →
        </button>
      </Panel>
    )
  }

  const overPct = Math.round(overall.overconfidenceIndex * 100)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* headline verdict */}
      <div className="rise rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Your reading</p>
        <p className="mt-3 font-display text-2xl leading-snug text-ivory md:text-3xl">
          {headline(overall.bins)}
        </p>
        <p className="mt-3 text-ivory-soft">{calibrationVerdict(overall)}</p>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Stat label="Brier score" value={overall.brier.toFixed(3)} hint="0 = perfect" />
          <Stat
            label="Accuracy"
            value={`${Math.round(overall.accuracy * 100)}%`}
            hint={`avg confidence ${Math.round(overall.meanConfidence * 100)}%`}
          />
          <Stat
            label="Calibration error"
            value={overall.calibrationError.toFixed(3)}
            hint="gap from perfect"
          />
          <Stat
            label="Sample"
            value={`${total}`}
            hint={`${counts.range} range · ${counts.predictionsResolved} resolved`}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
        {/* constellation */}
        <div className="rise rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-5" style={{ animationDelay: '80ms' }}>
          <h2 className="mb-3 font-display text-lg text-ivory">The constellation</h2>
          <ConstellationCurve bins={overall.bins} n={overall.n} />
        </div>

        {/* overconfidence gauge + brier trend */}
        <div className="rise space-y-6" style={{ animationDelay: '140ms' }}>
          <div className="rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-5">
            <h2 className="font-display text-lg text-ivory">Overconfidence index</h2>
            <Gauge value={overall.overconfidenceIndex} />
            <p className="mt-3 text-sm text-ivory-soft">
              {overall.n < 10
                ? 'Need a few more answers to read this reliably.'
                : overPct > 0
                  ? `You claim ~${overPct} points more certainty than you earn.`
                  : overPct < 0
                    ? `You’re ~${Math.abs(overPct)} points more right than you feel.`
                    : 'Dead centre — confidence matches accuracy.'}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-5">
            <h2 className="font-display text-lg text-ivory">Brier over time</h2>
            <BrierTrend series={brierOverTime} />
            <p className="mt-2 text-xs text-ivory-faint">Lower is better. Your running average.</p>
          </div>
        </div>
      </div>

      {/* by domain */}
      {byDomain.length > 0 && (
        <div className="rise rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-6" style={{ animationDelay: '200ms' }}>
          <h2 className="mb-4 font-display text-lg text-ivory">Where you bend</h2>
          <div className="space-y-3">
            {byDomain.map((d) => (
              <DomainRow key={d.domain} domain={d.domain} summary={d.summary} />
            ))}
          </div>
        </div>
      )}

      {/* interval coverage */}
      {intervals.n > 0 && (
        <div className="rise rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-6" style={{ animationDelay: '240ms' }}>
          <h2 className="mb-2 font-display text-lg text-ivory">Your 90% intervals</h2>
          <p className="text-sm text-ivory-soft">
            They contained the truth{' '}
            <span className="text-gold">{Math.round(intervals.hitRate * 100)}%</span> of the
            time across {intervals.n} questions — a true 90% interval should hit ~90%.
            {intervals.coverageGap < -0.05
              ? ' Yours are too narrow (overconfident).'
              : intervals.coverageGap > 0.05
                ? ' Yours are wider than they need to be.'
                : ' Right on target.'}
          </p>
        </div>
      )}

      {/* biggest surprises */}
      {surprises.length > 0 && (
        <div className="rise rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-6" style={{ animationDelay: '280ms' }}>
          <h2 className="mb-1 font-display text-lg text-ivory">Biggest surprises</h2>
          <p className="mb-4 text-xs text-ivory-faint">
            High-confidence misses — where certainty failed you most.
          </p>
          <div className="space-y-3">
            {surprises.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-line bg-indigo/40 p-3"
              >
                <span className="num mt-0.5 shrink-0 rounded-full bg-bad/15 px-2 py-0.5 text-xs font-bold text-bad">
                  {s.confidence}%
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ivory">{s.text}</p>
                  <p className="text-xs text-ivory-faint">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={onStartRange}
          className="rounded-md border border-gold/50 px-5 py-2.5 text-sm text-gold transition hover:bg-gold/10"
        >
          Answer more to sharpen your curve →
        </button>
      </div>
    </div>
  )
}

function headline(bins: CalibrationDashboard['overall']['bins']): string {
  const top = bins.find((b) => b.lo === 90)
  if (top && top.n >= 3) {
    return `When you said 90%, you were right ${Math.round(top.accuracy * 100)}% of the time.`
  }
  const high = [...bins].reverse().find((b) => b.n >= 3)
  if (high) {
    return `When you said ${Math.round(high.meanConfidence)}%, you were right ${Math.round(
      high.accuracy * 100,
    )}% of the time.`
  }
  return 'Your confidence, measured against the truth.'
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-ivory-faint">{label}</p>
      <p className="num text-3xl font-bold text-ivory">{value}</p>
      {hint && <p className="text-[11px] text-ivory-faint">{hint}</p>}
    </div>
  )
}

function Gauge({ value }: { value: number }) {
  // value in roughly [-0.5, 0.5]; clamp for display
  const v = Math.max(-0.5, Math.min(0.5, value))
  const pct = ((v + 0.5) / 1) * 100
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-good/40 via-line to-bad/50">
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-void bg-magenta pulse-glow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-ivory-faint">
        <span className="text-good">underconfident</span>
        <span>calibrated</span>
        <span className="text-bad">overconfident</span>
      </div>
    </div>
  )
}

function BrierTrend({ series }: { series: { i: number; running: number }[] }) {
  if (series.length < 2) {
    return <p className="mt-3 text-sm text-ivory-faint">Answer a few more to chart the trend.</p>
  }
  const W = 280
  const H = 70
  const max = Math.max(0.4, ...series.map((s) => s.running))
  const x = (i: number) => (i / (series.length - 1)) * W
  const y = (v: number) => H - (v / max) * H
  const path = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.running).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 4}`} className="mt-3 w-full">
      <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].running)} r="3.5" fill="var(--magenta)" />
    </svg>
  )
}

function DomainRow({
  domain,
  summary,
}: {
  domain: string
  summary: CalibrationDashboard['overall']
}) {
  const idx = summary.overconfidenceIndex
  const mag = Math.min(1, Math.abs(idx) / 0.5)
  const over = idx > 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm capitalize text-ivory">{domain}</span>
      <div className="relative h-2 flex-1 rounded-full bg-line/60">
        <div className="absolute left-1/2 top-0 h-full w-px bg-ivory-faint/50" />
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            background: over ? 'var(--bad)' : 'var(--good)',
            width: `${mag * 50}%`,
            left: over ? '50%' : `${50 - mag * 50}%`,
          }}
        />
      </div>
      <span className="num w-24 shrink-0 text-right text-xs text-ivory-faint">
        {summary.n < 5 ? `${summary.n} ans` : `${over ? '+' : ''}${Math.round(idx * 100)} pts`}
      </span>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-indigo-2/70 backdrop-blur-md p-8 text-center">
      {children}
    </div>
  )
}
