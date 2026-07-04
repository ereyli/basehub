import fs from 'fs'
import path from 'path'
import solc from 'solc'
import { ethers } from 'ethers'

const FEE_WALLET = ethers.getAddress(process.env.FEE_WALLET || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe')
const KEYSTORE_PATH = process.env.KEYSTORE_PATH || '.secrets/robinhood-deployer.json'
const KEYSTORE_PASSWORD_PATH = process.env.KEYSTORE_PASSWORD_PATH || '.secrets/robinhood-deployer.pass'

const NETWORKS = {
  arbitrum: {
    label: 'Arbitrum One',
    chainId: 42161n,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    nativeSymbol: 'ETH',
    configKey: 'ARBITRUM',
    outputFile: 'arbitrum-mainnet.json',
  },
  optimism: {
    label: 'Optimism',
    chainId: 10n,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    nativeSymbol: 'ETH',
    configKey: 'OPTIMISM',
    outputFile: 'optimism-mainnet.json',
  },
  monad: {
    label: 'Monad',
    chainId: 143n,
    rpcUrl: process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz',
    explorer: 'https://monadvision.com',
    nativeSymbol: 'MON',
    configKey: 'MONAD',
    outputFile: 'monad-mainnet.json',
    feeOverrides: {
      GAME_FEE: process.env.MONAD_GAME_FEE || '1.75',
      DEPLOYER_FEE: process.env.MONAD_DEPLOYER_FEE || '22',
      NFT_COLLECTION_FEE: process.env.MONAD_NFT_COLLECTION_FEE || '175',
    },
  },
}

const CONTRACTS = [
  { file: 'GMGame.sol', name: 'GMGame', args: [FEE_WALLET], configKey: 'GM_GAME' },
  { file: 'GNGame.sol', name: 'GNGame', args: [FEE_WALLET], configKey: 'GN_GAME' },
  { file: 'FlipGame.sol', name: 'FlipGame', args: [FEE_WALLET], configKey: 'FLIP_GAME' },
  { file: 'LuckyNumber.sol', name: 'LuckyNumber', args: [FEE_WALLET], configKey: 'LUCKY_NUMBER' },
  { file: 'DiceRoll.sol', name: 'DiceRoll', args: [FEE_WALLET], configKey: 'DICE_ROLL' },
  { file: 'SlotGame.sol', name: 'SlotGame', args: [FEE_WALLET], configKey: 'SLOT_GAME' },
  { file: 'BaseHubDeployer.sol', name: 'BaseHubDeployer', args: [], configKey: 'BASEHUB_DEPLOYER' },
]

function parseArgs() {
  const networkArg = process.argv.find((arg) => arg.startsWith('--network='))?.split('=')[1]
  const networkName = (networkArg || process.env.DEPLOY_NETWORK || '').toLowerCase()
  const dryRun = process.argv.includes('--dry-run')
  if (!networkName || !NETWORKS[networkName]) {
    const supported = Object.keys(NETWORKS).join(', ')
    throw new Error(`Use --network=<${supported}>`)
  }
  return { networkName, dryRun }
}

function applyFeeOverrides(file, source, network) {
  if (!network.feeOverrides) return source

  const gameFeeWei = ethers.parseEther(network.feeOverrides.GAME_FEE).toString()
  const deployerFeeWei = ethers.parseEther(network.feeOverrides.DEPLOYER_FEE).toString()
  const nftFeeWei = ethers.parseEther(network.feeOverrides.NFT_COLLECTION_FEE).toString()

  if (file === 'BaseHubDeployer.sol') {
    return source
      .replace('uint256 public constant FEE = 0.00025 ether;', `uint256 public constant FEE = ${deployerFeeWei};`)
      .replace('uint256 public constant FEE_NFT_COLLECTION = 0.002 ether;', `uint256 public constant FEE_NFT_COLLECTION = ${nftFeeWei};`)
      .replace('Fee: 0.00025 ETH sabit.', `Fee: ${network.feeOverrides.DEPLOYER_FEE} ${network.nativeSymbol} sabit.`)
  }

  if (file === 'SlotGame.sol') {
    return source.replace('uint256 public constant CREDIT_PRICE = 0.00002 ether;', `uint256 public constant CREDIT_PRICE = ${gameFeeWei};`)
  }

  return source.replace('uint256 public constant GAME_FEE = 0.00002 ether;', `uint256 public constant GAME_FEE = ${gameFeeWei};`)
}

function compileContracts(network) {
  const sources = Object.fromEntries(
    CONTRACTS.map(({ file }) => {
      const fullPath = path.resolve('contracts', file)
      const content = applyFeeOverrides(file, fs.readFileSync(fullPath, 'utf8'), network)
      return [file, { content }]
    })
  )

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = output.errors || []
  for (const error of errors) {
    const line = error.severity === 'error' ? console.error : console.warn
    line(error.formattedMessage)
  }
  if (errors.some((error) => error.severity === 'error')) {
    throw new Error('Solidity compilation failed')
  }
  return output.contracts
}

async function loadWallet(provider) {
  if (process.env.PRIVATE_KEY) {
    return new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  }

  const encrypted = fs.readFileSync(KEYSTORE_PATH, 'utf8')
  const password = fs.readFileSync(KEYSTORE_PASSWORD_PATH, 'utf8').trim()
  return (await ethers.Wallet.fromEncryptedJson(encrypted, password)).connect(provider)
}

async function deployOne({ item, compiled, wallet }) {
  const artifact = compiled[item.file][item.name]
  const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet)
  const contract = await factory.deploy(...item.args)
  const tx = contract.deploymentTransaction()
  console.log(`${item.name} tx:`, tx.hash)
  await contract.waitForDeployment()
  const address = await contract.getAddress()
  console.log(`${item.name}:`, address)
  return { address, abi: artifact.abi }
}

