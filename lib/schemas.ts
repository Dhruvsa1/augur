import { z } from 'zod'

// Zod schemas validating LLM structured output. Kept to simple objects/enums/
// strings/numbers to satisfy structured-output JSON-schema limits.

/** Freeform prediction → structured fields (user confirms before saving). */
export const zParsedPrediction = z.object({
  claim: z
    .string()
    .describe('The prediction rewritten as a single clear, falsifiable statement phrased so it resolves YES if the user is right.'),
  confidence: z
    .number()
    .describe('Probability 50–100 that the claim resolves YES, inferred from the text (default 70 if unstated).'),
  domain: z
    .string()
    .describe('A short lowercase domain tag, e.g. "tech", "timelines", "sports", "politics", "personal", "markets", "science".'),
  resolves_on: z
    .string()
    .nullable()
    .describe('ISO date (YYYY-MM-DD) when this can be checked, or null if no date is stated/implied.'),
  resolution_criteria: z
    .string()
    .describe('One sentence describing exactly what observable outcome counts as YES.'),
  needs_date: z
    .boolean()
    .describe('True if no resolution date could be determined and the user must supply one.'),
  note: z
    .string()
    .describe('A short friendly note to the user about how this was interpreted, or an empty string.'),
})

/** Assisted resolution suggestion (advisory only — the user is the final arbiter). */
export const zResolutionSuggestion = z.object({
  suggested_status: z.enum(['resolved_yes', 'resolved_no', 'unclear']),
  rationale: z
    .string()
    .describe('Brief reasoning. If you cannot verify from general knowledge, say so and choose "unclear".'),
  confidence_in_suggestion: z.enum(['low', 'medium', 'high']),
})
