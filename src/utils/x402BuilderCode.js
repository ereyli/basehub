import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { BuilderCodeClientExtension } from '@x402/extensions/builder-code'
import { BASE_BUILDER_CODE } from '../config/builderCode'

function getWalletAddress(walletClient) {
  return walletClient?.account?.address || walletClient?.address
}

function toX402Signer(walletClient) {
  const address = getWalletAddress(walletClient)
  if (!address) {
    throw new Error('Wallet address not available for x402 payment.')
  }

  return {
    address,
    signTypedData: (message) => walletClient.signTypedData({
      account: walletClient.account,
      ...message,
    }),
  }
}

function createMaxAmountPolicy(maxValue) {
  if (maxValue == null) return undefined

  return (_x402Version, paymentRequirements) => {
    const filtered = paymentRequirements.filter((requirement) => {
      const amount = requirement.maxAmountRequired ?? requirement.amount
      if (amount == null) return true

      try {
        return BigInt(amount) <= maxValue
      } catch {
        return false
      }
    })

    if (filtered.length === 0) {
      throw new Error('Payment amount exceeds maximum allowed')
    }

    return filtered
  }
}

export function createX402FetchWithBuilderCode(fetchImpl, walletClient, maxValue) {
  const signer = toX402Signer(walletClient)
  const maxAmountPolicy = createMaxAmountPolicy(maxValue)

  const client = new x402Client()
    .register('eip155:*', new ExactEvmScheme(signer))
    .registerExtension(new BuilderCodeClientExtension(BASE_BUILDER_CODE))

  if (maxAmountPolicy) {
    return wrapFetchWithPayment(fetchImpl, x402Client.fromConfig({
      schemes: [{ network: 'eip155:*', client: new ExactEvmScheme(signer) }],
      policies: [maxAmountPolicy],
    }).registerExtension(new BuilderCodeClientExtension(BASE_BUILDER_CODE)))
  }

  return wrapFetchWithPayment(fetchImpl, client)
}
