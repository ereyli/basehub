import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const SCROLL_POS_KEY = 'scrollPos'

function scrollToTop() {
  window.scrollTo(0, 0)
  if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0
  if (document.body.scrollTop !== 0) document.body.scrollTop = 0
}

/**
 * Professional SPA scroll management:
 * - PUSH / REPLACE (link click, navigate()): scroll to top.
 * - POP (browser back/forward, navigate(-1)): restore saved scroll position.
 * - Page refresh: always starts at top (index.html + scrollRestoration = 'manual').
 * Scroll positions are saved continuously while the user scrolls on each page.
 */
export default function ScrollToTop() {
  const location = useLocation()
  const { pathname, key } = location
  const navType = useNavigationType()
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    if (typeof window.history.scrollRestoration === 'string') {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // Continuously save scroll position for current pathname
  useEffect(() => {
    pathnameRef.current = pathname
    let tick = null
    const save = () => {
      if (tick) return
      tick = requestAnimationFrame(() => {
        tick = null
        try {
          const y = window.scrollY || document.documentElement.scrollTop || 0
          sessionStorage.setItem(SCROLL_POS_KEY + ':' + pathnameRef.current, String(y))
        } catch (e) { /* sessionStorage full or unavailable */ }
      })
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      window.removeEventListener('scroll', save)
      if (tick) cancelAnimationFrame(tick)
    }
  }, [pathname])

  // On route change: restore scroll on POP, scroll to top on PUSH/REPLACE
  useEffect(() => {
    if (navType === 'POP') {
      try {
        const saved = sessionStorage.getItem(SCROLL_POS_KEY + ':' + pathname)
        if (saved !== null) {
          const y = parseInt(saved, 10)
          if (!Number.isNaN(y) && y > 0) {
            requestAnimationFrame(() => {
              window.scrollTo(0, y)
              requestAnimationFrame(() => window.scrollTo(0, y))
              setTimeout(() => window.scrollTo(0, y), 100)
            })
            return
          }
        }
      } catch (e) { /* sessionStorage unavailable */ }
    }

    // Don't reset scroll if a component will handle its own scrolling (e.g. Home scrollTo section)
    if (location.state?.scrollTo) return

    scrollToTop()
    requestAnimationFrame(() => {
      scrollToTop()
      setTimeout(scrollToTop, 80)
    })
  }, [pathname, key, navType, location.state])

  return null
}
