// Ink line pictograms for the forge product picker (original, currentColor). Owner: P3 forge. Server-safe.
import type { ForgeKind } from './model'

const P: Record<ForgeKind, React.ReactNode> = {
  tshirt: <path d="M15 6l-9 4 3 8 4-2v20h22V16l4 2 3-8-9-4c-1 3-4 5-9 5s-8-2-9-5z" />,
  hoodie: (
    <>
      <path d="M14 9l-8 6 2 20 5-1 0-14 0 18h22V20l0 14 5 1 2-20-8-6" />
      <path d="M14 9c0-4 4-6 10-6s10 2 10 6c-2 5-6 7-10 7s-8-2-10-7z" />
      <path d="M17 30h14" />
    </>
  ),
  polaroid: (
    <>
      <rect x="9" y="6" width="30" height="36" rx="1" />
      <rect x="13" y="10" width="22" height="22" />
      <path d="M17 38h10" />
    </>
  ),
  bookmark: (
    <>
      <path d="M17 4h14v40l-7-6-7 6z" />
      <circle cx="24" cy="10" r="2" />
    </>
  ),
  sticker: (
    <>
      <path d="M8 12a4 4 0 014-4h24a4 4 0 014 4v16L28 40H12a4 4 0 01-4-4z" />
      <path d="M28 40V30a2 2 0 012-2h10" />
    </>
  ),
  badge: (
    <>
      <circle cx="24" cy="24" r="17" />
      <circle cx="24" cy="24" r="11" />
      <path d="M24 13l2.6 7.4H34l-6 4.6 2.3 7.3L24 28l-6.3 4.3L20 25l-6-4.6h7.4z" />
    </>
  ),
}

export function KindIcon({ kind, className }: { kind: ForgeKind; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
      {P[kind]}
    </svg>
  )
}
