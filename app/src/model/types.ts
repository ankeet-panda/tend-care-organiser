export type SlotId = 'morning' | 'midday' | 'evening' | 'bedtime'
export const SLOTS: SlotId[] = ['morning', 'midday', 'evening', 'bedtime']
export const SLOT_NAME: Record<SlotId, string> = {
  morning: 'Morning',
  midday: 'Midday',
  evening: 'Evening',
  bedtime: 'Bedtime',
}

export type PillShape = 'round' | 'oval' | 'capsule'
export type PillColour = 'white' | 'cream' | 'yellow' | 'peach' | 'pink' | 'blue'

export interface Person {
  id: string
  name: string
  /** How the family refers to them on screen */
  short: string
  initials: string
  role: string
}

export interface Medicine {
  id: string
  name: string
  strength: string
  purpose: string
  shape: PillShape
  colour: PillColour
  /** Tablets per dose time; missing = not taken then */
  doses: Partial<Record<SlotId, number>>
  /** Tablets in the house */
  stock: number
  withFood?: boolean
  note?: string
}

export interface AsNeeded {
  id: string
  name: string
  strength: string
  maxPerDay: number
  minHoursApart: number
}

export interface DoseLog {
  id: string
  date: string
  slot: SlotId
  by: string
  /** Minutes after midnight */
  at: number
  status: 'given' | 'skipped'
  reason?: string
}

export interface AsNeededLog {
  id: string
  medId: string
  date: string
  at: number
  by: string
}

export interface Appointment {
  id: string
  date: string
  /** Minutes after midnight */
  time: number
  title: string
  withWhom: string
  place: string
  /** Person going with her */
  escort: string | null
  prep?: string
}

export interface Note {
  id: string
  date: string
  at: number
  by: string
  text: string
}

export interface Data {
  v: 1
  me: string
  care: { name: string; short: string; age: number }
  people: Person[]
  slotTimes: Record<SlotId, number>
  meds: Medicine[]
  asNeeded: AsNeeded[]
  logs: DoseLog[]
  asNeededLogs: AsNeededLog[]
  appts: Appointment[]
  notes: Note[]
  /** ISO date -> kg */
  weights: Record<string, number>
  weightRule: { kg: number; days: number }
}
