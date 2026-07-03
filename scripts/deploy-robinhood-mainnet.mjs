import fs from 'fs'
import path from 'path'
import solc from 'solc'
import { ethers } from 'ethers'

const ROBINHOOD_RPC_URL = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const FEE_WALLET = ethers.getAddress(process.env.FEE_WALLET || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe')
const KEYSTORE_PATH = process.env.KEYSTORE_PATH || '.secrets/robinhood-deployer.json'
const KEYSTORE_PASSWORD_PATH = process.env.KEYSTORE_PASSWORD_PATH || '.secrets/robinhood-deployer.pass'

const CONTRACTS = [
  { file: 'GMGame.sol', name: 'GMGame', args: [FEE_WALLET], configKey: 'GM_GAME' },
  { file: 'GNGame.sol', name: 'GNGame', args: [FEE_WALLET], configKey: 'GN_GAME' },
  { file: 'FlipGame.sol', name: 'FlipGame', args: [FEE_WALLET], configKey: 'FLIP_GAME' },
  { file: 'LuckyNumber.sol', name: 'LuckyNumber', args: [FEE_WALLET], configKey: 'LUCKY_NUMBER' },
  { file: 'DiceRoll.sol', name: 'DiceRoll', args: [FEE_WALLET], configKey: 'DICE_ROLL' },
  { file: 'SlotGame.sol', name: 'SlotGame', args: [FEE_WALLET], configKey: 'SLOT_GAME' },
  { file: 'BaseHubDeployer.sol', name: 'BaseHubDeployer', args: [], configKey: 'BASEHUB_DEPLOYER' },
]

function compileContracts() {
  const sources = Object.fromEntries(
    CONTRACTS.map(({ file }) => {
      const fullPath = path.resolve('contracts', file)
      return [file, { content: fs.readFileSync(fullPath, 'utf8') }]
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

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const provider = new ethers.JsonRpcProvider(ROBINHOOD_RPC_URL)
  const network = await provider.getNetwork()
  if (network.chainId !== 4663n) {
    throw new Error(`RPC is not Robinhood mainnet. Expected chainId 4663, got ${network.chainId.toString()}`)
  }

  const compiled = compileContracts()
  const wallet = await loadWallet(provider)
  const balance = await provider.getBalance(wallet.address)

  console.log('Robinhood Chain mainnet deploy')
  console.log('Chain ID:', network.chainId.toString())
  console.log('RPC:', ROBINHOOD_RPC_URL)
  console.log('Deployer:', wallet.address)
  console.log('Fee wallet / owner:', FEE_WALLET)
  console.log('Balance:', ethers.formatEther(balance), 'ETH')

  if (dryRun) {
    console.log('Dry run complete. No transactions sent.')
    return
  }

  const deployments = {}
  for (const item of CONTRACTS) {
    const artifact = compiled[item.file][item.name]
    const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet)
    const contract = await factory.deploy(...item.args)
    const tx = contract.deploymentTransaction()
    console.log(`${item.name} tx:`, tx.hash)
    await contract.waitForDeployment()
    const address = await contract.getAddress()
    deployments[item.configKey] = address
    console.log(`${item.name}:`, address)
  }

  const outDir = path.resolve('deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'robinhood-mainnet.json')
  fs.writeFileSync(outPath, JSON.stringify({
    chainId: 4663,
    rpcUrl: ROBINHOOD_RPC_URL,
    explorer: 'https://robinhoodchain.blockscout.com',
    deployer: wallet.address,
    feeWallet: FEE_WALLET,
    deployedAt: new Date().toISOString(),
    contracts: deployments,
  }, null, 2))

  console.log('\nUpdate src/config/networks.js ROBINHOOD with:')
  for (const [key, value] of Object.entries(deployments)) {
    console.log(`    ${key}: '${value}',`)
  }
  console.log('\nSaved:', outPath)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
