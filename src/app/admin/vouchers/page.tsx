// /admin/vouchers — create / pause / hand out voucher codes, see redemptions, set the gift-wrap fee.
// Owner: CHECKOUT. Live rows load in the browser under RLS (vouchers.edit). Deletes: superadmin only.
import type { Metadata } from 'next'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { VouchersManager } from '@/components/admin/vouchers/VouchersManager'
import { loadCheckoutSettings } from '@/lib/checkout/server'
import { can } from '@/lib/admin/permissions'

export const metadata: Metadata = { title: 'Vouchers' }

export default async function VouchersPage() {
  const gate = await requireAdmin('vouchers.edit')
  if (!gate.allowed) return <NoAccess perm="vouchers.edit" session={gate.session} />
  const settings = await loadCheckoutSettings()
  const canSettings = gate.demo || (gate.session ? can(gate.session.perms, 'settings.edit') : false)
  return <VouchersManager settings={settings} canEditSettings={canSettings} />
}
