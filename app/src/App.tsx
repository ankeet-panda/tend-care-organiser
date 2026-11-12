import { useCallback, useEffect, useState } from 'react'
import { Monitor, Moon, Sun, X } from 'lucide-react'
import { Pill } from './components/Pill'
import { useStore, useNow } from './model/store'
import { asNeededToday, dayViews, headline } from './model/derive'
import { SLOT_NAME, type Appointment, type SlotId } from './model/types'
import { clock, longDate } from './model/time'
import { useTheme, type ThemeChoice } from './theme'
import { Compartment, CompartmentBody, WeekStrip, inkOf } from './components/Organiser'
import { ComingUp, Handover, Supply, Weight } from './components/Cards'
import { ApptSheet, MedicinesSheet } from './components/Sheets'

export function App() {
  const store = useStore()
  const { data } = store
  const { today, now } = useNow()
  const [date, setDateRaw] = useState(today)
  const setDate = (d: string) => { setDateRaw(d); setPicked(null) }
  const [sheet, setSheet] = useState<null | { kind: 'meds' } | { kind: 'appt'; appt: Appointment | null }>(null)
  const closeSheet = useCallback(() => setSheet(null), [])

  const views = dayViews(data, date, today, now)
  const h = headline(views)
  const isToday = date === today
  const at = (slotTime: number) => (isToday ? now : slotTime)
  // Phones show the case as 2×2; the picked compartment's tablets and actions sit under it
  const [picked, setPicked] = useState<SlotId | null>(null)
  const pickedView = views.find((v) => v.slot === picked) ?? h.attention ?? views.find((v) => v.status === 'missed') ?? h.next ?? views[0]
  const give = (s: SlotId) => store.giveDose(date, s, at(data.slotTimes[s]))
  const skip = (s: SlotId, r: string) => store.skipDose(date, s, at(data.slotTimes[s]), r)
  const clear = (s: SlotId) => store.clearDose(date, s)

  return (
    <div className="app">
      <TopBar />
      <main className="page" id="main">
        <div className="page-head">
          <div className="page-title-block">
            <h1 className="page-title display">{longDate(date)}</h1>
            <p className="answer">
              {answerLine(h, views, date, today)}
              {!isToday && (
                <button type="button" className="btn btn--secondary btn--sm back-today" onClick={() => setDate(today)}>Back to today</button>
              )}
            </p>
          </div>
          <AsNeededCard date={date} today={today} now={now} />
        </div>

        <section className="organiser" aria-label={`Tablets for ${longDate(date)}`}>
          <div className="organiser-bar">
            <WeekStrip selected={date} today={today} onSelect={setDate} statusOf={(d) => dayViews(data, d, today, now).map((v) => v.status)} />
          </div>
          <div className="compartments">
            {views.map((v) => (
              <Compartment
                key={`${date}-${v.slot}`}
                view={v}
                people={data.people}
                onGive={give}
                onSkip={skip}
                onClear={clear}
                picked={pickedView.slot === v.slot}
                onPick={setPicked}
              />
            ))}
          </div>
          <div className="cmp-detail">
            <CompartmentBody key={`${date}-${pickedView.slot}`} view={pickedView} people={data.people} onGive={give} onSkip={skip} onClear={clear} detail />
          </div>
        </section>

        <div className="lower">
          <Handover data={data} today={today} onPost={(t) => store.addNote(t, today, now)} onDelete={store.deleteNote} />
          <Weight data={data} today={today} onLog={(kg) => store.logWeight(today, kg)} />
          <Supply data={data} today={today} onRefill={store.refill} onManage={() => setSheet({ kind: 'meds' })} />
          <ComingUp data={data} today={today} onAdd={() => setSheet({ kind: 'appt', appt: null })} onOpen={(a) => setSheet({ kind: 'appt', appt: a })} />
        </div>
        <svg className="sr-only" aria-hidden="true" focusable="false">
          <filter id="ink-rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" />
            <feDisplacementMap in="SourceGraphic" scale="1.4" />
          </filter>
        </svg>

        <footer className="page-foot">
          <p>Saved on this device only. Nothing is sent anywhere.</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={store.resetSample}>Restore the sample household</button>
        </footer>
      </main>

      {sheet?.kind === 'meds' && (
        <MedicinesSheet data={data} today={today} onClose={closeSheet} onSave={store.saveMed} onDelete={store.deleteMed} />
      )}
      {sheet?.kind === 'appt' && (
        <ApptSheet
          data={data}
          appt={sheet.appt}
          today={today}
          onClose={closeSheet}
          onSave={(a) => { store.saveAppt(a); closeSheet() }}
          onDelete={(id) => { store.deleteAppt(id); closeSheet() }}
        />
      )}
      <Toasts />
    </div>
  )
}

