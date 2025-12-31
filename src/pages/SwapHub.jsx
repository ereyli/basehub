import React from 'react'
import SwapInterface from '../components/SwapInterface'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import { shouldUseRainbowKit } from '../config/rainbowkit'

const SwapHub = () => {
  return (
    <>
      <EmbedMeta 
        title="SwapHub - DEX Aggregator"
        description="Swap tokens on Base network using Uniswap V2/V3"
        url="/swap"
      />
      <BackButton />
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        padding: shouldUseRainbowKit() ? '80px 20px 40px' : '20px',
        color: '#ffffff'
      }}>
        <SwapInterface />
      </div>
    </>
  )
}

export default SwapHub