async function estimateDeployCost({ compiled, wallet, provider, network }) {
  let totalGas = 0n
  for (const item of CONTRACTS) {
    const artifact = compiled[item.file][item.name]
    const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet)
    const tx = await factory.getDeployTransaction(...item.args)
    const gas = await provider.estimateGas({ from: wallet.address, data: tx.data })
    totalGas += gas
    console.log(`${item.name} estimated gas:`, gas.toString())
  }

  const feeData = await provider.getFeeData()
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 0n
  const estimatedCost = totalGas * gasPrice
  console.log('Total estimated gas:', totalGas.toString())
  if (gasPrice > 0n) {
    console.log('Current gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei')
    console.log('Estimated native gas cost:', ethers.formatEther(estimatedCost), network.nativeSymbol)
    console.log('Suggested 2x buffer:', ethers.formatEther(estimatedCost * 2n), network.nativeSymbol)
  }
}

async function main() {
  const { networkName, dryRun } = parseArgs()
  const network = NETWORKS[networkName]
  const provider = new ethers.JsonRpcProvider(network.rpcUrl)
  const rpcNetwork = await provider.getNetwork()
  if (rpcNetwork.chainId !== network.chainId) {
    throw new Error(`RPC is not ${network.label}. Expected chainId ${network.chainId.toString()}, got ${rpcNetwork.chainId.toString()}`)
  }

  const compiled = compileContracts(network)
  const wallet = await loadWallet(provider)
  const balance = await provider.getBalance(wallet.address)

  console.log(`${network.label} mainnet deploy`)
  console.log('Chain ID:', network.chainId.toString())
  console.log('RPC:', network.rpcUrl)
  console.log('Deployer:', wallet.address)
  console.log('Fee wallet / owner:', FEE_WALLET)
  console.log('Balance:', ethers.formatEther(balance), network.nativeSymbol)
  if (network.feeOverrides) {
    console.log('Native fee overrides:', network.feeOverrides, network.nativeSymbol)
  }

  if (dryRun) {
    try {
      await estimateDeployCost({ compiled, wallet, provider, network })
    } catch (error) {
      console.warn('Gas estimation skipped:', error?.shortMessage || error?.message || String(error))
    }
    console.log('Dry run complete. No transactions sent.')
    return
  }

  const deployments = {}
  const verification = {}
  for (const item of CONTRACTS) {
    const { address, abi } = await deployOne({ item, compiled, wallet })
    deployments[item.configKey] = address

    if (['GM_GAME', 'GN_GAME', 'FLIP_GAME', 'LUCKY_NUMBER', 'DICE_ROLL'].includes(item.configKey)) {
      const contract = new ethers.Contract(address, abi, provider)
      verification[item.configKey] = {
        owner: await contract.owner(),
        gameFee: (await contract.GAME_FEE()).toString(),
      }
    }
    if (item.configKey === 'SLOT_GAME') {
      const contract = new ethers.Contract(address, abi, provider)
      verification[item.configKey] = {
        creditPrice: (await contract.CREDIT_PRICE()).toString(),
      }
    }
    if (item.configKey === 'BASEHUB_DEPLOYER') {
      const contract = new ethers.Contract(address, abi, provider)
      verification[item.configKey] = {
        feeWallet: await contract.FEE_WALLET(),
        fee: (await contract.FEE()).toString(),
        nftCollectionFee: (await contract.FEE_NFT_COLLECTION()).toString(),
      }
      deployments.BASEHUB_NFT_COLLECTION_DEPLOYER = address
    }
  }

  const outDir = path.resolve('deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, network.outputFile)
  fs.writeFileSync(outPath, JSON.stringify({
    chainId: Number(network.chainId),
    rpcUrl: network.rpcUrl,
    explorer: network.explorer,
    nativeSymbol: network.nativeSymbol,
    deployer: wallet.address,
    feeWallet: FEE_WALLET,
    feeOverrides: network.feeOverrides || null,
    deployedAt: new Date().toISOString(),
    contracts: deployments,
    verification,
  }, null, 2))

  console.log(`\nUpdate src/config/networks.js ${network.configKey} with:`)
  console.log(`  ${network.configKey}: {`)
  for (const [key, value] of Object.entries(deployments)) {
    console.log(`    ${key}: '${value}',`)
  }
  console.log('  },')
  console.log('\nSaved:', outPath)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
