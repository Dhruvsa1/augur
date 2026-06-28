// Deck metadata — pure, client-safe (no DB imports).
export type Deck = 'mixed' | 'estimation' | 'world' | 'science' | 'hard'

export const DECKS: { id: Deck; label: string; blurb: string }[] = [
  { id: 'mixed', label: 'Mixed', blurb: 'A bit of everything.' },
  { id: 'estimation', label: 'Estimation', blurb: 'Numeric 90% intervals.' },
  { id: 'world', label: 'World', blurb: 'History & geography.' },
  { id: 'science', label: 'Science & body', blurb: 'How the world works.' },
  { id: 'hard', label: 'Hard', blurb: 'The trickiest questions.' },
]
