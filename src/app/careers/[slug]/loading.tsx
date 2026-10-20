// Instant feedback while a role page streams (on-demand render for roles posted after the last build). Owner: CAREERS.
import { RouteSkeleton } from '@/components/layout/RouteSkeleton'

export default function Loading() {
  return <RouteSkeleton variant="page" label="Opening the role…" />
}
