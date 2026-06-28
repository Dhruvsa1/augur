import { fetchQuestions, ensureUser, type Deck } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DECKS = new Set<Deck>(['mixed', 'estimation', 'world', 'science', 'hard'])

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const owner = url.searchParams.get('owner') ?? ''
    const deckParam = (url.searchParams.get('deck') ?? 'mixed') as Deck
    const count = Math.max(1, Math.min(30, Number(url.searchParams.get('count') ?? 15)))
    if (!owner) return Response.json({ error: 'Missing owner' }, { status: 400 })
    const deck = DECKS.has(deckParam) ? deckParam : 'mixed'
    await ensureUser(owner)
    const questions = await fetchQuestions(owner, deck, count)
    return Response.json({ questions })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
