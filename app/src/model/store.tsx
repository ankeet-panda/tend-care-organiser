import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SLOT_NAME, type Appointment, type Data, type Medicine, type SlotId } from './types'
import { seed } from './seed'
import { iso } from './time'

const KEY = 'tend.data.v1'

function valid(d: unknown): d is Data {
  const x = d as Data
  return !!x && x.v === 1 && Array.isArray(x.meds) && Array.isArray(x.logs) && Array.isArray(x.people) && Array.isArray(x.notes)
}

function load(): Data | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    return valid(d) ? d : null
  } catch {
    return null
  }
}

function save(d: Data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* storage blocked (private window): the app still works for this visit */
  }
}

let counter = 0
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(++counter).toString(36)}`

export interface Notice {
  id: number
  text: string
  undo?: () => void
}

/** ?at=10:40 pins the time of day (screenshots and reviews); data is not saved in that mode */
export const pinned = (() => {
  const m = new URLSearchParams(location.search).get('at')?.match(/^(\d{1,2}):(\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
})()

const nowMinutes = () => {
  const d = new Date()
  return pinned ?? d.getHours() * 60 + d.getMinutes()
}

interface Store {
  data: Data
  setMe(id: string): void
  giveDose(date: string, slot: SlotId, at: number): void
  skipDose(date: string, slot: SlotId, at: number, reason: string): void
  clearDose(date: string, slot: SlotId): void
  giveAsNeeded(medId: string, date: string, at: number): void
  saveMed(m: Medicine): void
  deleteMed(id: string): void
  refill(id: string, count: number): void
  saveAppt(a: Appointment): void
  deleteAppt(id: string): void
  addNote(text: string, date: string, at: number): void
  deleteNote(id: string): void
  logWeight(date: string, kg: number): void
  resetSample(): void
  notices: Notice[]
  notify(text: string, undo?: () => void): void
  dismiss(id: number): void
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

/** Tablets each dose time takes from stock */
function stockChange(d: Data, slot: SlotId, sign: 1 | -1): Medicine[] {
  return d.meds.map((m) => {
    const n = m.doses[slot] ?? 0
    return n ? { ...m, stock: Math.max(0, m.stock + sign * n) } : m
  })
}

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: Data }) {
  const [data, setData] = useState<Data>(() => initial ?? ((pinned === null && load()) || seed(iso(new Date()), nowMinutes())))
  const [notices, setNotices] = useState<Notice[]>([])
  const ref = useRef(data)
  ref.current = data

  useEffect(() => {
    if (pinned === null && !initial) save(data)
  }, [data, initial])

  const notify = useCallback((text: string, undo?: () => void) => {
    const id = Date.now() + Math.random()
    // Only the newest change can be undone: an older undo would also wipe the newer change.
    setNotices((n) => [...n.slice(-1).map((x) => ({ ...x, undo: undefined })), { id, text, undo }])
  }, [])
  const dismiss = useCallback((id: number) => setNotices((n) => n.filter((x) => x.id !== id)), [])

  const commit = useCallback((next: Data) => setData(next), [])

  const store = useMemo<Store>(() => {
    const restore = (before: Data) => () => commit(before)
    const who = (d: Data, id: string) => d.people.find((p) => p.id === id)?.short ?? 'Someone'
    return {
      data,
      notices,
      notify,
      dismiss,
      setMe(id) {
        commit({ ...ref.current, me: id })
      },
      giveDose(date, slot, at) {
        const d = ref.current
        if (d.logs.some((l) => l.date === date && l.slot === slot)) return
        commit({
          ...d,
          meds: stockChange(d, slot, -1),
          logs: [...d.logs, { id: newId('l'), date, slot, by: d.me, at, status: 'given' }],
        })
        notify(`${SLOT_NAME[slot]} dose given by ${who(d, d.me)}`, restore(d))
      },
      skipDose(date, slot, at, reason) {
        const d = ref.current
        if (d.logs.some((l) => l.date === date && l.slot === slot)) return
        commit({ ...d, logs: [...d.logs, { id: newId('l'), date, slot, by: d.me, at, status: 'skipped', reason }] })
        notify('Marked as not taken', restore(d))
      },
      clearDose(date, slot) {
        const d = ref.current
        const log = d.logs.find((l) => l.date === date && l.slot === slot)
        if (!log) return
        commit({
          ...d,
          meds: log.status === 'given' ? stockChange(d, slot, 1) : d.meds,
          logs: d.logs.filter((l) => l.id !== log.id),
        })
        notify(`${log.status === 'given' ? 'Dose' : 'Note'} cleared, tablets back in the box`, restore(d))
      },
      giveAsNeeded(medId, date, at) {
        const d = ref.current
        commit({ ...d, asNeededLogs: [...d.asNeededLogs, { id: newId('a'), medId, date, at, by: d.me }] })
        const m = d.asNeeded.find((x) => x.id === medId)
        notify(`${m?.name ?? 'Dose'} logged by ${who(d, d.me)}`, restore(d))
      },
      saveMed(m) {
        const d = ref.current
        const exists = d.meds.some((x) => x.id === m.id)
        commit({ ...d, meds: exists ? d.meds.map((x) => (x.id === m.id ? m : x)) : [...d.meds, m] })
        notify(exists ? `${m.name} updated` : `${m.name} added to the organiser`, restore(d))
      },
      deleteMed(id) {
        const d = ref.current
        const m = d.meds.find((x) => x.id === id)
        if (!m) return
        commit({ ...d, meds: d.meds.filter((x) => x.id !== id) })
        notify(`${m.name} stopped and removed`, restore(d))
      },
      refill(id, count) {
        const d = ref.current
        const m = d.meds.find((x) => x.id === id)
        if (!m) return
        commit({ ...d, meds: d.meds.map((x) => (x.id === id ? { ...x, stock: x.stock + count } : x)) })
        notify(`${count} ${m.name} added to stock`, restore(d))
      },
      saveAppt(a) {
        const d = ref.current
        const exists = d.appts.some((x) => x.id === a.id)
        commit({ ...d, appts: exists ? d.appts.map((x) => (x.id === a.id ? a : x)) : [...d.appts, a] })
        notify(exists ? 'Appointment updated' : 'Appointment added', restore(d))
      },
      deleteAppt(id) {
        const d = ref.current
        const a = d.appts.find((x) => x.id === id)
        if (!a) return
        commit({ ...d, appts: d.appts.filter((x) => x.id !== id) })
        notify(`${a.title} removed`, restore(d))
      },
      addNote(text, date, at) {
        const d = ref.current
        commit({ ...d, notes: [...d.notes, { id: newId('n'), date, at, by: d.me, text }] })
      },
      deleteNote(id) {
        const d = ref.current
        commit({ ...d, notes: d.notes.filter((x) => x.id !== id) })
        notify('Note deleted', restore(d))
      },
      logWeight(date, kg) {
        const d = ref.current
        commit({ ...d, weights: { ...d.weights, [date]: kg } })
      },
      resetSample() {
        const d = ref.current
        commit(seed(iso(new Date()), nowMinutes()))
        notify('Sample household restored', restore(d))
      },
    }
  }, [data, notices, notify, dismiss, commit])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

/** The current minute and date, ticking every 20 s */
export function useNow(): { today: string; now: number } {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const i = window.setInterval(() => setT(new Date()), 20_000)
    return () => window.clearInterval(i)
  }, [])
  return { today: iso(t), now: pinned ?? t.getHours() * 60 + t.getMinutes() }
}
