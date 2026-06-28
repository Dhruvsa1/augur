import { generateJSON } from './anthropic'
import { zParsedPrediction, zResolutionSuggestion } from './schemas'
import type { ParsedPrediction, PredictionRow, ResolutionSuggestion } from './types'

/**
 * Parse a freeform prediction ("I'll ship by Friday — 80%") into structured
 * fields for the user to confirm. Never invents resolution; flags missing dates.
 */
export async function parsePrediction(
  text: string,
  today: string,
): Promise<ParsedPrediction> {
  const system = `You convert a person's freeform prediction into structured, falsifiable
fields for a personal calibration tracker. Today is ${today}.

Rules:
- Rewrite the prediction as ONE clear statement phrased so it resolves YES when the person
  is right (move any negation into the claim; confidence is always 50–100).
- Infer confidence from hedging language if a number isn't given (e.g. "pretty sure" ≈ 75,
  "maybe" ≈ 55, "almost certain" ≈ 90). If truly unclear, use 70.
- resolves_on: a concrete YYYY-MM-DD if a date is stated or clearly implied (e.g. "by Friday",
  "end of Q3", "next month"). If none can be determined, set resolves_on to null and
  needs_date to true.
- resolution_criteria: state exactly what observable outcome counts as YES.
- domain: a short lowercase tag.
- Do NOT fabricate specifics the person didn't say. Keep their meaning.`

  return generateJSON<ParsedPrediction>({
    schema: zParsedPrediction,
    system,
    prompt: `Freeform prediction:\n"""\n${text.slice(0, 2000)}\n"""`,
    maxTokens: 2000,
    effort: 'medium',
  })
}

/**
 * Suggest a resolution for a prediction whose date has arrived. ADVISORY ONLY —
 * the caller surfaces this to the user, who makes the final call. The model is
 * told to choose "unclear" rather than guess at anything it can't verify.
 */
export async function suggestResolution(
  prediction: Pick<PredictionRow, 'claim' | 'resolution_criteria' | 'resolves_on' | 'domain'>,
  today: string,
): Promise<ResolutionSuggestion> {
  const system = `You help a user resolve a past prediction. Today is ${today}. You are an
ADVISOR, not the decider — the user always confirms. If you cannot verify the outcome from
reliable general knowledge (anything recent, private, or genuinely uncertain), you MUST
return "unclear" and say why. Never bluff a resolution.`

  const prompt = `Prediction (resolves YES if it came true):
claim: ${prediction.claim}
resolution criteria: ${prediction.resolution_criteria ?? '(none given)'}
resolve date: ${prediction.resolves_on ?? '(none)'}
domain: ${prediction.domain}

Did this resolve YES or NO, or is it unclear?`

  return generateJSON<ResolutionSuggestion>({
    schema: zResolutionSuggestion,
    system,
    prompt,
    maxTokens: 1500,
    effort: 'medium',
  })
}
