// Ticket-stub card for a stall (events data). Owner: P5 / HOME. Server.
// Dates are printed ONLY for confirmed + dated events, built from startDate/endDate so they always carry the year.
// Anything else is a "next season" stub: venue + city, "Dates announced soon" — never a bare month or "TBC".
import { CalendarCheck, MapPin, Sparkles } from 'lucide-react'
import type { FestEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import { dateRangeLabel, isDatedUpcoming } from './events'
import s from './content.module.css'

export function EventStub({ event, index }: { event: FestEvent; index: number }) {
  const dated = isDatedUpcoming(event)
  const dates = dated ? dateRangeLabel(event) : ''
  return (
    <article
      className={cn(
        s.stub,
        'group relative grid grid-cols-[1fr_auto] bg-ink text-paper transition-transform duration-300 can-hover:hover:-rotate-1 can-hover:hover:-translate-y-1',
      )}
      style={{ ['--stub-y' as string]: '50%', transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <div className="p-5 pl-7 sm:p-6 sm:pl-8">
        <p className="label text-volt">{dated ? `Stall ${String(index + 1).padStart(2, '0')}` : 'Next season'}</p>
        <h3 className="font-display mt-3 text-[clamp(34px,4.4vw,56px)] uppercase leading-[0.9]">{event.venue || event.city}</h3>
        <p className="mt-3 flex items-center gap-2 text-[15px] text-tone-4">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {event.city}
        </p>
        {dated && (
          <p className="label mt-4 inline-flex items-center gap-1.5 border-2 border-volt px-2 py-1 text-volt">
            <CalendarCheck aria-hidden="true" className="size-3.5" />
            Confirmed
          </p>
        )}
      </div>
      <div className="relative flex min-w-[112px] flex-col items-center justify-center border-l-0 px-4 py-5 text-center sm:min-w-[136px]">
        <span aria-hidden="true" className={cn(s.perforation, 'absolute inset-y-3 left-0 w-[3px] text-tone-3')} />
        {dated ? (
          <>
            <span className="label text-tone-4">Dates</span>
            <span className="font-mono mt-2 max-w-[9ch] text-[20px] font-bold leading-tight text-paper sm:text-[22px]">{dates}</span>
          </>
        ) : (
          <>
            <Sparkles aria-hidden="true" className="size-6 text-volt" />
            <span className="label mt-2 max-w-[11ch] leading-snug text-tone-4">Dates announced soon</span>
          </>
        )}
      </div>
    </article>
  )
}

export default EventStub
