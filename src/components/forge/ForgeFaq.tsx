// Three Forge answers (FAQPage JSON-LD on /custom uses the same text). Owner: P3 forge. Server-safe.
export function ForgeFaq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <details key={it.q} open={i === 0} className="group border-4 border-ink bg-paper text-ink shadow-hard open:bg-volt">
          <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
            <h3 className="font-display text-2xl uppercase leading-none sm:text-3xl">{it.q}</h3>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center border-[3px] border-ink bg-ink font-mono text-xl font-bold text-volt transition-transform duration-200 group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="border-t-[3px] border-ink px-4 py-4 text-[16px] leading-relaxed sm:px-5">{it.a}</p>
        </details>
      ))}
    </div>
  )
}
export default ForgeFaq
