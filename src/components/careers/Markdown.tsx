// Tiny, safe markdown → React renderer for job descriptions. Owner: CAREERS.
// No HTML passthrough, no dangerouslySetInnerHTML: text is always rendered as React text nodes.
// Supports: # / ## / ### headings (rendered one level under the page's H2s), paragraphs, line breaks,
// "- " / "* " bullets, "1. " numbered lists, **bold**, *italic* / _italic_, `code`, [label](https://… | /path | mailto:).
// No hooks → usable from Server Components (public page) and client components (admin preview).
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: string[] }

function parse(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let para: string[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', lines: para })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) {
      flushPara()
      flushList()
      continue
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(t)
    if (h) {
      flushPara()
      flushList()
      blocks.push({ kind: 'h', level: h[1].length as 1 | 2 | 3, text: h[2] })
      continue
    }
    const ul = /^[-*•]\s+(.+)$/.exec(t)
    const ol = /^\d{1,3}[.)]\s+(.+)$/.exec(t)
    if (ul || ol) {
      flushPara()
      const kind = ul ? 'ul' : 'ol'
      if (!list || list.kind !== kind) {
        flushList()
        list = { kind, items: [] }
      }
      list.items.push((ul ?? ol)![1])
      continue
    }
    if (list && /^\s{2,}\S/.test(raw)) {
      // indented continuation of the previous bullet
      list.items[list.items.length - 1] += ` ${t}`
      continue
    }
    flushList()
    para.push(t)
  }
  flushPara()
  flushList()
  return blocks
}

function safeHref(href: string): string | null {
  const h = href.trim()
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h
  if (h.startsWith('/') && !h.startsWith('//')) return h
  return null
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

function inline(text: string, keyBase: string, linkClass: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (tok.startsWith('**')) out.push(<strong key={key} className="font-bold">{inline(tok.slice(2, -2), key, linkClass)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={key} className="border-2 border-current/20 px-1 font-mono text-[0.9em]">{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      const href = lm ? safeHref(lm[2]) : null
      if (lm && href) {
        const ext = /^https?:/i.test(href)
        out.push(
          <a key={key} href={href} className={linkClass} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {lm[1]}
          </a>,
        )
      } else out.push(lm ? lm[1] : tok)
    } else out.push(<em key={key} className="italic [background:none]">{tok.slice(1, -1)}</em>)
    last = idx + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source, className, tone = 'paper' }: { source: string; className?: string; tone?: 'paper' | 'ink' }) {
  const blocks = parse(source)
  const linkClass = cn('focus-ring underline decoration-2 underline-offset-4', tone === 'paper' ? 'decoration-door hover:text-door' : 'decoration-volt hover:text-volt')
  return (
    <div className={cn('space-y-4 text-[17px] leading-[1.65]', className)}>
      {blocks.map((b, bi) => {
        const k = `b${bi}`
        if (b.kind === 'h') {
          const cls = 'font-display uppercase leading-[0.95] tracking-[-0.005em] pt-2'
          return b.level === 3 ? (
            <h4 key={k} className={cn(cls, 'text-[22px]')}>{inline(b.text, k, linkClass)}</h4>
          ) : (
            <h3 key={k} className={cn(cls, b.level === 1 ? 'text-[34px]' : 'text-[28px]')}>{inline(b.text, k, linkClass)}</h3>
          )
        }
        if (b.kind === 'p') {
          return (
            <p key={k}>
              {b.lines.map((l, li) => (
                <span key={li}>
                  {li > 0 && <br />}
                  {inline(l, `${k}-${li}`, linkClass)}
                </span>
              ))}
            </p>
          )
        }
        const List = b.kind === 'ul' ? 'ul' : 'ol'
        return (
          <List key={k} className={cn('space-y-2 pl-1', b.kind === 'ol' && 'list-none [counter-reset:md]')}>
            {b.items.map((it, ii) => (
              <li key={ii} className="relative flex gap-3">
                {b.kind === 'ul' ? (
                  <span aria-hidden="true" className={cn('mt-[0.6em] inline-block size-2 shrink-0 border-2', tone === 'paper' ? 'border-ink bg-volt' : 'border-paper bg-door')} />
                ) : (
                  <span aria-hidden="true" className="mt-[0.15em] shrink-0 font-mono text-[13px] font-bold tabular-nums opacity-70">{String(ii + 1).padStart(2, '0')}</span>
                )}
                <span className="min-w-0">{inline(it, `${k}-${ii}`, linkClass)}</span>
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}

/** Plain text (for meta descriptions / JSON-LD): strips markdown syntax. */
export function markdownToText(src: string): string {
  return src
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
