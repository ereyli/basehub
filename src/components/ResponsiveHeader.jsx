import React from 'react'
import WebHeader from './WebHeader'
import MobileHeader from './MobileHeader'

const ResponsiveHeader = () => {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    // Initial check
    checkMobile()
    
    // Listen to resize
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile ? <MobileHeader /> : <WebHeader />
}

export default ResponsiveHeader
