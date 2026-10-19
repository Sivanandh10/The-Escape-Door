// /contact — Contact The Escape Door (SITEMAP §2.11, CONTRACTS §10.7). Owner: P5.
// No address or phone is published until confirmed. WhatsApp shows only when NEXT_PUBLIC_WHATSAPP_NUMBER is set.
import Link from 'next/link'
import { ArrowUpRight, Instagram, MessageCircle, Store } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import { Reveal } from '@/components/motion/Reveal'
import { PageHero } from '@/components/content/PageHero'
import { SectionHead } from '@/components/content/SectionHead'
import { LeadForm } from '@/components/content/LeadForm'
import { pageMeta } from '@/components/content/meta'
import { FAQ } from '@/components/content/faq'
import { absUrl, INSTAGRAM_URL, ORG_ID, WEBSITE_ID } from '@/lib/seo'
import { waLink, whatsappNumber } from '@/lib/whatsapp'

export const metadata = pageMeta({
  title: 'Contact The Escape Door',
  description:
    'Message The Escape Door about an order, a custom design or a fest partnership. Reach us on WhatsApp or Instagram @escapedoor.in, or send the form.',
  path: '/contact',
})

const QUICK = ['oversized-tee-price', 'own-design', 'fest-partner']

export default function ContactPage() {
  const hasWa = whatsappNumber().length > 0
  const quick = FAQ.filter((f) => QUICK.includes(f.id))

  const CHANNELS = [
    hasWa
      ? { icon: MessageCircle, k: 'Fastest', t: 'WhatsApp', d: 'Orders, custom requests and quick questions.', href: waLink('Hi The Escape Door!'), cta: 'Open chat', tone: 'bg-volt', ext: true }
      : { icon: MessageCircle, k: 'Orders', t: 'WhatsApp', d: 'Our order number is being set up. Until then, DM us on Instagram or use the form.', href: '', cta: '', tone: 'bg-volt', ext: true },
    { icon: Instagram, k: 'Drops & DMs', t: '@escapedoor.in', d: 'New designs, stall dates and DMs to personalise a design.', href: INSTAGRAM_URL, cta: 'Open Instagram', tone: 'bg-lav', ext: true },
    { icon: Store, k: 'In person', t: 'Fest stalls', d: 'Meet us at our next college fest stall.', href: '/fests#live', cta: 'See upcoming stalls', tone: 'bg-pink', ext: false },
  ]

  return (
    <>
      <PageHero
        kicker="Contact · Say hello"
        title={
          <>
            Contact the Escape <em>Door</em>
          </>
        }
        jp="連絡"
        crumbs={[{ name: 'Contact', path: '/contact' }]}
        sfx="コンコン"
        compact
        intro={<p>Orders, custom designs, fest partnerships or a question about a print: write to us and a real person replies.</p>}
      />

      <section aria-labelledby="reach" className="section-y relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x">
          <SectionHead n="01" label="Channels" jp="連絡先" id="reach" tone="paper" size="md">
            Ways to <em>reach</em> us
          </SectionHead>
          <Reveal as="ul" variant="slam" stagger={0.1} className="mt-10 grid gap-4 md:grid-cols-3">
            {CHANNELS.map((c) => {
              const Icon = c.icon
              const body = (
                <>
                  <span className="flex items-center justify-between">
                    <span className="label">{c.k}</span>
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <span className="font-display mt-4 block text-[clamp(32px,3.4vw,44px)] uppercase leading-[0.9]">{c.t}</span>
                  <span className="mt-3 block text-[15px]">{c.d}</span>
                  {c.cta && (
                    <span className="label mt-6 inline-flex items-center gap-1.5 font-bold underline decoration-2 underline-offset-4">
                      {c.cta}
                      <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-200 can-hover:group-hover:-translate-y-0.5 can-hover:group-hover:translate-x-0.5" />
                    </span>
                  )}
                </>
              )
              const cls = `group focus-ring flex h-full flex-col border-4 border-ink p-5 shadow-hard sm:p-6 ${c.tone}`
              return (
                <li key={c.t}>
                  {!c.href ? (
                    <div className={cls}>{body}</div>
                  ) : c.ext ? (
                    <a href={c.href} target="_blank" rel="noopener noreferrer" className={`${cls} press transition-transform duration-200 can-hover:hover:-translate-y-1`}>
                      {body}
                    </a>
                  ) : (
                    <Link href={c.href} className={`${cls} press transition-transform duration-200 can-hover:hover:-translate-y-1`}>
                      {body}
                    </Link>
                  )}
                </li>
              )
            })}
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="write" className="section-y relative border-t-4 border-ink bg-ink text-paper">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHead n="02" label="The form" jp="メッセージ" id="write" size="md" intro={<p>Tell us what it is about and how to reach you. We only use these details to reply.</p>}>
              Send us a <em>message</em>
            </SectionHead>
            <div className="mt-10 border-4 border-paper p-5">
              <p className="label text-volt">Quick answers</p>
              <ul className="mt-3 space-y-2">
                {quick.map((q) => (
                  <li key={q.id}>
                    <Link href={`/faq#${q.id}`} className="focus-ring inline-flex min-h-10 items-center gap-1.5 text-[16px] underline decoration-tone-3 decoration-2 underline-offset-4 hover:decoration-volt">
                      {q.q}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lg:col-span-7">
            <LeadForm variant="contact" />
          </div>
        </div>
      </section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact The Escape Door',
          url: absUrl('/contact'),
          isPartOf: { '@id': WEBSITE_ID },
          about: { '@id': ORG_ID },
          inLanguage: 'en-IN',
        }}
      />
    </>
  )
}
