'use client'

import { useEffect, useState } from 'react'

/**
 * The living nebula ground. A fixed, full-viewport looping video sits behind all
 * content with a dark gradient overlay for legibility. On reduced-motion or small
 * screens we fall back to the matching still (nebula.jpg) — no video fetched, no
 * battery burned. The video element is rendered on first paint (matching SSR), and
 * only swapped to the still after mount if the environment asks for calm.
 */
export function BgVideo() {
  const [calm, setCalm] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const small = window.matchMedia('(max-width: 640px)')
    const update = () => setCalm(reduce.matches || small.matches)
    update()
    reduce.addEventListener('change', update)
    small.addEventListener('change', update)
    return () => {
      reduce.removeEventListener('change', update)
      small.removeEventListener('change', update)
    }
  }, [])

  return (
    <>
      <div className="bg-stage" aria-hidden="true">
        {calm ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bg-media" src="/art/nebula.jpg" alt="" />
        ) : (
          <video
            className="bg-media"
            autoPlay
            muted
            loop
            playsInline
            poster="/art/nebula.jpg"
          >
            <source src="/art/nebula.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div className="bg-overlay" aria-hidden="true" />
    </>
  )
}
