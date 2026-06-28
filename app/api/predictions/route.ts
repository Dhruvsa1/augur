import { createPrediction, listPredictions } from '@/lib/data'
import type { ParsedPrediction } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const owner = new URL(req.url).searchParams.get('owner') ?? ''
    if (!owner) return Response.json({ error: 'Missing owner' }, { status: 400 })
    const predictions = await listPredictions(owner)
    return Response.json({ predictions })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { anonOwner, parsed } = (await req.json()) ?? {}
    if (!anonOwner) return Response.json({ error: 'Missing anonOwner' }, { status: 400 })
    const p = parsed as Partial<ParsedPrediction> | undefined
    if (!p || !p.claim || typeof p.claim !== 'string') {
      return Response.json({ error: 'A claim is required' }, { status: 400 })
    }
    const prediction = await createPrediction({
      userId: anonOwner,
      parsed: {
        claim: p.claim,
        confidence: Number(p.confidence ?? 70),
        domain: p.domain ?? 'general',
        resolves_on: p.resolves_on ?? null,
        resolution_criteria: p.resolution_criteria ?? '',
      },
    })
    return Response.json({ prediction })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}
