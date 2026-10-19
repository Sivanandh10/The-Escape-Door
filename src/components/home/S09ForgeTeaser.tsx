// STUB by F1 so the home page composes. Owner: S09 section agent (replace freely).
import Link from 'next/link'

export default function S09ForgeTeaser() {
  return (
    <section id="forge" aria-labelledby="forge-title" className="section-y border-t-4 border-ink bg-door text-paper">
      <div className="container-x">
        <p className="label">Chapter 09 · Custom Forge</p>
        <h2 id="forge-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Bring your own design to the Custom <em>Forge</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          特注工房
        </span>
        <p className="mt-6 max-w-[52ch]">Send your own artwork, or have us create the design for ₹200 extra.</p>
        <Link
          href="/custom"
          className="press label mt-8 inline-flex min-h-12 items-center border-[3px] border-ink bg-volt px-6 py-4 font-bold text-ink shadow-hard"
        >
          Open the Custom Forge
        </Link>
      </div>
    </section>
  )
}
