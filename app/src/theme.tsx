import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'tend.theme'

const Ctx = createContext<{ choice: ThemeChoice; resolved: 'light' | 'dark'; setChoice(c: ThemeChoice): void }>({
  choice: 'system',
  resolved: 'light',
  setChoice: () => {},
})

export const useTheme = () => useContext(Ctx)

function initial(): ThemeChoice {
  const forced = new URLSearchParams(location.search).get('theme')
  if (forced === 'light' || forced === 'dark') return forced
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* storage blocked */ }
  return 'system'
}

// Set the theme before the first paint, so a dark device never flashes the light page
{
  const c = initial()
  const dark = c === 'dark' || (c === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(initial)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSystemDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c)
    try { localStorage.setItem(KEY, c) } catch { /* storage blocked */ }
  }
  return <Ctx.Provider value={{ choice, resolved, setChoice }}>{children}</Ctx.Provider>
}
