// Announcement banner above the header — the "Banner text" from Admin → Settings. Owner: F1 / HOME.
// Server component (no JS). Scrolls away with the page (the header below it is the sticky part).
// Sets --ted-banner-h so full-height sections (the S01 hero stage) can subtract it and still fit the first screen.
import Link from 'next/link'

export const BANNER_H = 34

export function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="relative z-[81] border-b-2 border-ink bg-volt text-ink" style={{ height: BANNER_H }}>
      <style>{`:root{--ted-banner-h:${BANNER_H}px}`}</style>
      <Link
        href="/shop"
        className="focus-ring group container-x flex h-full items-center justify-center gap-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] sm:text-[11.5px]"
      >
        <span aria-hidden="true" lang="ja" className="hidden shrink-0 bg-ink px-1.5 py-0.5 font-jp text-[10px] tracking-[0.08em] text-volt sm:inline">
          お知らせ
        </span>
        <span className="min-w-0 truncate">{text}</span>
        <span aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </div>
  )
}

export default AnnouncementBar
