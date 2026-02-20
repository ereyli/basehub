import { ethers } from 'ethers'

const TUG_OF_WAR_ADDRESS = '0x6102f5893EF6cDE8Eabf67f59845D7704b228a2c'
const LOCK_WINDOW_MINUTES = 5

const ABI = [
  'function lockWindowSeconds() view returns (uint256)',
  'function setLockWindowMinutes(uint256 newLockWindowMinutes)',
]

async function main() {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  const privateKey = process.env.OWNER_PRIVATE_KEY

  if (!privateKey) {
    throw new Error('Missing OWNER_PRIVATE_KEY in env')
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  const contract = new ethers.Contract(TUG_OF_WAR_ADDRESS, ABI, wallet)

  const before = await contract.lockWindowSeconds()
  console.log(`Current lock window: ${Number(before) / 60} mins`)

  const tx = await contract.setLockWindowMinutes(LOCK_WINDOW_MINUTES)
  console.log(`Submitted tx: ${tx.hash}`)
  await tx.wait()

  const after = await contract.lockWindowSeconds()
  console.log(`Updated lock window: ${Number(after) / 60} mins`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
