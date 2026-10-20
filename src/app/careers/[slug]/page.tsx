// /careers/[slug] — one open role: full description, lists, facts, share, Apply form + JobPosting JSON-LD.
// Static per open job (generateStaticParams); new jobs render on demand and are cached (tag 'careers').
// Draft / closed / unknown slugs → 404 (public RLS only returns open jobs). Owner: CAREERS.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import JsonLd from '@/components/seo/JsonLd'
import { pageMeta } from '@/components/content/meta'
import { JobView } from '@/components/careers/JobView'
import { markdownToText } from '@/components/careers/Markdown'
import { getOpenJob, getOpenJobs } from '@/components/careers/data'
import { JOB_TYPES, jobTypeLabel, type Job } from '@/components/careers/model'
import { absUrl, ORG_ID, SITE_NAME, SITE_URL } from '@/lib/seo'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const jobs = await getOpenJobs()
  // Cache Components needs ≥ 1 param at build; with no open roles this sample slug just renders a 404.
  return jobs.length ? jobs.map((j) => ({ slug: j.slug })) : [{ slug: 'no-open-roles' }]
}

function metaDescription(j: Job): string {
  const lead = markdownToText(j.description).replace(/\s+/g, ' ')
  const where = [j.location, j.isRemote ? 'remote OK' : ''].filter(Boolean).join(', ')
  const text = `${jobTypeLabel(j.type)} ${j.title} role at The Escape Door${where ? ` (${where})` : ''}. ${lead}`
  return text.length > 158 ? `${text.slice(0, 155).replace(/\s+\S*$/, '')}…` : text
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const j = await getOpenJob((await params).slug)
  if (!j) return { title: 'Role not found', robots: { index: false, follow: true } }
  return pageMeta({ title: `${j.title} — Careers at The Escape Door`, description: metaDescription(j), path: `/careers/${j.slug}` })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function jobPostingLd(j: Job) {
  const parts = [`<p>${esc(markdownToText(j.description)).replace(/\n/g, '<br>')}</p>`]
  const list = (h: string, xs: string[]) => (xs.length ? `<p><strong>${h}</strong></p><ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')
  parts.push(list('What you’ll do', j.responsibilities), list('What we’re looking for', j.requirements), list('Perks', j.perks))
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: j.title,
    description: parts.join(''),
    datePosted: j.createdAt.slice(0, 10),
    employmentType: JOB_TYPES.find((t) => t.id === j.type)?.schema ?? 'OTHER',
    directApply: true,
    url: absUrl(`/careers/${j.slug}`),
    identifier: { '@type': 'PropertyValue', name: SITE_NAME, value: j.id },
    hiringOrganization: { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME, sameAs: `${SITE_URL}/`, logo: absUrl('/brand/icon-512.png') },
    ...(j.location
      ? { jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: j.location, addressCountry: 'IN' } } }
      : {}),
    ...(j.isRemote ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'India' } } : {}),
    ...(j.team ? { occupationalCategory: j.team } : {}),
  }
}

export default async function JobPage({ params }: Props) {
  const j = await getOpenJob((await params).slug)
  if (!j) notFound()
  return (
    <>
      <JsonLd data={jobPostingLd(j)} id="job-ld" />
      <JobView job={j} />
    </>
  )
}
