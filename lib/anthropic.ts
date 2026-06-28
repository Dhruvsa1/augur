import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType } from 'zod'

const g = globalThis as unknown as { _ai?: Anthropic }

export function ai(): Anthropic {
  if (!g._ai) g._ai = new Anthropic() // reads ANTHROPIC_API_KEY
  return g._ai
}

export const MODEL = 'claude-opus-4-8'

/**
 * Ask Claude for a value that conforms to a Zod schema, validated by the SDK.
 * Uses Opus 4.8 with adaptive thinking + structured outputs. Throws if the model
 * returns nothing parseable (callers should catch and surface a graceful error).
 * NOTE: no temperature / top_p — Opus 4.8 rejects them (400).
 */
export async function generateJSON<T>(opts: {
  schema: ZodType<T>
  system?: string
  prompt: string
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  thinking?: boolean
}): Promise<T> {
  const {
    schema,
    system,
    prompt,
    maxTokens = 4000,
    effort = 'medium',
    thinking = true,
  } = opts

  const res = await ai().messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    ...(thinking ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: { format: zodOutputFormat(schema), effort },
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  })

  const out = res.parsed_output
  if (out == null) throw new Error('LLM returned no parseable output')
  return out as T
}
