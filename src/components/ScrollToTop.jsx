import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scrolls window to top when route changes and on initial load/refresh,
 * so the site always starts at the very top (including home page refresh).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (typeof window.history.scrollRestoration === 'string') {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
