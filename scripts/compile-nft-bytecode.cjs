/**
 * NFT Launchpad only: compile NFTLaunchCollection.sol and write bytecode to src/config/nftCollection.js
 * Run: node scripts/compile-nft-bytecode.cjs
 * Requires: solc@0.8.20 (npm install --save-dev solc@0.8.20)
 */
const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, '..', 'contracts-nft-launchpad', 'NFTLaunchCollection.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

function findImports(importPath) {
  if (importPath.startsWith('@openzeppelin/')) {
    const rel = importPath.replace('@openzeppelin/contracts/', '');
    const full = path.join(__dirname, '..', 'node_modules', '@openzeppelin', 'contracts', rel);
    try {
      return { contents: fs.readFileSync(full, 'utf8') };
    } catch (e) {
      return { error: e.message };
    }
  }
  return { error: 'Unknown import' };
}

const input = {
  language: 'Solidity',
  sources: { 'NFTLaunchCollection.sol': { content: contractSource } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['evm.bytecode'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const bytecode = output?.contracts?.['NFTLaunchCollection.sol']?.NFTLaunchCollection?.evm?.bytecode?.object;
if (bytecode) {
  const configPath = path.join(__dirname, '..', 'src', 'config', 'nftCollection.js');
  const content = `/**
 * NFTLaunchCollection contract for NFT Launchpad (public mint).
 * Constructor: (name, symbol, maxSupply, mintPrice, fundsRecipient, baseTokenURI, contractURI)
 * Bytecode from: contracts-nft-launchpad/NFTLaunchCollection.sol (compiled with solc 0.8.20).
 * Re-run: node scripts/compile-nft-bytecode.cjs to regenerate.
 */
export const NFT_COLLECTION_BYTECODE = '${bytecode}'

/**
 * ABI for the public mint function and read functions used by mint pages.
 */
export const NFT_LAUNCH_COLLECTION_ABI = [
  { inputs: [{ name: 'quantity', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'maxSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'mintPrice', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'saleActive', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'fundsRecipient', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'contractURI', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'toggleSale', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'newPrice', type: 'uint256' }], name: 'setMintPrice', outputs: [], stateMutability: 'nonpayable', type: 'function' },
]
`;
  fs.writeFileSync(configPath, content);
  console.log('OK: NFT_COLLECTION_BYTECODE written to src/config/nftCollection.js (length:', bytecode.length, ')');
} else {
  console.error('Compile failed:', JSON.stringify(output.errors || output, null, 2));
  process.exit(1);
}