function answerLine(h: ReturnType<typeof headline>, views: ReturnType<typeof dayViews>, date: string, today: string): string {
  if (date > today) return `${h.total} dose times planned. Nothing to do yet.`
  if (date < today) {
    const gaps = views.filter((v) => v.status === 'missed' || v.status === 'skipped')
    if (!gaps.length) return `All ${h.total} doses were given.`
    return `${h.given} of ${h.total} given. ${gaps.map((g) => SLOT_NAME[g.slot]).join(' and ')} ${gaps.length === 1 ? 'was' : 'were'} missed.`
  }
  const count = `${h.given} of ${h.total} given.`
  if (h.attention?.status === 'late') return `${count} ${SLOT_NAME[h.attention.slot]} tablets are late, due at ${clock(h.attention.time)}.`
  if (h.attention) return `${count} ${SLOT_NAME[h.attention.slot]} tablets are due now.`
  if (h.next) return `${count} All caught up. ${SLOT_NAME[h.next.slot]} is next, at ${clock(h.next.time)}.`
  return `All of today’s tablets are given.`
}

function TopBar() {
  const { data, setMe } = useStore()
  const { choice, setChoice } = useTheme()
  const helpers = data.people.filter((p) => p.id !== 'eleanor')
  const opts: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
    { id: 'system', label: 'Match device', Icon: Monitor },
    { id: 'light', label: 'Light', Icon: Sun },
    { id: 'dark', label: 'Dark', Icon: Moon },
  ]
  return (
    <header className="topbar">
      <a className="skip" href="#main">Skip to today</a>
      <div className="brand">
        <span className="brand-name display">Tend</span>
        <span className="brand-for">
          <span className="avatar avatar--ink" style={inkOf('eleanor')} aria-hidden="true">EH</span>
          <span className="brand-for-name">{data.care.name}, {data.care.age}</span>
        </span>
      </div>
      <div className="topbar-right">
        <label className="me">
          <span className="me-label">You are</span>
          <select className="me-select" aria-label="You are" value={data.me} onChange={(e) => setMe(e.target.value)}>
            {helpers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
          </select>
        </label>
        <div className="theme-seg" role="radiogroup" aria-label="Theme">
          {opts.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={choice === id} aria-label={label} title={label} className={`theme-opt${choice === id ? ' is-on' : ''}`} onClick={() => setChoice(id)}>
              <Icon size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

function AsNeededCard({ date, today, now }: { date: string; today: string; now: number }) {
  const { data, giveAsNeeded } = useStore()
  const m = data.asNeeded[0]
  if (!m) return null
  const logs = asNeededToday(data, m.id, date)
  const last = logs[logs.length - 1]
  const isToday = date === today
  const wait = isToday && last ? last.at + m.minHoursApart * 60 - now : 0
  const atMax = logs.length >= m.maxPerDay
  const blocked = atMax || wait > 0
  const day = isToday ? 'today' : 'that day'
  const sub = logs.length ? `${logs.length} ${day}, last at ${clock(last!.at)}` : `None ${day}`
  const reason = !isToday ? '' : atMax ? `The most allowed is ${m.maxPerDay} a day` : wait > 0 ? `Next from ${clock(last!.at + m.minHoursApart * 60)}` : 'Can be given now'
  return (
    <div className="asneeded" role="group" aria-label={`${m.name}, as needed`}>
      <span className="asneeded-glyph" aria-hidden="true"><Pill shape="oval" colour="white" size={18} /></span>
      <div className="asneeded-main">
        <span className="asneeded-name">{m.name}, as needed</span>
        <span className="asneeded-sub">{m.strength} · {sub}</span>
        {reason && <span className={`asneeded-sub${blocked ? '' : ' is-ok'}`}>{reason}</span>}
      </div>
      {isToday && (
        <button type="button" className="btn btn--secondary btn--sm" aria-disabled={blocked} onClick={() => !blocked && giveAsNeeded(m.id, today, now)}>
          Log a dose
        </button>
      )}
    </div>
  )
}

function Toasts() {
  const { notices, dismiss } = useStore()
  useEffect(() => {
    const timers = notices.map((n) => window.setTimeout(() => dismiss(n.id), n.undo ? 8000 : 5000))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [notices, dismiss])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className="toast">
          <span>{n.text}</span>
          {n.undo && (
            <button type="button" className="toast-undo" onClick={() => { n.undo!(); dismiss(n.id) }}>Undo</button>
          )}
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(n.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
