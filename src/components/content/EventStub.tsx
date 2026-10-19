// Ticket-stub card for a stall (events data). dateLabel is shown EXACTLY (no invented year). Owner: P5. Server.
import { CalendarClock, MapPin } from 'lucide-react'
import type { FestEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import s from './content.module.css'

export function EventStub({ event, index }: { event: FestEvent; index: number }) {
  const [dates, note] = event.dateLabel.split('·').map((x) => x.trim())
  return (
    <article
      className={cn(
        s.stub,
        'group relative grid grid-cols-[1fr_auto] bg-ink text-paper transition-transform duration-300 can-hover:hover:-rotate-1 can-hover:hover:-translate-y-1',
      )}
      style={{ ['--stub-y' as string]: '50%', transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <div className="p-5 pl-7 sm:p-6 sm:pl-8">
        <p className="label text-volt">Stall {String(index + 1).padStart(2, '0')}</p>
        <h3 className="font-display mt-3 text-[clamp(34px,4.4vw,56px)] uppercase leading-[0.9]">{event.venue || event.city}</h3>
        <p className="mt-3 flex items-center gap-2 text-[15px] text-tone-4">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {event.city}
        </p>
        {!event.confirmed && (
          <p className="label mt-4 inline-flex items-center gap-1.5 border-2 border-volt px-2 py-1 text-volt">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {note || 'Dates to be confirmed'}
          </p>
        )}
      </div>
      <div className="relative flex min-w-[112px] flex-col items-center justify-center border-l-0 px-4 py-5 text-center sm:min-w-[136px]">
        <span aria-hidden="true" className={cn(s.perforation, 'absolute inset-y-3 left-0 w-[3px] text-tone-3')} />
        <span className="label text-tone-4">Dates</span>
        <span className="font-mono mt-2 text-[22px] font-bold leading-tight text-paper sm:text-[26px]">{dates}</span>
      </div>
    </article>
  )
}

export default EventStub
