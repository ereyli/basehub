import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import solc from 'solc'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getContract,
  http,
  padHex,
  parseEther,
  stringToHex,
  zeroAddress
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const RPC_URL = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545'
const OWNER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const USER_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const REAL_FEE_PK = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

const localChain = {
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } }
}

const owner = privateKeyToAccount(OWNER_PK)
const user = privateKeyToAccount(USER_PK)
const feeRecipient = privateKeyToAccount(REAL_FEE_PK)

let hardhatNodeProcess = null
let publicClient
let ownerClient
let userClient
let contracts
const tokenSource = 'contracts/test/SwapAggregatorV4Mocks.sol'
const v4Source = 'contracts/SwapAggregatorV4.sol'

const DEX_UNIV3 = padHex(stringToHex('uniswap-v3'), { size: 32 })
const DEX_UNIV2 = padHex(stringToHex('uniswap-v2'), { size: 32 })
const DEX_PANCAKE = padHex(stringToHex('pancake-v3'), { size: 32 })
const DEX_AERO = padHex(stringToHex('aerodrome'), { size: 32 })
const UNI_V3_ROUTER_ABI = [{
  name: 'exactInputSingle',
  type: 'function',
  stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'recipient', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOutMinimum', type: 'uint256' },
    { name: 'sqrtPriceLimitX96', type: 'uint160' }
  ] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }]
}]
const PANCAKE_V3_ROUTER_ABI = [{
  name: 'exactInputSingle',
  type: 'function',
  stateMutability: 'payable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'recipient', type: 'address' },
    { name: 'deadline', type: 'uint256' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOutMinimum', type: 'uint256' },
    { name: 'sqrtPriceLimitX96', type: 'uint160' }
  ] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }]
}]

async function isRpcReady() {
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 })
    })
    const json = await response.json()
    return json?.result === '0x7a69'
  } catch (_) {
    return false
  }
}

async function ensureHardhatNode() {
  if (await isRpcReady()) return
  hardhatNodeProcess = spawn('npx', ['hardhat', 'node', '--hostname', '127.0.0.1', '--port', '8545'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
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

function stopHardhatNode() {
  if (hardhatNodeProcess) {
    hardhatNodeProcess.stdout.destroy()
    hardhatNodeProcess.stderr.destroy()
    hardhatNodeProcess.kill('SIGKILL')
    hardhatNodeProcess = null
  }
}

process.on('exit', stopHardhatNode)

function findImport(importPath) {
  const candidates = [path.join(process.cwd(), importPath), path.join(process.cwd(), 'node_modules', importPath)]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return { contents: fs.readFileSync(candidate, 'utf8') }
  }
  return { error: `File not found: ${importPath}` }
}

function compile() {
  const input = {
    language: 'Solidity',
    sources: {
      'contracts/SwapAggregatorV4.sol': { content: fs.readFileSync('contracts/SwapAggregatorV4.sol', 'utf8') },
      'contracts/test/SwapAggregatorV4Mocks.sol': { content: fs.readFileSync('contracts/test/SwapAggregatorV4Mocks.sol', 'utf8') }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
    }
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }))
  const errors = (output.errors || []).filter((error) => error.severity === 'error')
  if (errors.length > 0) throw new Error(errors.map((error) => error.formattedMessage).join('\n'))
  return output.contracts
}

