// Tiny, safe markdown for the Pages CMS (server + client: no hooks, no 'use client').
// Never injects HTML: every piece of text becomes a React text node (auto-escaped); there is no
// dangerouslySetInnerHTML anywhere. Links are allow-listed (https/http, mailto, tel, site-relative "/…", "#…").
//
// Supported:
//   text before the first "## " → intro       ## Heading {#anchor pending} → section (accent word in *stars*)
//   ### Sub-heading                            paragraphs (blank line between)
//   - bullet / * bullet / 1. numbered          > note (rendered as a callout)
//   **bold**  *italic* / _italic_  `code`      [link text](/path or https://…)
//   ---  (divider)                             \* escapes a special character
import Link from 'next/link'
import type { ReactNode } from 'react'

export type Inline =
  | string
  | { t: 'strong' | 'em' | 'code'; c: Inline[] }
  | { t: 'a'; href: string; c: Inline[] }

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h3'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'hr' }

export interface MdSection {
  id: string
  /** plain text of the heading (table of contents, aria) */
  toc: string
  title: Inline[]
  pending: boolean
  blocks: Block[]
}

export interface MdDoc {
  intro: Block[]
  sections: MdSection[]
}

// ──────────────────────────────────────────────────────────────── links
/** Allow-listed href or null (→ the link renders as plain text). */
export function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (!href || href.length > 500) return null
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href
  if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) return href
  if (href.startsWith('#')) return href
  return null
}

// ──────────────────────────────────────────────────────────────── inline
const isWord = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch)

export function parseInline(s: string, depth = 0): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) out.push(buf)
    buf = ''
  }
  if (depth > 6) return [s]
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length && /[\\`*_[\]()#>{}\-.!+]/.test(s[i + 1])) {
      buf += s[i + 1]
      i += 2
      continue
    }
    if (ch === '`') {
      const end = s.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ t: 'code', c: [s.slice(i + 1, end)] })
        i = end + 1
        continue
      }
    }
    if (ch === '*' && s[i + 1] === '*') {
      const end = s.indexOf('**', i + 2)
      if (end > i + 2 && s[i + 2] !== ' ') {
        flush()
        out.push({ t: 'strong', c: parseInline(s.slice(i + 2, end), depth + 1) })
        i = end + 2
        continue
      }
    }
    if (ch === '*' || (ch === '_' && !isWord(s[i - 1]))) {
      let end = s.indexOf(ch, i + 1)
      // skip a "**" that belongs to a nested strong
      while (ch === '*' && end !== -1 && s[end + 1] === '*') {
        const close = s.indexOf('**', end + 2)
        end = close === -1 ? -1 : s.indexOf('*', close + 2)
      }
      if (end > i + 1 && s[i + 1] !== ' ' && (ch === '*' || !isWord(s[end + 1]))) {
        flush()
        out.push({ t: 'em', c: parseInline(s.slice(i + 1, end), depth + 1) })
        i = end + 1
        continue
      }
    }
    if (ch === '[') {
      const m = /^\[([^\]\n]+)\]\(([^()\s]+)\)/.exec(s.slice(i))
      if (m) {
        flush()
        const href = safeHref(m[2])
        const c = parseInline(m[1], depth + 1)
        if (href) out.push({ t: 'a', href, c })
        else out.push(...c)
        i += m[0].length
        continue
      }
    }
    buf += ch
    i++
  }
  flush()
  return out
}

export function plainText(nodes: Inline[]): string {
  return nodes.map((n) => (typeof n === 'string' ? n : plainText(n.c))).join('')
}

// ──────────────────────────────────────────────────────────────── blocks
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section'

/** "Heading text {#id pending}" → text + attributes */
function headingAttrs(raw: string): { text: string; id: string | null; pending: boolean } {
  const m = /\s*\{([^{}]*)\}\s*$/.exec(raw)
  if (!m) return { text: raw.trim(), id: null, pending: false }
  let id: string | null = null
  let pending = false
  for (const tok of m[1].trim().split(/\s+/)) {
    if (tok.startsWith('#') && tok.length > 1) id = slugify(tok.slice(1))
    else if (/^\.?pending$/i.test(tok)) pending = true
  }
  return { text: raw.slice(0, m.index).trim(), id, pending }
}

