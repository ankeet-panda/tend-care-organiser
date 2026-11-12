import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronRight, Plus, X } from 'lucide-react'
import type { Appointment, Data, Medicine, PillColour, PillShape, SlotId } from '../model/types'
import { SLOT_NAME, SLOTS } from '../model/types'
import { perDay, supply } from '../model/derive'
import { clock, parseClock, toInputTime } from '../model/time'
import { newId } from '../model/store'
import { Pill } from './Pill'

/* ───────── Sheet: a side drawer on wide screens, a bottom sheet on phones ───────── */

export function Sheet({ title, onClose, children, footer }: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current!
    const first = el.querySelector<HTMLElement>('input, select, textarea, button:not(.sheet-close)')
    ;(first ?? el).focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab') {
        const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        if (!items.length) return
        const a = items[0]
        const z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="sheet-layer">
      <button type="button" className="scrim" tabIndex={-1} aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <header className="sheet-head">
          <h2 id={titleId} className="sheet-title">{title}</h2>
          <button type="button" className="icon-btn sheet-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}

/* ───────── Medicines ───────── */

const SHAPES: { id: PillShape; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'oval', label: 'Oval' },
  { id: 'capsule', label: 'Capsule' },
]
const COLOURS: PillColour[] = ['white', 'cream', 'yellow', 'peach', 'pink', 'blue']

