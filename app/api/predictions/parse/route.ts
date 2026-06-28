import { parsePrediction } from '@/lib/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) ?? {}
    if (!text || typeof text !== 'string' || text.trim().length < 4) {
      return Response.json({ error: 'Write a prediction first.' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'REPLACE_ME') {
      return Response.json(
        { error: 'Prediction parsing needs the Anthropic key, which is not configured yet.' },
        { status: 503 },
      )
    }
    const today = new Date().toISOString().slice(0, 10)
    const parsed = await parsePrediction(text.trim(), today)
    return Response.json({ parsed })
  } catch {
    return Response.json(
      { error: "Couldn't read that prediction. Try rephrasing it." },
      { status: 502 },
    )
  }
}
