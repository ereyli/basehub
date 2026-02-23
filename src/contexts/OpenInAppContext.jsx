import React, { createContext, useContext, useState } from 'react'
import OpenInAppModal from '../components/OpenInAppModal'

const OpenInAppContext = createContext(null)

export function OpenInAppProvider({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <OpenInAppContext.Provider value={{ openModal: () => setOpen(true), closeModal: () => setOpen(false) }}>
      {children}
      <OpenInAppModal open={open} onClose={() => setOpen(false)} />
    </OpenInAppContext.Provider>
  )
}

export function useOpenInApp() {
  const ctx = useContext(OpenInAppContext)
  return ctx || { openModal: () => {}, closeModal: () => {} }
}
