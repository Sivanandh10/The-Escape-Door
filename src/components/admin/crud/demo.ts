// P4b — deterministic DEMO rows for leads/orders when Supabase isn't connected.
// Clearly fake (example.com, +91 90000 00xxx, "Demo" prefix) and always shown under the DEMO banner.
import type { CartItem, LeadKind, Product } from '@/lib/types'
import { computeTotals } from '@/lib/pricing'
import { seeded } from '@/lib/utils'
import { type AdminLead, type AdminOrder, type LeadStatus, type OrderStatus, orderFromLead } from './entities'

const FIRST = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Ishaan', 'Anaya', 'Rohan', 'Sara', 'Vihaan', 'Tara', 'Arjun', 'Naina', 'Dev', 'Zoya']
const CITIES = ['Bhopal', 'Indore', 'Roorkee', 'Guwahati', 'Surat', 'Kolkata', 'Kolhapur', 'Jodhpur', 'Pune', 'Delhi']
const SRCS = ['', '', 'thomso', 'alcheringa', 'vit-bhopal', 'instagram', '', 'iit-indore']
const KINDS: LeadKind[] = ['whatsapp_order', 'whatsapp_order', 'custom_request', 'remind_me', 'newsletter', 'whatsapp_order', 'custom_request', 'exit_intent']
const STAT: LeadStatus[] = ['new', 'new', 'contacted', 'converted', 'new', 'contacted', 'closed', 'converted', 'new', 'spam']
const BASE = Date.parse('2026-10-18T18:30:00+05:30')

function lineFor(p: Product, qty: number): CartItem {
  const v = p.variants[0]
  return {
    key: `${p.id}:${v.id}`, productId: p.id, slug: p.slug, name: p.name, type: p.type, collection: p.collection,
    variantId: v.id, variantLabel: v.label, ...(v.attrs ? { variantAttrs: v.attrs } : {}),
    ...(p.sizes?.length ? { size: p.sizes[2] ?? p.sizes[0] } : {}),
    unitPrice: v.price, qty, image: p.images[0]?.src ?? '',
  }
}

export function demoLeads(products: Product[], n = 18): AdminLead[] {
  const rnd = seeded(20261019)
  const priced = products.filter((p) => !p.priceOnRequest && p.variants[0]?.price != null)
  const out: AdminLead[] = []
  for (let i = 0; i < n; i++) {
    const kind = KINDS[i % KINDS.length]
    const name = `${FIRST[i % FIRST.length]} (demo)`
    const city = CITIES[Math.floor(rnd() * CITIES.length)]
    const src = SRCS[Math.floor(rnd() * SRCS.length)]
    const created = new Date(BASE - Math.floor((i * 7.3 + rnd() * 5) * 3600_000)).toISOString()
    let payload: Record<string, unknown> | null = null
    let message = ''
    if (kind === 'whatsapp_order' && priced.length) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
        const p = priced[Math.floor(rnd() * priced.length)]
        return lineFor(p, p.type === 'polaroid' ? 3 : 1 + Math.floor(rnd() * 2))
      })
      payload = { items, totals: computeTotals(items) }
    } else if (kind === 'custom_request') {
      payload = { type: i % 2 ? 'tshirt' : 'polaroid', mode: i % 3 ? 'own' : 'company', quantity: i % 2 ? 1 : 20, fileUrls: [] }
      message = i % 2 ? 'Back print of my own sketch, oversized, size L.' : 'Twenty polaroids from our club photos.'
    } else if (kind === 'remind_me') {
      payload = { eventId: 'ev-vit-bhopal' }
    }
    out.push({
      id: `demo-lead-${String(i + 1).padStart(2, '0')}`,
      kind, name, city,
      contact: i % 3 === 0 ? `demo${i + 1}@example.com` : `+91 90000 00${String(100 + i).slice(-3)}`,
      message, payload, source: src ? { src } : null, src,
      status: STAT[i % STAT.length], createdAt: created, updatedAt: created,
      notes: i === 1 ? 'Asked about size chart — replied on WhatsApp.' : '',
    })
  }
  return out
}

const OSTAT: OrderStatus[] = ['new', 'confirmed', 'paid', 'shipped', 'delivered', 'paid', 'cancelled']
export function demoOrders(leads: AdminLead[]): AdminOrder[] {
  return leads
    .filter((l) => l.kind === 'whatsapp_order' && (l.status === 'converted' || l.status === 'contacted'))
    .map((l, i) => ({ ...orderFromLead(l, `demo-order-${String(i + 1).padStart(2, '0')}`), status: OSTAT[i % OSTAT.length], createdAt: l.createdAt }))
}
