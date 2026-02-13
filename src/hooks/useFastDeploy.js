import { useState, useCallback } from 'react'
import { useDeployToken } from './useDeployToken'
import { useDeployERC721 } from './useDeployERC721'
import { useDeployERC1155 } from './useDeployERC1155'

/** Default params; same XP as manual deploy (850 XP per deploy) */
const FAST_DEPLOY_DEFAULTS = {
  erc20: { name: 'BaseHub Token', symbol: 'BHT', initialSupply: 1000000 },
  erc721: { name: 'BaseHub NFT', symbol: 'BHN', imageFile: null },
  erc1155: { name: 'BaseHub Multi', symbol: 'BHM', uri: 'https://basehub.xyz/metadata/' },
}

export function useFastDeploy() {
  const { deployToken } = useDeployToken()
  const { deployERC721 } = useDeployERC721()
  const { deployERC1155 } = useDeployERC1155()

  const [isRunning, setIsRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])

  const startFastDeploy = useCallback(async () => {
    setIsRunning(true)
    setStep(0)
    setError(null)
    setResults([])

    const { erc20, erc721, erc1155 } = FAST_DEPLOY_DEFAULTS
    const out = []

    try {
      setStep(1)
      const r0 = await deployToken(erc20.name, erc20.symbol, erc20.initialSupply)
      out.push({ type: 'ERC20', ...r0 })

      setStep(2)
      const r1 = await deployERC721(erc721.name, erc721.symbol, erc721.imageFile)
      out.push({ type: 'ERC721', ...r1 })

      setStep(3)
      const r2 = await deployERC1155(erc1155.name, erc1155.symbol, erc1155.uri)
      out.push({ type: 'ERC1155', ...r2 })

      setResults(out)
      setStep(0)
      return out
    } catch (err) {
      setError(err?.message || 'Deploy failed')
      setResults(out)
      throw err
    } finally {
      setIsRunning(false)
    }
  }, [deployToken, deployERC721, deployERC1155])

  return {
    startFastDeploy,
    isRunning,
    step,
    error,
    results,
  }
}
