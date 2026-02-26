import React from 'react'
import WebHeader from './WebHeader'
import MobileHeader from './MobileHeader'

const ResponsiveHeader = ({ forceMobile = false, customWallet }) => {
  const [isMobile, setIsMobile] = React.useState(forceMobile || false)

  React.useEffect(() => {
    if (forceMobile) {
      setIsMobile(true)
      return
    }
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [forceMobile])

  if (forceMobile || isMobile) {
    return <MobileHeader customWallet={customWallet} />
  }
  return <WebHeader />
}

export default ResponsiveHeader
