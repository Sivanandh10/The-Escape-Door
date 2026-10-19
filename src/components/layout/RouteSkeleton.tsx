// Instant route feedback (loading.tsx): a light screentone skeleton shown within one frame of a click
// while the next page streams. Server component, no JS, no images. Owner: F1.
type Variant = 'grid' | 'product' | 'page'

export function RouteSkeleton({ variant = 'grid', label = 'Opening the door…' }: { variant?: Variant; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="container-x pb-16 pt-[calc(var(--header-h,72px)+28px)]"
      data-route-skeleton={variant}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="skeleton-tone mb-3 h-3 w-28 rounded-[2px]" />
        <div className="skeleton-tone mb-8 h-10 w-[min(72%,520px)] rounded-[2px] md:h-14" />
        {variant === 'product' ? (
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            <div className="skeleton-tone aspect-[4/5] w-full rounded-[2px]" />
            <div className="flex flex-col gap-3">
              <div className="skeleton-tone h-7 w-1/3 rounded-[2px]" />
              <div className="skeleton-tone h-4 w-full rounded-[2px]" />
              <div className="skeleton-tone h-4 w-5/6 rounded-[2px]" />
              <div className="skeleton-tone mt-4 h-12 w-full rounded-[2px]" />
              <div className="skeleton-tone h-12 w-full rounded-[2px]" />
            </div>
          </div>
        ) : variant === 'page' ? (
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:gap-8">
            <div className="skeleton-tone aspect-[16/10] w-full rounded-[2px]" />
            <div className="flex flex-col gap-3">
              <div className="skeleton-tone h-4 w-full rounded-[2px]" />
              <div className="skeleton-tone h-4 w-11/12 rounded-[2px]" />
              <div className="skeleton-tone h-4 w-4/5 rounded-[2px]" />
              <div className="skeleton-tone mt-4 h-12 w-2/3 rounded-[2px]" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={i > 3 ? 'hidden md:block' : undefined}>
                <div className="skeleton-tone aspect-[4/5] w-full rounded-[2px]" />
                <div className="skeleton-tone mt-2 h-3 w-3/4 rounded-[2px]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteSkeleton
