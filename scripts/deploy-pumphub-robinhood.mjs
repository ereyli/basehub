import fs from 'fs'
import path from 'path'
import solc from 'solc'
import { ethers } from 'ethers'

const CHAIN_ID = 4663n
const RPC_URL = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const ROUTER = ethers.getAddress('0x89e5db8b5aa49aa85ac63f691524311aeb649eba')
const EXPECTED_FACTORY = ethers.getAddress('0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f')
const FEE_WALLET = ethers.getAddress(process.env.FEE_WALLET || '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe')
const KEYSTORE_PATH = process.env.KEYSTORE_PATH || '.secrets/robinhood-deployer.json'
const KEYSTORE_PASSWORD_PATH = process.env.KEYSTORE_PASSWORD_PATH || '.secrets/robinhood-deployer.pass'

const readImport = (importPath) => {
  const candidates = [
    path.resolve(importPath),
    path.resolve('contracts', importPath),
    path.resolve('node_modules', importPath),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  return found
    ? { contents: fs.readFileSync(found, 'utf8') }
    : { error: `Import not found: ${importPath}` }
}

const compile = () => {
  const sourcePath = path.resolve('contracts/PumpHubFactory.sol')
  const input = {
    language: 'Solidity',
    sources: {
      'contracts/PumpHubFactory.sol': { content: fs.readFileSync(sourcePath, 'utf8') },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: readImport }))
  for (const item of output.errors || []) {
    const write = item.severity === 'error' ? console.error : console.warn
    write(item.formattedMessage)
  }
  if ((output.errors || []).some((item) => item.severity === 'error')) {
    throw new Error('PumpHubFactory compilation failed')
  }
  return output.contracts['contracts/PumpHubFactory.sol'].PumpHubFactory
}

const loadWallet = async (provider) => {
  if (process.env.PRIVATE_KEY) return new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  const encrypted = fs.readFileSync(KEYSTORE_PATH, 'utf8')
  const password = fs.readFileSync(KEYSTORE_PASSWORD_PATH, 'utf8').trim()
  return (await ethers.Wallet.fromEncryptedJson(encrypted, password)).connect(provider)
}

const main = async () => {
  const dryRun = process.argv.includes('--dry-run')
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const network = await provider.getNetwork()
  if (network.chainId !== CHAIN_ID) {
    throw new Error(`Expected Robinhood mainnet ${CHAIN_ID}, received ${network.chainId}`)
  }

  const router = new ethers.Contract(
    ROUTER,
    ['function factory() view returns (address)', 'function WETH() view returns (address)'],
    provider,
  )
  const [routerCode, routerFactory, weth] = await Promise.all([
    provider.getCode(ROUTER),
    router.factory(),
    router.WETH(),
  ])
  if (routerCode === '0x') throw new Error('Robinhood Uniswap V2 router has no bytecode')
  if (ethers.getAddress(routerFactory) !== EXPECTED_FACTORY) {
    throw new Error(`Unexpected Uniswap factory: ${routerFactory}`)
  }

  const artifact = compile()
  const wallet = await loadWallet(provider)
  const balance = await provider.getBalance(wallet.address)
  const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet)
  const deployTx = await contractFactory.getDeployTransaction(ROUTER, weth, FEE_WALLET)
  const [estimatedGas, feeData] = await Promise.all([
    provider.estimateGas({ ...deployTx, from: wallet.address }),
    provider.getFeeData(),
  ])
  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 0n
  const estimatedCost = estimatedGas * maxFeePerGas

  console.log('Robinhood PumpHub deployment')
  console.log('Chain ID:', network.chainId.toString())
  console.log('Deployer:', wallet.address)
  console.log('Admin / fee wallet:', FEE_WALLET)
  console.log('Uniswap V2 router:', ROUTER)
  console.log('Uniswap V2 factory:', routerFactory)
  console.log('WETH:', weth)
  console.log('Balance:', ethers.formatEther(balance), 'ETH')
  console.log('Estimated gas:', estimatedGas.toString())
  console.log('Estimated max cost:', ethers.formatEther(estimatedCost), 'ETH')

  if (balance < estimatedCost) {
    throw new Error(`Insufficient balance. Need about ${ethers.formatEther(estimatedCost)} ETH plus margin.`)
  }
  if (dryRun) {
    console.log('Dry run complete. No transaction sent.')
    return
  }

  const contract = await contractFactory.deploy(ROUTER, weth, FEE_WALLET)
  const deploymentTx = contract.deploymentTransaction()
  console.log('Deployment transaction:', deploymentTx.hash)
  await contract.waitForDeployment()
  const address = await contract.getAddress()

  const [owner, configuredRouter, configuredWeth, code] = await Promise.all([
    contract.owner(),
    contract.ROUTER(),
    contract.WETH(),
    provider.getCode(address),
  ])
  if (ethers.getAddress(owner) !== FEE_WALLET) throw new Error(`Unexpected owner: ${owner}`)
  if (ethers.getAddress(configuredRouter) !== ROUTER) throw new Error(`Unexpected router: ${configuredRouter}`)
  if (ethers.getAddress(configuredWeth) !== ethers.getAddress(weth)) throw new Error(`Unexpected WETH: ${configuredWeth}`)
  if (code === '0x') throw new Error('Deployed PumpHubFactory has no bytecode')

  const out = {
    chainId: Number(CHAIN_ID),
    network: 'Robinhood Chain',
    factoryAddress: address,
    deploymentTransaction: deploymentTx.hash,
    deployer: wallet.address,
    owner: FEE_WALLET,
    feeWallet: FEE_WALLET,
    uniswapV2Router: ROUTER,
    uniswapV2Factory: ethers.getAddress(routerFactory),
    weth: ethers.getAddress(weth),
    creationFeeEth: '0.001',
    graduationThresholdEth: '5',
    tradingFeeBps: 60,
    deployedAt: new Date().toISOString(),
  }
  fs.mkdirSync('deployments', { recursive: true })
  fs.writeFileSync('deployments/pumphub-robinhood-mainnet.json', `${JSON.stringify(out, null, 2)}\n`)

  console.log('PumpHubFactory:', address)
  console.log('Explorer:', `https://robinhoodchain.blockscout.com/address/${address}`)
  console.log('Saved: deployments/pumphub-robinhood-mainnet.json')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
