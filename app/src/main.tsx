import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import { ThemeProvider } from './theme'
import { StoreProvider } from './model/store'
import { App } from './App'

function useRoute() {
  const read = () => (location.hash.startsWith('#/app') ? 'app' : 'site')
  const [r, setR] = useState(read)
  useEffect(() => {
    const on = () => {
      setR(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

function Root() {
  const route = useRoute()
  useEffect(() => {
    document.title = 'Tend · Today'
  }, [route])
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </StrictMode>,
)
