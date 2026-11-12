import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, Moon, RotateCcw, Sun, Sunrise, Sunset, X } from 'lucide-react'
import type { Person, SlotId } from '../model/types'
import { SLOT_NAME, SLOTS } from '../model/types'
import type { SlotView } from '../model/derive'
import { addDays, clock, dayNum, fromIso, iso, weekdayShort } from '../model/time'
import { Pill } from './Pill'

export const SLOT_ICON = { morning: Sunrise, midday: Sun, evening: Sunset, bedtime: Moon } as const

const TILTS = [-14, 11, -8, 15, -12, 9, -15, 12]
/** Small fixed offsets so tablets look dropped in, not lined up */
const DRIFT: [number, number][] = [[-6, 4], [5, -5], [-3, -6], [7, 5], [-8, -2], [4, 6], [-5, 7], [6, -3]]

const STATUS_WORD: Record<SlotView['status'], string> = {
  given: 'Given',
  skipped: 'Not taken',
  due: 'Due now',
  late: 'Late',
  upcoming: 'Later',
  missed: 'Missed',
  empty: 'Nothing due',
}

const REASONS = ['Refused', 'Asleep', 'Out for the day', 'Unwell', 'Other']

export interface CompartmentProps {
  view: SlotView
  people: Person[]
  /** Pictures in the product page render without controls */
  interactive?: boolean
  onGive?(slot: SlotId): void
  onSkip?(slot: SlotId, reason: string): void
  onClear?(slot: SlotId): void
  /** Demo hook: force the press state on the give button */
  pressing?: boolean
}

/** Each person stamps in their own ink, so the week shows who did what */
export const inkOf = (id: string | undefined) => (id ? { '--ink': `var(--ink-${id}, var(--text))` } : {}) as CSSProperties

export function Seal({ initials, by, small, fresh }: { initials: string; by?: string; small?: boolean; fresh?: boolean }) {
  return (
    <span className={`seal${small ? ' seal--small' : ''}${fresh ? ' is-fresh' : ''}`} style={inkOf(by)} aria-hidden="true">
      <span className="seal-initials">{initials}</span>
    </span>
  )
}

export function Compartment({ view, people, interactive = true, onGive, onSkip, onClear, pressing, picked, onPick }: CompartmentProps & { picked?: boolean; onPick?(slot: SlotId): void }) {
  const { slot, status, meds, log, tablets } = view
  const person = log ? people.find((p) => p.id === log.by) : undefined
  const Icon = SLOT_ICON[slot]
  const closed = status === 'given' || status === 'skipped' || status === 'upcoming' || status === 'empty'
  const nameId = `cmp-${slot}`
  // The seal presses in only when the dose is given while you watch, not on every load
  const prev = useRef(status)
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (prev.current !== status) setFresh(status === 'given')
    prev.current = status
  }, [status])

  return (
    <article className={`cmp s-${slot} is-${status}${picked ? ' is-picked' : ''}`} aria-labelledby={nameId} data-slot={slot}>
      {onPick && (
        <button type="button" className="cmp-pick" aria-pressed={!!picked} aria-label={`${SLOT_NAME[slot]}, ${clock(view.time)}: ${STATUS_WORD[status].toLowerCase()}. Show details`} onClick={() => onPick(slot)} />
      )}
      <header className="cmp-head">
        <div className="cmp-title">
          <span className="cmp-icon" aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>
          <div className="cmp-name" id={nameId}>{SLOT_NAME[slot]}</div>
        </div>
        <div className="cmp-time display">{clock(view.time)}</div>
      </header>

      <div className="tray-wrap">
        <div className="tray" aria-hidden={closed ? 'true' : undefined}>
          {status === 'given' || meds.length === 0 ? null : (
            <div className="tray-pills">
              {meds.flatMap(({ med, count }, mi) =>
                Array.from({ length: count }, (_, k) => {
                  const i = mi * 3 + k
                  return (
                    <span key={`${med.id}-${k}`} className="tray-pill" style={{ transform: `translate(${DRIFT[i % DRIFT.length][0]}px, ${DRIFT[i % DRIFT.length][1]}px)` }}>
                      <Pill shape={med.shape} colour={med.colour} size={tablets >= 4 ? 46 : tablets === 3 ? 56 : tablets === 2 ? 70 : 84} tilt={TILTS[i % TILTS.length]} />
                    </span>
                  )
                }),
              )}
            </div>
          )}
          {status === 'missed' && <span className="tray-flag"><Clock size={13} strokeWidth={2.25} aria-hidden="true" /> Missed</span>}
        </div>
        <div className="lid" aria-hidden={closed ? undefined : 'true'}>
          {status === 'given' && log && (
            <div className="lid-given lid-given--seal">
              <Seal initials={person?.short ?? '?'} by={log.by} fresh={fresh} />
              <span className="lid-caption">Given at {clock(log.at)}</span>
            </div>
          )}
          {status === 'skipped' && log && (
            <div className="lid-given lid-given--seal">
              <span className="seal seal--skip" aria-hidden="true"><X size={18} strokeWidth={2.25} /></span>
              <span className="lid-caption">Not taken{log.reason ? `: ${log.reason.toLowerCase()}` : ''}</span>
            </div>
          )}
          {status === 'upcoming' && (
            <div className="lid-upcoming">
              <span className="lid-count">{tablets} {tablets === 1 ? 'tablet' : 'tablets'}</span>
            </div>
          )}
          {status === 'empty' && <div className="lid-upcoming"><span className="lid-count-word">Nothing at this time</span></div>}
        </div>
      </div>

      <CompartmentBody view={view} people={people} interactive={interactive} onGive={onGive} onSkip={onSkip} onClear={onClear} pressing={pressing} />
    </article>
  )
}

