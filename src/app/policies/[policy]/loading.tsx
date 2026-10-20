// Instant feedback while a policy page streams (also the Suspense boundary for `params` under Cache Components,
// so pages added in Admin → Pages after the last build render on demand). Owner: CMS.
import { RouteSkeleton } from '@/components/layout/RouteSkeleton'

export default function Loading() {
  return <RouteSkeleton variant="page" label="Opening the page…" />
}
