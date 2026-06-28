import { q, q1 } from './db'
import {
  brier,
  scoreNumeric,
  calibrationSummary,
  calibrationByDomain,
  intervalStats,
  type CalPoint,
  type NumericScore,
} from './scoring'
import type {
  AnswerKey,
  BinaryAnswer,
  BinaryResponse,
  NumericAnswer,
  NumericResponse,
  ParsedPrediction,
  PredictionRow,
  PredictionStatus,
  QuestionKind,
  QuestionPublic,
  QuestionRow,
  RangeResponse,
} from './types'
import { type Deck } from './decks'

export { DECKS, type Deck } from './decks'

// ── Users ────────────────────────────────────────────────────────────────────

/** Ensure the anon user row exists (id is the client-generated uuid). Idempotent. */
export async function ensureUser(userId: string): Promise<void> {
  await q(
    `insert into augur.users_anon (id) values ($1) on conflict (id) do nothing`,
    [userId],
  )
}

// ── Decks / questions ──────────────────────────────────────────────────────────

function deckWhere(deck: Deck): { clause: string; params: unknown[] } {
  switch (deck) {
    case 'estimation':
      return { clause: `kind = 'numeric'`, params: [] }
    case 'world':
      return { clause: `domain in ('history','geography')`, params: [] }
    case 'science':
      return { clause: `domain in ('science','the body','tech')`, params: [] }
    case 'hard':
      return { clause: `difficulty >= 3`, params: [] }
    case 'mixed':
    default:
      return { clause: `true`, params: [] }
  }
}

function toPublic(row: QuestionRow): QuestionPublic {
  const unit = row.kind === 'numeric' ? (row.answer as NumericAnswer).unit ?? null : null
  return {
    id: row.id,
    kind: row.kind,
    prompt: row.prompt,
    domain: row.domain,
    difficulty: row.difficulty,
    unit,
  }
}

/** Fetch a batch of questions the user hasn't answered yet (answer key stripped). */
export async function fetchQuestions(
  userId: string,
  deck: Deck,
  count: number,
): Promise<QuestionPublic[]> {
  const { clause, params } = deckWhere(deck)
  const rows = await q<QuestionRow>(
    `select * from augur.questions
       where (${clause})
         and id not in (
           select question_id from augur.range_answers where user_id = $${params.length + 1}
         )
       order by random()
       limit $${params.length + 2}`,
    [...params, userId, count],
  )
  return rows.map(toPublic)
}

async function getQuestion(id: string): Promise<QuestionRow | null> {
  return q1<QuestionRow>(`select * from augur.questions where id = $1`, [id])
}

// ── Recording a Calibration-Range answer (pure-math scoring, no LLM) ───────────

export interface RangeReveal {
  correct: boolean
  brier: number
  confidence: number
  kind: QuestionKind
  /** the true answer, revealed only after the user has committed */
  truth: AnswerKey
  /** numeric-only extras */
  numeric?: { inside: boolean; width: number; points: number }
}

