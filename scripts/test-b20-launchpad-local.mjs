import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import solc from 'solc'
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  getAddress,
  getContract,
  http,
  keccak256,
  maxUint256,
  parseAbiParameters,
  parseEther,
  parseUnits,
  stringToBytes,
} from 'viem'

const RPC_URL = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const PROD_B20_FACTORY = '0xB20f000000000000000000000000000000000000'

const localChain = {
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
}

let hardhatNodeProcess = null
let publicClient
let ownerClient
let userClient
let owner
let user
let feeWallet
let contracts

async function isRpcReady() {
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
    })
    const json = await response.json()
    return json?.result === '0x7a69'
  } catch {
    return false
  }
}

async function ensureHardhatNode() {
  if (await isRpcReady()) return
  hardhatNodeProcess = spawn('npx', ['hardhat', 'node', '--hostname', '127.0.0.1', '--port', '8545'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Hardhat node did not start in time')), 20_000)
    const onData = (chunk) => {
      if (String(chunk).includes('Started HTTP and WebSocket JSON-RPC server')) {
        clearTimeout(timeout)
        resolve()
      }
    }
    hardhatNodeProcess.stdout.on('data', onData)
    hardhatNodeProcess.stderr.on('data', onData)
    hardhatNodeProcess.on('exit', (code) => reject(new Error(`Hardhat node exited before tests started: ${code}`)))
  })
}

async function getUnlockedAccounts() {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_accounts', params: [], id: 2 }),
  })
  const json = await response.json()
  if (!Array.isArray(json?.result) || json.result.length < 3) {
    throw new Error('Hardhat node must expose at least three unlocked accounts')
  }
  return json.result.map((account) => getAddress(account))
}

function stopHardhatNode() {
  if (hardhatNodeProcess) {
    hardhatNodeProcess.stdout.destroy()
    hardhatNodeProcess.stderr.destroy()
    hardhatNodeProcess.kill('SIGKILL')
    hardhatNodeProcess = null
  }
}

process.on('exit', stopHardhatNode)

function compileSources(sources) {
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = (output.errors || []).filter((error) => error.severity === 'error')
  if (errors.length > 0) throw new Error(errors.map((error) => error.formattedMessage).join('\n'))
  return output.contracts
}

