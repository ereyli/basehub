import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const HOME_SCROLL_KEY = 'homeScrollSection'

/**
 * Saves location.state.fromHomeSection to sessionStorage when user navigates
 * from Home to a subpage (e.g. Gaming > Flip). When user clicks Home later,
 * we pass scrollTo so Home can scroll back to that section.
 */
export default function HomeScrollManager() {
  const location = useLocation()

  useEffect(() => {
    const from = location.state?.fromHomeSection
    if (typeof sessionStorage !== 'undefined' && from) {
      sessionStorage.setItem(HOME_SCROLL_KEY, from)
    }
  }, [location.pathname, location.state?.fromHomeSection])

  return null
}
