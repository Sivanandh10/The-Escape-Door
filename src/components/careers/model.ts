// Careers — shared types, row mappers and zod schemas. Owner: CAREERS. Pure module (server + client safe).
// Mirrors supabase/migrations/0007_careers.sql.
import { z } from 'zod'

export const JOB_TYPES = [
  { id: 'full-time', label: 'Full-time', schema: 'FULL_TIME' },
  { id: 'part-time', label: 'Part-time', schema: 'PART_TIME' },
  { id: 'internship', label: 'Internship', schema: 'INTERN' },
  { id: 'freelance', label: 'Freelance', schema: 'CONTRACTOR' },
] as const
export type JobType = (typeof JOB_TYPES)[number]['id']
export const jobTypeLabel = (t: string) => JOB_TYPES.find((x) => x.id === t)?.label ?? t

export const JOB_STATUSES = [
  { id: 'draft', label: 'Draft' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]['id']

export const QUESTION_TYPES = [
  { id: 'text', label: 'Short answer' },
  { id: 'textarea', label: 'Long answer' },
  { id: 'url', label: 'Link (URL)' },
  { id: 'select', label: 'Pick one' },
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]['id']

export interface JobQuestion {
  id: string
  label: string
  type: QuestionType
  options?: string[]
  required: boolean
}

export interface Job {
  id: string
  slug: string
  title: string
  team: string
  location: string
  type: JobType
  isRemote: boolean
  /** markdown */
  description: string
  responsibilities: string[]
  requirements: string[]
  perks: string[]
  questions: JobQuestion[]
  status: JobStatus
  createdAt: string
  updatedAt: string
}

export const APP_STATUSES = [
  { id: 'new', label: 'New', jp: '新着', tone: 'volt' },
  { id: 'shortlisted', label: 'Shortlisted', jp: '選考', tone: 'lav' },
  { id: 'interview', label: 'Interview', jp: '面接', tone: 'pink' },
  { id: 'hired', label: 'Hired', jp: '採用', tone: 'door' },
  { id: 'rejected', label: 'Rejected', jp: '不採用', tone: 'muted' },
] as const
export type AppStatus = (typeof APP_STATUSES)[number]['id']
export const appStatusMeta = (s: string) => APP_STATUSES.find((x) => x.id === s) ?? APP_STATUSES[0]

export interface AppAnswer {
  id: string
  label: string
  value: string
}

export interface JobApplication {
  id: string
  jobId: string
  jobTitle: string
  name: string
  email: string
  phone: string
  city: string
  portfolioUrl: string
  linkedinUrl: string
  resumePath: string | null
  resumeName: string
  answers: AppAnswer[]
  consent: boolean
  status: AppStatus
  notes: string
  createdAt: string
}

// ---------------------------------------------------------------- mappers (DB snake_case ⇄ app)
type Row = Record<string, unknown>
const s = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const isQType = (v: unknown): v is QuestionType => QUESTION_TYPES.some((q) => q.id === v)

export function questionsFrom(v: unknown): JobQuestion[] {
  if (!Array.isArray(v)) return []
  const out: JobQuestion[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue
    const q = raw as Row
    const id = s(q.id)
    const label = s(q.label)
    if (!id || !label) continue
    const type = isQType(q.type) ? q.type : 'text'
    const options = arr(q.options).filter(Boolean)
    out.push({ id, label, type, required: q.required === true, ...(type === 'select' ? { options } : {}) })
  }
  return out
}

export function jobFromRow(r: Row): Job {
  const created = s(r.created_at, new Date(0).toISOString())
  return {
    id: s(r.id),
    slug: s(r.slug),
    title: s(r.title),
    team: s(r.team),
    location: s(r.location),
    type: (JOB_TYPES.some((t) => t.id === r.type) ? r.type : 'full-time') as JobType,
    isRemote: r.is_remote === true,
    description: s(r.description),
    responsibilities: arr(r.responsibilities),
    requirements: arr(r.requirements),
    perks: arr(r.perks),
    questions: questionsFrom(r.questions),
    status: (JOB_STATUSES.some((t) => t.id === r.status) ? r.status : 'draft') as JobStatus,
    createdAt: created,
    updatedAt: s(r.updated_at, created),
  }
}

export function jobToRow(j: Job): Row {
  return {
    id: j.id,
    slug: j.slug,
    title: j.title.trim(),
    team: j.team.trim(),
    location: j.location.trim(),
    type: j.type,
    is_remote: j.isRemote,
    description: j.description,
    responsibilities: j.responsibilities.map((x) => x.trim()).filter(Boolean),
    requirements: j.requirements.map((x) => x.trim()).filter(Boolean),
    perks: j.perks.map((x) => x.trim()).filter(Boolean),
    questions: j.questions.map((q) => ({
      id: q.id,
      label: q.label.trim(),
      type: q.type,
      required: q.required,
      ...(q.type === 'select' ? { options: (q.options ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
    })),
    status: j.status,
  }
}

export function answersFrom(v: unknown): AppAnswer[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is Row => !!x && typeof x === 'object')
    .map((x) => ({ id: s(x.id), label: s(x.label), value: s(x.value) }))
    .filter((x) => x.id || x.label)
}

export function applicationFromRow(r: Row): JobApplication {
  return {
    id: s(r.id),
    jobId: s(r.job_id),
    jobTitle: s(r.job_title),
    name: s(r.name),
    email: s(r.email),
    phone: s(r.phone),
    city: s(r.city),
    portfolioUrl: s(r.portfolio_url),
    linkedinUrl: s(r.linkedin_url),
    resumePath: s(r.resume_path) || null,
    resumeName: s(r.resume_name),
    answers: answersFrom(r.answers),
    consent: r.consent === true,
    status: (APP_STATUSES.some((t) => t.id === r.status) ? r.status : 'new') as AppStatus,
    notes: s(r.notes),
    createdAt: s(r.created_at, new Date(0).toISOString()),
  }
}

/** Only the columns the admin may change (status pipeline + notes). */
export function applicationToRow(a: JobApplication): Row {
  return { id: a.id, status: a.status, notes: a.notes }
}

// ---------------------------------------------------------------- validation
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const line = z.string().trim().max(400, 'Keep each line under 400 characters')

export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    label: z.string().trim().min(2, 'Write the question').max(200),
    type: z.enum(['text', 'textarea', 'url', 'select']),
    options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    required: z.boolean(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'select' && (q.options?.filter(Boolean).length ?? 0) < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least two options' })
    }
  })

/** Admin job editor schema (client-side; the database re-checks lengths + enums). */
export const jobSchema = z.object({
  slug: z.string().regex(SLUG_RE, 'Lowercase letters, numbers and dashes').max(80),
  title: z.string().trim().min(2, 'Add a job title').max(120),
  team: z.string().trim().max(60),
  location: z.string().trim().min(2, 'Add a city (or “Remote — India”)').max(120),
  type: z.enum(['full-time', 'part-time', 'internship', 'freelance']),
  isRemote: z.boolean(),
  description: z.string().trim().min(40, 'Describe the role in a few sentences (40+ characters)').max(20000),
  responsibilities: z.array(line).max(30),
  requirements: z.array(line).max(30),
  perks: z.array(line).max(30),
  questions: z.array(questionSchema).max(12, 'Max 12 questions'),
  status: z.enum(['draft', 'open', 'closed']),
})

export const RESUME_TYPES: Record<string, 'pdf' | 'doc' | 'docx'> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}
export const RESUME_MAX_BYTES = 5 * 1024 * 1024
export const RESUME_PATH_RE = /^resumes\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(pdf|doc|docx)$/

