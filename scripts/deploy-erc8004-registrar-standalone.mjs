import fs from 'node:fs'
import path from 'node:path'
import solc from 'solc'
import { ethers } from 'ethers'

const BASE_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const BASE_SEPOLIA_IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const DEFAULT_FEE_WALLET = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'

function compileRegistrar() {
  const sourcePath = path.resolve('contracts-erc8004/BaseHubERC8004Registrar.sol')
  const source = fs.readFileSync(sourcePath, 'utf8')
  const input = {
    language: 'Solidity',
    sources: {
      'BaseHubERC8004Registrar.sol': { content: source },
    },
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
  const errors = (output.errors || []).filter((item) => item.severity === 'error')
  if (errors.length) {
    throw new Error(errors.map((item) => item.formattedMessage).join('\n'))
  }
  const artifact = output.contracts['BaseHubERC8004Registrar.sol'].BaseHubERC8004Registrar
  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
  }
}

async function main() {
  const networkName = process.env.ERC8004_NETWORK || 'base'
  const isSepolia = networkName === 'baseSepolia' || networkName === 'base-sepolia'
  const rpcUrl = isSepolia ? BASE_SEPOLIA_RPC : BASE_RPC
  const identityRegistry =
    process.env.ERC8004_IDENTITY_REGISTRY ||
    (isSepolia ? BASE_SEPOLIA_IDENTITY_REGISTRY : BASE_IDENTITY_REGISTRY)
  const feeWallet = process.env.FEE_WALLET || DEFAULT_FEE_WALLET
  const feeEth = process.env.ERC8004_FEE_ETH

  if (process.env.COMPILE_ONLY === 'true') {
    compileRegistrar()
    console.log('Standalone ERC-8004 registrar compile OK')
    return
  }
  if (!process.env.PRIVATE_KEY) throw new Error('Set PRIVATE_KEY before deploying.')
  if (!feeEth) throw new Error('Set ERC8004_FEE_ETH to the current 1 USD worth of ETH before deploying.')

  const { abi, bytecode } = compileRegistrar()
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  const feeWei = ethers.parseEther(feeEth)

  console.log('Deploying BaseHubERC8004Registrar')
  console.log('Network:', isSepolia ? 'baseSepolia' : 'base')
  console.log('Deployer:', wallet.address)
  console.log('Identity Registry:', identityRegistry)
  console.log('Fee Wallet:', feeWallet)
  console.log('Fee ETH:', feeEth)

  const contract = await factory.deploy(identityRegistry, feeWallet, feeWei)
  await contract.waitForDeployment()
  console.log('BaseHubERC8004Registrar:', await contract.getAddress())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
