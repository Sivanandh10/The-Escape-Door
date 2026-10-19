// Loading state for the Forge studio (Suspense fallback while ?product= resolves). Owner: P3 forge.
export function StudioSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the Forge studio" role="status">
      <div className="grid h-16 grid-cols-4 border-4 border-ink bg-ink shadow-hard">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={i === 0 ? 'bg-volt/80' : 'skeleton-tone border-l-2 border-tone-2'} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        <div className="skeleton-tone h-[44svh] min-h-[300px] border-4 border-ink lg:col-span-7 lg:h-[640px]" />
        <div className="space-y-4 lg:col-span-5">
          <div className="skeleton-tone h-[380px] border-4 border-ink" />
          <div className="skeleton-tone h-40 border-4 border-ink" />
        </div>
      </div>
      <span className="sr-only">Loading the Forge…</span>
    </div>
  )
}
export default StudioSkeleton
