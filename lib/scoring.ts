// ───────────────────────────────────────────────────────────────────────────
// Augur core math — PURE, deterministic, unit-tested.
//
// This is the engine that turns "I felt 90% sure" into "you were right 64% of
// the time." Everything here is side-effect free so it can run on the client
// (instant Calibration Range scoring, no LLM) or the server, and be tested hard.
// ───────────────────────────────────────────────────────────────────────────

import type { NumericResponse } from './types'

// ── Brier score (binary probabilistic predictions) ─────────────────────────

/**
 * Brier score for a single binary prediction.
 * @param p        probability assigned to the outcome being true, in [0,1].
 * @param outcome  the realized outcome: true → 1, false → 0.
 * Returns (p − outcome)^2, in [0,1]; lower is better.
 */
export function brier(p: number, outcome: boolean): number {
  const o = outcome ? 1 : 0
  const x = clamp01(p)
  return (x - o) * (x - o)
}

/** Mean Brier score over many predictions (0 best, 1 worst). NaN-safe → 0 for empty. */
export function meanBrier(scores: number[]): number {
  if (scores.length === 0) return 0
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

// ── Calibration: a single unified data point ────────────────────────────────

/**
 * One point on the calibration curve: a prediction stated with `confidence`
 * (50–100, the probability the person assigned to their own answer / the claim)
 * that turned out `correct` or not.
 */
export interface CalPoint {
  confidence: number // 50–100
  correct: boolean
  domain?: string
}

export interface CalibrationBin {
  /** lower edge of the bin, e.g. 70 */
  lo: number
  /** upper edge (exclusive except the final 90–100 bin) */
  hi: number
  label: string
  n: number
  /** mean stated confidence within the bin, 0–100 (the x you plot) */
  meanConfidence: number
  /** empirical accuracy within the bin, 0–1 (the y you plot) */
  accuracy: number
  /** signed gap: meanConfidence/100 − accuracy (positive = overconfident) */
  gap: number
}

export interface CalibrationSummary {
  n: number
  /** mean Brier over all points (binary outcomes) */
  brier: number
  /** overall empirical accuracy, 0–1 */
  accuracy: number
  /** mean stated confidence as a probability, 0–1 */
  meanConfidence: number
  bins: CalibrationBin[]
  /**
   * Expected calibration error: n-weighted mean of |meanConf − accuracy| across
   * bins, 0–1. 0 = perfectly on the diagonal.
   */
  calibrationError: number
  /**
   * Overconfidence index: meanConfidence − accuracy, in [-1,1].
   * Positive ⇒ overconfident (you claim more certainty than you earn).
   * Negative ⇒ underconfident.
   */
  overconfidenceIndex: number
}

const BIN_LOS = [50, 60, 70, 80, 90] as const

/** Map a confidence (50–100) to its bin index 0..4. Clamps out-of-range input. */
export function binIndex(confidence: number): number {
  const c = Math.max(50, Math.min(100, confidence))
  return Math.min(4, Math.floor((c - 50) / 10))
}

function binLabel(lo: number): string {
  return lo === 90 ? '90–100' : `${lo}–${lo + 10}`
}

/** Group points into the five confidence bins (only non-empty bins are returned). */
export function calibrationBins(points: CalPoint[]): CalibrationBin[] {
  const buckets: CalPoint[][] = [[], [], [], [], []]
  for (const p of points) buckets[binIndex(p.confidence)].push(p)

  const bins: CalibrationBin[] = []
  buckets.forEach((pts, i) => {
    if (pts.length === 0) return
    const lo = BIN_LOS[i]
    const meanConf =
      pts.reduce((a, b) => a + clamp01(b.confidence / 100), 0) / pts.length
    const acc = pts.filter((p) => p.correct).length / pts.length
    bins.push({
      lo,
      hi: lo === 90 ? 100 : lo + 10,
      label: binLabel(lo),
      n: pts.length,
      meanConfidence: meanConf * 100,
      accuracy: acc,
      gap: meanConf - acc,
    })
  })
  return bins
}

/** Full calibration summary over a set of points. Empty-safe. */
export function calibrationSummary(points: CalPoint[]): CalibrationSummary {
  const n = points.length
  if (n === 0) {
    return {
      n: 0,
      brier: 0,
      accuracy: 0,
      meanConfidence: 0,
      bins: [],
      calibrationError: 0,
      overconfidenceIndex: 0,
    }
  }

  const briers = points.map((p) => brier(clamp01(p.confidence / 100), p.correct))
  const accuracy = points.filter((p) => p.correct).length / n
  const meanConfidence =
    points.reduce((a, b) => a + clamp01(b.confidence / 100), 0) / n

  const bins = calibrationBins(points)
  const calibrationError =
    bins.reduce((a, b) => a + (b.n / n) * Math.abs(b.meanConfidence / 100 - b.accuracy), 0)

  return {
    n,
    brier: meanBrier(briers),
    accuracy,
    meanConfidence,
    bins,
    calibrationError,
    overconfidenceIndex: meanConfidence - accuracy,
  }
}

/** Per-domain calibration summaries, sorted by sample size (desc). */
export function calibrationByDomain(
  points: CalPoint[],
): { domain: string; summary: CalibrationSummary }[] {
  const groups = new Map<string, CalPoint[]>()
  for (const p of points) {
    const d = p.domain ?? 'general'
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(p)
  }
  return [...groups.entries()]
    .map(([domain, pts]) => ({ domain, summary: calibrationSummary(pts) }))
    .sort((a, b) => b.summary.n - a.summary.n)
}

/** A short human read of the calibration result. Pure + deterministic. */
export function calibrationVerdict(s: CalibrationSummary): string {
  if (s.n < 10) return 'Answer a few more for a stable reading.'
  const idx = s.overconfidenceIndex
  const pct = Math.round(Math.abs(idx) * 100)
  if (idx > 0.08) return `Overconfident by ~${pct} points — you claim more certainty than you earn.`
  if (idx < -0.08) return `Underconfident by ~${pct} points — you're righter than you feel.`
  return 'Well calibrated — your confidence tracks your accuracy.'
}

// ── Numeric 90%-interval scoring ────────────────────────────────────────────

export interface NumericScore {
  inside: boolean
  width: number
  /** width normalised by the magnitude of the truth (scale-free) */
  relWidth: number
  /**
   * Gneiting–Raftery interval score for a central (1−α) interval (lower better).
   * Penalises both width and being outside; outside misses are weighted by 2/α.
   */
  intervalScore: number
  /**
   * Bounded reward in [0,1] (1 best): a miss scores 0; a hit is rewarded for
   * sharpness so absurdly wide "safe" intervals aren't free.
   */
  points: number
}

/**
 * Score a stated interval [low, high] against the true value for a nominal
 * (1−alpha) interval (default 90%, alpha=0.10).
 * Defensive: if low > high the bounds are swapped (the UI guards this upstream).
 */
export function scoreNumeric(
  response: NumericResponse,
  truth: number,
  alpha = 0.1,
): NumericScore {
  let { low, high } = response
  if (low > high) [low, high] = [high, low]

  const inside = truth >= low && truth <= high
  const width = high - low
  const scale = Math.max(Math.abs(truth), 1)
  const relWidth = width / scale

  // Gneiting interval score (lower is better).
  let intervalScore = width
  if (truth < low) intervalScore += (2 / alpha) * (low - truth)
  else if (truth > high) intervalScore += (2 / alpha) * (truth - high)

  // Bounded sharpness-aware reward.
  const points = inside ? 1 / (1 + relWidth) : 0

  return { inside, width, relWidth, intervalScore, points }
}

export interface IntervalStats {
  n: number
  /** fraction of intervals that contained the truth (target ≈ nominal) */
  hitRate: number
  /** the nominal coverage these intervals were meant to have, e.g. 0.9 */
  target: number
  avgRelWidth: number
  avgPoints: number
  /** hitRate − target: negative ⇒ intervals too narrow (overconfident) */
  coverageGap: number
}

/** Aggregate stats over many numeric-interval responses. Empty-safe. */
export function intervalStats(scores: NumericScore[], target = 0.9): IntervalStats {
  const n = scores.length
  if (n === 0) {
    return { n: 0, hitRate: 0, target, avgRelWidth: 0, avgPoints: 0, coverageGap: 0 }
  }
  const hitRate = scores.filter((s) => s.inside).length / n
  return {
    n,
    hitRate,
    target,
    avgRelWidth: scores.reduce((a, b) => a + b.relWidth, 0) / n,
    avgPoints: scores.reduce((a, b) => a + b.points, 0) / n,
    coverageGap: hitRate - target,
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return Math.max(0, Math.min(1, x))
}
