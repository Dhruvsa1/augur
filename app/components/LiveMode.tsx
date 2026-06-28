'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ParsedPrediction, PredictionRow, ResolutionSuggestion } from '@/lib/types'

type Draft = {
  claim: string
  confidence: number
  domain: string
  resolves_on: string
  resolution_criteria: string
  needs_date: boolean
  note: string
}

const EMPTY_DRAFT: Draft = {
  claim: '',
  confidence: 70,
  domain: 'general',
  resolves_on: '',
  resolution_criteria: '',
  needs_date: true,
  note: '',
}

export function LiveMode({ owner }: { owner: string }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [needsKey, setNeedsKey] = useState(false)
  const [list, setList] = useState<PredictionRow[] | null>(null)

  const refresh = useCallback(() => {
    if (!owner) return
    fetch(`/api/predictions?owner=${owner}`)
      .then((r) => r.json())
      .then((d) => setList(d.predictions ?? []))
      .catch(() => setList([]))
  }, [owner])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function interpret() {
    if (!text.trim() || parsing) return
    setParsing(true)
    setErr(null)
    setNeedsKey(false)
    try {
      const res = await fetch('/api/predictions/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const d = await res.json()
      if (res.status === 503) {
        setNeedsKey(true)
        return
      }
      if (!res.ok) {
        // parsing unavailable for any reason — offer the manual path
        setErr(d.error || 'Could not interpret that.')
        setNeedsKey(true)
        return
      }
      const p = d.parsed as ParsedPrediction
      setDraft({
        claim: p.claim,
        confidence: clamp(p.confidence),
        domain: p.domain || 'general',
        resolves_on: p.resolves_on ?? '',
        resolution_criteria: p.resolution_criteria ?? '',
        needs_date: p.needs_date,
        note: p.note ?? '',
      })
    } catch (e) {
      setErr((e as Error).message)
      setNeedsKey(true)
    } finally {
      setParsing(false)
    }
  }

  function startManual() {
    setNeedsKey(false)
    setDraft({ ...EMPTY_DRAFT, claim: text.trim() })
  }

  async function save() {
    if (!draft || saving) return
    if (!draft.claim.trim()) {
      setErr('A claim is required.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          anonOwner: owner,
          parsed: {
            claim: draft.claim,
            confidence: draft.confidence,
            domain: draft.domain,
            resolves_on: draft.resolves_on || null,
            resolution_criteria: draft.resolution_criteria,
          },
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save.')
      setDraft(null)
      setText('')
      refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const open = (list ?? []).filter((p) => p.status === 'open')
  const resolved = (list ?? []).filter((p) => p.status !== 'open')

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* composer */}
      <div className="rise rounded-2xl border border-line bg-indigo-2/55 p-6">
        <h2 className="font-display text-xl text-ivory">Log a real prediction</h2>
        <p className="mt-1 text-sm text-ivory-soft">
          Write it however you think it. Augur turns it into something you can resolve later —
          and it feeds the same curve.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="“I’ll ship the redesign by Friday — about 80% sure.”"
          className="mt-4 h-24 w-full resize-none rounded-lg border border-line bg-indigo/50 px-4 py-3 text-sm leading-relaxed text-ivory outline-none placeholder:text-ivory-faint focus:border-gold/60"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ivory-faint">
            {needsKey ? 'Auto-parsing is offline right now.' : 'Claude will structure it for you.'}
          </span>
          <button
            onClick={interpret}
            disabled={!text.trim() || parsing}
            className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-void transition enabled:hover:bg-gold-soft disabled:opacity-30"
          >
            {parsing ? 'Interpreting…' : 'Interpret →'}
          </button>
        </div>

        {needsKey && (
          <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-ivory-soft">
            Auto-parsing isn’t available right now. You can still log this prediction by filling
            in the fields yourself.
            <button
              onClick={startManual}
              className="ml-2 font-medium text-gold underline underline-offset-2"
            >
              Enter it manually →
            </button>
          </div>
        )}

        {err && <p className="mt-3 text-sm text-bad">{err}</p>}

        {/* confirm / edit card */}
        {draft && (
          <div className="settle mt-5 rounded-xl border border-gold/40 bg-indigo/50 p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.16em] text-gold">
              Confirm before it’s logged
            </p>
            {draft.note && <p className="mb-3 text-xs italic text-ivory-faint">{draft.note}</p>}

            <Field label="Claim (resolves YES if you’re right)">
              <textarea
                value={draft.claim}
                onChange={(e) => setDraft({ ...draft, claim: e.target.value })}
                className="h-16 w-full resize-none rounded-md border border-line bg-indigo/60 px-3 py-2 text-sm text-ivory outline-none focus:border-gold/60"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Confidence — ${draft.confidence}%`}>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={draft.confidence}
                  onChange={(e) => setDraft({ ...draft, confidence: Number(e.target.value) })}
                  className="conf-slider mt-2"
                  style={{ ['--pct' as string]: `${((draft.confidence - 50) / 50) * 100}%` }}
                />
              </Field>
              <Field label="Domain">
                <input
                  value={draft.domain}
                  onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                  className="w-full rounded-md border border-line bg-indigo/60 px-3 py-2 text-sm text-ivory outline-none focus:border-gold/60"
                />
              </Field>
            </div>

            <Field
              label={
                draft.needs_date && !draft.resolves_on
                  ? 'Resolve date — pick one so Augur can remind you'
                  : 'Resolve date'
              }
            >
              <input
                type="date"
                value={draft.resolves_on}
                onChange={(e) => setDraft({ ...draft, resolves_on: e.target.value })}
                className={`w-full rounded-md border bg-indigo/60 px-3 py-2 text-sm text-ivory outline-none focus:border-gold/60 ${
                  draft.needs_date && !draft.resolves_on ? 'border-gold/60' : 'border-line'
                }`}
              />
            </Field>

            <Field label="What counts as YES">
              <input
                value={draft.resolution_criteria}
                onChange={(e) => setDraft({ ...draft, resolution_criteria: e.target.value })}
                placeholder="e.g. the redesign is merged to main"
                className="w-full rounded-md border border-line bg-indigo/60 px-3 py-2 text-sm text-ivory outline-none placeholder:text-ivory-faint focus:border-gold/60"
              />
            </Field>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setDraft(null)}
                className="text-sm text-ivory-faint underline hover:text-ivory"
              >
                Discard
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-void hover:bg-gold-soft disabled:opacity-40"
              >
                {saving ? 'Logging…' : 'Log this prediction →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* open list */}
      <div className="rise" style={{ animationDelay: '80ms' }}>
        <h3 className="mb-3 font-display text-lg text-ivory">
          Open{open.length > 0 ? ` · ${open.length}` : ''}
        </h3>
        {list === null ? (
          <p className="text-sm text-ivory-faint">Loading…</p>
        ) : open.length === 0 ? (
          <p className="rounded-lg border border-line bg-indigo-2/40 p-4 text-sm text-ivory-faint">
            Nothing open yet. Log a prediction above — it’ll wait here until its date.
          </p>
        ) : (
          <div className="space-y-3">
            {open.map((p) => (
              <OpenCard key={p.id} p={p} owner={owner} onChange={refresh} />
            ))}
          </div>
        )}
      </div>

      {/* resolved list */}
      {resolved.length > 0 && (
        <div className="rise" style={{ animationDelay: '120ms' }}>
          <h3 className="mb-3 font-display text-lg text-ivory">Resolved</h3>
          <div className="space-y-2">
            {resolved.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-indigo-2/40 px-4 py-2.5"
              >
                <StatusDot status={p.status} />
                <span className="min-w-0 flex-1 truncate text-sm text-ivory-soft">{p.claim}</span>
                <span className="shrink-0 text-xs text-ivory-faint tabular-nums">
                  {p.confidence}%{p.brier != null ? ` · Brier ${Number(p.brier).toFixed(2)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OpenCard({
  p,
  owner,
  onChange,
}: {
  p: PredictionRow
  owner: string
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<ResolutionSuggestion | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function resolve(status: PredictionRow['status']) {
    setBusy(true)
    try {
      const res = await fetch(`/api/predictions/${p.id}/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anonOwner: owner, status }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Could not resolve.')
      }
      onChange()
    } catch (e) {
      setNote((e as Error).message)
      setBusy(false)
    }
  }

  async function askAugur() {
    setSuggesting(true)
    setNote(null)
    try {
      const res = await fetch(`/api/predictions/${p.id}/suggest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anonOwner: owner }),
      })
      const d = await res.json()
      if (res.status === 503) {
        setNote('Assisted resolution needs the Anthropic key — resolve it yourself for now.')
        return
      }
      if (!res.ok) throw new Error(d.error || 'No suggestion available.')
      setSuggestion(d.suggestion)
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setSuggesting(false)
    }
  }

  const due =
    p.resolves_on && new Date(p.resolves_on) <= new Date() ? 'due now' : p.resolves_on ?? 'no date'

  return (
    <div className="rounded-xl border border-line bg-indigo-2/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ivory">{p.claim}</p>
        <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
          {p.confidence}%
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ivory-faint">
        <span className="capitalize">{p.domain}</span>
        <span>·</span>
        <span className={due === 'due now' ? 'text-gold' : ''}>{due}</span>
        {p.resolution_criteria && (
          <>
            <span>·</span>
            <span className="italic">YES if {p.resolution_criteria}</span>
          </>
        )}
      </div>

      {suggestion && (
        <div className="mt-3 rounded-lg border border-magenta/40 bg-magenta/10 p-3 text-xs text-ivory-soft">
          <span className="font-medium text-magenta">
            Augur suggests:{' '}
            {suggestion.suggested_status === 'resolved_yes'
              ? 'YES'
              : suggestion.suggested_status === 'resolved_no'
                ? 'NO'
                : 'unclear'}{' '}
            ({suggestion.confidence_in_suggestion})
          </span>{' '}
          — {suggestion.rationale} <span className="italic">You decide.</span>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-ivory-faint">{note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => resolve('resolved_yes')}
          disabled={busy}
          className="rounded-md border border-good/50 px-3 py-1.5 text-xs font-medium text-good hover:bg-good/10 disabled:opacity-40"
        >
          Came true
        </button>
        <button
          onClick={() => resolve('resolved_no')}
          disabled={busy}
          className="rounded-md border border-bad/50 px-3 py-1.5 text-xs font-medium text-bad hover:bg-bad/10 disabled:opacity-40"
        >
          Didn’t
        </button>
        <button
          onClick={() => resolve('void')}
          disabled={busy}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ivory-faint hover:text-ivory disabled:opacity-40"
        >
          Void
        </button>
        <button
          onClick={askAugur}
          disabled={suggesting}
          className="ml-auto rounded-md px-3 py-1.5 text-xs text-magenta hover:underline disabled:opacity-40"
        >
          {suggesting ? 'Asking…' : 'Ask Augur'}
        </button>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: PredictionRow['status'] }) {
  const map: Record<string, string> = {
    resolved_yes: 'var(--good)',
    resolved_no: 'var(--bad)',
    void: 'var(--ivory-faint)',
    open: 'var(--gold)',
  }
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: map[status] ?? 'var(--ivory-faint)' }}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="text-[11px] uppercase tracking-wider text-ivory-faint">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function clamp(c: number): number {
  if (!Number.isFinite(c)) return 70
  return Math.max(50, Math.min(100, Math.round(c)))
}
