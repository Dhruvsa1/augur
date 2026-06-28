import { calibrationDashboard } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const owner = new URL(req.url).searchParams.get('owner') ?? ''
    if (!owner) return Response.json({ error: 'Missing owner' }, { status: 400 })
    const dashboard = await calibrationDashboard(owner)
    return Response.json(dashboard)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
