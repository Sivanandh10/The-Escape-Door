'use client'
// Careers admin — editor fields: markdown description (write / preview), one-per-line lists, questions builder.
// Owner: CAREERS. Styled with the admin kit (adminInput / adminBtn / Field) so it matches every other drawer.
import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, PencilLine, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminBtn, adminInput, adminLabel } from '../ui'
import { Field } from '../crud/kit'
import { Markdown } from '@/components/careers/Markdown'
import { QUESTION_TYPES, type JobQuestion, type QuestionType } from '@/components/careers/model'

// ---------------------------------------------------------------- markdown editor
export function MarkdownField({ value, onChange, error, label = 'Description' }: { value: string; onChange: (v: string) => void; error?: string; label?: string }) {
  const id = useId()
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <label htmlFor={id} className={cn(adminLabel, 'mb-0')}>{label}</label>
        <div role="tablist" aria-label="Description editor" className="flex border-2 border-paper/20">
          {(['write', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('inline-flex min-h-9 items-center gap-1.5 px-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] focus-ring', tab === t ? 'bg-paper text-ink' : 'text-paper/65 can-hover:hover:text-paper')}
            >
              {t === 'write' ? <PencilLine aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          id={id}
          rows={12}
          value={value}
          maxLength={20000}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          placeholder={'What the role is and why it matters.\n\n## A normal week\n- Design two drops for the next fest\n- **Bold**, *italic*, [links](https://…)'}
          className={cn(adminInput, 'resize-y font-mono text-[13.5px] leading-relaxed')}
        />
      ) : (
        <div className="min-h-[220px] border-2 border-ink bg-paper p-4 text-ink shadow-[4px_4px_0_var(--color-door)]" data-lenis-prevent="">
          {value.trim() ? <Markdown source={value} className="text-[15px]" /> : <p className="text-[14px] text-ink/50">Nothing to preview yet.</p>}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-hype">{error}</p>
      ) : (
        <p className="mt-1.5 text-[12.5px] leading-snug text-paper/50">
          Markdown: <code className="font-mono">## heading</code> · <code className="font-mono">- bullet</code> · <code className="font-mono">**bold**</code> · <code className="font-mono">[text](https://…)</code>. The first paragraph is the teaser on /careers.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- one-item-per-line list
export function LinesField({ label, value, onChange, hint, error, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; error?: string; placeholder?: string }) {
  const id = useId()
  const [text, setText] = useState(value.join('\n'))
  return (
    <Field label={label} htmlFor={id} hint={hint ?? 'One per line.'} error={error} className="sm:col-span-2">
      <textarea
        id={id}
        rows={Math.min(8, Math.max(3, value.length + 1))}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean))
        }}
        aria-invalid={!!error}
        className={cn(adminInput, 'resize-y leading-relaxed')}
      />
    </Field>
  )
}

// ---------------------------------------------------------------- questions builder
const qid = () => `q${Date.now().toString(36)}${Math.floor(performance.now() % 1000).toString(36)}`

export function QuestionsBuilder({ value, onChange, errors }: { value: JobQuestion[]; onChange: (v: JobQuestion[]) => void; errors: Record<string, string> }) {
  const patch = (i: number, p: Partial<JobQuestion>) => onChange(value.map((q, j) => (j === i ? { ...q, ...p } : q)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = () => onChange([...value, { id: qid(), label: '', type: 'text', required: false }])

  return (
    <div className="sm:col-span-2">
      {value.length === 0 ? (
        <p className="border-2 border-dashed border-paper/15 p-4 text-[13.5px] text-paper/55">
          No extra questions. Everyone answers name, email, phone, city, links and résumé — add questions only if this role needs them (e.g. “Which tools do you design in?”).
        </p>
      ) : (
        <ol className="space-y-3">
          {value.map((q, i) => {
            const err = (k: string) => errors[`questions.${i}.${k}`]
            return (
              <li key={q.id} className="border-2 border-paper/15 bg-ink/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center border-2 border-ink bg-volt font-mono text-[11px] font-bold text-ink">{i + 1}</span>
                  <span className="label flex-1 text-paper/55">Question</span>
                  <button type="button" aria-label="Move question up" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-10 place-items-center text-paper/60 focus-ring disabled:opacity-30 can-hover:hover:text-volt"><ArrowUp aria-hidden className="size-4" /></button>
                  <button type="button" aria-label="Move question down" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid size-10 place-items-center text-paper/60 focus-ring disabled:opacity-30 can-hover:hover:text-volt"><ArrowDown aria-hidden className="size-4" /></button>
                  <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-10 place-items-center text-paper/60 focus-ring can-hover:hover:text-hype"><Trash2 aria-hidden className="size-4" /></button>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_170px]">
                  <label className="block min-w-0">
                    <span className="sr-only">Question {i + 1} text</span>
                    <input value={q.label} maxLength={200} onChange={(e) => patch(i, { label: e.target.value })} placeholder="e.g. Which tools do you design in?" aria-invalid={!!err('label')} className={adminInput} />
                    {err('label') && <span role="alert" className="mt-1 block text-[12px] text-hype">{err('label')}</span>}
                  </label>
                  <label className="block">
                    <span className="sr-only">Answer type</span>
                    <select value={q.type} onChange={(e) => { const type = e.target.value as QuestionType; patch(i, { type, options: type === 'select' ? q.options ?? [] : undefined }) }} className={cn(adminInput, 'cursor-pointer')}>
                      {QUESTION_TYPES.map((t) => <option key={t.id} value={t.id} className="bg-ink">{t.label}</option>)}
                    </select>
                  </label>
                </div>
                {q.type === 'select' && (
                  <label className="mt-3 block">
                    <span className={adminLabel}>Options (comma-separated)</span>
                    <input
                      defaultValue={(q.options ?? []).join(', ')}
                      onChange={(e) => patch(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                      placeholder="Weekdays, Weekends, Both"
                      aria-invalid={!!err('options')}
                      className={adminInput}
                    />
                    {err('options') && <span role="alert" className="mt-1 block text-[12px] text-hype">{err('options')}</span>}
                  </label>
                )}
                <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 text-[13.5px] text-paper/80">
                  <input type="checkbox" checked={q.required} onChange={(e) => patch(i, { required: e.target.checked })} className="size-4 accent-[var(--color-volt)]" />
                  Required
                </label>
              </li>
            )
          })}
        </ol>
      )}
      {errors.questions && <p role="alert" className="mt-2 text-[12.5px] text-hype">{errors.questions}</p>}
      <button type="button" onClick={add} disabled={value.length >= 12} className={cn(adminBtn({ variant: 'ghost', size: 'sm' }), 'mt-3 min-h-10')}>
        <Plus aria-hidden className="size-4" /> Add question
      </button>
    </div>
  )
}
