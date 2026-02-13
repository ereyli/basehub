import React, { createContext, useContext, useState } from 'react'

const FastDeployContext = createContext(null)

export function FastDeployProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)
  return (
    <FastDeployContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </FastDeployContext.Provider>
  )
}

export function useFastDeployModal() {
  const ctx = useContext(FastDeployContext)
  if (!ctx) return { isOpen: false, openModal: () => {}, closeModal: () => {} }
  return ctx
}
