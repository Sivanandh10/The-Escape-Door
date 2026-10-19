// S07 HOODIE GSM POWER LEVELS (#23 exploded fabric · #17 counters · #10 pinned scan). Owner: S07 section agent.
// Server shell → the scanner (gauge, exploded fabric stack, tier buttons) is one client island.
import type { HoodieTier } from '@/lib/types'
import GsmScanner from './s07/GsmScanner'

export default function S07Gsm({ tiers = [] }: { tiers?: HoodieTier[] }) {
  if (!tiers.length) return null
  const sorted = [...tiers].sort((a, b) => a.level - b.level)
  return <GsmScanner tiers={sorted} />
}
