import { isEarlyAccessPassHolder, normalizeAddress } from './_agentAccess.js'

export const ANALYSIS_PASS_DISCOUNT_PERCENT = 50

export function isPassDiscountRequest(req) {
  const rawUrl = String(req?.url || '')
  return /(?:\?|&)pass=1(?:&|$)/.test(rawUrl)
}

export async function readRequestJson(c) {
  try {
    return await c.req.raw.clone().json()
  } catch {
    return {}
  }
}

export async function enforceAnalysisPassDiscount(c) {
  const body = await readRequestJson(c)
  const payer = normalizeAddress(
    body.payerWalletAddress ||
    body.walletAddress ||
    c.req.query('payerWalletAddress') ||
    c.req.query('walletAddress')
  )

  if (!payer) {
    return c.json({
      success: false,
      error: 'A valid payerWalletAddress is required for the BaseHub Pass discount.',
    }, 400)
  }

  const isPassHolder = await isEarlyAccessPassHolder(payer)
  if (!isPassHolder) {
    return c.json({
      success: false,
      error: 'BaseHub Pass NFT was not found in this wallet. Use the standard x402 analysis payment.',
      discountRequired: 'basehub_pass_nft',
    }, 403)
  }

  c.set('basehubPassHolder', payer)
}
