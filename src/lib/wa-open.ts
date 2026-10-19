// Open WhatsApp inside the click gesture — never after an await (popup blockers + perceived speed). Owner: F2.

const PENDING_HTML =
  '<!doctype html><title>Opening WhatsApp…</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#0b0b0f;color:#f4efe6;font:600 16px system-ui,sans-serif"><p>Opening WhatsApp…</p></body>'

/** Open the final wa.me link right now. Returns true when a tab opened; if the popup was blocked and
 *  `fallbackSameTab` is set, navigates this tab instead (still instant). */
export function openWhatsApp(link: string, { fallbackSameTab = true } = {}): boolean {
  try {
    const win = window.open(link, '_blank')
    if (win) {
      try {
        win.opener = null
      } catch {}
      return true
    }
  } catch {}
  if (fallbackSameTab) window.location.href = link
  return false
}

/** For flows that must wait on something (e.g. design uploads): open a tab synchronously in the gesture,
 *  then point it at WhatsApp later with `go(link)`. If the popup was blocked, `go` falls back to this tab. */
export function openWhatsAppPending() {
  let win: Window | null = null
  try {
    win = window.open('', '_blank')
    if (win) {
      win.opener = null
      win.document.write(PENDING_HTML)
      win.document.close()
    }
  } catch {
    win = null
  }
  return {
    get opened() {
      return !!win && !win.closed
    },
    go(link: string): boolean {
      if (win && !win.closed) {
        try {
          win.location.href = link
          return true
        } catch {}
      }
      window.location.href = link
      return false
    },
  }
}
