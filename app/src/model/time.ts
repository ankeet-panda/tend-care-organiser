const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = fromIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000)
}

/** 8:12 am, 1 pm, 9:30 pm */
export function clock(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  const h12 = h % 12 === 0 ? 12 : h % 12
  const ap = h < 12 ? 'am' : 'pm'
  return m === 0 ? `${h12} ${ap}` : `${h12}:${pad(m)} ${ap}`
}

/** 8:12 without the am/pm, for tight stamps */
export function clockShort(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)}`
}

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const weekday = (s: string) => WD[fromIso(s).getDay()]
export const weekdayShort = (s: string) => WD[fromIso(s).getDay()].slice(0, 3)
export const monthShort = (s: string) => MO[fromIso(s).getMonth()].slice(0, 3)
export const dayNum = (s: string) => fromIso(s).getDate()

/** Thursday 6 November */
export const longDate = (s: string) => `${weekday(s)} ${dayNum(s)} ${MO[fromIso(s).getMonth()]}`
/** Thu 6 Nov */
export const shortDate = (s: string) => `${weekdayShort(s)} ${dayNum(s)} ${monthShort(s)}`

/** Today, Tomorrow, Yesterday, In 5 days, Thu 13 Nov */
export function relDay(today: string, s: string): string {
  const n = daysBetween(today, s)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1 && n < 7) return weekday(s)
  return shortDate(s)
}

export function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

export const toInputTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
