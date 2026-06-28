// Augur domain types — the contract the whole app is built on.
// Two prediction surfaces feed ONE calibration curve:
//   1. Calibration Range — verifiable questions scored instantly by pure math.
//   2. Live Predictions — freeform real-world claims, resolved later by the user.

export type QuestionKind = 'binary' | 'numeric'

/** Stored answer key for a question (server-only; never sent before the user answers). */
export interface BinaryAnswer {
  value: boolean
}
export interface NumericAnswer {
  value: number
  unit?: string
}
export type AnswerKey = BinaryAnswer | NumericAnswer

export interface QuestionRow {
  id: string
  kind: QuestionKind
  prompt: string
  answer: AnswerKey
  domain: string
  difficulty: number
  source: string | null
  created_at: string
}

/** A question as sent to the client — the answer key is stripped. */
export interface QuestionPublic {
  id: string
  kind: QuestionKind
  prompt: string
  domain: string
  difficulty: number
  unit?: string | null
}

/** What the user submits for a binary question: their True/False guess. */
export interface BinaryResponse {
  value: boolean
}
/** What the user submits for a numeric question: a 90% confidence interval. */
export interface NumericResponse {
  low: number
  high: number
}
export type RangeResponse = BinaryResponse | NumericResponse

export interface RangeAnswerRow {
  id: string
  user_id: string
  question_id: string
  kind: QuestionKind
  confidence: number // 50–100 for binary; numeric is fixed at the 90% interval
  response: RangeResponse
  correct: boolean
  brier: number | null
  created_at: string
}

export type PredictionStatus = 'open' | 'resolved_yes' | 'resolved_no' | 'void'

export interface PredictionRow {
  id: string
  user_id: string
  claim: string
  confidence: number // probability (50–100) that the claim resolves YES
  domain: string
  resolves_on: string | null
  resolution_criteria: string | null
  status: PredictionStatus
  resolved_at: string | null
  brier: number | null
  created_at: string
}

/** The LLM's structured parse of a freeform prediction (user confirms before saving). */
export interface ParsedPrediction {
  claim: string
  confidence: number
  domain: string
  resolves_on: string | null
  resolution_criteria: string
  needs_date: boolean
  note: string
}

/** The LLM's assisted-resolution suggestion (user is always the final arbiter). */
export interface ResolutionSuggestion {
  suggested_status: 'resolved_yes' | 'resolved_no' | 'unclear'
  rationale: string
  confidence_in_suggestion: 'low' | 'medium' | 'high'
}