export async function recordRangeAnswer(args: {
  userId: string
  questionId: string
  confidence: number // 50–100 (binary). For numeric this is forced to 90.
  response: RangeResponse
}): Promise<RangeReveal> {
  const { userId, questionId, response } = args
  await ensureUser(userId)

  const question = await getQuestion(questionId)
  if (!question) throw new Error('Question not found')

  let correct: boolean
  let brierScore: number
  let confidence: number
  let numeric: RangeReveal['numeric']

  if (question.kind === 'binary') {
    const truth = question.answer as BinaryAnswer
    const resp = response as BinaryResponse
    if (typeof resp.value !== 'boolean') throw new Error('Binary response requires a boolean value')
    confidence = clampConfidence(args.confidence)
    correct = resp.value === truth.value
    brierScore = brier(confidence / 100, correct)
  } else {
    const truth = question.answer as NumericAnswer
    const resp = response as NumericResponse
    if (!Number.isFinite(resp.low) || !Number.isFinite(resp.high)) {
      throw new Error('Numeric response requires low and high numbers')
    }
    if (resp.low > resp.high) throw new Error('Interval low must be ≤ high')
    const score = scoreNumeric(resp, truth.value)
    confidence = 90 // a 90% interval is a 90%-confidence prediction
    correct = score.inside
    brierScore = brier(0.9, correct)
    numeric = { inside: score.inside, width: score.width, points: score.points }
  }

  await q(
    `insert into augur.range_answers (user_id, question_id, kind, confidence, response, correct, brier)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      userId,
      questionId,
      question.kind,
      confidence,
      JSON.stringify(response),
      correct,
      brierScore,
    ],
  )

  return {
    correct,
    brier: brierScore,
    confidence,
    kind: question.kind,
    truth: question.answer,
    numeric,
  }
}

// ── Predictions (Live mode) ────────────────────────────────────────────────────

export async function createPrediction(args: {
  userId: string
  parsed: Pick<
    ParsedPrediction,
    'claim' | 'confidence' | 'domain' | 'resolves_on' | 'resolution_criteria'
  >
}): Promise<PredictionRow> {
  const { userId, parsed } = args
  await ensureUser(userId)
  const confidence = clampConfidence(parsed.confidence)
  const row = await q1<PredictionRow>(
    `insert into augur.predictions
       (user_id, claim, confidence, domain, resolves_on, resolution_criteria, status)
     values ($1,$2,$3,$4,$5,$6,'open')
     returning *`,
    [
      userId,
      parsed.claim,
      confidence,
      parsed.domain || 'general',
      parsed.resolves_on || null,
      parsed.resolution_criteria || null,
    ],
  )
  if (!row) throw new Error('Failed to create prediction')
  return row
}

export async function listPredictions(userId: string): Promise<PredictionRow[]> {
  return q<PredictionRow>(
    `select * from augur.predictions
       where user_id = $1
       order by (status = 'open') desc, coalesce(resolves_on, created_at::date) asc, created_at desc`,
    [userId],
  )
}

export async function getPrediction(
  userId: string,
  id: string,
): Promise<PredictionRow | null> {
  return q1<PredictionRow>(
    `select * from augur.predictions where id = $1 and user_id = $2`,
    [id, userId],
  )
}

/** Resolve a prediction. The USER decides the status — this just records it + scores. */
export async function resolvePrediction(args: {
  userId: string
  id: string
  status: PredictionStatus
}): Promise<PredictionRow> {
  const { userId, id, status } = args
  const existing = await getPrediction(userId, id)
  if (!existing) throw new Error('Prediction not found')

  let brierScore: number | null = null
  if (status === 'resolved_yes' || status === 'resolved_no') {
    const outcome = status === 'resolved_yes'
    brierScore = brier(Number(existing.confidence) / 100, outcome)
  }

  const resolvedAt = status === 'open' ? null : new Date().toISOString()
  const row = await q1<PredictionRow>(
    `update augur.predictions
       set status = $1, brier = $2, resolved_at = $3
     where id = $4 and user_id = $5
     returning *`,
    [status, brierScore, resolvedAt, id, userId],
  )
  if (!row) throw new Error('Failed to resolve prediction')
  return row
}

// ── Calibration dashboard ───────────────────────────────────────────────────────

interface JoinedRange {
  kind: QuestionKind
  confidence: string
  correct: boolean
  domain: string
  prompt: string
  response: RangeResponse
  answer: AnswerKey
  created_at: string
}

export interface BiggestSurprise {
  kind: 'range' | 'prediction'
  text: string
  confidence: number
  detail: string
  created_at: string
}

export interface CalibrationDashboard {
  overall: ReturnType<typeof calibrationSummary>
  byDomain: ReturnType<typeof calibrationByDomain>
  intervals: ReturnType<typeof intervalStats>
  /** running mean Brier over time, oldest→newest */
  brierOverTime: { i: number; brier: number; running: number }[]
  surprises: BiggestSurprise[]
  counts: { range: number; predictionsResolved: number; predictionsOpen: number }
}

export async function calibrationDashboard(userId: string): Promise<CalibrationDashboard> {
  const ranges = await q<JoinedRange>(
    `select ra.kind, ra.confidence, ra.correct, ra.response, ra.created_at,
            qu.domain, qu.prompt, qu.answer
       from augur.range_answers ra
       join augur.questions qu on qu.id = ra.question_id
       where ra.user_id = $1
       order by ra.created_at asc`,
    [userId],
  )

  const preds = await q<PredictionRow>(
    `select * from augur.predictions where user_id = $1 order by created_at asc`,
    [userId],
  )
  const resolvedPreds = preds.filter(
    (p) => p.status === 'resolved_yes' || p.status === 'resolved_no',
  )
  const openPreds = preds.filter((p) => p.status === 'open')

  // Unified calibration points (range answers + resolved predictions).
  const points: CalPoint[] = [
    ...ranges.map((r) => ({
      confidence: Number(r.confidence),
      correct: r.correct,
      domain: r.domain,
    })),
    ...resolvedPreds.map((p) => ({
      confidence: Number(p.confidence),
      correct: p.status === 'resolved_yes',
      domain: p.domain,
    })),
  ]

  const overall = calibrationSummary(points)
  const byDomain = calibrationByDomain(points)

  // Numeric interval stats (recomputed from stored responses + truths).
  const numericScores: NumericScore[] = ranges
    .filter((r) => r.kind === 'numeric')
    .map((r) =>
      scoreNumeric(r.response as NumericResponse, (r.answer as NumericAnswer).value),
    )
  const intervals = intervalStats(numericScores)

  // Brier over time (chronological, with a running mean).
  const chrono = [
    ...ranges.map((r) => ({ t: r.created_at, brier: brier(Number(r.confidence) / 100, r.correct) })),
    ...resolvedPreds.map((p) => ({
      t: p.resolved_at ?? p.created_at,
      brier: brier(Number(p.confidence) / 100, p.status === 'resolved_yes'),
    })),
  ].sort((a, b) => +new Date(a.t) - +new Date(b.t))
  let acc = 0
  const brierOverTime = chrono.map((c, i) => {
    acc += c.brier
    return { i, brier: round(c.brier), running: round(acc / (i + 1)) }
  })

  // Biggest surprises: high-confidence misses.
  const rangeSurprises: BiggestSurprise[] = ranges
    .filter((r) => !r.correct && Number(r.confidence) >= 80)
    .map((r) => ({
      kind: 'range' as const,
      text: r.prompt,
      confidence: Number(r.confidence),
      detail:
        r.kind === 'numeric'
          ? `Truth was ${(r.answer as NumericAnswer).value}${
              (r.answer as NumericAnswer).unit ? ' ' + (r.answer as NumericAnswer).unit : ''
            } — outside your interval.`
          : `You were ${Number(r.confidence)}% sure — and wrong.`,
      created_at: r.created_at,
    }))
  const predSurprises: BiggestSurprise[] = resolvedPreds
    .filter((p) => p.status === 'resolved_no' && Number(p.confidence) >= 80)
    .map((p) => ({
      kind: 'prediction' as const,
      text: p.claim,
      confidence: Number(p.confidence),
      detail: `You were ${Number(p.confidence)}% sure — it didn't happen.`,
      created_at: p.resolved_at ?? p.created_at,
    }))
  const surprises = [...rangeSurprises, ...predSurprises]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)

  return {
    overall,
    byDomain,
    intervals,
    brierOverTime,
    surprises,
    counts: {
      range: ranges.length,
      predictionsResolved: resolvedPreds.length,
      predictionsOpen: openPreds.length,
    },
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function clampConfidence(c: number): number {
  if (!Number.isFinite(c)) return 50
  return Math.max(50, Math.min(100, Math.round(c)))
}
function round(x: number): number {
  return Math.round(x * 1000) / 1000
}
