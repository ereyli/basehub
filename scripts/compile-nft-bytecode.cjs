/**
 * NFT Launchpad only: compile NFTCollection.sol and write bytecode to src/config/nftCollection.js
 * Run: node scripts/compile-nft-bytecode.cjs
 * Requires: solc@0.8.20 (npm install --save-dev solc@0.8.20)
 */
const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, '..', 'contracts-nft-launchpad', 'NFTCollection.sol');
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
  sources: { 'NFTCollection.sol': { content: contractSource } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['evm.bytecode'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const bytecode = output?.contracts?.['NFTCollection.sol']?.NFTCollection?.evm?.bytecode?.object;
if (bytecode) {
  const configPath = path.join(__dirname, '..', 'src', 'config', 'nftCollection.js');
  const content = `/**
 * NFTCollection contract for NFT Launchpad.
 * Bytecode from: contracts-nft-launchpad/NFTCollection.sol (compiled with solc 0.8.20).
 * Re-run: node scripts/compile-nft-bytecode.cjs to regenerate.
 */
export const NFT_COLLECTION_BYTECODE = '${bytecode}'
`;
  fs.writeFileSync(configPath, content);
  console.log('OK: NFT_COLLECTION_BYTECODE written to src/config/nftCollection.js (length:', bytecode.length, ')');
} else {
  console.error('Compile failed:', JSON.stringify(output.errors || output, null, 2));
  process.exit(1);
}