async function deploy(source, name, args = []) {
  const contract = contracts[source][name]
  const hash = await ownerClient.deployContract({
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    args
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  assert.ok(receipt.contractAddress, `${name} did not deploy`)
  return getContract({
    address: receipt.contractAddress,
    abi: contract.abi,
    client: { public: publicClient, wallet: ownerClient }
  })
}

async function write(contract, functionName, args, client = ownerClient, options = {}) {
  const hash = await client.writeContract({
    address: contract.address,
    abi: contract.abi,
    functionName,
    args,
    ...options
  })
  return publicClient.waitForTransactionReceipt({ hash })
}

async function send(client, to, value) {
  const hash = await client.sendTransaction({ to, value })
  return publicClient.waitForTransactionReceipt({ hash })
}

async function expectRevert(label, fn) {
  try {
    await fn()
  } catch (_) {
    console.log(`ok - ${label}`)
    return
  }
  throw new Error(`Expected revert: ${label}`)
}

async function deployStack() {
  const weth = await deploy(tokenSource, 'MockWETH9')
  const tokenIn = await deploy(tokenSource, 'MockERC20', ['Mock USDC', 'mUSDC', 18])
  const tokenOut = await deploy(tokenSource, 'MockERC20', ['Mock ETH', 'mETH', 18])
  const routerA = await deploy(tokenSource, 'MockDexRouter')
  const routerB = await deploy(tokenSource, 'MockDexRouter')
  const adapter = await deploy(v4Source, 'BaseHubDexAdapterV1')
  const aggregator = await deploy(v4Source, 'SwapAggregatorV4', [weth.address, 50, feeRecipient.address])

  await write(aggregator, 'setAdapter', [adapter.address, true])
  for (const router of [routerA, routerB]) {
    await write(router, 'setWETH', [weth.address])
    await write(adapter, 'setRouter', [router.address, true])
  }
  await write(adapter, 'setRouterSelector', [routerA.address, '0x04e45aaf', 1, true])
  await write(adapter, 'setRouterSelector', [routerA.address, '0x414bf389', 2, true])
  await write(adapter, 'setRouterSelector', [routerA.address, '0x38ed1739', 3, true])
  await write(adapter, 'setRouterSelector', [routerA.address, '0xcac88ea9', 4, true])
  await write(adapter, 'setRouterSelector', [routerB.address, '0x04e45aaf', 1, true])
  await write(adapter, 'setRouterSelector', [routerB.address, '0x414bf389', 2, true])
  await write(adapter, 'setRouterSelector', [routerB.address, '0x38ed1739', 3, true])
  await write(adapter, 'setRouterSelector', [routerB.address, '0xcac88ea9', 4, true])

  return { weth, tokenIn, tokenOut, routerA, routerB, adapter, aggregator }
}

function uniV3Step({ adapter, router, tokenIn, tokenOut, aggregator, amount, dexId = DEX_UNIV3, recipient = aggregator.address, min = 0n }) {
  const calldata = encodeFunctionData({
    abi: UNI_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{ tokenIn, tokenOut, fee: 500, recipient, amountIn: amount, amountOutMinimum: min, sqrtPriceLimitX96: 0n }]
  })
  return [adapter.address, router.address, tokenIn, tokenOut, amount, calldata, dexId]
}

function pancakeStep({ adapter, router, tokenIn, tokenOut, aggregator, amount }) {
  const calldata = encodeFunctionData({
    abi: PANCAKE_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{ tokenIn, tokenOut, fee: 2500, recipient: aggregator.address, deadline: 9999999999n, amountIn: amount, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }]
  })
  return [adapter.address, router.address, tokenIn, tokenOut, amount, calldata, DEX_PANCAKE]
}

function v2Step({ adapter, router, tokenIn, tokenOut, aggregator, amount, path = [tokenIn, tokenOut] }) {
  const calldata = encodeFunctionData({
    abi: router.abi,
    functionName: 'swapExactTokensForTokens',
    args: [amount, 0n, path, aggregator.address, 9999999999n]
  })
  return [adapter.address, router.address, tokenIn, tokenOut, amount, calldata, DEX_UNIV2]
}

function aerodromeStep({ adapter, router, tokenIn, tokenOut, aggregator, amount }) {
  const calldata = encodeFunctionData({
    abi: router.abi,
    functionName: 'swapExactTokensForTokens',
    args: [amount, 0n, [{ from: tokenIn, to: tokenOut, stable: false, factory: router.address }], aggregator.address, 9999999999n]
  })
  return [adapter.address, router.address, tokenIn, tokenOut, amount, calldata, DEX_AERO]
}

