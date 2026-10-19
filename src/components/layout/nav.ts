// Site navigation data (SITEMAP §6.1). Owner: F1. Pure data — server and client safe.
import type { Collection } from '@/lib/types'

export const INSTAGRAM_URL = 'https://www.instagram.com/escapedoor.in'
export const INSTAGRAM_HANDLE = '@escapedoor.in'

/** Minimal arc shape the shell needs (keeps client props small). */
export type NavArc = Pick<Collection, 'slug' | 'name' | 'jp' | 'accentA' | 'accentB' | 'tagline' | 'group'>

export const toNavArcs = (cs: Collection[]): NavArc[] =>
  cs.map(({ slug, name, jp, accentA, accentB, tagline, group }) => ({ slug, name, jp, accentA, accentB, tagline, group }))

/** Header "chapter tabs". Arcs opens the mega-panel. */
export const MAIN_NAV = [
  { href: '/shop', label: 'Shop', jp: 'ショップ' },
  { href: '/arc', label: 'Arcs', jp: 'アーク', mega: true },
  { href: '/custom', label: 'Custom Forge', jp: '特注' },
  { href: '/fests', label: 'Fests', jp: 'フェス' },
  { href: '/cosplay', label: 'Cosplay', jp: 'コスプレ' },
] as const

export const SHOP_CATEGORIES = [
  { href: '/shop/oversized-t-shirts', label: 'Oversized tees' },
  { href: '/shop/t-shirts', label: 'T-shirts' },
  { href: '/shop/hoodies', label: 'Hoodies' },
  { href: '/shop/polaroids', label: 'Polaroids' },
  { href: '/shop/posters', label: 'Posters' },
  { href: '/shop/bookmarks', label: 'Bookmarks' },
  { href: '/shop/badges', label: 'Badges' },
  { href: '/shop/stickers', label: 'Stickers' },
  { href: '/shop/cosplay-props', label: 'Cosplay props' },
  { href: '/shop/accessories', label: 'Accessories' },
] as const

export const HELP_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/policies/shipping', label: 'Shipping' },
  { href: '/policies/returns', label: 'Returns' },
  { href: '/policies/privacy', label: 'Privacy' },
  { href: '/policies/terms', label: 'Terms' },
] as const

/** ink or paper text for a given background hex (WCAG relative luminance). */
export function readableOn(hex: string): 'ink' | 'paper' {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // contrast vs ink (#0b0b0f, L≈0.0036) and paper (#f4efe6, L≈0.86)
  const vsInk = (L + 0.05) / (0.0036 + 0.05)
  const vsPaper = (0.86 + 0.05) / (L + 0.05)
  return vsInk >= vsPaper ? 'ink' : 'paper'
}
