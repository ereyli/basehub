import fs from 'fs'
import path from 'path'
import assert from 'node:assert/strict'
import solc from 'solc'
import { ethers } from 'ethers'
import hre from 'hardhat'

const readImport = (importPath) => {
  const candidates = [path.resolve(importPath), path.resolve('contracts', importPath), path.resolve('node_modules', importPath)]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  return found ? { contents: fs.readFileSync(found, 'utf8') } : { error: `Import not found: ${importPath}` }
}

const compile = () => {
  const input = {
    language: 'Solidity',
    sources: {
      'contracts/PumpHubFactory.sol': { content: fs.readFileSync('contracts/PumpHubFactory.sol', 'utf8') },
      'contracts/test/PumpHubRouterMock.sol': { content: fs.readFileSync('contracts/test/PumpHubRouterMock.sol', 'utf8') },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: readImport }))
  for (const item of output.errors || []) {
    if (item.severity === 'error') console.error(item.formattedMessage)
  }
  assert.equal((output.errors || []).some((item) => item.severity === 'error'), false, 'Solidity compilation failed')
  return output.contracts
}

const deploy = async (artifact, signer, args = []) => {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, signer)
  const contract = await factory.deploy(...args)
  await contract.waitForDeployment()
  return contract
}

const main = async () => {
  const compiled = compile()
  const connection = await hre.network.connect()
  const provider = new ethers.BrowserProvider(connection.provider)
  const [deployer, admin, creator, buyer] = await Promise.all([0, 1, 2, 3].map((index) => provider.getSigner(index)))
  const adminAddress = await admin.getAddress()
  const creatorAddress = await creator.getAddress()
  const buyerAddress = await buyer.getAddress()
  const pair = ethers.getAddress('0x0000000000000000000000000000000000001111')
  const weth = ethers.getAddress('0x0000000000000000000000000000000000002222')
  const dead = ethers.getAddress('0x000000000000000000000000000000000000dEaD')

  const factoryMock = await deploy(compiled['contracts/test/PumpHubRouterMock.sol'].PumpHubFactoryMock, deployer, [pair])
  const router = await deploy(compiled['contracts/test/PumpHubRouterMock.sol'].PumpHubRouterMock, deployer, [await factoryMock.getAddress(), weth])
  const pump = await deploy(compiled['contracts/PumpHubFactory.sol'].PumpHubFactory, deployer, [await router.getAddress(), weth, adminAddress])

  assert.equal(await pump.owner(), adminAddress)
  assert.equal(await pump.ROUTER(), await router.getAddress())
  assert.equal(await pump.WETH(), weth)

  const readBalance = async (account) => BigInt(await connection.provider.request({
    method: 'eth_getBalance',
    params: [account, 'latest'],
  }))
  const adminBefore = await readBalance(adminAddress)
  const createTx = await pump.connect(creator).createToken('Robinhood Test', 'RHT', 'mock launch', 'ipfs://test', 0, {
    value: ethers.parseEther('0.001'),
  })
  const createReceipt = await createTx.wait()
  const createdLog = createReceipt.logs
    .map((log) => { try { return pump.interface.parseLog(log) } catch { return null } })
    .find((log) => log?.name === 'TC')
  assert.ok(createdLog, 'TC event missing')
  const token = createdLog.args.t
  assert.equal(await pump.getAllTokensCount(), 1n)
  assert.equal((await readBalance(adminAddress)) - adminBefore, ethers.parseEther('0.001'))

  const buyValue = ethers.parseEther('5.031')
  const buyTx = await pump.connect(buyer).buy(token, 0, { value: buyValue })
  await buyTx.wait()

  const totalFee = (buyValue * 60n) / 10000n
  const creatorFee = totalFee - totalFee / 2n
  assert.equal(await pump.fees(creatorAddress), creatorFee)
  assert.ok(await new ethers.Contract(token, ['function balanceOf(address) view returns(uint256)'], provider).balanceOf(buyerAddress) > 0n)

  const core = await pump.tokenCore(token)
  assert.equal(core.graduated, true)
  assert.equal(core.uniswapPair, pair)
  assert.equal(await router.lastLiquidityTo(), dead)
  assert.ok(await router.lastLiquidityETH() >= ethers.parseEther('5'))
  assert.ok(await router.lastLiquidityTokens() > 0n)

  console.log('PumpHub local tests passed')
  console.log('- configurable router/WETH/admin')
  console.log('- 0.001 ETH creation fee to admin')
  console.log('- 0.6% trading fee split')
  console.log('- 5 ETH graduation and LP sent to dead address')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