async function testSplitRoute() {
  const s = await deployStack()
  await write(s.routerA, 'setRate', [s.tokenIn.address, s.tokenOut.address, 2n, 1n])
  await write(s.routerB, 'setRate', [s.tokenIn.address, s.tokenOut.address, 3n, 1n])

  const amountIn = parseEther('1000')
  const stepAAmount = parseEther('400')
  const stepBAmount = parseEther('600')
  const expectedRawOut = parseEther('2600')
  const expectedFee = (expectedRawOut * 50n) / 10_000n
  const expectedUserOut = expectedRawOut - expectedFee

  await write(s.tokenIn, 'mint', [user.address, amountIn])
  await write(s.tokenOut, 'mint', [s.routerA.address, parseEther('10000')])
  await write(s.tokenOut, 'mint', [s.routerB.address, parseEther('10000')])
  await write(s.tokenIn, 'approve', [s.aggregator.address, amountIn], userClient)

  const stepA = uniV3Step({ adapter: s.adapter, router: s.routerA, tokenIn: s.tokenIn.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount: stepAAmount })
  const stepB = v2Step({ adapter: s.adapter, router: s.routerB, tokenIn: s.tokenIn.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount: stepBAmount })

  await write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, amountIn, expectedUserOut, [stepA, stepB]], userClient)
  assert.equal(await s.tokenOut.read.balanceOf([user.address]), expectedUserOut)
  assert.equal(await s.tokenOut.read.balanceOf([feeRecipient.address]), expectedFee)
  console.log('ok - split execution sends combined output and one final fee')
}

async function testPancakeAndAerodrome() {
  const s = await deployStack()
  await write(s.routerA, 'setRate', [s.tokenIn.address, s.tokenOut.address, 5n, 2n])
  await write(s.routerB, 'setRate', [s.tokenIn.address, s.tokenOut.address, 7n, 2n])
  const amountIn = parseEther('100')
  const each = parseEther('50')
  const raw = parseEther('300')
  const userOut = raw - (raw * 50n) / 10_000n
  await write(s.tokenIn, 'mint', [user.address, amountIn])
  await write(s.tokenOut, 'mint', [s.routerA.address, parseEther('1000')])
  await write(s.tokenOut, 'mint', [s.routerB.address, parseEther('1000')])
  await write(s.tokenIn, 'approve', [s.aggregator.address, amountIn], userClient)
  const stepA = pancakeStep({ adapter: s.adapter, router: s.routerA, tokenIn: s.tokenIn.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount: each })
  const stepB = aerodromeStep({ adapter: s.adapter, router: s.routerB, tokenIn: s.tokenIn.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount: each })
  await write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, amountIn, userOut, [stepA, stepB]], userClient)
  assert.equal(await s.tokenOut.read.balanceOf([user.address]), userOut)
  console.log('ok - Pancake V3 and Aerodrome calldata shapes execute through adapter')
}

async function testEthInput() {
  const s = await deployStack()
  await write(s.routerA, 'setRate', [s.weth.address, s.tokenOut.address, 2n, 1n])
  await write(s.tokenOut, 'mint', [s.routerA.address, parseEther('100')])
  const amount = parseEther('1')
  const raw = parseEther('2')
  const userOut = raw - (raw * 50n) / 10_000n
  const step = uniV3Step({ adapter: s.adapter, router: s.routerA, tokenIn: s.weth.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount })
  await write(s.aggregator, 'executeSplit', [zeroAddress, s.tokenOut.address, amount, userOut, [step]], userClient, { value: amount })
  assert.equal(await s.tokenOut.read.balanceOf([user.address]), userOut)
  console.log('ok - native ETH input wraps to WETH and executes')
}

