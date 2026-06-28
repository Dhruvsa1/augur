import { resolvePrediction } from '@/lib/data'
import type { PredictionStatus } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID = new Set<PredictionStatus>(['open', 'resolved_yes', 'resolved_no', 'void'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { anonOwner, status } = (await req.json()) ?? {}
    if (!anonOwner) return Response.json({ error: 'Missing anonOwner' }, { status: 400 })
    if (!VALID.has(status)) return Response.json({ error: 'Invalid status' }, { status: 400 })
    const prediction = await resolvePrediction({ userId: anonOwner, id, status })
    return Response.json({ prediction })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}
