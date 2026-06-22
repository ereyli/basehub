import { HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { BUILDER_CODE, builderCodeResourceServerExtension, declareBuilderCodeExtension } from '@x402/extensions/builder-code'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { facilitator } from '@coinbase/x402'
import { BASE_BUILDER_CODE } from '../src/config/builderCode.js'

export const X402_BUILDER_CODE = process.env.X402_BUILDER_CODE || BASE_BUILDER_CODE

export function toX402Network(network = 'base') {
  if (network === 'base') return 'eip155:8453'
  if (network === 'base-sepolia') return 'eip155:84532'
  return network
}

export function getFacilitatorConfig() {
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) return facilitator
  return { url: 'https://x402.org/facilitator' }
}

export function createX402ResourceServer(facilitatorConfig = getFacilitatorConfig()) {
  return new x402ResourceServer(new HTTPFacilitatorClient(facilitatorConfig))
    .register('eip155:*', new ExactEvmScheme())
    .registerExtension(builderCodeResourceServerExtension)
}

export function createX402Route({ price, network, payTo, description, mimeType = 'application/json', maxTimeoutSeconds = 600 }) {
  return {
    accepts: {
      scheme: 'exact',
      price,
      network: toX402Network(network),
      payTo,
      maxTimeoutSeconds,
    },
    description,
    mimeType,
    extensions: {
      [BUILDER_CODE]: declareBuilderCodeExtension(X402_BUILDER_CODE),
    },
  }
}

function getRouteConfigs(routes) {
  if (!routes || typeof routes !== 'object') return []
  if ('accepts' in routes) return [routes]
  return Object.values(routes)
}

function routeUsesMainnet(routes) {
  return getRouteConfigs(routes).some((route) => {
    const accepts = Array.isArray(route.accepts) ? route.accepts : [route.accepts]
    return accepts.some((accept) => accept?.network === 'eip155:8453')
  })
}

export function createX402PaymentMiddleware(routes, facilitatorConfig) {
  const canSyncFacilitator = Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) || !routeUsesMainnet(routes)
  return paymentMiddleware(routes, createX402ResourceServer(facilitatorConfig), undefined, undefined, canSyncFacilitator)
}
