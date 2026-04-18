export function normalizeAgentError(error) {
  const fallback = {
    code: 'generic',
    shortMessage: 'Action failed. Review logs and try again.',
    shouldPauseAgent: false,
  }

  const rawMessage = String(error?.shortMessage || error?.message || error || '').trim()
  if (!rawMessage) return fallback

  const message = rawMessage.toLowerCase()

  if (
    message.includes('insufficient funds') ||
    message.includes('exceeds the balance') ||
    message.includes('sender doesn\'t have enough funds') ||
    message.includes('not enough funds') ||
    message.includes('exceeds balance')
  ) {
    return {
      code: 'balance',
      shortMessage: 'Low balance. Fund the burner wallet before restarting.',
      shouldPauseAgent: true,
    }
  }

  if (
    message.includes('fee') ||
    message.includes('gas') ||
    message.includes('intrinsic') ||
    message.includes('base fee') ||
    message.includes('max fee per gas')
  ) {
    return {
      code: 'fee',
      shortMessage: 'Network fee issue. Add a little more ETH, then restart.',
      shouldPauseAgent: true,
    }
  }

  if (message.includes('user rejected') || message.includes('rejected')) {
    return {
      code: 'rejected',
      shortMessage: 'Action was rejected.',
      shouldPauseAgent: false,
    }
  }

  return {
    code: 'generic',
    shortMessage: rawMessage.slice(0, 160),
    shouldPauseAgent: false,
  }
}
