// Site header (server wrapper). Owner: F1 / HOME.
// Reads the admin-editable announcement banner (Admin → Settings → "Banner text", settings key 'site') through the
// cached, cookie-less repo read — static, and refreshed by the admin's updateTag('settings') — and renders it above
// the client header bar (HeaderBar.tsx: nav, search, account, cart, mobile menu).
import { getSettings } from '@/lib/data/repo'
import { AnnouncementBar } from './AnnouncementBar'
import { HeaderBar, type HeaderProps } from './HeaderBar'

export type { HeaderProps }

export async function Header(props: HeaderProps) {
  const { bannerText } = await getSettings()
  const banner = typeof bannerText === 'string' ? bannerText.trim() : ''
  return (
    <>
      {banner ? <AnnouncementBar text={banner} /> : null}
      <HeaderBar {...props} />
    </>
  )
}

export default Header
