'use client'

import { useEffect, useState } from 'react'
import { anonOwner } from '@/lib/anon'
import { RangeMode } from './components/RangeMode'
import { Dashboard } from './components/Dashboard'
import { LiveMode } from './components/LiveMode'

type View = 'intro' | 'range' | 'reading' | 'live'

const NAV: { id: Exclude<View, 'intro'>; label: string }[] = [
  { id: 'range', label: 'Calibration Range' },
  { id: 'reading', label: 'Your Reading' },
  { id: 'live', label: 'Live Predictions' },
]

export default function Home() {
  const [owner, setOwner] = useState('')
  const [view, setView] = useState<View>('intro')

  useEffect(() => {
    setOwner(anonOwner())
    // returning users (have seen the intro) skip straight to the range
    if (typeof window !== 'undefined' && window.localStorage.getItem('augur_seen')) {
      setView('range')
    }
  }, [])

  function begin() {
    if (typeof window !== 'undefined') window.localStorage.setItem('augur_seen', '1')
    setView('range')
  }

  return (
    <div className="relative z-10 min-h-screen">
      {view === 'intro' ? (
        <Intro onBegin={begin} />
      ) : (
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
          {/* header / nav */}
          <header className="mb-8 flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={() => setView('range')} className="flex items-baseline gap-2 text-left">
              <span className="font-display text-2xl italic tracking-tight text-ivory">Augur</span>
              <span className="h-1.5 w-1.5 rounded-full bg-magenta pulse-glow" />
            </button>
            <nav className="flex flex-wrap gap-1">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                    view === n.id ? 'bg-gold/15 text-gold' : 'text-ivory-faint hover:text-ivory'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </nav>
          </header>

          {owner && view === 'range' && (
            <RangeMode owner={owner} onSeeReading={() => setView('reading')} />
          )}
          {owner && view === 'reading' && (
            <Dashboard owner={owner} onStartRange={() => setView('range')} />
          )}
          {owner && view === 'live' && <LiveMode owner={owner} />}

          <footer className="mt-20 border-t border-line pt-6 text-xs text-ivory-faint">
            Built by{' '}
            <a className="underline decoration-gold/40 hover:text-gold" href="https://dhruvsa1.org">
              Dhruvsai Dhulipudi
            </a>
            . No account — your calibration lives on this device.
          </footer>
        </main>
      )}
    </div>
  )
}

function Intro({ onBegin }: { onBegin: () => void }) {
  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="rise text-xs uppercase tracking-[0.32em] text-gold" style={{ animationDelay: '0ms' }}>
        Mirror 03 · the reasoning instrument
      </p>
      <h1
        className="rise mt-6 text-balance font-display text-5xl leading-[1.04] text-ivory md:text-7xl"
        style={{ animationDelay: '90ms' }}
      >
        How often are you <span className="italic text-gold">actually right</span> when you feel{' '}
        <span className="italic text-magenta">sure</span>?
      </h1>
      <p
        className="rise mt-7 max-w-xl text-lg leading-relaxed text-ivory-soft"
        style={{ animationDelay: '180ms' }}
      >
        Augur is a star-chart of your own certainty. Answer verifiable questions and state how sure
        you are. It scores you instantly — no waiting — and plots your confidence against the truth.
        Most people discover the same thing:{' '}
        <span className="text-ivory">when they say 90%, they’re right far less often.</span>
      </p>

      <div
        className="rise mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
        style={{ animationDelay: '280ms' }}
      >
        <button
          onClick={onBegin}
          className="rounded-md bg-gold px-7 py-3 text-base font-semibold text-void shadow-[0_0_30px_rgba(231,178,76,0.35)] transition hover:bg-gold-soft"
        >
          Consult the oracle →
        </button>
        <span className="text-sm text-ivory-faint">Answer ~15 to see your first reading. No sign-up.</span>
      </div>

      <div
        className="rise mt-16 grid gap-4 text-sm text-ivory-soft sm:grid-cols-3"
        style={{ animationDelay: '380ms' }}
      >
        <Glyph title="Calibration Range" body="A deck of true/false and estimation questions, scored instantly by pure math." />
        <Glyph title="The constellation" body="Your bins settle onto a perfect-calibration diagonal — see the gap at a glance." />
        <Glyph title="Live Predictions" body="Log real-world calls; resolve them later; watch your domains diverge." />
      </div>
    </main>
  )
}

function Glyph({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-indigo-2/40 p-4">
      <p className="font-display text-base text-gold">{title}</p>
      <p className="mt-1 leading-snug text-ivory-faint">{body}</p>
    </div>
  )
}
