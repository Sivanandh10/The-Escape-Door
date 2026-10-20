// S07 HOODIE GSM POWER LEVELS (#17 counters · #10 pinned scan · real hoodie per tier). Owner: S07 section agent.
// Server shell → the scanner (gauge, hoodie deck, tier buttons) is one client island.
// Each tier shows a REAL hoodie product image from the catalogue (repo → Supabase when configured, seed mockups
// otherwise). When the owner uploads real photos in admin, they replace the mockups here automatically.
import type { HoodieTier, Product, ProductImage } from '@/lib/types'
import { getProducts } from '@/lib/data/repo'
import GsmScanner, { type TierShot } from './s07/GsmScanner'

const isReal = (i: ProductImage) => !i.sample

/** Prefer an uploaded real photo; then the back print (the hero of a hoodie); then the front. */
function pickImage(p: Product): ProductImage | null {
  const imgs = p.images.filter((i) => i.side !== 'detail' && i.src)
  return (
    imgs.find((i) => isReal(i) && i.side === 'back') ??
    imgs.find(isReal) ??
    imgs.find((i) => i.side === 'back') ??
    imgs[0] ??
    null
  )
}

export default async function S07Gsm({ tiers = [], hoodies }: { tiers?: HoodieTier[]; hoodies?: Product[] }) {
  if (!tiers.length) return null
  const sorted = [...tiers].sort((a, b) => a.level - b.level)
  const pool = (hoodies ?? (await getProducts({ type: 'hoodie' }))).filter((p) => p.type === 'hoodie' && pickImage(p))
  // real photos first, then featured, so the strongest images land on the tiers
  const ranked = [...pool].sort(
    (a, b) =>
      Number(b.images.some(isReal)) - Number(a.images.some(isReal)) || Number(b.featured) - Number(a.featured),
  )
  const shots: Array<TierShot | null> = sorted.map((_, i) => {
    const p = ranked.length ? ranked[i % ranked.length] : null
    const img = p && pickImage(p)
    if (!p || !img) return null
    return {
      src: img.src,
      alt: img.alt || `${p.name} by The Escape Door`,
      slug: p.slug,
      name: p.designTitle,
      sample: !!img.sample,
      color: p.colorBlock || '#C9B8FF',
    }
  })
  return <GsmScanner tiers={sorted} shots={shots} />
}
