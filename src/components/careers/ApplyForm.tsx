'use client'
// Apply form for /careers/[slug]. Owner: CAREERS.
// Flow: validate instantly → (résumé) POST /api/careers/resume-url → uploadToSignedUrl (private 'careers' bucket)
// → POST /api/careers/apply. States: idle · invalid (inline, focus first error) · uploading · sending ·
// error (ink splat + retry) · success (#71: stamp slams in + Kado cheers). Honeypot "website".
// Only what's needed is collected, with a consent line linking /policies/privacy (DPDP 2023).
import Link from 'next/link'
import { useId, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, FileText, Paperclip, RotateCcw, X } from 'lucide-react'
import { Mascot } from '@/components/brand'
import { InkSplat } from '@/components/fx/InkSplat'
import { supabaseBrowser } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { RESUME_MAX_BYTES, resumeContentType, type JobQuestion } from './model'

type Status = 'idle' | 'uploading' | 'sending' | 'done' | 'error'
type Base = 'name' | 'email' | 'phone' | 'city' | 'portfolioUrl' | 'linkedinUrl'
type Errors = Partial<Record<Base | 'resume' | 'consent' | `q:${string}`, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^[+\d][\d\s-]{6,}$/
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+/i

const FIELDS: Array<{ k: Base; label: string; type: string; auto: string; placeholder: string; req?: boolean; mode?: 'email' | 'tel' | 'url' }> = [
  { k: 'name', label: 'Full name', type: 'text', auto: 'name', placeholder: 'Aanya Sharma', req: true },
  { k: 'email', label: 'Email', type: 'email', auto: 'email', placeholder: 'you@college.in', req: true, mode: 'email' },
  { k: 'phone', label: 'Phone / WhatsApp', type: 'tel', auto: 'tel', placeholder: '98xxxxxx10', mode: 'tel' },
  { k: 'city', label: 'City', type: 'text', auto: 'address-level2', placeholder: 'Your city' },
  { k: 'portfolioUrl', label: 'Portfolio link', type: 'url', auto: 'url', placeholder: 'https://behance.net/you', mode: 'url' },
  { k: 'linkedinUrl', label: 'LinkedIn', type: 'url', auto: 'off', placeholder: 'https://linkedin.com/in/you', mode: 'url' },
]

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function ApplyForm({ job }: { job: { id: string; title: string; questions: JobQuestion[] } }) {
  const uid = useId()
  const reduced = useReducedMotion()
  const formRef = useRef<HTMLFormElement>(null)
  const honeypot = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<Record<Base, string>>({ name: '', email: '', phone: '', city: '', portfolioUrl: '', linkedinUrl: '' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [uploaded, setUploaded] = useState<{ file: File; path: string } | null>(null)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const clearErr = (k: keyof Errors) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }))
  const set = (k: Base, v: string) => {
    setValues((s) => ({ ...s, [k]: v }))
    clearErr(k)
  }
  const setAnswer = (id: string, v: string) => {
    setAnswers((s) => ({ ...s, [id]: v }))
    clearErr(`q:${id}`)
  }

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    if (!resumeContentType(f)) {
      setErrors((e) => ({ ...e, resume: 'Upload a PDF or Word file (.pdf, .doc, .docx).' }))
      return
    }
    if (f.size > RESUME_MAX_BYTES) {
      setErrors((e) => ({ ...e, resume: `That file is ${fmtSize(f.size)} — max is 5 MB.` }))
      return
    }
    setFile(f)
    setUploaded(null)
    clearErr('resume')
  }

  const validate = (): Errors => {
    const e: Errors = {}
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])) as Record<Base, string>
    if (v.name.length < 2) e.name = 'Add your name.'
    if (!EMAIL_RE.test(v.email)) e.email = 'Enter a valid email so we can reply.'
    if (v.phone && !PHONE_RE.test(v.phone)) e.phone = 'Enter a phone number (digits, + or -).'
    if (v.portfolioUrl && !URL_RE.test(v.portfolioUrl)) e.portfolioUrl = 'Paste a full link starting with https://'
    if (v.linkedinUrl && !URL_RE.test(v.linkedinUrl)) e.linkedinUrl = 'Paste a full link starting with https://'
    if (!file && !v.portfolioUrl && !v.linkedinUrl) e.resume = 'Attach your résumé — or add a portfolio / LinkedIn link above.'
    for (const q of job.questions) {
      const a = (answers[q.id] ?? '').trim()
      if (q.required && !a) e[`q:${q.id}`] = 'This one is required.'
      else if (a && q.type === 'url' && !URL_RE.test(a)) e[`q:${q.id}`] = 'Paste a full link starting with https://'
    }
    if (!consent) e.consent = 'Please tick this so we can review your application.'
    return e
  }

  const focusFirst = (e: Errors) => {
    const order = [...FIELDS.map((f) => f.k as string), 'resume', ...job.questions.map((q) => `q:${q.id}`), 'consent']
    const first = order.find((k) => e[k as keyof Errors])
    if (first) formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
  }

  async function uploadResume(f: File): Promise<string> {
    if (uploaded && uploaded.file === f) return uploaded.path
    const contentType = resumeContentType(f)!
    const res = await fetch('/api/careers/resume-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, filename: f.name.slice(0, 200), contentType, size: f.size }),
    })
    const data = (await res.json().catch(() => ({}))) as { bucket?: string; path?: string; token?: string; error?: string }
    if (!res.ok || !data.path || !data.token || !data.bucket) {
      throw new Error(
        data.error === 'rate-limited'
          ? 'Too many uploads in a row. Give it a few minutes and try again.'
          : data.error === 'job-closed'
            ? 'This role just closed, so it isn’t taking applications any more.'
          : data.error === 'uploads-unconfigured' || data.error === 'uploads-unavailable'
            ? 'Résumé uploads are down right now. Add a portfolio or LinkedIn link instead, or try again later.'
            : 'We couldn’t prepare the upload. Check the file and try again.',
      )
    }
    const sb = supabaseBrowser()
    if (!sb) throw new Error('Résumé uploads are down right now. Add a portfolio or LinkedIn link instead.')
    const up = await sb.storage.from(data.bucket).uploadToSignedUrl(data.path, data.token, f, { contentType })
    if (up.error) throw new Error('The upload didn’t finish. Check your connection and try again.')
    setUploaded({ file: f, path: data.path })
    return data.path
  }

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (status === 'uploading' || status === 'sending') return
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      focusFirst(e)
      return
    }
    setServerError('')
    let resumePath: string | null = null
    try {
      if (file) {
        setStatus('uploading')
        resumePath = await uploadResume(file)
      }
      setStatus('sending')
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          ...Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])),
          resumePath,
          resumeName: file?.name.slice(0, 200) ?? '',
          answers: Object.fromEntries(Object.entries(answers).map(([k, x]) => [k, x.trim()]).filter(([, x]) => x)),
          consent: true,
          website: honeypot.current?.value ?? '',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> }
      if (res.ok && data.ok) {
        setStatus('done')
        track('job_apply', { job: job.title })
        return
      }
      if (data.fieldErrors) {
        const fe: Errors = {}
        for (const [k, msgs] of Object.entries(data.fieldErrors)) if (msgs?.[0]) fe[k as keyof Errors] = msgs[0]
        setErrors(fe)
        focusFirst(fe)
      }
      if (data.fieldErrors?.resume) setUploaded(null)
      setStatus('error')
      setServerError(
        data.error === 'rate-limited'
          ? 'Too many tries in a row. Give it a few minutes, then send again.'
          : data.error === 'job-closed' || data.error === 'job-not-found'
            ? 'This role just closed, so we can’t take new applications for it. See the other open roles.'
            : data.error === 'invalid'
              ? 'A few answers need another look — check the highlighted fields.'
              : 'That didn’t go through. Check your connection and send again.',
      )
    } catch (err) {
      setStatus('error')
      setServerError(err instanceof Error ? err.message : 'That didn’t go through. Try again.')
    }
  }

  const busy = status === 'uploading' || status === 'sending'
  const inputCls = (err?: string) =>
    cn(
      'mt-2 block w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink placeholder:text-tone-3 transition-shadow duration-150 focus:outline-none focus-visible:shadow-[4px_4px_0_0_var(--color-door)]',
      err && 'shadow-[4px_4px_0_0_var(--color-hype)]',
    )
  const errLine = (id: string, msg?: string): ReactNode =>
    msg ? (
      <p id={id} className="mt-1.5 flex items-center gap-1.5 text-[14px] font-medium text-[#b3121f]">
        <InkSplat variant={2} color="var(--color-hype)" className="size-4 shrink-0" />
        {msg}
      </p>
    ) : null

  return (
    <div className="relative" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {status === 'done' ? (
          <motion.div
            key="done"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 400, damping: 22 }}
            className="relative overflow-hidden border-4 border-ink bg-paper p-6 text-ink shadow-hard-lg grain sm:p-8"
            role="status"
          >
            <motion.p
              initial={reduced ? false : { scale: 2.2, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: reduced ? 0 : 0.12 }}
              className="font-display inline-block border-[5px] border-hype px-4 py-1 text-[clamp(40px,7vw,72px)] uppercase leading-none text-hype"
            >
              Application sent
            </motion.p>
            <div className="mt-6 flex items-end gap-4">
              <p className="max-w-[42ch] text-[17px] leading-[1.55]">
                Thanks, {values.name.trim().split(/\s+/)[0] || 'friend'}! Your application for <strong>{job.title}</strong> is with the team. If it’s a fit,
                we’ll reach out at <strong className="break-all">{values.email.trim()}</strong>.
              </p>
              <Mascot mood="cheer" size={96} animate title="" className="ml-auto shrink-0" />
            </div>
            <Link href="/careers#roles" className="press focus-ring label mt-6 inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 font-bold shadow-hard-sm hover:bg-volt-hot">
              See other roles <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            ref={formRef}
            noValidate
            onSubmit={onSubmit}
            initial={false}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            className="relative border-4 border-ink bg-paper p-5 text-ink shadow-hard-lg grain sm:p-8"
            aria-labelledby={`${uid}-title`}
          >
            <p className="label text-tone-2">Apply · {job.title}</p>
            <h2 id={`${uid}-title`} className="h-display mt-3 text-[clamp(36px,4.4vw,56px)]">
              Send your <em>application</em>
            </h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => {
                const id = `${uid}-${f.k}`
                const err = errors[f.k]
                return (
                  <div key={f.k}>
                    <label htmlFor={id} className="label flex items-baseline justify-between gap-2">
                      <span className="font-bold">{f.label}</span>
                      <span className="text-[10px] text-tone-3">{f.req ? 'Required' : 'Optional'}</span>
                    </label>
                    <input
                      id={id}
                      name={f.k}
                      data-field={f.k}
                      type={f.type}
                      inputMode={f.mode}
                      autoComplete={f.auto}
                      value={values[f.k]}
                      maxLength={f.k.endsWith('Url') ? 500 : 120}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.k, e.target.value)}
                      aria-invalid={!!err}
                      aria-describedby={err ? `${id}-err` : undefined}
                      className={cn(inputCls(err), 'min-h-12')}
                    />
                    {errLine(`${id}-err`, err)}
                  </div>
                )
              })}
            </div>

            {/* résumé drop zone */}
            <div className="mt-5">
              <p className="label flex items-baseline justify-between gap-2">
                <span className="font-bold">Résumé</span>
                <span className="text-[10px] text-tone-3">PDF / DOC / DOCX · max 5 MB</span>
              </p>
              {file ? (
                <div className="mt-2 flex items-center gap-3 border-[3px] border-ink bg-lav p-3">
                  <FileText aria-hidden="true" className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{file.name}</span>
                    <span className="block font-mono text-[12px] text-tone-2">{fmtSize(file.size)}{uploaded?.file === file ? ' · uploaded' : ''}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setUploaded(null); if (fileInput.current) fileInput.current.value = '' }}
                    disabled={busy}
                    aria-label={`Remove ${file.name}`}
                    className="press focus-ring grid size-11 shrink-0 place-items-center border-[3px] border-ink bg-paper hover:bg-pink"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              ) : (
                <label
                  data-field="resume"
                  tabIndex={-1}
                  onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]) }}
                  className={cn(
                    'mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 border-[3px] border-dashed border-ink px-4 py-5 text-center transition-colors duration-150 focus-within:shadow-[4px_4px_0_0_var(--color-door)]',
                    dragOver ? 'bg-volt' : 'bg-paper hover:bg-volt/40',
                    errors.resume && 'shadow-[4px_4px_0_0_var(--color-hype)]',
                  )}
                >
                  <Paperclip aria-hidden="true" className="size-5" />
                  <span className="text-[15px] font-semibold">Drop your résumé here, or <span className="underline decoration-2 underline-offset-4">choose a file</span></span>
                  <span className="text-[13px] text-tone-2">Or skip it and add a portfolio / LinkedIn link above.</span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    aria-describedby={errors.resume ? `${uid}-resume-err` : undefined}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => pickFile(e.target.files?.[0])}
                  />
                </label>
              )}
              {errLine(`${uid}-resume-err`, errors.resume)}
            </div>

            {job.questions.length > 0 && (
              <fieldset className="mt-6 border-t-[3px] border-ink pt-5">
                <legend className="sr-only">Questions from the team</legend>
                <p className="label mb-1 font-bold">A few questions from the team</p>
                <div className="grid gap-4">
                  {job.questions.map((q) => {
                    const id = `${uid}-q-${q.id}`
                    const key = `q:${q.id}` as const
                    const err = errors[key]
                    const common = {
                      id,
                      name: key,
                      'data-field': key,
                      value: answers[q.id] ?? '',
                      'aria-invalid': !!err,
                      'aria-describedby': err ? `${id}-err` : undefined,
                      required: q.required,
                    }
                    return (
                      <div key={q.id}>
                        <label htmlFor={id} className="label flex items-baseline justify-between gap-2 normal-case tracking-normal">
                          <span className="text-[15px] font-bold">{q.label}</span>
                          <span className="label text-[10px] text-tone-3">{q.required ? 'Required' : 'Optional'}</span>
                        </label>
                        {q.type === 'textarea' ? (
                          <textarea {...common} rows={4} maxLength={4000} onChange={(e) => setAnswer(q.id, e.target.value)} className={cn(inputCls(err), 'min-h-28 resize-y py-2.5')} />
                        ) : q.type === 'select' ? (
                          <select {...common} onChange={(e) => setAnswer(q.id, e.target.value)} className={cn(inputCls(err), 'min-h-12 cursor-pointer')}>
                            <option value="">Choose one…</option>
                            {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input {...common} type={q.type === 'url' ? 'url' : 'text'} inputMode={q.type === 'url' ? 'url' : undefined} maxLength={500} placeholder={q.type === 'url' ? 'https://' : ''} onChange={(e) => setAnswer(q.id, e.target.value)} className={cn(inputCls(err), 'min-h-12')} />
                        )}
                        {errLine(`${id}-err`, err)}
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {/* honeypot */}
            <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />

            <div className="mt-6">
              <label className={cn('flex cursor-pointer items-start gap-3 border-[3px] border-ink p-3 text-[15px] leading-[1.5]', consent ? 'bg-volt/50' : 'bg-paper', errors.consent && 'shadow-[4px_4px_0_0_var(--color-hype)]')}>
                <input
                  type="checkbox"
                  data-field="consent"
                  checked={consent}
                  onChange={(e) => { setConsent(e.target.checked); clearErr('consent') }}
                  aria-invalid={!!errors.consent}
                  className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--color-door)]"
                />
                <span>
                  I agree that The Escape Door can use these details to review my application and contact me about this role.{' '}
                  <Link href="/policies/privacy" className="font-semibold underline decoration-2 underline-offset-2 hover:text-door">Privacy policy</Link>
                </span>
              </label>
              {errLine(`${uid}-consent-err`, errors.consent)}
            </div>

            <AnimatePresence initial={false}>
              {status === 'error' && serverError && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, x: -6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, x: [0, -5, 5, -3, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-5 flex items-start gap-2 border-[3px] border-ink bg-pink p-3 text-[15px] font-medium"
                >
                  <InkSplat variant={3} color="var(--color-hype)" className="size-5 shrink-0" />
                  <span className="flex-1">{serverError}</span>
                  <RotateCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className={cn(
                'press focus-ring label relative mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 overflow-hidden border-[3px] border-ink px-5 py-3.5 text-[13px] font-bold shadow-hard sm:w-auto',
                busy ? 'skeleton-tone cursor-progress text-paper' : 'bg-volt text-ink hover:bg-volt-hot',
              )}
            >
              {status === 'uploading' ? 'Uploading résumé…' : status === 'sending' ? 'Sending…' : status === 'error' ? 'Try again' : 'Send application'}
              {!busy && <ArrowRight aria-hidden="true" className="size-4" />}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ApplyForm
