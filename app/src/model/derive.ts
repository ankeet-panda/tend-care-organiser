import { SLOTS, type Data, type DoseLog, type Medicine, type SlotId } from './types'
import { addDays, daysBetween } from './time'

export type SlotStatus = 'given' | 'skipped' | 'due' | 'late' | 'upcoming' | 'missed' | 'empty'

export interface SlotView {
  slot: SlotId
  time: number
  meds: { med: Medicine; count: number }[]
  tablets: number
  log?: DoseLog
  status: SlotStatus
}

/** A dose is "due" from an hour before its time until 90 minutes after; then it is late. */
export const DUE_BEFORE = 60
export const LATE_AFTER = 90

export function medsIn(d: Data, slot: SlotId) {
  return d.meds.filter((m) => (m.doses[slot] ?? 0) > 0).map((med) => ({ med, count: med.doses[slot] ?? 0 }))
}

export function slotView(d: Data, date: string, slot: SlotId, today: string, now: number): SlotView {
  const meds = medsIn(d, slot)
  const time = d.slotTimes[slot]
  const log = d.logs.find((l) => l.date === date && l.slot === slot)
  const tablets = meds.reduce((s, x) => s + x.count, 0)
  let status: SlotStatus
  if (log) status = log.status
  else if (!meds.length) status = 'empty'
  else if (date < today) status = 'missed'
  else if (date > today) status = 'upcoming'
  else if (now < time - DUE_BEFORE) status = 'upcoming'
  else if (now <= time + LATE_AFTER) status = 'due'
  else status = 'late'
  return { slot, time, meds, tablets, log, status }
}

export function dayViews(d: Data, date: string, today: string, now: number): SlotView[] {
  return SLOTS.map((s) => slotView(d, date, s, today, now))
}

export const perDay = (m: Medicine) => SLOTS.reduce((s, k) => s + (m.doses[k] ?? 0), 0)

export function supply(m: Medicine, today: string) {
  const daily = perDay(m)
  const days = daily ? Math.floor(m.stock / daily) : Infinity
  // Repeat prescriptions take about a week to come through, so order a week before running out.
  const orderBy = Number.isFinite(days) ? addDays(today, Math.max(0, days - 7)) : null
  const runsOut = Number.isFinite(days) ? addDays(today, days) : null
  const level: 'ok' | 'low' | 'urgent' = days <= 7 ? 'urgent' : days <= 14 ? 'low' : 'ok'
  return { daily, days, orderBy, runsOut, level }
}

export function weightTrend(d: Data, today: string) {
  const dates = Object.keys(d.weights).sort()
  const series = dates.slice(-14).map((date) => ({ date, kg: d.weights[date] }))
  const last = series[series.length - 1] ?? null
  const ruleStart = last ? addDays(last.date, -d.weightRule.days) : null
  const base = ruleStart ? series.find((p) => p.date >= ruleStart) ?? null : null
  const change = last && base ? Math.round((last.kg - base.kg) * 10) / 10 : 0
  const loggedToday = !!last && last.date === today
  const alert = change >= d.weightRule.kg
  const daysSince = last ? daysBetween(last.date, today) : null
  return { series, last, base, change, alert, loggedToday, daysSince }
}

export function asNeededToday(d: Data, medId: string, today: string) {
  return d.asNeededLogs.filter((l) => l.medId === medId && l.date === today).sort((a, b) => a.at - b.at)
}

/** One line that answers "is Mum looked after right now?" */
export function headline(views: SlotView[]): { given: number; total: number; next: SlotView | null; attention: SlotView | null } {
  const real = views.filter((v) => v.status !== 'empty')
  const given = real.filter((v) => v.status === 'given').length
  const attention = real.find((v) => v.status === 'late') ?? real.find((v) => v.status === 'due') ?? null
  const next = real.find((v) => v.status === 'upcoming') ?? null
  return { given, total: real.length, next, attention }
}
