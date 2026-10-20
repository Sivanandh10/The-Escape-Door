// /careers — "Join the crew": open roles from Supabase (public RLS: status = 'open'), filters, how applying works.
// Static: getOpenJobs() is 'use cache' (tag 'careers'; the admin revalidates on every save). Owner: CAREERS.
import Link from 'next/link'
import { ArrowDown, ArrowRight } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import { Mascot } from '@/components/brand'
import { Reveal } from '@/components/motion/Reveal'
import { PageHero } from '@/components/content/PageHero'
import { SectionHead } from '@/components/content/SectionHead'
import { pageMeta } from '@/components/content/meta'
import { RolesBoard, type RoleCard } from '@/components/careers/RolesBoard'
import { getOpenJobs } from '@/components/careers/data'
import { markdownToText } from '@/components/careers/Markdown'
import { absUrl, ORG_ID } from '@/lib/seo'

export const metadata = pageMeta({
  title: 'Careers at The Escape Door — Join the Crew',
  description:
    'Open roles at The Escape Door: design, print, fest stalls and content for an anime-first merch label from India. See every opening and apply online in minutes.',
  path: '/careers',
})

const STEPS = [
  { n: '01', t: 'Pick a role', d: 'Open the role, read what the work is, and send the form — résumé, portfolio or LinkedIn, whichever shows your work best.', tone: 'bg-volt' },
  { n: '02', t: 'We read it', d: 'Every application lands with the team that’s hiring, not a bot. You only hear from us about the role you applied for.', tone: 'bg-lav' },
  { n: '03', t: 'Let’s talk', d: 'If it’s a fit, we reach out on the email or phone number you gave us to set up a chat.', tone: 'bg-pink' },
]

export default async function CareersPage() {
  const jobs = await getOpenJobs()
  const roles: RoleCard[] = jobs.map((j) => ({
    id: j.id, slug: j.slug, title: j.title, team: j.team, location: j.location, type: j.type, isRemote: j.isRemote, createdAt: j.createdAt,
    blurb: markdownToText(j.description).split('\n')[0]?.slice(0, 220) ?? '',
  }))
  const count = roles.length

  const listLd = count
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Open roles at The Escape Door',
        numberOfItems: count,
        itemListElement: roles.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/careers/${r.slug}`), name: r.title })),
      }
    : null
  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${absUrl('/careers')}#page`,
    url: absUrl('/careers'),
    name: 'Careers at The Escape Door',
    about: { '@id': ORG_ID },
  }

  return (
    <>
      <JsonLd data={[pageLd, listLd]} id="careers-ld" />
      <PageHero
        kicker={count ? `Careers · ${count} open role${count === 1 ? '' : 's'}` : 'Careers · The crew'}
        title={
          <>
            Join the <em>crew</em>
          </>
        }
        jp="仲間募集"
        crumbs={[{ name: 'Careers', path: '/careers' }]}
        sfx="ドン!"
        rail="CREW"
        intro={
          <p>
            We make original, anime-first merch and bring it to college fests across India. When we need more hands — design, print,
            stalls, content — the roles show up here first.
          </p>
        }
        aside={
          <div className="relative border-4 border-paper bg-door p-6 text-paper shadow-[8px_8px_0_var(--color-volt)]">
            <p className="label text-volt">Now hiring</p>
            <p className="font-display mt-2 text-[clamp(64px,9vw,120px)] leading-[0.85] tabular-nums">{String(count).padStart(2, '0')}</p>
            <p className="label mt-1">open role{count === 1 ? '' : 's'}</p>
            <Mascot mood={count ? 'wave' : 'peek'} size={120} animate title="" className="absolute -bottom-4 right-4" />
          </div>
        }
      >
        <a href="#roles" className="press focus-ring label inline-flex min-h-13 items-center gap-2 border-[3px] border-ink bg-volt px-5 py-3.5 text-[13px] font-bold text-ink shadow-[5px_5px_0_0_var(--color-paper)] hover:bg-volt-hot">
          {count ? 'See open roles' : 'Open roles'} <ArrowDown aria-hidden="true" className="size-4" />
        </a>
      </PageHero>

      <section aria-labelledby="roles-h" id="roles" className="section-y relative scroll-mt-20 border-t-4 border-ink bg-lav text-ink">
        <div className="container-x">
          <SectionHead n="01" label="Open roles" jp="募集中" id="roles-h" tone="paper" size="md">
            Doors that are <em>open</em>
          </SectionHead>
          <div className="mt-10">
            <RolesBoard roles={roles} />
          </div>
        </div>
      </section>

      <section aria-labelledby="how-h" className="section-y relative border-t-4 border-ink bg-ink text-paper">
        <div className="container-x">
          <SectionHead n="02" label="How it works" jp="応募の流れ" id="how-h" size="md" intro={<p>No cover-letter essays. Show us what you make and how to reach you.</p>}>
            How applying <em>works</em>
          </SectionHead>
          <Reveal as="ol" variant="slam" stagger={0.1} className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className={`flex h-full flex-col border-4 border-ink p-5 text-ink shadow-[6px_6px_0_var(--color-paper)] sm:p-6 ${s.tone}`}>
                <span className="font-mono text-[13px] font-bold">{s.n}</span>
                <span className="font-display mt-3 block text-[clamp(32px,3.4vw,44px)] uppercase leading-[0.9]">{s.t}</span>
                <span className="mt-3 block text-[16px] leading-[1.55]">{s.d}</span>
              </li>
            ))}
          </Reveal>
          <p className="mt-10 text-[15px] text-tone-4">
            Questions about a role?{' '}
            <Link href="/contact" className="focus-ring inline-flex items-center gap-1 font-semibold underline decoration-volt decoration-2 underline-offset-4 hover:text-volt">
              Contact us <ArrowRight aria-hidden="true" className="size-4" />
            </Link>{' '}
            · How we handle your details:{' '}
            <Link href="/policies/privacy" className="focus-ring font-semibold underline decoration-volt decoration-2 underline-offset-4 hover:text-volt">
              Privacy policy
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
