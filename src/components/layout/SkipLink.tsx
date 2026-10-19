// Skip link — first focusable element on every page. Owner: F1. Server-safe.
export function SkipLink() {
  return (
    <a
      href="#main"
      className="label fixed left-3 top-3 z-[300] -translate-y-[200%] border-[3px] border-ink bg-volt px-4 py-3 text-ink shadow-hard-sm transition-transform duration-200 ease-expo focus:translate-y-0"
    >
      Skip to content
    </a>
  )
}

export default SkipLink
