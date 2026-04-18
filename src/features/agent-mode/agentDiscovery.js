import { getEnabledTargets } from './agentCatalog.js'
import {
  resolveFreeMintOpportunities,
  resolvePumpHubOpportunities,
  resolvePumpHubSellableOpportunities,
  resolveSwapHubOpportunities,
} from './agentOpportunities.js'

function createBaseOpportunity(target, overrides = {}) {
  return {
    targetId: target.id,
    title: target.title,
    category: target.type,
    source: 'static',
    available: true,
    priorityScore: 0.4,
    summary: target.summary,
    payload: {},
    ...overrides,
  }
}

export async function discoverBaseHubOpportunities({ settings = {}, logs = [] }) {
  const enabledTargets = getEnabledTargets(settings)
  const opportunities = []
  const discoveryLimit = Math.max(10, Math.min(Number(settings?.dailyTxTarget || 24), 24))

  for (const target of enabledTargets) {
    if (target.id === 'pumphub-buy' || target.id === 'pumphub-sell') continue
    if (target.id === 'free-nft-mint') continue

    opportunities.push(
      createBaseOpportunity(target, {
        source: 'basehub-live',
        priorityScore: target.type === 'simple' ? 0.45 : 0.5,
      })
    )
  }

  const pumpHubNeeded = enabledTargets.some((target) => target.id === 'pumphub-buy' || target.id === 'pumphub-sell')
  if (pumpHubNeeded) {
    const pumpHubOpportunities = await resolvePumpHubOpportunities({ settings, logs, limit: discoveryLimit }).catch(() => [])
    const sellablePumpHubOpportunities = await resolvePumpHubSellableOpportunities({
      settings,
      logs,
      walletAddress: settings.walletAddress,
      limit: discoveryLimit,
    }).catch(() => [])
    const pumpHubOpportunity = pumpHubOpportunities[0] || null
    const sellablePumpHubOpportunity = sellablePumpHubOpportunities[0] || null
    const buyTarget = enabledTargets.find((target) => target.id === 'pumphub-buy')
    const sellTarget = enabledTargets.find((target) => target.id === 'pumphub-sell')

    if (buyTarget) {
      opportunities.push(
        createBaseOpportunity(buyTarget, {
          source: pumpHubOpportunity?.source || 'pumphub',
          available: Boolean(pumpHubOpportunity?.address),
          priorityScore: pumpHubOpportunity?.address ? 0.95 : 0.15,
          summary: pumpHubOpportunity?.address
            ? `${pumpHubOpportunities.length} PumpHub trade targets are ready for rotation.`
            : 'No live PumpHub buy target was discovered yet.',
          payload: {
            pumpHubTokenAddress: String(pumpHubOpportunity?.address || '').trim(),
            pumpHubTradeAmountEth: String(settings.pumpHubTradeAmountEth || '0.0001'),
            candidates: pumpHubOpportunities.map((item) => ({
              pumpHubTokenAddress: String(item.address || '').trim(),
              name: String(item.name || ''),
              symbol: String(item.symbol || ''),
            })),
          },
        })
      )
    }

    if (sellTarget) {
      opportunities.push(
        createBaseOpportunity(sellTarget, {
          source: sellablePumpHubOpportunity?.source || 'pumphub',
          available: Boolean(sellablePumpHubOpportunity?.address),
          priorityScore: sellablePumpHubOpportunity?.address ? 0.72 : 0.05,
          summary: sellablePumpHubOpportunity?.address
            ? `${sellablePumpHubOpportunities.length} PumpHub sell targets are ready for rotation.`
            : 'No sell-ready PumpHub token balance was found yet.',
          payload: {
            pumpHubTokenAddress: String(sellablePumpHubOpportunity?.address || '').trim(),
            pumpHubSellBps: 2000,
            candidates: sellablePumpHubOpportunities.map((item) => ({
              pumpHubTokenAddress: String(item.address || '').trim(),
              name: String(item.name || ''),
              symbol: String(item.symbol || ''),
              pumpHubSellBps: 2000,
            })),
          },
        })
      )
    }
  }

  const swapHubTarget = enabledTargets.find((target) => target.id === 'swaphub-swap')
  if (swapHubTarget) {
    const swapHubOpportunities = await resolveSwapHubOpportunities({ logs, limit: discoveryLimit }).catch(() => [])
    const swapHubOpportunity = swapHubOpportunities[0] || null
    opportunities.push(
      createBaseOpportunity(swapHubTarget, {
        source: swapHubOpportunity?.source || 'swaphub',
        available: Boolean(swapHubOpportunity?.address),
        priorityScore: swapHubOpportunity?.address ? 0.88 : 0.18,
        summary: swapHubOpportunity?.address
          ? `${swapHubOpportunities.length} SwapHub token routes are ready for rotation.`
          : 'No SwapHub token route was discovered yet.',
        payload: {
          tokenOutAddress: String(swapHubOpportunity?.address || '').trim(),
          tokenOutSymbol: String(swapHubOpportunity?.symbol || ''),
          tokenOutName: String(swapHubOpportunity?.name || ''),
          swapAmountEth: String(settings.swapHubTradeAmountEth || '0.00008'),
          candidates: swapHubOpportunities.map((item) => ({
            tokenOutAddress: String(item.address || '').trim(),
            tokenOutSymbol: String(item.symbol || ''),
            tokenOutName: String(item.name || ''),
            decimals: Number(item.decimals || 18),
          })),
        },
      })
    )
  }

  const freeMintTarget = enabledTargets.find((target) => target.id === 'free-nft-mint')
  if (freeMintTarget) {
    const freeMintOpportunities = await resolveFreeMintOpportunities({ logs, limit: discoveryLimit }).catch(() => [])
    const freeMintOpportunity = freeMintOpportunities[0] || null
    opportunities.push(
      createBaseOpportunity(freeMintTarget, {
        source: freeMintOpportunity?.source || 'launchpad',
        available: Boolean(freeMintOpportunity?.contractAddress),
        priorityScore: freeMintOpportunity?.contractAddress ? 0.92 : 0.2,
        summary: freeMintOpportunity?.contractAddress
          ? `${freeMintOpportunities.length} active free NFT mints are available to rotate through.`
          : 'No active free NFT mint was discovered right now.',
        payload: {
          contractAddress: String(freeMintOpportunity?.contractAddress || '').trim(),
          slug: String(freeMintOpportunity?.slug || ''),
          collectionName: String(freeMintOpportunity?.name || ''),
          candidates: freeMintOpportunities.map((item) => ({
            contractAddress: String(item.contractAddress || '').trim(),
            slug: String(item.slug || ''),
            collectionName: String(item.name || ''),
          })),
        },
      })
    )
  }

  return opportunities.sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0))
}
