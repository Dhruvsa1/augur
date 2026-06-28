import { describe, it, expect } from 'vitest'
import {
  brier,
  meanBrier,
  binIndex,
  calibrationBins,
  calibrationSummary,
  calibrationByDomain,
  calibrationVerdict,
  scoreNumeric,
  intervalStats,
  type CalPoint,
} from '../scoring'

// ── Brier ────────────────────────────────────────────────────────────────────
describe('brier', () => {
  it('is 0 for a perfectly confident correct prediction', () => {
    expect(brier(1, true)).toBe(0)
    expect(brier(0, false)).toBe(0)
  })
  it('is 1 for a perfectly confident wrong prediction', () => {
    expect(brier(1, false)).toBe(1)
    expect(brier(0, true)).toBe(1)
  })
  it('is 0.25 at maximum uncertainty', () => {
    expect(brier(0.5, true)).toBeCloseTo(0.25)
    expect(brier(0.5, false)).toBeCloseTo(0.25)
  })
  it('rewards confidence in the right direction', () => {
    expect(brier(0.9, true)).toBeCloseTo(0.01)
    expect(brier(0.9, false)).toBeCloseTo(0.81)
  })
  it('clamps out-of-range probabilities', () => {
    expect(brier(1.5, true)).toBe(0)
    expect(brier(-0.5, false)).toBe(0)
  })
  it('meanBrier averages and is empty-safe', () => {
    expect(meanBrier([])).toBe(0)
    expect(meanBrier([0, 0.25, 1])).toBeCloseTo(0.4166, 3)
  })
})

// ── Binning ───────────────────────────────────────────────────────────────────
describe('binIndex', () => {
  it('maps confidences to the five bins', () => {
    expect(binIndex(50)).toBe(0)
    expect(binIndex(59)).toBe(0)
    expect(binIndex(60)).toBe(1)
    expect(binIndex(75)).toBe(2)
    expect(binIndex(80)).toBe(3)
    expect(binIndex(90)).toBe(4)
    expect(binIndex(100)).toBe(4)
  })
  it('clamps out-of-range', () => {
    expect(binIndex(20)).toBe(0)
    expect(binIndex(140)).toBe(4)
  })
})

// helper: build N points at a given confidence with a given correct-rate
function pts(confidence: number, n: number, nCorrect: number, domain?: string): CalPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    confidence,
    correct: i < nCorrect,
    domain,
  }))
}

describe('calibrationBins', () => {
  it('computes per-bin accuracy and gap', () => {
    // 10 predictions at 90% confidence, 6 correct → accuracy 0.6, gap +0.3
    const bins = calibrationBins(pts(90, 10, 6))
    expect(bins).toHaveLength(1)
    expect(bins[0].label).toBe('90–100')
    expect(bins[0].n).toBe(10)
    expect(bins[0].accuracy).toBeCloseTo(0.6)
    expect(bins[0].meanConfidence).toBeCloseTo(90)
    expect(bins[0].gap).toBeCloseTo(0.3)
  })
  it('omits empty bins', () => {
    const bins = calibrationBins([...pts(55, 4, 2), ...pts(95, 4, 4)])
    expect(bins.map((b) => b.lo)).toEqual([50, 90])
  })
})

// ── Fixtures: perfectly calibrated / over / under ─────────────────────────────
describe('calibrationSummary fixtures', () => {
  // Perfectly calibrated: at each confidence the empirical accuracy matches.
  const perfect: CalPoint[] = [
    ...pts(60, 10, 6),
    ...pts(70, 10, 7),
    ...pts(80, 10, 8),
    ...pts(90, 10, 9),
  ]
  it('perfectly-calibrated set has ~0 calibration error and ~0 overconfidence', () => {
    const s = calibrationSummary(perfect)
    expect(s.n).toBe(40)
    expect(s.calibrationError).toBeCloseTo(0, 6)
    expect(s.overconfidenceIndex).toBeCloseTo(0, 6)
    expect(calibrationVerdict(s)).toContain('Well calibrated')
  })

  it('overconfident set has positive overconfidence index', () => {
    // Always says 90% but only right half the time.
    const over = pts(90, 20, 10)
    const s = calibrationSummary(over)
    expect(s.overconfidenceIndex).toBeCloseTo(0.4)
    expect(s.calibrationError).toBeCloseTo(0.4)
    expect(s.accuracy).toBeCloseTo(0.5)
    expect(calibrationVerdict(s)).toContain('Overconfident')
  })

  it('underconfident set has negative overconfidence index', () => {
    // Says 60% but is right 95% of the time.
    const under = pts(60, 20, 19)
    const s = calibrationSummary(under)
    expect(s.overconfidenceIndex).toBeCloseTo(0.6 - 0.95)
    expect(s.overconfidenceIndex).toBeLessThan(0)
    expect(calibrationVerdict(s)).toContain('Underconfident')
  })

  it('Brier rewards the calibrated set over the overconfident one', () => {
    const sPerfect = calibrationSummary(perfect)
    const sOver = calibrationSummary(pts(90, 40, 20))
    expect(sPerfect.brier).toBeLessThan(sOver.brier)
  })

  it('is empty-safe', () => {
    const s = calibrationSummary([])
    expect(s.n).toBe(0)
    expect(s.brier).toBe(0)
    expect(s.bins).toEqual([])
    expect(calibrationVerdict(s)).toContain('few more')
  })
})

