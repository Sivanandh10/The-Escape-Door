'use client'
// Login-free WhatsApp ordering — used ONLY while no customer login method works yet (GET /api/auth/providers →
// any:false: Google not enabled, MAL not configured, no email delivery). Keeps the shop able to take orders exactly
// like before accounts existed: build the cart message → open WhatsApp inside the click → save a lead → success page.
// Owner: INTEGRATOR (CHECKOUT area).
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { computeTotals } from '@/lib/pricing'
import { buildOrderMessage, waLink } from '@/lib/whatsapp'
import { openWhatsApp } from '@/lib/wa-open'
import { submitLead } from '@/lib/leads'
import { getAttribution, track } from '@/lib/analytics'
import { useBundleRules, useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { saveLastOrder, slimOrderPayload } from '@/components/shop/cart/order'

/** Returns `order(where)`: false when the cart is empty, else true after WhatsApp was opened. */
export function useWhatsAppCartOrder() {
  const router = useRouter()
  const waNumber = useWhatsappNumber()
  const rules = useBundleRules()
  return (where: string): boolean => {
    const items = useCart.getState().items
    if (!items.length) return false
    const totals = computeTotals(items, rules)
    const ref = `TED-${Date.now().toString(36).slice(-6).toUpperCase()}`
    const link = waLink(buildOrderMessage({ items, totals, orderRef: ref }), waNumber)
    const opened = openWhatsApp(link, { fallbackSameTab: false })
    void submitLead({ kind: 'whatsapp_order', payload: { ...slimOrderPayload(items, totals), orderRef: ref, from: `${where}_guest` }, source: getAttribution() })
    track('whatsapp_click', { where: `${where}_guest`, pieces: items.reduce((n, i) => n + i.qty, 0), total: totals.total, opened })
    saveLastOrder({
      ref,
      items,
      totals: {
        subtotal: totals.subtotal,
        savings: totals.savings,
        total: totals.total,
        hasPriceOnRequest: totals.hasPriceOnRequest,
        applied: totals.applied,
        lines: totals.lines.map((l) => ({ key: l.key, lineTotal: l.lineTotal, saving: l.saving })),
      },
      name: '',
      city: '',
      link,
      at: Date.now(),
      opened,
    })
    useCart.getState().setOpen(false)
    router.push('/checkout-success')
    return true
  }
}
