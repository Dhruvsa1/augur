import { getPrediction } from '@/lib/data'
import { suggestResolution } from '@/lib/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Assisted resolution — ADVISORY ONLY. The user always confirms the final status.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { anonOwner } = (await req.json()) ?? {}
    if (!anonOwner) return Response.json({ error: 'Missing anonOwner' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'REPLACE_ME') {
      return Response.json(
        { error: 'Assisted resolution needs the Anthropic key, which is not configured yet.' },
        { status: 503 },
      )
    }
    const prediction = await getPrediction(anonOwner, id)
    if (!prediction) return Response.json({ error: 'Not found' }, { status: 404 })
    const today = new Date().toISOString().slice(0, 10)
    const suggestion = await suggestResolution(prediction, today)
    return Response.json({ suggestion })
  } catch {
    return Response.json(
      { error: "Couldn't get a suggestion — resolve it yourself." },
      { status: 502 },
    )
  }
}
