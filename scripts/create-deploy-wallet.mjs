import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { ethers } from 'ethers'

const secretsDir = path.resolve('.secrets')
const keystorePath = path.join(secretsDir, 'robinhood-deployer.json')
const passwordPath = path.join(secretsDir, 'robinhood-deployer.pass')

if (fs.existsSync(keystorePath) || fs.existsSync(passwordPath)) {
  throw new Error('Robinhood deploy wallet already exists in .secrets/')
}

fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 })

const wallet = ethers.Wallet.createRandom()
const password = randomBytes(32).toString('base64url')
const encrypted = await wallet.encrypt(password)

fs.writeFileSync(keystorePath, encrypted, { mode: 0o600 })
fs.writeFileSync(passwordPath, `${password}\n`, { mode: 0o600 })

console.log(`Address: ${wallet.address}`)
console.log(`Keystore: ${keystorePath}`)
console.log('Private key was not printed. Keep .secrets/ out of git and backups you do not control.')
