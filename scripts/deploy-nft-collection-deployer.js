/**
 * NFT Launchpad only: deploy NFTCollectionDeployer to Base.
 * Run: npx hardhat run scripts/deploy-nft-collection-deployer.js --network base
 * Then set BASEHUB_NFT_COLLECTION_DEPLOYER in src/config/networks.js (CONTRACT_ADDRESSES.BASE).
 */
const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying NFTCollectionDeployer with:', deployer.address)
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH')

  const NFTCollectionDeployer = await ethers.getContractFactory('NFTCollectionDeployer')
  const deployerContract = await NFTCollectionDeployer.deploy()
  await deployerContract.waitForDeployment()
  const address = await deployerContract.getAddress()

  console.log('NFTCollectionDeployer deployed to:', address)
  console.log('\nUpdate src/config/networks.js:')
  console.log("  BASE: { ... BASEHUB_NFT_COLLECTION_DEPLOYER: '" + address + "', }")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