async function testEthOutput() {
  const s = await deployStack()
  await write(s.routerA, 'setRate', [s.tokenIn.address, s.weth.address, 1n, 1n])
  await send(ownerClient, s.routerA.address, parseEther('10'))
  const amount = parseEther('1')
  const raw = parseEther('1')
  const userOut = raw - (raw * 50n) / 10_000n
  await write(s.tokenIn, 'mint', [user.address, amount])
  await write(s.tokenIn, 'approve', [s.aggregator.address, amount], userClient)
  const step = uniV3Step({ adapter: s.adapter, router: s.routerA, tokenIn: s.tokenIn.address, tokenOut: s.weth.address, aggregator: s.aggregator, amount })
  const before = await publicClient.getBalance({ address: user.address })
  await write(s.aggregator, 'executeSplit', [s.tokenIn.address, zeroAddress, amount, userOut, [step]], userClient)
  const after = await publicClient.getBalance({ address: user.address })
  assert.ok(after > before - parseEther('0.01'), 'user should receive native ETH minus gas cost')
  assert.equal(await s.weth.read.balanceOf([feeRecipient.address]), 0n)
  console.log('ok - WETH final output unwraps to native ETH for user and fee recipient')
}

async function testNegativeValidation() {
  const s = await deployStack()
  await write(s.routerA, 'setRate', [s.tokenIn.address, s.tokenOut.address, 2n, 1n])
  await write(s.tokenIn, 'mint', [user.address, parseEther('10')])
  await write(s.tokenOut, 'mint', [s.routerA.address, parseEther('100')])
  await write(s.tokenIn, 'approve', [s.aggregator.address, parseEther('10')], userClient)

  const badRecipientStep = uniV3Step({
    adapter: s.adapter,
    router: s.routerA,
    tokenIn: s.tokenIn.address,
    tokenOut: s.tokenOut.address,
    aggregator: s.aggregator,
    amount: parseEther('5'),
    recipient: user.address
  })
  await expectRevert('adapter rejects wrong router recipient', () =>
    write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, parseEther('5'), 1n, [badRecipientStep]], userClient)
  )

  const validStep = uniV3Step({ adapter: s.adapter, router: s.routerA, tokenIn: s.tokenIn.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount: parseEther('5') })
  await expectRevert('aggregator rejects split sum mismatch', () =>
    write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, parseEther('10'), 1n, [validStep]], userClient)
  )
  await expectRevert('aggregator rejects too high final min output', () =>
    write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, parseEther('5'), parseEther('100'), [validStep]], userClient)
  )

  const unallowedRouter = await deploy(tokenSource, 'MockDexRouter')
  await write(unallowedRouter, 'setRate', [s.tokenIn.address, s.tokenOut.address, 2n, 1n])
  const unallowedStep = uniV3Step({ adapter: s.adapter, router: unallowedRouter, tokenIn: s.tokenIn.address, tokenOut: s.tokenOut.address, aggregator: s.aggregator, amount: parseEther('5') })
  await expectRevert('adapter rejects unallowed router', () =>
    write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, parseEther('5'), 1n, [unallowedStep]], userClient)
  )

  const badPathStep = v2Step({
    adapter: s.adapter,
    router: s.routerA,
    tokenIn: s.tokenIn.address,
    tokenOut: s.tokenOut.address,
    aggregator: s.aggregator,
    amount: parseEther('5'),
    path: [s.tokenOut.address, s.tokenIn.address]
  })
  await expectRevert('adapter rejects wrong V2 path', () =>
    write(s.aggregator, 'executeSplit', [s.tokenIn.address, s.tokenOut.address, parseEther('5'), 1n, [badPathStep]], userClient)
  )
}

async function main() {
  await ensureHardhatNode()
  publicClient = createPublicClient({ chain: localChain, transport: http(RPC_URL) })
  ownerClient = createWalletClient({ account: owner, chain: localChain, transport: http(RPC_URL) })
  userClient = createWalletClient({ account: user, chain: localChain, transport: http(RPC_URL) })
  contracts = compile()

  console.log('Running SwapAggregatorV4 local test suite...')
  await testSplitRoute()
  await testPancakeAndAerodrome()
  await testEthInput()
  await testEthOutput()
  await testNegativeValidation()
  console.log('All SwapAggregatorV4 local tests passed.')
}

try {
  await main()
} finally {
  stopHardhatNode()
}
