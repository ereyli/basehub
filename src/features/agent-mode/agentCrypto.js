/**
 * Private key encryption/decryption using Web Crypto API.
 *
 * Uses PBKDF2 for key derivation (100 000 iterations, SHA-256)
 * and AES-256-GCM for encryption.
 *
 * The encrypted payload stored in localStorage contains:
 *   - ciphertext (base64)
 *   - iv         (base64, 12 bytes)
 *   - salt       (base64, 16 bytes)
 *
 * The raw private key never touches localStorage once encrypted.
 */

const PBKDF2_ITERATIONS = 100_000

function bufToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuf(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Derive an AES-256-GCM key from a user PIN + random salt.
 */
async function deriveKey(pin, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a private key string with a user-chosen PIN.
 * Returns { ciphertext, iv, salt } all base64-encoded.
 */
export async function encryptPrivateKey(privateKey, pin) {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pin, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(privateKey)
  )

  return {
    ciphertext: bufToBase64(ciphertext),
    iv: bufToBase64(iv),
    salt: bufToBase64(salt),
  }
}

/**
 * Decrypt a private key from the encrypted payload using the user PIN.
 * Returns the raw private key string, or throws if PIN is wrong.
 */
export async function decryptPrivateKey(encryptedPayload, pin) {
  const salt = new Uint8Array(base64ToBuf(encryptedPayload.salt))
  const iv = new Uint8Array(base64ToBuf(encryptedPayload.iv))
  const ciphertext = base64ToBuf(encryptedPayload.ciphertext)
  const key = await deriveKey(pin, salt)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('Wrong PIN. Please try again.')
  }
}

/**
 * Check if a wallet object uses the new encrypted format.
 */
export function isEncryptedWallet(wallet) {
  return (
    wallet &&
    wallet.encryptedKey &&
    typeof wallet.encryptedKey.ciphertext === 'string' &&
    typeof wallet.encryptedKey.iv === 'string' &&
    typeof wallet.encryptedKey.salt === 'string'
  )
}

/**
 * Check if a wallet still uses the old plain-text format (for migration).
 */
export function isLegacyWallet(wallet) {
  return wallet && typeof wallet.privateKey === 'string' && !wallet.encryptedKey
}
