/**
 * NFT Launchpad (Ink, Soneium): deploy NFTCollectionDeployerNoEarlyAccess.
 * Early Access Pass sadece Base'de mevcut; bu ağlarda kontrol yok, herkes 0.002 ETH öder.
 *
 * Run:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-nft-collection-deployer-no-early-access.js --network ink
 *   PRIVATE_KEY=0x... npx hardhat run scripts/deploy-nft-collection-deployer-no-early-access.js --network soneium
 *
 * Then update src/config/networks.js:
 *   INKCHAIN: { ... BASEHUB_NFT_COLLECTION_DEPLOYER: '<address>', }
 *   SONEIUM:  { ... BASEHUB_NFT_COLLECTION_DEPLOYER: '<address>', }
 */
const { ethers } = require('hardhat')
const hre = require('hardhat')

async function main() {
  const network = hre.network.name
  if (!['ink', 'soneium'].includes(network)) {
    console.error('Bu script sadece ink veya soneium ağı için: --network ink veya --network soneium')
    process.exit(1)
  }

  const [deployer] = await ethers.getSigners()
  console.log('Deploying NFTCollectionDeployerNoEarlyAccess on', network, 'with:', deployer.address)
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH')

  const NFTCollectionDeployerNoEarlyAccess = await ethers.getContractFactory('NFTCollectionDeployerNoEarlyAccess')
  const deployerContract = await NFTCollectionDeployerNoEarlyAccess.deploy()
  await deployerContract.waitForDeployment()
  const address = await deployerContract.getAddress()

  console.log('NFTCollectionDeployerNoEarlyAccess deployed to:', address)
  console.log('\nUpdate src/config/networks.js:')
  const key = network === 'ink' ? 'INKCHAIN' : 'SONEIUM'
  console.log(`  ${key}: { ... BASEHUB_NFT_COLLECTION_DEPLOYER: '${address}', }`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