/** Content type from a File (some systems leave .doc/.docx type empty). */
export function resumeContentType(file: { name: string; type: string }): string | null {
  if (RESUME_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return null
}

const optUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), 'Paste a full link starting with https://')

/** POST /api/careers/apply body (server re-validates answers against the job's questions). */
export const applySchema = z.object({
  jobId: z.uuid(),
  name: z.string().trim().min(2, 'Add your name').max(120),
  email: z.email('Enter a valid email').max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === '' || /^[+\d][\d\s-]{6,}$/.test(v), 'Enter a phone number (digits, + or -)'),
  city: z.string().trim().max(120),
  portfolioUrl: optUrl,
  linkedinUrl: optUrl,
  resumePath: z.string().regex(RESUME_PATH_RE).nullable(),
  resumeName: z.string().trim().max(200),
  answers: z.record(z.string().regex(/^[a-z0-9_-]{1,40}$/), z.string().max(4000)),
  consent: z.literal(true, { error: 'Please tick the consent box' }),
  website: z.string().max(200).optional(), // honeypot
})
export type ApplyInput = z.infer<typeof applySchema>

/** Check answers against the job's questions → snapshot [{id,label,value}] or field errors. */
export function checkAnswers(questions: JobQuestion[], answers: Record<string, string>): { ok: true; value: AppAnswer[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const value: AppAnswer[] = []
  for (const q of questions) {
    const v = (answers[q.id] ?? '').trim()
    if (!v) {
      if (q.required) errors[q.id] = 'This one is required'
      continue
    }
    const max = q.type === 'textarea' ? 4000 : 500
    if (v.length > max) errors[q.id] = `Keep it under ${max} characters`
    else if (q.type === 'url' && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(v)) errors[q.id] = 'Paste a full link starting with https://'
    else if (q.type === 'select' && !(q.options ?? []).includes(v)) errors[q.id] = 'Pick one of the options'
    value.push({ id: q.id, label: q.label, value: v })
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value }
}
