import { useId, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarPlus, MapPin, Plus, Scale, Trash2 } from 'lucide-react'
import type { Appointment, Data, Note, Person } from '../model/types'
import { supply, weightTrend } from '../model/derive'
import { clock, dayNum, weekdayShort, daysBetween, monthShort, relDay, shortDate } from '../model/time'
import { Pill } from './Pill'
import { Seal, inkOf } from './Organiser'

const personOf = (people: Person[], id: string | null) => people.find((p) => p.id === id)

/* ───────── Handover notes ───────── */

export function Handover({
  data,
  today,
  onPost,
  onDelete,
  interactive = true,
  limit,
}: {
  data: Data
  today: string
  onPost?(text: string): void
  onDelete?(id: string): void
  interactive?: boolean
  limit?: number
}) {
  const [text, setText] = useState('')
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState('')
  const fieldId = useId()
  const me = personOf(data.people, data.me)
  const notes = [...data.notes].sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1)).slice(0, limit ?? 8)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      setError('Write the note first, then post it.')
      return
    }
    onPost?.(text.trim())
    setText('')
    setError('')
    setWriting(false)
  }

  return (
    <section className="card handover" aria-labelledby="handover-title">
      <header className="card-head">
        <h2 id="handover-title" className="card-title">Handover</h2>
        <p className="card-sub">Notes for whoever is with {data.care.short} next</p>
      </header>
      {interactive && !writing && (
        <button type="button" className="write-note" onClick={() => setWriting(true)}>
          <span className="avatar avatar--ink" style={inkOf(me?.id)} aria-hidden="true">{me?.initials}</span>
          <span>Write a note for the family</span>
        </button>
      )}
      {interactive && writing && (
        <form className="compose" onSubmit={submit} noValidate>
          <label htmlFor={fieldId} className="sr-only">Note for the family</label>
          <span className="avatar avatar--ink" style={inkOf(me?.id)} aria-hidden="true">{me?.initials}</span>
          <div className="compose-box">
            <textarea
              id={fieldId}
              className="input compose-input"
              rows={3}
              autoFocus
              placeholder={`How was ${data.care.short} today?`}
              value={text}
              aria-invalid={!!error}
              aria-describedby={error ? `${fieldId}-err` : undefined}
              onChange={(e) => {
                setText(e.target.value)
                if (error) setError('')
              }}
            />
            {error && <p className="field-error" id={`${fieldId}-err`}>{error}</p>}
            <div className="compose-row">
              <span className="field-hint">Posting as {me?.short}</span>
              <span className="compose-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setWriting(false); setError('') }}>Cancel</button>
                <button type="submit" className="btn btn--secondary btn--sm">Post note</button>
              </span>
            </div>
          </div>
        </form>
      )}
      {notes[0] && <LeadNote note={notes[0]} people={data.people} today={today} mine={notes[0].by === data.me} onDelete={interactive ? onDelete : undefined} />}
      {notes.length > 1 && (
        <>
          <h3 className="notes-earlier">Earlier</h3>
          <ol className="notes">
            {notes.slice(1).map((n) => (
              <NoteItem key={n.id} note={n} people={data.people} today={today} mine={n.by === data.me} onDelete={interactive ? onDelete : undefined} />
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function LeadNote({ note, people, today, mine, onDelete }: { note: Note; people: Person[]; today: string; mine: boolean; onDelete?(id: string): void }) {
  const p = personOf(people, note.by)
  return (
    <article className="lead-note" style={inkOf(note.by)} aria-label={`Latest note, from ${p?.short ?? 'someone'}`}>
      <p className="lead-text">{note.text}</p>
      <footer className="lead-foot">
        <Seal initials={p?.initials ?? '?'} by={note.by} small />
        <span className="lead-who">
          <span className="note-who">{p?.short ?? 'Someone'}</span>
          <span className="note-when">{relDay(today, note.date)}, {clock(note.at)}</span>
        </span>
        {mine && onDelete && (
          <button type="button" className="icon-btn note-del" aria-label="Delete this note" onClick={() => onDelete(note.id)}>
            <Trash2 size={15} />
          </button>
        )}
      </footer>
    </article>
  )
}

function NoteItem({ note, people, today, mine, onDelete }: { note: Note; people: Person[]; today: string; mine: boolean; onDelete?(id: string): void }) {
  const p = personOf(people, note.by)
  return (
    <li className="note">
      <span className="avatar avatar--ink" style={inkOf(note.by)} aria-hidden="true">{p?.initials}</span>
      <div className="note-body">
        <div className="note-meta">
          <span className="note-who">{p?.short ?? 'Someone'}</span>
          <span className="note-when">{relDay(today, note.date)}, {clock(note.at)}</span>
          {mine && onDelete && (
            <button type="button" className="icon-btn note-del" aria-label="Delete this note" onClick={() => onDelete(note.id)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
        <p className="note-text">{note.text}</p>
      </div>
    </li>
  )
}

/* ───────── Morning weight ───────── */

export function Weight({ data, today, onLog, interactive = true }: { data: Data; today: string; onLog?(kg: number): void; interactive?: boolean }) {
  const t = weightTrend(data, today)
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const id = useId()
  const limit = t.base ? Math.round((t.base.kg + data.weightRule.kg) * 10) / 10 : null

  const save = (e: FormEvent) => {
    e.preventDefault()
    const kg = Number(val.replace(',', '.'))
    if (!val.trim() || !Number.isFinite(kg) || kg < 25 || kg > 250) {
      setErr('Enter the weight in kilograms, for example 64.2.')
      return
    }
    onLog?.(Math.round(kg * 10) / 10)
    setVal('')
    setErr('')
  }

  const sign = t.change > 0 ? '+' : t.change < 0 ? '−' : '±'
  return (
    <section className={`card weight${t.alert ? ' is-alert' : ''}`} aria-labelledby="weight-title">
      <header className="card-head card-head--row">
        <div>
          <h2 id="weight-title" className="card-title">Morning weight</h2>
          <p className="card-sub">Heart team: call if up {data.weightRule.kg} kg in {data.weightRule.days} days</p>
        </div>
        <Scale size={18} className="card-glyph" aria-hidden="true" />
      </header>
      {t.last ? (
        <div className="weight-figure">
          <span className="figure display">{t.last.kg.toFixed(1)}<span className="unit">kg</span></span>
          <span className={`delta${t.alert ? ' delta--alert' : t.change >= 1 ? ' delta--watch' : ''}`}>
            {sign}{Math.abs(t.change).toFixed(1)} kg since {t.base ? shortDate(t.base.date).slice(0, 3) : `${data.weightRule.days} days ago`}
          </span>
        </div>
      ) : (
        <p className="empty-line">No weights logged yet.</p>
      )}
      {t.base && t.last && t.base.date !== t.last.date && (
        <ul className="weight-recent" aria-label={`Weigh-ins since ${shortDate(t.base.date)}`}>
          {t.series.filter((p) => p.date >= t.base!.date).slice(-4).map((p) => (
            <li key={p.date}>
              <span className="wr-day">{p.date === today ? 'Today' : weekdayShort(p.date)}</span>
              <span className="wr-kg">{p.kg.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
      {t.alert && (
        <p className="weight-alert" role="status">
          <AlertTriangle size={16} aria-hidden="true" /> Up {t.change.toFixed(1)} kg since {shortDate(t.base!.date)}. Call the heart failure nurse today.
        </p>
      )}
      {t.series.length > 1 && <WeightChart series={t.series} limit={limit} today={today} base={t.base} />}
      {interactive && !t.loggedToday && (
        <form className="weight-log" onSubmit={save} noValidate>
          <label htmlFor={id} className="sr-only">Today’s weight in kilograms</label>
          <div className="input-unit">
            <input
              id={id}
              className="input"
              inputMode="decimal"
              placeholder="Today’s weight"
              value={val}
              aria-invalid={!!err}
              aria-describedby={err ? `${id}-err` : undefined}
              onChange={(e) => { setVal(e.target.value); if (err) setErr('') }}
            />
            <span aria-hidden="true">kg</span>
          </div>
          <button type="submit" className="btn btn--secondary btn--sm">Log weight</button>
          {err && <p className="field-error weight-err" id={`${id}-err`}>{err}</p>}
        </form>
      )}
      {interactive && t.loggedToday && <p className="card-foot-note">Logged today, {shortDate(today)}.</p>}
    </section>
  )
}

function WeightChart({ series, limit, today, base }: { series: { date: string; kg: number }[]; limit: number | null; today: string; base: { date: string; kg: number } | null }) {
  const W = 320
  const H = 112
  const padT = 14
  const padB = 10
  const kgs = series.map((p) => p.kg)
  const lo = Math.min(...kgs) - 0.5
  const hi = Math.max(limit ?? Math.max(...kgs), Math.max(...kgs)) + 0.8
  const first = series[0]
  const last = series[series.length - 1]
  const span = Math.max(1, daysBetween(first.date, last.date))
  const x = (d: string) => 8 + (daysBetween(first.date, d) / span) * (W - 16)
  const y = (kg: number) => padT + (1 - (kg - lo) / (hi - lo)) * (H - padT - padB)
  const pts = series.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`)
  const line = `M${pts.join('L')}`
  const area = `${line}L${x(last.date).toFixed(1)},${H}L${x(first.date).toFixed(1)},${H}Z`
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  return (
    <figure className="weight-chart">
      <div className="wc-plot">
        <div className="wc-area">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wfade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--morning-mark)" stopOpacity="0.24" />
              <stop offset="1" stopColor="var(--morning-mark)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {limit && <line x1="0" x2={W} y1={y(limit)} y2={y(limit)} className="wc-limit" vectorEffect="non-scaling-stroke" />}
          <path d={area} fill="url(#wfade)" />
          <path d={line} className="wc-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {limit && (
          <span className="wc-limit-label" style={{ top: pct(y(limit), H) }}>Call above {limit.toFixed(1)} kg</span>
        )}
        {base && base.date !== last.date && (
          <>
            <span className="wc-dot wc-dot--first" style={{ left: pct(x(base.date), W), top: pct(y(base.kg), H) }} aria-hidden="true" />
            <span className="wc-val wc-val--first" style={{ left: pct(x(base.date), W), top: pct(y(base.kg), H) }} aria-hidden="true">{base.kg.toFixed(1)}</span>
          </>
        )}
        <span className="wc-dot" style={{ left: pct(x(last.date), W), top: pct(y(last.kg), H) }} aria-hidden="true" />
        <span className="wc-val wc-val--last" style={{ left: pct(x(last.date), W), top: pct(y(last.kg), H) }} aria-hidden="true">{last.kg.toFixed(1)}</span>
        </div>
      </div>
      <figcaption className="wc-axis">
        <span>{shortDate(first.date)}</span>
        <span>{last.date === today ? 'Today' : shortDate(last.date)}</span>
      </figcaption>
      <table className="sr-only">
        <caption>Daily weight, last {series.length} days</caption>
        <tbody>{series.map((p) => <tr key={p.date}><th scope="row">{shortDate(p.date)}</th><td>{p.kg.toFixed(1)} kg</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

/* ───────── Tablets in the house ───────── */

export function Supply({ data, today, onRefill, onManage, interactive = true }: { data: Data; today: string; onRefill?(id: string, n: number): void; onManage?(): void; interactive?: boolean }) {
  const rows = data.meds.map((m) => ({ m, s: supply(m, today) })).sort((a, b) => a.s.days - b.s.days)
  const [open, setOpen] = useState<string | null>(null)
  const [count, setCount] = useState('28')
  const [err, setErr] = useState('')
  const urgent = rows.filter((r) => r.s.level !== 'ok').length

  return (
    <section className="card supply" aria-labelledby="supply-title">
      <header className="card-head card-head--row">
        <div>
          <h2 id="supply-title" className="card-title">Tablets in the house</h2>
          <p className="card-sub">{urgent ? `${urgent} to order in the next week` : 'Nothing to order in the next week'}</p>
        </div>
        {interactive && (
          <button type="button" className="link-btn" onClick={onManage}>All medicines</button>
        )}
      </header>
      <ul className="supply-list">
        {rows.slice(0, interactive ? rows.length : 4).map(({ m, s }) => {
          const pct = Math.min(1, s.days / 28)
          return (
            <li key={m.id} className={`supply-row lvl-${s.level}`}>
              <Pill shape={m.shape} colour={m.colour} size={18} />
              <div className="supply-main">
                <div className="supply-line">
                  <span className="supply-name">{m.name}</span>
                  <span className="supply-days">{Number.isFinite(s.days) ? `${s.days} ${s.days === 1 ? 'day' : 'days'} left` : 'Not in use'}</span>
                </div>
                {s.level !== 'ok' && (
                  <div className="meter" aria-hidden="true">
                    <span className="meter-zone" style={{ width: `${(7 / 28) * 100}%` }} />
                    <span className="meter-fill" style={{ width: `${pct * 100}%` }} />
                  </div>
                )}
                {s.level !== 'ok' ? (
                  <div className="supply-sub">
                    {s.orderBy ? (s.orderBy <= today ? 'Order a repeat today' : `Order by ${relDay(today, s.orderBy)}`) : ''}
                    <span className="supply-stock"> · {m.stock} in stock</span>
                  </div>
                ) : null}
                {interactive && open !== m.id && s.level !== 'ok' && (
                  <button type="button" className="btn btn--secondary btn--sm supply-refill" onClick={() => { setOpen(m.id); setCount('28'); setErr('') }}>
                    Refill collected<span className="sr-only"> for {m.name}</span>
                  </button>
                )}
                {interactive && open === m.id && (
                  <form
                    className="refill"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault()
                      const n = Number(count)
                      if (!Number.isInteger(n) || n < 1 || n > 500) {
                        setErr('Enter how many tablets came, from 1 to 500.')
                        return
                      }
                      onRefill?.(m.id, n)
                      setOpen(null)
                      setErr('')
                    }}
                  >
                    <label className="sr-only" htmlFor={`refill-${m.id}`}>Tablets collected</label>
                    <input id={`refill-${m.id}`} className="input" inputMode="numeric" value={count} onChange={(e) => { setCount(e.target.value); setErr('') }} aria-invalid={!!err} />
                    <button type="submit" className="btn btn--secondary btn--sm">Add to stock</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setOpen(null); setErr('') }}>Cancel</button>
                    {err && <p className="field-error refill-err">{err}</p>}
                  </form>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ───────── Coming up ───────── */

export function ComingUp({ data, today, onAdd, onOpen, interactive = true }: { data: Data; today: string; onAdd?(): void; onOpen?(a: Appointment): void; interactive?: boolean }) {
  const upcoming = data.appts.filter((a) => a.date >= today).sort((a, b) => (a.date === b.date ? a.time - b.time : a.date < b.date ? -1 : 1))
  return (
    <section className="card coming" aria-labelledby="coming-title">
      <header className="card-head card-head--row">
        <div>
          <h2 id="coming-title" className="card-title">Coming up</h2>
          <p className="card-sub">{upcoming.length ? `${upcoming.length} appointment${upcoming.length === 1 ? '' : 's'} booked` : 'No appointments booked'}</p>
        </div>
        {interactive && (
          <button type="button" className="icon-btn" aria-label="Add an appointment" onClick={onAdd}>
            <CalendarPlus size={18} />
          </button>
        )}
      </header>
      {upcoming.length === 0 ? (
        <div className="empty-block">
          <p>Clinic letters and home visits go here, with who is going.</p>
          {interactive && <button type="button" className="btn btn--secondary btn--sm" onClick={onAdd}><Plus size={15} aria-hidden="true" /> Add appointment</button>}
        </div>
      ) : (
        <ol className="appts">
          {upcoming.slice(0, 3).map((a) => {
            const p = personOf(data.people, a.escort)
            const inner = (
              <>
                <span className="leaf" aria-hidden="true">
                  <span className="leaf-day">{dayNum(a.date)}</span>
                  <span className="leaf-month">{monthShort(a.date)}</span>
                </span>
                <span className="appt-main">
                  <span className="appt-title">{a.title}</span>
                  <span className="appt-when">{relDay(today, a.date)}, {clock(a.time)}</span>
                  <span className="appt-place"><MapPin size={13} aria-hidden="true" /> {a.place}</span>
                  <span className="appt-who">
                    {p ? <><span className="avatar avatar--xs avatar--ink" style={inkOf(p.id)} aria-hidden="true">{p.initials}</span> {p.short} is going</> : <span className="appt-nobody">Nobody going yet</span>}
                  </span>
                </span>
              </>
            )
            return (
              <li key={a.id}>
                {interactive ? (
                  <button type="button" className="appt" onClick={() => onOpen?.(a)}>
                    {inner}
                  </button>
                ) : (
                  <div className="appt">{inner}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

