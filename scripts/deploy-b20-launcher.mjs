import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import solc from 'solc'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_FEE_WALLET = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'

function compile() {
  const contractPath = path.join(__dirname, '..', 'contracts', 'BaseHubB20Launcher.sol')
  const source = fs.readFileSync(contractPath, 'utf8')
  const input = {
    language: 'Solidity',
    sources: {
      'BaseHubB20Launcher.sol': { content: source },
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
  const errors = output.errors || []
  const fatal = errors.filter((err) => err.severity === 'error')
  for (const err of errors) console.warn(err.formattedMessage)
  if (fatal.length) throw new Error('Solidity compilation failed')
  return output.contracts['BaseHubB20Launcher.sol'].BaseHubB20Launcher
}

async function main() {
  const rpcUrl = process.env.RPC_URL
  const privateKey = process.env.PRIVATE_KEY
  const feeWallet = process.env.FEE_WALLET || DEFAULT_FEE_WALLET
  if (!rpcUrl) throw new Error('Set RPC_URL')
  if (!privateKey) throw new Error('Set PRIVATE_KEY')

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  const network = await provider.getNetwork()
  console.log('Deploying BaseHubB20Launcher')
  console.log('Chain ID:', network.chainId.toString())
  console.log('Deployer:', wallet.address)
  console.log('Fee Wallet:', feeWallet)
  console.log('Fee ETH:', '0.0008')

  const compiled = compile()
  const factory = new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, wallet)
  const contract = await factory.deploy(feeWallet)
  console.log('Tx:', contract.deploymentTransaction().hash)
  await contract.waitForDeployment()
  console.log('BaseHubB20Launcher:', await contract.getAddress())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
