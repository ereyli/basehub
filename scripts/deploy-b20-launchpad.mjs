import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import solc from 'solc'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_BASE_SEPOLIA_RPC = 'https://sepolia.base.org'
const DEFAULT_FEE_WALLET = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const KEYSTORE_PATH = process.env.KEYSTORE_PATH || '.secrets/robinhood-deployer.json'
const KEYSTORE_PASSWORD_PATH = process.env.KEYSTORE_PASSWORD_PATH || '.secrets/robinhood-deployer.pass'

function compileContracts() {
  const contracts = ['BaseHubB20Launcher.sol', 'BaseHubB20BondingLaunchpad.sol']
  const sources = Object.fromEntries(
    contracts.map((file) => [
      file,
      { content: fs.readFileSync(path.join(__dirname, '..', 'contracts', file), 'utf8') },
    ])
  )

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = output.errors || []
  for (const err of errors) console.warn(err.formattedMessage)
  if (errors.some((err) => err.severity === 'error')) throw new Error('Solidity compilation failed')

  return {
    launcher: output.contracts['BaseHubB20Launcher.sol'].BaseHubB20Launcher,
    curve: output.contracts['BaseHubB20BondingLaunchpad.sol'].BaseHubB20BondingLaunchpad,
  }
}

async function deployContract(wallet, compiled, args) {
  const factory = new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, wallet)
  const contract = await factory.deploy(...args)
  console.log('Tx:', contract.deploymentTransaction().hash)
  await contract.waitForDeployment()
  return contract
}

async function transferOwnerIfNeeded(contract, nextOwner, label) {
  const currentOwner = await contract.owner()
  if (currentOwner.toLowerCase() === nextOwner.toLowerCase()) {
    console.log(`${label} owner already:`, nextOwner)
    return null
  }
  const tx = await contract.transferOwnership(nextOwner)
  console.log(`${label} transferOwnership tx:`, tx.hash)
  await tx.wait(1)
  console.log(`${label} owner:`, await contract.owner())
  return tx.hash
}

async function loadWallet(provider) {
  if (process.env.PRIVATE_KEY) {
    return new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  }

  const encrypted = fs.readFileSync(KEYSTORE_PATH, 'utf8')
  const password = fs.readFileSync(KEYSTORE_PASSWORD_PATH, 'utf8').trim()
  return (await ethers.Wallet.fromEncryptedJson(encrypted, password)).connect(provider)
}

async function estimateDeployCost(wallet, compiled, deployments) {
  let totalGas = 0n
  for (const item of deployments) {
    const factory = new ethers.ContractFactory(item.compiled.abi, item.compiled.evm.bytecode.object, wallet)
    const tx = await factory.getDeployTransaction(...item.args)
    const gas = await wallet.provider.estimateGas({ from: wallet.address, data: tx.data })
    totalGas += gas
    console.log(`${item.label} estimated gas:`, gas.toString())
  }

  const feeData = await wallet.provider.getFeeData()
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 0n
  console.log('Total estimated gas:', totalGas.toString())
  if (gasPrice > 0n) {
    console.log('Current gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei')
    console.log('Estimated gas cost:', ethers.formatEther(totalGas * gasPrice), 'ETH')
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || DEFAULT_BASE_SEPOLIA_RPC
  const feeWallet = process.env.FEE_WALLET || DEFAULT_FEE_WALLET
  const router = process.env.B20_ROUTER || ZERO_ADDRESS
  const weth = process.env.B20_WETH || ZERO_ADDRESS

  if (!ethers.isAddress(feeWallet)) throw new Error('FEE_WALLET is not a valid address')
  if (!ethers.isAddress(router) || !ethers.isAddress(weth)) throw new Error('B20_ROUTER/B20_WETH must be valid addresses')
  if ((router === ZERO_ADDRESS) !== (weth === ZERO_ADDRESS)) {
    throw new Error('Set both B20_ROUTER and B20_WETH, or leave both empty for test locking mode')
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = await loadWallet(provider)
  const network = await provider.getNetwork()
  const balance = await provider.getBalance(wallet.address)

  console.log('Deploying BaseHub B20 launchpad contracts')
  console.log('Chain ID:', network.chainId.toString())
  console.log('Deployer:', wallet.address)
  console.log('Fee Wallet:', feeWallet)
  console.log('Router:', router)
  console.log('WETH:', weth)
  console.log('Balance:', ethers.formatEther(balance), 'ETH')

  if (network.chainId !== 84532n) {
    throw new Error(`Expected Base Sepolia chain ID 84532, got ${network.chainId.toString()}`)
  }

  const compiled = compileContracts()
  const deploymentPlan = [
    { label: 'BaseHubB20Launcher', compiled: compiled.launcher, args: [feeWallet] },
    { label: 'BaseHubB20BondingLaunchpad', compiled: compiled.curve, args: [feeWallet, router, weth] },
  ]

  await estimateDeployCost(wallet, compiled, deploymentPlan)

  if (dryRun) {
    console.log('Dry run complete. No transactions sent.')
    return
  }

  console.log('\nDeploying BaseHubB20Launcher')
  const launcher = await deployContract(wallet, compiled.launcher, [feeWallet])
  const launcherAddress = await launcher.getAddress()
  console.log('BaseHubB20Launcher:', launcherAddress)

  console.log('\nDeploying BaseHubB20BondingLaunchpad')
  const curve = await deployContract(wallet, compiled.curve, [feeWallet, router, weth])
  const curveAddress = await curve.getAddress()
  console.log('BaseHubB20BondingLaunchpad:', curveAddress)

  console.log('\nTransferring B20 admin ownership')
  const launcherOwnershipTx = await transferOwnerIfNeeded(launcher, feeWallet, 'BaseHubB20Launcher')
  const curveOwnershipTx = await transferOwnerIfNeeded(curve, feeWallet, 'BaseHubB20BondingLaunchpad')

  console.log('\nAdd these to Vercel/local env:')
  console.log(`VITE_B20_LAUNCHER_BASE_SEPOLIA=${launcherAddress}`)
  console.log(`VITE_B20_CURVE_LAUNCHPAD_BASE_SEPOLIA=${curveAddress}`)

  const outDir = path.resolve('deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'base-sepolia-b20-launchpad.json')
  fs.writeFileSync(outPath, JSON.stringify({
    chainId: 84532,
    rpcUrl,
    explorer: 'https://sepolia.basescan.org',
    deployer: wallet.address,
    feeWallet,
    router,
    weth,
    owner: feeWallet,
    deployedAt: new Date().toISOString(),
    contracts: {
      BASEHUB_B20_LAUNCHER: launcherAddress,
      BASEHUB_B20_CURVE_LAUNCHPAD: curveAddress,
    },
    ownershipTransfers: {
      BASEHUB_B20_LAUNCHER: launcherOwnershipTx,
      BASEHUB_B20_CURVE_LAUNCHPAD: curveOwnershipTx,
    },
  }, null, 2))
  console.log('Saved:', outPath)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
