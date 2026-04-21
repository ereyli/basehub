import crypto from 'node:crypto'

function getEncryptionKey() {
  const secret =
    process.env.AGENT_SIGNER_ENCRYPTION_KEY ||
    process.env.CLOUD_AGENT_WORKER_PRIVATE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  if (!secret) {
    throw new Error('Agent signer encryption key is not configured.')
  }
  return crypto.createHash('sha256').update(String(secret)).digest()
}

export function encryptAgentSignerPrivateKey(privateKey) {
  const normalized = String(privateKey || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error('Invalid agent signer private key.')
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    version: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    createdAt: new Date().toISOString(),
  }
}

export function decryptAgentSignerPrivateKey(payload) {
  if (!payload || typeof payload !== 'object') return ''
  if (payload.alg !== 'aes-256-gcm' || !payload.iv || !payload.tag || !payload.ciphertext) return ''

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(payload.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')

  return /^0x[a-fA-F0-9]{64}$/.test(plaintext) ? plaintext : ''
}
