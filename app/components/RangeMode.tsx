'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuestionPublic, AnswerKey, NumericAnswer, BinaryAnswer } from '@/lib/types'
import { DECKS, type Deck } from '@/lib/decks'

interface Reveal {
  correct: boolean
  brier: number
  confidence: number
  kind: 'binary' | 'numeric'
  truth: AnswerKey
  numeric?: { inside: boolean; width: number; points: number }
}

interface Tally {
  correct: boolean
  confidence: number
}

export function RangeMode({
  owner,
  onSeeReading,
}: {
  owner: string
  onSeeReading: () => void
}) {
  const [deck, setDeck] = useState<Deck>('mixed')
  const [queue, setQueue] = useState<QuestionPublic[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  // per-question state
  const [pick, setPick] = useState<boolean | null>(null)
  const [confidence, setConfidence] = useState(50)
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [busy, setBusy] = useState(false)
  const [answerErr, setAnswerErr] = useState<string | null>(null)
  const [tally, setTally] = useState<Tally[]>([])

  const loadDeck = useCallback(
    (d: Deck) => {
      if (!owner) return
      setQueue(null)
      setLoadErr(null)
      setIdx(0)
      resetQuestion()
      fetch(`/api/questions?owner=${owner}&deck=${d}&count=15`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error)
          setQueue(data.questions ?? [])
        })
        .catch((e) => setLoadErr(e.message))
    },
    [owner],
  )

  useEffect(() => {
    if (owner) loadDeck(deck)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, deck])

  function resetQuestion() {
    setPick(null)
    setConfidence(50)
    setLow('')
    setHigh('')
    setReveal(null)
    setAnswerErr(null)
  }

  const q = queue && idx < queue.length ? queue[idx] : null

  const numericGuard =
    q?.kind === 'numeric' &&
    low.trim() !== '' &&
    high.trim() !== '' &&
    Number(low) > Number(high)

  async function submit() {
    if (!q || busy) return
    setAnswerErr(null)
    let response: Record<string, unknown>
    let conf = confidence
    if (q.kind === 'binary') {
      if (pick === null) {
        setAnswerErr('Choose True or False first.')
        return
      }
      response = { value: pick }
    } else {
      if (low.trim() === '' || high.trim() === '') {
        setAnswerErr('Give both a low and a high bound.')
        return
      }
      if (!Number.isFinite(Number(low)) || !Number.isFinite(Number(high))) {
        setAnswerErr('Bounds must be numbers.')
        return
      }
      if (Number(low) > Number(high)) {
        setAnswerErr('Your low bound is above your high bound.')
        return
      }
      response = { low: Number(low), high: Number(high) }
      conf = 90
    }
    setBusy(true)
    try {
      const res = await fetch('/api/range/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          anonOwner: owner,
          questionId: q.id,
          confidence: conf,
          response,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not score that.')
      setReveal(data)
      setTally((t) => [...t, { correct: data.correct, confidence: data.confidence }])
    } catch (e) {
      setAnswerErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function next() {
    resetQuestion()
    setIdx((i) => i + 1)
  }

  // keyboard: T / F for binary, Enter to submit / advance
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q) return
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (reveal) {
        if (e.key === 'Enter') next()
        return
      }
      if (q.kind === 'binary' && !typing) {
        if (e.key.toLowerCase() === 't') setPick(true)
        if (e.key.toLowerCase() === 'f') setPick(false)
      }
      if (e.key === 'Enter' && (q.kind === 'numeric' || pick !== null)) {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, reveal, pick, confidence, low, high, busy])

  const answeredThisSession = tally.length
  const sessionCorrect = tally.filter((t) => t.correct).length

  // ── render states ──────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="mx-auto max-w-2xl">
      {/* deck selector + session tally */}
      <div className="rise mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {DECKS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeck(d.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                deck === d.id
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-line text-ivory-faint hover:border-indigo-3 hover:text-ivory-soft'
              }`}
              title={d.blurb}
            >
              {d.label}
            </button>
          ))}
        </div>
        {answeredThisSession > 0 && (
          <button
            onClick={onSeeReading}
            className="text-xs text-magenta underline decoration-magenta/40 underline-offset-4 hover:text-ivory"
          >
            <span className="num">{sessionCorrect}/{answeredThisSession}</span> this session · see your reading →
          </button>
        )}
      </div>

      {loadErr && (
        <Notice tone="bad">Couldn’t load questions: {loadErr}</Notice>
      )}

      {queue === null && !loadErr && (
        <div className="rounded-2xl border border-line bg-indigo-2/50 p-10 text-center">
          <Dots />
          <p className="mt-4 text-ivory-soft">Drawing your cards…</p>
        </div>
      )}

      {queue !== null && !q && (
        <div className="rise rounded-2xl border border-line bg-indigo-2/50 p-10 text-center">
          <p className="font-display text-2xl text-ivory">
            {answeredThisSession > 0
              ? 'You’ve cleared this deck.'
              : 'You’ve already answered every question here.'}
          </p>
          <p className="mt-2 text-ivory-soft">
            Try another deck, or read your calibration so far.
          </p>
          <button
            onClick={onSeeReading}
            className="mt-6 rounded-md bg-gold px-5 py-2.5 text-sm font-medium text-void transition hover:bg-gold-soft"
          >
            See your reading →
          </button>
        </div>
      )}

      {q && (
        <div key={q.id} className="rise">
          {/* progress */}
          <div className="mb-3 flex items-center justify-between text-xs text-ivory-faint">
            <span className="uppercase tracking-[0.18em] text-gold">{q.domain}</span>
            <span className="num">
              {idx + 1} / {queue!.length} drawn
            </span>
          </div>

          <div className="rounded-2xl border border-line bg-indigo-2/70 p-6 backdrop-blur-md md:p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
            <p className="font-display text-2xl leading-snug text-ivory md:text-[28px]">
              {q.prompt}
            </p>

            {/* ── binary ── */}
            {q.kind === 'binary' && !reveal && (
              <>
                <div className="mt-7 grid grid-cols-2 gap-3">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      onClick={() => setPick(v)}
                      className={`rounded-xl border px-4 py-4 text-base font-medium transition ${
                        pick === v
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-line bg-indigo/40 text-ivory-soft hover:border-indigo-3 hover:text-ivory'
                      }`}
                    >
                      {v ? 'True' : 'False'}
                      <span className="ml-2 text-xs opacity-50">{v ? '(T)' : '(F)'}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-8">
                  <div className="flex items-end justify-between">
                    <div>
                      <label
                        htmlFor="conf"
                        className="text-xs uppercase tracking-[0.18em] text-ivory-faint"
                      >
                        How sure are you?
                      </label>
                      <p className="mt-1 font-display text-base italic text-magenta">
                        {confVerdict(confidence)}
                      </p>
                    </div>
                    <span className="num text-5xl font-bold leading-none text-gold">
                      {confidence}
                      <span className="text-2xl text-gold-soft">%</span>
                    </span>
                  </div>
                  <input
                    id="conf"
                    type="range"
                    min={50}
                    max={100}
                    step={1}
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="conf-slider mt-4"
                    style={{ ['--pct' as string]: `${((confidence - 50) / 50) * 100}%` }}
                    aria-label="Confidence percentage"
                  />
                  <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-ivory-faint">
                    <span>50% · coin flip</span>
                    <span>100% · certain</span>
                  </div>
                </div>
              </>
            )}

            {/* ── numeric ── */}
            {q.kind === 'numeric' && !reveal && (
              <div className="mt-7">
                <p className="text-sm text-ivory-soft">
                  Give a range you’re{' '}
                  <span className="text-gold">90% sure</span> contains the answer
                  {q.unit ? <> (in {q.unit})</> : null}.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <NumberField label="Low" value={low} onChange={setLow} unit={q.unit} />
                  <span className="mt-5 text-ivory-faint">to</span>
                  <NumberField label="High" value={high} onChange={setHigh} unit={q.unit} />
                </div>
                {numericGuard && (
                  <p className="mt-3 text-xs text-bad">
                    Your low bound is above your high bound — flip them.
                  </p>
                )}
                <p className="mt-3 text-xs text-ivory-faint">
                  Tip: a 90% interval should be wide enough that you’d be surprised to be
                  wrong — but not so wide it’s meaningless.
                </p>
              </div>
            )}

            {/* ── reveal ── */}
            {reveal && <RevealCard q={q} reveal={reveal} />}

            {answerErr && (
              <p className="mt-4 text-sm text-bad">{answerErr}</p>
            )}

            {/* actions */}
            <div className="mt-7 flex items-center justify-between">
              {!reveal ? (
                <button
                  onClick={submit}
                  disabled={busy || numericGuard}
                  className="rounded-md bg-gold px-6 py-2.5 text-sm font-semibold text-void transition enabled:hover:bg-gold-soft disabled:opacity-30"
                >
                  {busy ? 'Consulting…' : 'Lock it in →'}
                </button>
              ) : (
                <button
                  onClick={next}
                  className="rounded-md bg-gold px-6 py-2.5 text-sm font-semibold text-void transition hover:bg-gold-soft"
                  autoFocus
                >
                  Next question →
                </button>
              )}
              <span className="text-[11px] text-ivory-faint">
                {reveal ? 'Enter for next' : 'Enter to lock in'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RevealCard({ q, reveal }: { q: QuestionPublic; reveal: Reveal }) {
  const correct = reveal.correct
  const tone = correct ? 'good' : 'bad'
  let truthLine: string
  if (q.kind === 'binary') {
    truthLine = `The claim is ${(reveal.truth as BinaryAnswer).value ? 'TRUE' : 'FALSE'}.`
  } else {
    const t = reveal.truth as NumericAnswer
    truthLine = `The answer is ${formatNum(t.value)}${t.unit ? ' ' + t.unit : ''}.`
  }

  return (
    <div
      className="settle mt-7 rounded-xl border p-5"
      style={{
        borderColor: correct ? 'var(--good)' : 'var(--bad)',
        background: correct ? 'rgba(111,208,168,0.08)' : 'rgba(232,117,91,0.08)',
      }}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-display text-2xl" style={{ color: `var(--${tone})` }}>
          {correct ? 'Right.' : 'Wrong.'}
        </p>
        <p className="num text-xs text-ivory-faint">
          Brier {reveal.brier.toFixed(2)} ·{' '}
          {q.kind === 'numeric' ? '90% interval' : `${reveal.confidence}% sure`}
        </p>
      </div>
      <p className="mt-2 text-ivory">{truthLine}</p>
      <p className="mt-2 text-sm text-ivory-soft">{nudge(q, reveal)}</p>
    </div>
  )
}

function nudge(q: QuestionPublic, r: Reveal): string {
  if (q.kind === 'numeric') {
    return r.numeric?.inside
      ? 'Inside your interval — well judged. Tighter intervals earn more when you’re right.'
      : 'Outside your interval. A true 90% interval should miss only 1 in 10.'
  }
  if (r.correct) {
    return r.confidence >= 85
      ? 'Confident and correct — that’s calibration working for you.'
      : 'Right, though you hedged. You may know more than you let on.'
  }
  return r.confidence >= 85
    ? 'A confident miss — these are the ones that bend your curve the most.'
    : 'A miss, but you weren’t sure — that’s honest uncertainty.'
}

function NumberField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit?: string | null
}) {
  return (
    <label className="flex-1">
      <span className="text-[10px] uppercase tracking-wider text-ivory-faint">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-line bg-indigo/50 focus-within:border-gold/60">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-full bg-transparent px-3 py-2.5 text-lg tabular-nums text-ivory outline-none placeholder:text-ivory-faint"
        />
        {unit && <span className="pr-3 text-xs text-ivory-faint">{unit}</span>}
      </div>
    </label>
  )
}

function Notice({ tone, children }: { tone: 'good' | 'bad'; children: React.ReactNode }) {
  return (
    <div
      className="mb-4 rounded-md border px-4 py-3 text-sm"
      style={{
        borderColor: tone === 'bad' ? 'var(--bad)' : 'var(--good)',
        color: tone === 'bad' ? 'var(--bad)' : 'var(--good)',
        background: tone === 'bad' ? 'rgba(232,117,91,0.08)' : 'rgba(111,208,168,0.08)',
      }}
    >
      {children}
    </div>
  )
}

function Dots() {
  return (
    <div className="flex justify-center gap-1.5">
      <span className="thinking-dot h-2 w-2 rounded-full bg-gold" />
      <span className="thinking-dot h-2 w-2 rounded-full bg-gold" />
      <span className="thinking-dot h-2 w-2 rounded-full bg-gold" />
    </div>
  )
}

function formatNum(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function confVerdict(c: number): string {
  if (c <= 50) return 'a coin flip'
  if (c < 65) return 'leaning'
  if (c < 80) return 'fairly sure'
  if (c < 95) return 'confident'
  return 'near-certain'
}
