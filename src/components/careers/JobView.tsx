// Role page body (hero, description, lists, facts, apply form). Owner: CAREERS. Server component.
// Used by /careers/[slug]; JSON-LD + metadata stay in the route.
import Link from 'next/link'
import { ArrowDown, ArrowLeft, Briefcase, CalendarDays, MapPin, Users, Wifi } from 'lucide-react'
import { PageHero } from '@/components/content/PageHero'
import { cn } from '@/lib/utils'
import { ApplyForm } from './ApplyForm'
import { Markdown } from './Markdown'
import { ShareRole } from './ShareRole'
import { jobTypeLabel, type Job } from './model'

const POSTED = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

function ListBlock({ id, title, items, tone }: { id: string; title: string; items: string[]; tone: string }) {
  if (!items.length) return null
  return (
    <section aria-labelledby={id} className="mt-12 border-t-[3px] border-ink pt-8">
      <h2 id={id} className="h-display text-[clamp(34px,4.6vw,60px)]">{title}</h2>
      <ul className="mt-6 space-y-3">
        {items.map((x, i) => (
          <li key={i} className="flex gap-3 text-[17px] leading-[1.6]">
            <span aria-hidden="true" className={cn('mt-[0.55em] inline-block size-3 shrink-0 border-2 border-ink', tone)} />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function JobView({ job: j }: { job: Job }) {
  const words = j.title.trim().split(/\s+/)
  const lastWord = words.pop()
  const facts = [
    j.team && { icon: Users, k: 'Team', v: j.team },
    { icon: Briefcase, k: 'Type', v: jobTypeLabel(j.type) },
    { icon: MapPin, k: 'Location', v: j.location || 'India' },
    j.isRemote && { icon: Wifi, k: 'Remote', v: 'Remote OK' },
    { icon: CalendarDays, k: 'Posted', v: POSTED.format(new Date(j.createdAt)) },
  ].filter(Boolean) as Array<{ icon: typeof Users; k: string; v: string }>

  return (
    <>
      <PageHero
        compact
        kicker={['Careers', j.team, jobTypeLabel(j.type)].filter(Boolean).join(' · ')}
        title={
          <>
            {words.length ? `${words.join(' ')} ` : ''}
            <em>{lastWord}</em>
          </>
        }
        jp="募集中"
        crumbs={[{ name: 'Careers', path: '/careers' }, { name: j.title, path: `/careers/${j.slug}` }]}
        intro={
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 text-volt" />{j.location || 'India'}</span>
            {j.isRemote && <span className="inline-flex items-center gap-1.5"><Wifi aria-hidden="true" className="size-4 text-volt" />Remote OK</span>}
            <span className="inline-flex items-center gap-1.5"><Briefcase aria-hidden="true" className="size-4 text-volt" />{jobTypeLabel(j.type)}</span>
          </p>
        }
      >
        <a href="#apply" className="press focus-ring label inline-flex min-h-13 items-center gap-2 border-[3px] border-ink bg-volt px-5 py-3.5 text-[13px] font-bold text-ink shadow-[5px_5px_0_0_var(--color-paper)] hover:bg-volt-hot">
          Apply now <ArrowDown aria-hidden="true" className="size-4" />
        </a>
        <ShareRole title={j.title} path={`/careers/${j.slug}`} />
      </PageHero>

      <div className="relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-10 py-12 sm:py-16 lg:grid-cols-12 lg:gap-14 lg:py-20">
          <article className="min-w-0 lg:col-span-7">
            <h2 className="h-display text-[clamp(34px,4.6vw,60px)]">The <em>role</em></h2>
            <Markdown source={j.description} className="mt-6" />
            <ListBlock id="do-h" title="What you’ll do" items={j.responsibilities} tone="bg-volt" />
            <ListBlock id="need-h" title="What we’re looking for" items={j.requirements} tone="bg-lav" />
            <ListBlock id="perks-h" title="Perks" items={j.perks} tone="bg-pink" />
          </article>

          <aside className="lg:col-span-4 lg:col-start-9" aria-label="Role facts">
            <div className="border-4 border-ink bg-paper p-5 shadow-hard lg:sticky lg:top-28">
              <p className="label text-tone-2">At a glance</p>
              <dl className="mt-4 space-y-3">
                {facts.map((f) => (
                  <div key={f.k} className="flex items-start gap-3">
                    <f.icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-door" />
                    <div>
                      <dt className="label text-tone-3">{f.k}</dt>
                      <dd className="text-[16px] font-semibold">{f.v}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <a href="#apply" className="press focus-ring label mt-6 flex min-h-12 items-center justify-center gap-2 border-[3px] border-ink bg-volt px-4 font-bold shadow-hard-sm hover:bg-volt-hot">
                Apply for this role <ArrowDown aria-hidden="true" className="size-4" />
              </a>
              <Link href="/careers#roles" className="focus-ring label mt-3 flex min-h-11 items-center justify-center gap-2 underline decoration-2 underline-offset-4 hover:text-door">
                <ArrowLeft aria-hidden="true" className="size-4" /> All open roles
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <section id="apply" aria-label={`Apply for ${j.title}`} className="section-y relative scroll-mt-20 border-t-4 border-ink bg-lav">
        <div className="container-x">
          <div className="mx-auto max-w-[860px]">
            <ApplyForm job={{ id: j.id, title: j.title, questions: j.questions }} />
          </div>
        </div>
      </section>
    </>
  )
}