async function deploy(source, name, args = []) {
  const contract = contracts[source][name]
  const hash = await ownerClient.deployContract({
    account: owner,
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    args,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  assert.ok(receipt.contractAddress, `${name} did not deploy`)
  return getContract({
    address: receipt.contractAddress,
    abi: contract.abi,
    client: { public: publicClient, wallet: ownerClient },
  })
}

async function expectRevert(label, fn) {
  try {
    await fn()
  } catch {
    console.log(`ok - ${label}`)
    return
  }
  throw new Error(`Expected revert: ${label}`)
}

function b20Params(name, symbol, admin) {
  return encodeAbiParameters(
    parseAbiParameters('(uint8 version, string name, string symbol, address initialAdmin, uint8 decimals)'),
    [[1, name, symbol, admin, 18]],
  )
}

async function run() {
  await ensureHardhatNode()
  ;[owner, user, feeWallet] = await getUnlockedAccounts()
  publicClient = createPublicClient({ chain: localChain, transport: http(RPC_URL) })
  ownerClient = createWalletClient({ account: owner, chain: localChain, transport: http(RPC_URL) })
  userClient = createWalletClient({ account: user, chain: localChain, transport: http(RPC_URL) })

  const mockSources = {
    'contracts/test/B20LaunchpadMocks.sol': { content: fs.readFileSync('contracts/test/B20LaunchpadMocks.sol', 'utf8') },
  }
  contracts = compileSources(mockSources)
  const factory = await deploy('contracts/test/B20LaunchpadMocks.sol', 'MockB20Factory')

  const mockFactoryAddress = getAddress(factory.address)
  const launcherSource = fs.readFileSync('contracts/BaseHubB20Launcher.sol', 'utf8')
    .replace(PROD_B20_FACTORY, mockFactoryAddress)
  const curveSource = fs.readFileSync('contracts/BaseHubB20BondingLaunchpad.sol', 'utf8')
    .replace(PROD_B20_FACTORY, mockFactoryAddress)
  contracts = compileSources({
    'contracts/BaseHubB20Launcher.sol': { content: launcherSource },
    'contracts/BaseHubB20BondingLaunchpad.sol': { content: curveSource },
    ...mockSources,
  })

  const launcher = await deploy('contracts/BaseHubB20Launcher.sol', 'BaseHubB20Launcher', [feeWallet])
  const curve = await deploy('contracts/BaseHubB20BondingLaunchpad.sol', 'BaseHubB20BondingLaunchpad', [
    feeWallet,
    ZERO_ADDRESS,
    ZERO_ADDRESS,
  ])

  const directSalt = keccak256(stringToBytes('direct-launch'))
  const directHash = await ownerClient.writeContract({
    address: launcher.address,
    abi: launcher.abi,
    functionName: 'createB20',
    args: [0, directSalt, b20Params('Direct Test', 'DTST', owner), []],
    value: parseEther('0.0008'),
  })
  await publicClient.waitForTransactionReceipt({ hash: directHash })
  const directToken = await launcher.read.getB20Address([0, owner, directSalt])
  assert.notEqual(directToken, ZERO_ADDRESS)
  console.log('ok - direct B20 launch creates a token')

  const curveSalt = keccak256(stringToBytes('curve-launch'))
  const curveHash = await userClient.writeContract({
    address: curve.address,
    abi: curve.abi,
    functionName: 'createCurveB20',
    args: ['Curve Test', 'CTST', 'mock curve token', 'ipfs://mock', 1000n, curveSalt],
    value: parseEther('0.001'),
  })
  await publicClient.waitForTransactionReceipt({ hash: curveHash })
  assert.equal(await curve.read.getAllTokensCount(), 1n)
  const [curveToken] = await curve.read.getTokens([0n, 1n])
  assert.notEqual(curveToken, ZERO_ADDRESS)
  console.log('ok - curve launch creates and lists a token')

  const quote = await curve.read.getTokensForETH([curveToken, parseEther('0.01')])
  assert.ok(quote > 0n)
  const buyHash = await userClient.writeContract({
    address: curve.address,
    abi: curve.abi,
    functionName: 'buy',
    args: [curveToken, (quote * 97n) / 100n],
    value: parseEther('0.01'),
  })
  await publicClient.waitForTransactionReceipt({ hash: buyHash })
  const coreAfterBuy = await curve.read.tokenCore([curveToken])
  const statsAfterBuy = await curve.read.tokenStats([curveToken])
  assert.ok(coreAfterBuy[3] > 0n)
  assert.equal(statsAfterBuy[0], 1n)
  console.log('ok - buy updates reserves and stats')

  const token = getContract({
    address: curveToken,
    abi: contracts['contracts/test/B20LaunchpadMocks.sol'].MockB20Token.abi,
    client: { public: publicClient, wallet: userClient },
  })
  const userBalance = await token.read.balanceOf([user])
  await token.write.approve([curve.address, maxUint256])
  await expectRevert('curve rejects oversell above real ETH liquidity', () =>
    curve.write.sell([curveToken, userBalance, 0n], { account: user }),
  )

  const sellAmount = userBalance / 100n
  const ethQuote = await curve.read.getETHForTokens([curveToken, sellAmount])
  assert.ok(ethQuote > 0n)
  const sellHash = await userClient.writeContract({
    address: curve.address,
    abi: curve.abi,
    functionName: 'sell',
    args: [curveToken, sellAmount, (ethQuote * 97n) / 100n],
  })
  await publicClient.waitForTransactionReceipt({ hash: sellHash })
  const statsAfterSell = await curve.read.tokenStats([curveToken])
  assert.equal(statsAfterSell[1], 1n)
  console.log('ok - sell works after unlimited approve')

  const creatorFees = await curve.read.fees([user])
  assert.ok(creatorFees > 0n)
  console.log('ok - creator fee accrues')

  console.log('All B20 launchpad local mock tests passed.')
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
}).finally(stopHardhatNode)