export function MedicinesSheet({ data, today, onClose, onSave, onDelete }: { data: Data; today: string; onClose(): void; onSave(m: Medicine): void; onDelete(id: string): void }) {
  const [editing, setEditing] = useState<Medicine | null>(null)
  if (editing) {
    return (
      <MedEditor
        med={editing}
        isNew={!data.meds.some((m) => m.id === editing.id)}
        onBack={() => setEditing(null)}
        onClose={onClose}
        onSave={(m) => { onSave(m); setEditing(null) }}
        onDelete={(id) => { onDelete(id); setEditing(null) }}
      />
    )
  }
  const blank: Medicine = { id: newId('m'), name: '', strength: '', purpose: '', shape: 'round', colour: 'white', doses: { morning: 1 }, stock: 28 }
  return (
    <Sheet
      title="Medicines"
      onClose={onClose}
      footer={<button type="button" className="btn btn--primary btn--block" onClick={() => setEditing(blank)}><Plus size={16} aria-hidden="true" /> Add a medicine</button>}
    >
      <p className="sheet-lead">Everything in the organiser. Change a dose when the doctor does.</p>
      <ul className="med-list">
        {data.meds.map((m) => {
          const s = supply(m, today)
          return (
            <li key={m.id}>
              <button type="button" className="med-row" onClick={() => setEditing(m)}>
                <span className="med-pill"><Pill shape={m.shape} colour={m.colour} size={22} /></span>
                <span className="med-main">
                  <span className="med-name">{m.name} <span className="med-strength">{m.strength}</span></span>
                  <span className="med-sub">{m.purpose}</span>
                  <span className="med-slots">
                    {SLOTS.filter((k) => m.doses[k]).map((k) => (
                      <span key={k} className={`slot-chip s-${k}`}>{SLOT_NAME[k]}{(m.doses[k] ?? 0) > 1 ? ` × ${m.doses[k]}` : ''}</span>
                    ))}
                  </span>
                </span>
                <span className={`med-days lvl-${s.level}`}>{Number.isFinite(s.days) ? `${s.days} days` : '—'}</span>
                <ChevronRight size={16} className="med-chev" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

function MedEditor({ med, isNew, onBack, onClose, onSave, onDelete }: { med: Medicine; isNew: boolean; onBack(): void; onClose(): void; onSave(m: Medicine): void; onDelete(id: string): void }) {
  const [m, setM] = useState<Medicine>(med)
  const [stock, setStock] = useState(String(med.stock))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmStop, setConfirmStop] = useState(false)
  const id = useId()
  const set = (patch: Partial<Medicine>) => setM((x) => ({ ...x, ...patch }))
  const setDose = (k: SlotId, n: number) => setM((x) => ({ ...x, doses: { ...x.doses, [k]: Math.max(0, Math.min(4, n)) || undefined } }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!m.name.trim()) errs.name = 'Enter the name on the box.'
    if (!m.strength.trim()) errs.strength = 'Enter the strength, for example 40 mg.'
    const n = Number(stock)
    if (!Number.isInteger(n) || n < 0 || n > 2000) errs.stock = 'Enter how many tablets are in the house.'
    if (!perDay(m)) errs.doses = 'Choose at least one time of day.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = document.getElementById(`${id}-${Object.keys(errs)[0]}`)
      first?.focus()
      return
    }
    onSave({ ...m, name: m.name.trim(), strength: m.strength.trim(), purpose: m.purpose.trim(), stock: n })
  }

  const err = (k: string) => (errors[k] ? <p className="field-error" id={`${id}-${k}-err`}>{errors[k]}</p> : null)
  const desc = (k: string) => (errors[k] ? `${id}-${k}-err` : undefined)

  return (
    <Sheet
      title={isNew ? 'Add a medicine' : m.name || 'Medicine'}
      onClose={onClose}
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>Back</button>
          <button type="submit" form={`${id}-form`} className="btn btn--primary">{isNew ? 'Add to organiser' : 'Save changes'}</button>
        </div>
      }
    >
      <form id={`${id}-form`} className="form" onSubmit={submit} noValidate>
        <div className="form-preview" aria-hidden="true">
          <span className="form-preview-tray"><Pill shape={m.shape} colour={m.colour} size={56} /></span>
          <span className="form-preview-name">{m.name || 'New medicine'}{m.strength ? ` ${m.strength}` : ''}</span>
        </div>
        <label className="field">
          <span>Name</span>
          <input id={`${id}-name`} className="input" value={m.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={desc('name')} autoComplete="off" />
          {err('name')}
        </label>
        <div className="form-row">
          <label className="field">
            <span>Strength</span>
            <input id={`${id}-strength`} className="input" value={m.strength} onChange={(e) => set({ strength: e.target.value })} aria-invalid={!!errors.strength} aria-describedby={desc('strength')} placeholder="40 mg" autoComplete="off" />
            {err('strength')}
          </label>
          <label className="field">
            <span>Tablets in the house</span>
            <input id={`${id}-stock`} className="input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} aria-invalid={!!errors.stock} aria-describedby={desc('stock')} />
            {err('stock')}
          </label>
        </div>
        <label className="field">
          <span>What it’s for <em className="opt">(optional)</em></span>
          <input className="input" value={m.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Water tablet, eases fluid" autoComplete="off" />
        </label>

        <fieldset className="field fieldset" aria-describedby={desc('doses')}>
          <legend>When she takes it</legend>
          <div className="dose-grid" id={`${id}-doses`} tabIndex={-1}>
            {SLOTS.map((k) => {
              const n = m.doses[k] ?? 0
              return (
                <div key={k} className={`dose-cell s-${k}${n ? ' is-on' : ''}`}>
                  <span className="dose-name">{SLOT_NAME[k]}</span>
                  <span className="stepper">
                    <button type="button" className="icon-btn" aria-label={`One fewer at ${SLOT_NAME[k].toLowerCase()}`} disabled={n === 0} onClick={() => setDose(k, n - 1)}>−</button>
                    <output aria-live="polite" aria-label={`${SLOT_NAME[k]}: ${n} tablets`}>{n}</output>
                    <button type="button" className="icon-btn" aria-label={`One more at ${SLOT_NAME[k].toLowerCase()}`} disabled={n === 4} onClick={() => setDose(k, n + 1)}>+</button>
                  </span>
                </div>
              )
            })}
          </div>
          {err('doses')}
        </fieldset>

        <fieldset className="field fieldset">
          <legend>What it looks like</legend>
          <div className="seg" role="radiogroup" aria-label="Shape">
            {SHAPES.map((s) => (
              <label key={s.id} className={`seg-opt${m.shape === s.id ? ' is-on' : ''}`}>
                <input type="radio" name={`${id}-shape`} checked={m.shape === s.id} onChange={() => set({ shape: s.id })} />
                {s.label}
              </label>
            ))}
          </div>
          <div className="swatches" role="radiogroup" aria-label="Colour">
            {COLOURS.map((c) => (
              <label key={c} className={`swatch${m.colour === c ? ' is-on' : ''}`}>
                <input type="radio" name={`${id}-colour`} checked={m.colour === c} onChange={() => set({ colour: c })} aria-label={c} />
                <span className="swatch-dot" style={{ background: `var(--pill-${c})` }} aria-hidden="true" />
              </label>
            ))}
            <span className="swatch-name">{m.colour[0].toUpperCase() + m.colour.slice(1)}</span>
          </div>
        </fieldset>

        <label className="check">
          <input type="checkbox" checked={!!m.withFood} onChange={(e) => set({ withFood: e.target.checked })} />
          <span>Take with food</span>
        </label>

        {!isNew && (
          <div className="danger-zone">
            {confirmStop ? (
              <div className="confirm-row" role="group" aria-label={`Stop ${m.name}?`}>
                <span>Stop {m.name} and take it out of the organiser?</span>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setConfirmStop(false)}>Keep it</button>
                <button type="button" className="btn btn--sm btn--stop" onClick={() => onDelete(m.id)}>Stop {m.name}</button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost btn--danger btn--sm" onClick={() => setConfirmStop(true)}>Stop this medicine</button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}

/* ───────── Appointment ───────── */

export function ApptSheet({ data, appt, today, onClose, onSave, onDelete }: { data: Data; appt: Appointment | null; today: string; onClose(): void; onSave(a: Appointment): void; onDelete(id: string): void }) {
  const isNew = !appt
  const [a, setA] = useState<Appointment>(appt ?? { id: newId('p'), date: today, time: 10 * 60, title: '', withWhom: '', place: '', escort: data.me, prep: '' })
  const [time, setTime] = useState(toInputTime(a.time))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const id = useId()
  const set = (p: Partial<Appointment>) => setA((x) => ({ ...x, ...p }))
  const helpers = data.people.filter((p) => p.id !== 'eleanor')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!a.title.trim()) errs.title = 'Say what the appointment is.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) errs.date = 'Choose the date.'
    const t = parseClock(time)
    if (t === null) errs.time = 'Choose the time.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`${id}-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    onSave({ ...a, time: t!, title: a.title.trim(), place: a.place.trim(), withWhom: a.withWhom.trim(), prep: a.prep?.trim() })
  }
  const err = (k: string) => (errors[k] ? <p className="field-error" id={`${id}-${k}-err`}>{errors[k]}</p> : null)

  return (
    <Sheet
      title={isNew ? 'Add an appointment' : a.title || 'Appointment'}
      onClose={onClose}
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form={`${id}-form`} className="btn btn--primary">{isNew ? 'Add appointment' : 'Save changes'}</button>
        </div>
      }
    >
      <form id={`${id}-form`} className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>What is it</span>
          <input id={`${id}-title`} className="input" value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder="Heart clinic review" aria-invalid={!!errors.title} aria-describedby={errors.title ? `${id}-title-err` : undefined} autoComplete="off" />
          {err('title')}
        </label>
        <div className="form-row">
          <label className="field">
            <span>Date</span>
            <input id={`${id}-date`} type="date" className="input" value={a.date} onChange={(e) => set({ date: e.target.value })} aria-invalid={!!errors.date} />
            {err('date')}
          </label>
          <label className="field">
            <span>Time</span>
            <input id={`${id}-time`} type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={!!errors.time} />
            {err('time')}
          </label>
        </div>
        <label className="field">
          <span>Who with <em className="opt">(optional)</em></span>
          <input className="input" value={a.withWhom} onChange={(e) => set({ withWhom: e.target.value })} placeholder="Dr Adeyemi, cardiology" autoComplete="off" />
        </label>
        <label className="field">
          <span>Where <em className="opt">(optional)</em></span>
          <input className="input" value={a.place} onChange={(e) => set({ place: e.target.value })} placeholder="Outpatients B" autoComplete="off" />
        </label>
        <fieldset className="field fieldset">
          <legend>Who is going with {data.care.short}</legend>
          <div className="seg seg--wrap" role="radiogroup">
            {helpers.map((p) => (
              <label key={p.id} className={`seg-opt${a.escort === p.id ? ' is-on' : ''}`}>
                <input type="radio" name={`${id}-escort`} checked={a.escort === p.id} onChange={() => set({ escort: p.id })} />
                {p.short}
              </label>
            ))}
            <label className={`seg-opt${a.escort === null ? ' is-on' : ''}`}>
              <input type="radio" name={`${id}-escort`} checked={a.escort === null} onChange={() => set({ escort: null })} />
              Not decided
            </label>
          </div>
        </fieldset>
        <label className="field">
          <span>To remember <em className="opt">(optional)</em></span>
          <textarea className="input" rows={2} value={a.prep ?? ''} onChange={(e) => set({ prep: e.target.value })} placeholder="Bring the weight diary" />
        </label>
        {!isNew && (
          <div className="danger-zone">
            {confirm ? (
              <div className="confirm-row" role="group" aria-label="Remove appointment?">
                <span>Remove {a.title} on {clock(a.time)}?</span>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setConfirm(false)}>Keep it</button>
                <button type="button" className="btn btn--sm btn--stop" onClick={() => onDelete(a.id)}>Remove appointment</button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost btn--danger btn--sm" onClick={() => setConfirm(true)}>Remove this appointment</button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}
