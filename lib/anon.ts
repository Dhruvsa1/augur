'use client'

/** Stable per-browser anonymous owner id (no login). UUID, client-generated. */
export function anonOwner(): string {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem('augur_owner')
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem('augur_owner', id)
  }
  return id
}