/** Status, tablet list and actions. Sits inside the compartment on wide screens, under the case on phones. */
export function CompartmentBody({ view, people, interactive = true, onGive, onSkip, onClear, pressing, detail }: CompartmentProps & { detail?: boolean }) {
  const { slot, status, meds, log } = view
  const [asking, setAsking] = useState(false)
  const person = log ? people.find((p) => p.id === log.by) : undefined
  return (
    <div className={`cmp-body${detail ? ` cmp-body--detail s-${slot} is-${status}` : ''}`}>
      <div className="cmp-status">
        {detail && <span className="cmp-body-name">{SLOT_NAME[slot]}, {clock(view.time)}</span>}
        <span className={`status-word status-word--${status}`}>
          {status === 'given' ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : status === 'late' || status === 'missed' ? <Clock size={14} strokeWidth={2.25} aria-hidden="true" /> : null}
          {status === 'given' && person && detail && log ? `Given by ${person.short}, ${clock(log.at)}` : STATUS_WORD[status]}
        </span>
      </div>

      <ul className="cmp-meds" aria-label={`${SLOT_NAME[slot]} tablets`}>
        {meds.map(({ med, count }) => (
          <li key={med.id}>
            <Pill shape={med.shape} colour={med.colour} size={14} />
            <span className="cmp-med-name">{med.name}</span>
            <span className="cmp-med-dose">{med.strength}{count > 1 ? ` × ${count}` : ''}</span>
          </li>
        ))}
        {meds.length === 0 && <li className="cmp-med-none">No tablets at this time</li>}
      </ul>

      {interactive ? (
        <footer className="cmp-foot">
          {asking ? (
            <div className="skip-ask" role="group" aria-label="Why wasn’t it taken?">
              <div className="skip-q">Why wasn’t it taken?</div>
              <div className="skip-reasons">
                {REASONS.map((r) => (
                  <button key={r} type="button" className="chip-btn" onClick={() => { onSkip?.(slot, r); setAsking(false) }}>{r}</button>
                ))}
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(false)}>Keep it open</button>
            </div>
          ) : status === 'due' || status === 'late' || status === 'missed' ? (
            <>
              <button type="button" className={`btn btn--primary cmp-give${pressing ? ' is-pressed' : ''}`} onClick={() => onGive?.(slot)} data-demo="give">
                {status === 'missed' ? 'Log as given' : 'Mark given'}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(true)}>Not taken</button>
            </>
          ) : status === 'upcoming' ? (
            <span className="cmp-opens">Opens at {clock(view.time - 60)}</span>
          ) : status === 'given' || status === 'skipped' ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onClear?.(slot)}>
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" /> {status === 'given' ? 'Undo given' : 'Undo'}
            </button>
          ) : null}
        </footer>
      ) : (
        <div className="cmp-foot cmp-foot--still" aria-hidden="true">
          {status === 'due' || status === 'late' ? (
            <span className={`btn btn--primary cmp-give${pressing ? ' is-pressed' : ''}`} data-demo="give">Mark given</span>
          ) : status === 'upcoming' ? (
            <span className="cmp-opens">Opens at {clock(view.time - 60)}</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** Mon–Sun of the week holding `date` */
export function weekOf(date: string): string[] {
  const d = fromIso(date)
  const back = (d.getDay() + 6) % 7
  const mon = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export function WeekStrip({
  selected,
  today,
  statusOf,
  onSelect,
}: {
  selected: string
  today: string
  statusOf(date: string): SlotView['status'][]
  onSelect(date: string): void
}) {
  const days = weekOf(selected)
  return (
    <div className="week" role="group" aria-label="Week">
      <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => onSelect(addDays(selected, -7))}>
        <ChevronLeft size={18} />
      </button>
      <ol className="week-days">
        {days.map((date) => {
          const st = statusOf(date)
          const given = st.filter((s) => s === 'given').length
          const real = st.filter((s) => s !== 'empty').length
          const missed = st.filter((s) => s === 'missed' || s === 'skipped').length
          const label = `${weekdayShort(date)} ${dayNum(date)}${date === today ? ', today' : ''}: ${given} of ${real} given${missed ? `, ${missed} missed` : ''}`
          return (
            <li key={date}>
              <button
                type="button"
                className={`week-day${date === selected ? ' is-selected' : ''}${date === today ? ' is-today' : ''}${date > today ? ' is-future' : ''}`}
                aria-pressed={date === selected}
                onClick={() => onSelect(date)}
              >
                <span className="week-name">{weekdayShort(date)}</span>{' '}
                <span className="week-num">{dayNum(date)}</span>
                <span className="sr-only">{label.slice(label.indexOf(':'))}</span>
                <span className="week-cells" aria-hidden="true">
                  {SLOTS.map((s, i) => (
                    <span key={s} className={`week-cell s-${s} c-${st[i]}`} />
                  ))}
                </span>
                {missed > 0 && <span className="week-missed" aria-hidden="true"><span className="week-missed-n">{missed} </span>missed</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" className="icon-btn" aria-label="Next week" onClick={() => onSelect(addDays(selected, 7))}>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
