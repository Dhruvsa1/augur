import { recordRangeAnswer } from '@/lib/data'
import type { RangeResponse } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) ?? {}
    const { anonOwner, questionId, confidence, response } = body as {
      anonOwner?: string
      questionId?: string
      confidence?: number
      response?: RangeResponse
    }
    if (!anonOwner) return Response.json({ error: 'Missing anonOwner' }, { status: 400 })
    if (!questionId) return Response.json({ error: 'Missing questionId' }, { status: 400 })
    if (!response || typeof response !== 'object') {
      return Response.json({ error: 'Missing response' }, { status: 400 })
    }
    const reveal = await recordRangeAnswer({
      userId: anonOwner,
      questionId,
      confidence: Number(confidence ?? 90),
      response,
    })
    return Response.json(reveal)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}