export function parsePageMarkdown(src: string): MdDoc {
  const lines = (src ?? '').replace(/\r\n?/g, '\n').split('\n')
  const doc: MdDoc = { intro: [], sections: [] }
  const usedIds = new Set<string>()
  let target = doc.intro
  let para: string[] = []
  let quote: string[] = []
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) target.push({ t: 'p', c: parseInline(para.join(' ')) })
    para = []
  }
  const flushQuote = () => {
    if (quote.length) target.push({ t: 'quote', c: parseInline(quote.join(' ')) })
    quote = []
  }
  const flushList = () => {
    if (list) target.push({ t: list.t, items: list.items.map((x) => parseInline(x)) })
    list = null
  }
  const flushAll = () => {
    flushPara()
    flushQuote()
    flushList()
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim()) {
      flushAll()
      continue
    }
    let m: RegExpExecArray | null
    if ((m = /^#{1,2}\s+(.+)$/.exec(line))) {
      flushAll()
      const { text, id, pending } = headingAttrs(m[1])
      const title = parseInline(text)
      const toc = plainText(title).trim()
      let sid = id ?? slugify(toc)
      for (let n = 2; usedIds.has(sid); n++) sid = `${id ?? slugify(toc)}-${n}`
      usedIds.add(sid)
      const section: MdSection = { id: sid, toc, title, pending, blocks: [] }
      doc.sections.push(section)
      target = section.blocks
      continue
    }
    if ((m = /^#{3,6}\s+(.+)$/.exec(line))) {
      flushAll()
      target.push({ t: 'h3', c: parseInline(headingAttrs(m[1]).text) })
      continue
    }
    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll()
      target.push({ t: 'hr' })
      continue
    }
    if ((m = /^\s{0,3}>\s?(.*)$/.exec(line))) {
      flushPara()
      flushList()
      quote.push(m[1])
      continue
    }
    if ((m = /^\s{0,3}([-*+])\s+(.*)$/.exec(line)) || (m = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/.exec(line))) {
      flushPara()
      flushQuote()
      const t = /\d/.test(m[1]) ? 'ol' : 'ul'
      if (!list || list.t !== t) {
        flushList()
        list = { t, items: [] }
      }
      list.items.push(m[2])
      continue
    }
    // indented continuation of the last list item
    if (list && /^\s+\S/.test(rawLine)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
      continue
    }
    flushList()
    flushQuote()
    para.push(line.trim())
  }
  flushAll()
  return doc
}

// ──────────────────────────────────────────────────────────────── render
const linkCls = 'font-semibold underline decoration-2 underline-offset-4 hover:text-door focus-ring'

export function MdInline({ nodes }: { nodes: Inline[] }): ReactNode {
  return nodes.map((n, i) => {
    if (typeof n === 'string') return n
    const kids = <MdInline nodes={n.c} />
    switch (n.t) {
      case 'strong':
        return <strong key={i}>{kids}</strong>
      case 'em':
        return <em key={i}>{kids}</em>
      case 'code':
        return (
          <code key={i} className="border border-current/20 bg-ink/5 px-1 font-mono text-[0.88em]">
            {kids}
          </code>
        )
      case 'a':
        if (n.href.startsWith('/') || n.href.startsWith('#')) {
          return (
            <Link key={i} href={n.href} className={linkCls}>
              {kids}
            </Link>
          )
        }
        return (
          <a key={i} href={n.href} className={linkCls} {...(/^https?:/i.test(n.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {kids}
          </a>
        )
    }
  })
}

export function MdBlocks({ blocks }: { blocks: Block[] }): ReactNode {
  return blocks.map((b, i) => {
    switch (b.t) {
      case 'p':
        return (
          <p key={i}>
            <MdInline nodes={b.c} />
          </p>
        )
      case 'h3':
        return (
          <h3 key={i} className="mt-8 font-display text-[clamp(22px,2.6vw,30px)] uppercase leading-none">
            <MdInline nodes={b.c} />
          </h3>
        )
      case 'ul':
      case 'ol': {
        const L = b.t
        return (
          <L key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <MdInline nodes={it} />
              </li>
            ))}
          </L>
        )
      }
      case 'quote':
        return (
          <blockquote key={i} className="mt-4 border-l-4 border-door bg-lav/30 py-2 pl-4 pr-3">
            <MdInline nodes={b.c} />
          </blockquote>
        )
      case 'hr':
        return <hr key={i} className="my-8 border-t-[3px] border-ink" />
    }
  })
}

/** Body-copy rhythm shared by the public page and the admin preview. */
export const MD_BODY_CLASS =
  'max-w-[68ch] text-[17px] leading-[1.65] [&_li]:mt-2 [&_li]:pl-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p+p]:mt-4 [&_ul+p]:mt-4 [&_ol+p]:mt-4 [&_p+ul]:mt-4 [&_ul]:mt-4 [&_ul]:list-[square] [&_ul]:pl-6 [&_li::marker]:text-door'
