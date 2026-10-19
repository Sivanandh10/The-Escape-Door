'use client'
// #53 manga page-turn / ink wipe between routes. Owner: F1.
//
// How it works (Next 16 + React 19.3 <ViewTransition>, see docs/stack-notes addenda):
// - src/app/template.tsx renders <PageTransition /> once per navigation (templates remount).
// - Each instance owns an invisible, fixed, viewport-sized "sheet" wrapped in a named
//   <ViewTransition name="page-sheet">. Old + new sheets pair up on every route change, so React
//   starts a view transition and the browser builds ::view-transition-group(page-sheet).
// - globals.css paints that group as a screentone ink sheet with volt/door edges that sweeps in
//   from the right, holds while the root snapshot swaps (old → new at 50%), then exits left.
// - <html style="view-transition-name: root"> (layout.tsx) stops React from cancelling the root
//   snapshot, so the old page stays visible until the sheet covers it.
// - First load: no navigation → no transition. Reduced motion: 150 ms crossfade (globals.css).
// - Links with transitionTypes={['morph']} (shared-element morphs) skip the sheet.
import { ViewTransition } from 'react'

export function PageTransition() {
  return (
    <ViewTransition name="page-sheet" share="page-turn" enter="page-turn" exit="page-turn">
      <div
        aria-hidden="true"
        data-page-sheet=""
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0, zIndex: -1 }}
      />
    </ViewTransition>
  )
}

export default PageTransition
