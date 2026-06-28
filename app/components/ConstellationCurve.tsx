'use client'

import type { CalibrationBin } from '@/lib/scoring'

/**
 * The calibration curve as a constellation plot.
 * x = stated confidence (50–100), y = empirical accuracy (0–100%).
 * The gold dashed diagonal is perfect calibration; magenta stars are the user's
 * bins (sized by sample count) that spring-settle onto/away from the diagonal.
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

  const stable = n >= minForStable
  const remaining = Math.max(0, minForStable - n)

  const points = bins.map((bin) => {
    const cx = xScale(bin.meanConfidence / 100)
    const cyActual = yScale(bin.accuracy)
    const cyDiag = yScale(bin.meanConfidence / 100)
    const r = 4 + Math.min(9, Math.sqrt(bin.n) * 1.7)
    return { bin, cx, cyActual, cyDiag, dy: cyDiag - cyActual, r }
  })

  return (
    <div className="relative">
      <svg
        viewBox="0 0 410 300"
        className="w-full"
        role="img"
        aria-label="Calibration curve: stated confidence versus actual accuracy"
      >
        {/* frame */}
        <rect x={L} y={T} width={R - L} height={B - T} fill="rgba(20,26,68,0.45)" rx="6" />

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
              style={{ fontSize: 9, fontFamily: 'var(--font-sans)' }}
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
              style={{ fontSize: 9, fontFamily: 'var(--font-sans)' }}
            >
              {a}
            </text>
          </g>
        ))}

        {/* perfect-calibration diagonal */}
        <line
          x1={xScale(0.5)}
          y1={yScale(0.5)}
          x2={xScale(1)}
          y2={yScale(1)}
          stroke="var(--gold)"
          strokeWidth="1.4"
          strokeDasharray="5 4"
          opacity="0.85"
        />
        <text
          x={xScale(0.74)}
          y={yScale(0.74) - 7}
          transform={`rotate(-26 ${xScale(0.74)} ${yScale(0.74)})`}
          className="fill-[var(--gold)]"
          style={{ fontSize: 8.5, letterSpacing: '0.12em', fontFamily: 'var(--font-sans)' }}
        >
          PERFECT CALIBRATION
        </text>

        {/* constellation links between consecutive bins */}
        {points.length > 1 &&
          points.map((p, i) => {
            if (i === 0) return null
            const prev = points[i - 1]
            return (
              <line
                key={`link-${i}`}
                x1={prev.cx}
                y1={prev.cyActual}
                x2={p.cx}
                y2={p.cyActual}
                stroke="var(--magenta)"
                strokeWidth="0.9"
                opacity="0.32"
              />
            )
          })}

        {/* the user's stars */}
        {points.map((p, i) => (
          <g
            key={`pt-${p.bin.lo}`}
            className="settle pulse-glow"
            style={
              { '--dy': `${p.dy}px`, animationDelay: `${i * 110}ms` } as React.CSSProperties
            }
          >
            <circle cx={p.cx} cy={p.cyActual} r={p.r + 3} fill="var(--magenta)" opacity="0.16" />
            <circle cx={p.cx} cy={p.cyActual} r={p.r} fill="var(--magenta)" />
            <circle cx={p.cx} cy={p.cyActual} r={p.r * 0.4} fill="#fff3f8" opacity="0.9" />
          </g>
        ))}

        {/* axis captions */}
        <text
          x={(L + R) / 2}
          y={296}
          textAnchor="middle"
          className="fill-[var(--ivory-soft)]"
          style={{ fontSize: 9.5, letterSpacing: '0.14em', fontFamily: 'var(--font-sans)' }}
        >
          YOU SAID (% SURE)
        </text>
        <text
          x={14}
          y={(T + B) / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(T + B) / 2})`}
          className="fill-[var(--ivory-soft)]"
          style={{ fontSize: 9.5, letterSpacing: '0.14em', fontFamily: 'var(--font-sans)' }}
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
