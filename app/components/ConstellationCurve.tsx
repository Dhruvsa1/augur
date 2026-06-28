'use client'

import { useEffect, useRef, useState } from 'react'
import type { CalibrationBin } from '@/lib/scoring'

/**
 * The calibration curve as a constellation plot.
 * x = stated confidence (50–100), y = empirical accuracy (0–100%).
 * The gold dashed diagonal is perfect calibration; magenta stars are the user's
 * bins (sized by sample count). When the chart scrolls into view, the diagonal and
 * the constellation links DRAW themselves on, then the user's stars spring-settle
 * down onto (or away from) the perfect-calibration line. This is the signature.
 */
export function ConstellationCurve({
  bins,
  n,
  minForStable = 10,
}: {
  bins: CalibrationBin[]
  n: number
  minForStable?: number
}) {
  const L = 46
  const R = 392
  const T = 18
  const B = 270

  const xScale = (conf01: number) => L + ((conf01 - 0.5) / 0.5) * (R - L)
  const yScale = (acc01: number) => B - acc01 * (B - T)
  const dist = (x1: number, y1: number, x2: number, y2: number) =>
    Math.hypot(x2 - x1, y2 - y1)

  const stable = n >= minForStable
  const remaining = Math.max(0, minForStable - n)

  const points = bins.map((bin) => {
    const cx = xScale(bin.meanConfidence / 100)
    const cyActual = yScale(bin.accuracy)
    const cyDiag = yScale(bin.meanConfidence / 100)
    const r = 4 + Math.min(9, Math.sqrt(bin.n) * 1.7)
    return { bin, cx, cyActual, cyDiag, dy: cyDiag - cyActual, r }
  })

  // draw-in once the chart enters the viewport
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const diagX1 = xScale(0.5)
  const diagY1 = yScale(0.5)
  const diagX2 = xScale(1)
  const diagY2 = yScale(1)
  const diagLen = dist(diagX1, diagY1, diagX2, diagY2)

  // timing: diagonal draws first, links chase it, then stars settle
  const linkStart = 0.55
  const starStart = 0.95

  return (
    <div ref={ref}>
      <svg
        viewBox="0 0 410 300"
        className={`w-full ${inView ? 'cv-in' : ''}`}
        role="img"
        aria-label="Calibration curve: stated confidence versus actual accuracy"
      >
        {/* frame */}
        <rect x={L} y={T} width={R - L} height={B - T} fill="rgba(14,17,48,0.55)" rx="6" />

        {/* grid */}
        {[50, 60, 70, 80, 90, 100].map((c) => (
          <g key={`vx-${c}`}>
            <line
              x1={xScale(c / 100)}
              y1={T}
              x2={xScale(c / 100)}
              y2={B}
              stroke="var(--line)"
              strokeWidth="0.6"
              opacity="0.5"
            />
            <text
              x={xScale(c / 100)}
              y={B + 16}
              textAnchor="middle"
              className="fill-[var(--ivory-faint)]"
              style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}
            >
              {c}
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((a) => (
          <g key={`hy-${a}`}>
            <line
              x1={L}
              y1={yScale(a / 100)}
              x2={R}
              y2={yScale(a / 100)}
              stroke="var(--line)"
              strokeWidth="0.6"
              opacity="0.5"
            />
            <text
              x={L - 8}
              y={yScale(a / 100) + 3}
              textAnchor="end"
              className="fill-[var(--ivory-faint)]"
              style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}
            >
              {a}
            </text>
          </g>
        ))}

        {/* perfect-calibration diagonal — draws itself first */}
        <line
          className="cv-draw"
          style={{ ['--len' as string]: diagLen, ['--d' as string]: '0.15s' }}
          x1={diagX1}
          y1={diagY1}
          x2={diagX2}
          y2={diagY2}
          stroke="var(--gold)"
          strokeWidth="1.4"
          strokeDasharray={`${diagLen}`}
          opacity="0.85"
        />
        <text
          x={xScale(0.74)}
          y={yScale(0.74) - 7}
          transform={`rotate(-26 ${xScale(0.74)} ${yScale(0.74)})`}
          className="fill-[var(--gold)]"
          style={{ fontSize: 8, letterSpacing: '0.14em', fontFamily: 'var(--font-mono)' }}
        >
          PERFECT CALIBRATION
        </text>

        {/* constellation links between consecutive bins — chase the diagonal */}
        {points.length > 1 &&
          points.map((p, i) => {
            if (i === 0) return null
            const prev = points[i - 1]
            const len = dist(prev.cx, prev.cyActual, p.cx, p.cyActual)
            return (
              <line
                key={`link-${i}`}
                className="cv-draw"
                style={{
                  ['--len' as string]: len,
                  ['--d' as string]: `${linkStart + (i - 1) * 0.12}s`,
                }}
                x1={prev.cx}
                y1={prev.cyActual}
                x2={p.cx}
                y2={p.cyActual}
                stroke="var(--magenta)"
                strokeWidth="1"
                strokeDasharray={`${len}`}
                opacity="0.4"
              />
            )
          })}

        {/* the user's stars — spring-settle onto the curve */}
        {points.map((p, i) => (
          <g
            key={`pt-${p.bin.lo}`}
            className="cv-star"
            style={
              {
                '--dy': `${p.dy}px`,
                '--d': `${starStart + i * 0.12}s`,
              } as React.CSSProperties
            }
          >
            <g className="pulse-glow">
              <circle cx={p.cx} cy={p.cyActual} r={p.r + 3} fill="var(--magenta)" opacity="0.16" />
              <circle cx={p.cx} cy={p.cyActual} r={p.r} fill="var(--magenta)" />
              <circle cx={p.cx} cy={p.cyActual} r={p.r * 0.4} fill="#fff3f8" opacity="0.9" />
            </g>
          </g>
        ))}

        {/* axis captions */}
        <text
          x={(L + R) / 2}
          y={296}
          textAnchor="middle"
          className="fill-[var(--ivory-soft)]"
          style={{ fontSize: 8.5, letterSpacing: '0.18em', fontFamily: 'var(--font-mono)' }}
        >
          YOU SAID (% SURE)
        </text>
        <text
          x={14}
          y={(T + B) / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(T + B) / 2})`}
          className="fill-[var(--ivory-soft)]"
          style={{ fontSize: 8.5, letterSpacing: '0.18em', fontFamily: 'var(--font-mono)' }}
        >
          YOU WERE RIGHT (%)
        </text>
      </svg>

      {!stable && (
        <div className="mt-2 rounded-md border border-line bg-indigo-2/60 px-3 py-2 text-center text-xs text-ivory-soft">
          {n === 0
            ? 'Your constellation is empty — answer ~10 questions to chart it.'
            : `Answer ~${remaining} more for a stable curve.`}
        </div>
      )}
    </div>
  )
}
