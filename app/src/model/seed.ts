import type { Data, DoseLog, Note } from './types'
import { addDays, fromIso } from './time'

/**
 * Sample household, built relative to today so the screen always shows a believable day.
 * Names and places are invented. `now` is minutes after midnight.
 */
export function seed(today: string, now: number): Data {
  const slotTimes = { morning: 8 * 60, midday: 13 * 60, evening: 18 * 60, bedtime: 21 * 60 + 30 }

  const logs: DoseLog[] = []
  let n = 0
  // The last 13 days: all given, by whoever was there, except one midday dose four days ago.
  for (let back = 13; back >= 1; back--) {
    const date = addDays(today, -back)
    const weekend = [0, 6].includes(fromIso(date).getDay())
    const morningBy = weekend ? 'priya' : 'agnes'
    logs.push({ id: `l${++n}`, date, slot: 'morning', by: morningBy, at: 8 * 60 + 6 + (back % 4) * 3, status: 'given' })
    if (back !== 4) logs.push({ id: `l${++n}`, date, slot: 'midday', by: 'eleanor', at: 13 * 60 + 10 + (back % 3) * 5, status: 'given' })
    logs.push({ id: `l${++n}`, date, slot: 'evening', by: back % 3 === 0 ? 'sam' : 'priya', at: 18 * 60 + 12 + (back % 5) * 4, status: 'given' })
    logs.push({ id: `l${++n}`, date, slot: 'bedtime', by: 'priya', at: 21 * 60 + 34 + (back % 4) * 2, status: 'given' })
  }
  // Today: whatever time has passed has been looked after, except the dose that is due now.
  if (now >= 8 * 60 + 30) logs.push({ id: `l${++n}`, date: today, slot: 'morning', by: 'agnes', at: 8 * 60 + 12, status: 'given' })
  if (now >= 14 * 60 + 30) logs.push({ id: `l${++n}`, date: today, slot: 'midday', by: 'eleanor', at: 13 * 60 + 18, status: 'given' })
  if (now >= 19 * 60 + 30) logs.push({ id: `l${++n}`, date: today, slot: 'evening', by: 'priya', at: 18 * 60 + 20, status: 'given' })

  // Daily weight (kg), oldest first; the heart team asked for a morning weigh-in.
  const series = [63.9, 64.0, 63.8, 63.9, 64.1, 63.9, 63.8, 63.9, 64.0, 64.1, 63.9, 64.2, 64.4, 64.6]
  const weights: Record<string, number> = {}
  series.forEach((kg, i) => {
    const date = addDays(today, i - (series.length - 1))
    if (i < series.length - 1 || now >= 8 * 60 + 30) weights[date] = kg
  })

  const notes: Note[] = [
    {
      id: 'n0',
      date: addDays(today, -2),
      at: 18 * 60 + 40,
      by: 'priya',
      text: 'Podiatry rang to book a home visit for Monday at 2. Agnes will be there to let them in.',
    },
    {
      id: 'n00',
      date: addDays(today, -1),
      at: 9 * 60 + 2,
      by: 'agnes',
      text: 'Weighed 64.4 kg. Bit breathless on the stairs, fine once sitting. Left soup in the fridge for lunch.',
    },
    {
      id: 'n1',
      date: addDays(today, -1),
      at: 19 * 60 + 5,
      by: 'sam',
      text: 'Called Mum at 7. She sounded bright and had watched the snooker. I’ll drive her to the heart clinic, so I cancelled the hospital transport.',
    },
    {
      id: 'n2',
      date: addDays(today, -1),
      at: 21 * 60 + 41,
      by: 'priya',
      text: 'Bedtime tablets done. Donepezil is getting low; I’ve asked the surgery for a repeat prescription.',
    },
  ]
  if (now >= 8 * 60 + 30) {
    notes.push({
      id: 'n3',
      date: today,
      at: 8 * 60 + 24,
      by: 'agnes',
      text: 'Morning tablets taken with porridge. Ankles look a little puffy, so I weighed her: 64.6 kg. She’s asking about Sunday lunch.',
    })
  }

  return {
    v: 1,
    me: 'priya',
    care: { name: 'Eleanor Hart', short: 'Mum', age: 84 },
    people: [
      { id: 'priya', name: 'Priya Hart', short: 'Priya', initials: 'PH', role: 'Daughter' },
      { id: 'sam', name: 'Sam Hart', short: 'Sam', initials: 'SH', role: 'Son' },
      { id: 'agnes', name: 'Agnes Mensah', short: 'Agnes', initials: 'AM', role: 'Carer, weekday mornings' },
      { id: 'eleanor', name: 'Eleanor Hart', short: 'Mum', initials: 'EH', role: 'Took it herself' },
    ],
    slotTimes,
    meds: [
      { id: 'furosemide', name: 'Furosemide', strength: '40 mg', purpose: 'Water tablet, eases fluid', shape: 'round', colour: 'white', doses: { morning: 1 }, stock: 6 },
      { id: 'bisoprolol', name: 'Bisoprolol', strength: '2.5 mg', purpose: 'Steadies the heart rate', shape: 'round', colour: 'yellow', doses: { morning: 1 }, stock: 41 },
      { id: 'metformin', name: 'Metformin', strength: '500 mg', purpose: 'Blood sugar', shape: 'oval', colour: 'white', doses: { morning: 1, evening: 1 }, stock: 38, withFood: true },
      { id: 'apixaban', name: 'Apixaban', strength: '2.5 mg', purpose: 'Blood thinner', shape: 'oval', colour: 'peach', doses: { morning: 1, evening: 1 }, stock: 30 },
      { id: 'calcium', name: 'Calcium and vitamin D', strength: 'chewable', purpose: 'Bones', shape: 'round', colour: 'pink', doses: { midday: 1 }, stock: 44, withFood: true },
      { id: 'atorvastatin', name: 'Atorvastatin', strength: '20 mg', purpose: 'Cholesterol', shape: 'oval', colour: 'cream', doses: { bedtime: 1 }, stock: 25 },
      { id: 'donepezil', name: 'Donepezil', strength: '5 mg', purpose: 'Memory', shape: 'round', colour: 'blue', doses: { bedtime: 1 }, stock: 9 },
    ],
    asNeeded: [{ id: 'paracetamol', name: 'Paracetamol', strength: '500 mg', maxPerDay: 8, minHoursApart: 4 }],
    logs,
    asNeededLogs: now >= 11 * 60 ? [{ id: 'a1', medId: 'paracetamol', date: today, at: 10 * 60 + 40, by: 'eleanor' }] : [],
    appts: [
      { id: 'p1', date: addDays(today, 3), time: 14 * 60, title: 'Podiatry home visit', withWhom: 'Community podiatrist', place: 'At home', escort: 'agnes', prep: 'Leave the side door unlocked' },
      { id: 'p2', date: addDays(today, 7), time: 10 * 60 + 40, title: 'Heart clinic review', withWhom: 'Dr Adeyemi, cardiology', place: 'St Clement’s Hospital, outpatients B', escort: 'sam', prep: 'Bring the weight diary and all tablet boxes' },
      { id: 'p3', date: addDays(today, 15), time: 9 * 60 + 20, title: 'Medicines review', withWhom: 'GP practice pharmacist', place: 'Elm Row Surgery', escort: 'priya' },
      { id: 'p0', date: addDays(today, -5), time: 11 * 60, title: 'Blood test', withWhom: 'Practice nurse', place: 'Elm Row Surgery', escort: 'priya' },
    ],
    notes,
    weights,
    weightRule: { kg: 2, days: 3 },
  }
}