describe('calibrationByDomain', () => {
  it('splits and sorts by sample size', () => {
    const points = [
      ...pts(90, 10, 5, 'timelines'),
      ...pts(80, 4, 3, 'tech'),
    ]
    const byDomain = calibrationByDomain(points)
    expect(byDomain[0].domain).toBe('timelines')
    expect(byDomain[0].summary.n).toBe(10)
    expect(byDomain[1].domain).toBe('tech')
    // timelines is badly overconfident here
    expect(byDomain[0].summary.overconfidenceIndex).toBeGreaterThan(0.3)
  })
})

// ── Numeric interval scoring ──────────────────────────────────────────────────
describe('scoreNumeric', () => {
  it('marks truth inside the interval as a hit', () => {
    const s = scoreNumeric({ low: 90, high: 110 }, 100)
    expect(s.inside).toBe(true)
    expect(s.width).toBe(20)
    expect(s.points).toBeGreaterThan(0)
  })
  it('marks truth outside as a miss with 0 points', () => {
    const s = scoreNumeric({ low: 90, high: 110 }, 200)
    expect(s.inside).toBe(false)
    expect(s.points).toBe(0)
  })
  it('penalises absurdly wide intervals even when they contain truth', () => {
    const tight = scoreNumeric({ low: 95, high: 105 }, 100)
    const huge = scoreNumeric({ low: 0, high: 1_000_000 }, 100)
    expect(tight.inside).toBe(true)
    expect(huge.inside).toBe(true)
    expect(tight.points).toBeGreaterThan(huge.points)
    expect(huge.points).toBeLessThan(0.01) // basically free no more
  })
  it('interval score punishes a miss more than a tight hit', () => {
    const hit = scoreNumeric({ low: 90, high: 110 }, 100)
    const miss = scoreNumeric({ low: 90, high: 110 }, 300)
    expect(miss.intervalScore).toBeGreaterThan(hit.intervalScore)
  })
  it('swaps reversed bounds defensively', () => {
    const s = scoreNumeric({ low: 110, high: 90 }, 100)
    expect(s.inside).toBe(true)
    expect(s.width).toBe(20)
  })
  it('handles a truth of zero without dividing by zero', () => {
    const s = scoreNumeric({ low: -1, high: 1 }, 0)
    expect(s.inside).toBe(true)
    expect(Number.isFinite(s.relWidth)).toBe(true)
  })
})

describe('intervalStats', () => {
  it('reports hit rate and coverage gap vs the 90% target', () => {
    // 10 intervals, 7 contained truth → hitRate 0.7, gap -0.2 (too narrow)
    const scores = [
      ...Array.from({ length: 7 }, () => scoreNumeric({ low: 90, high: 110 }, 100)),
      ...Array.from({ length: 3 }, () => scoreNumeric({ low: 90, high: 110 }, 500)),
    ]
    const stats = intervalStats(scores)
    expect(stats.n).toBe(10)
    expect(stats.hitRate).toBeCloseTo(0.7)
    expect(stats.coverageGap).toBeCloseTo(-0.2)
  })
  it('is empty-safe', () => {
    const stats = intervalStats([])
    expect(stats.n).toBe(0)
    expect(stats.hitRate).toBe(0)
  })
})
