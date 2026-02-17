/** Only for compiling NFTCollection (NFT Launchpad). Do not use for other contracts. */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: "./contracts-nft-launchpad",
    cache: "./cache-nft-launchpad",
    artifacts: "./artifacts-nft-launchpad",
  },
  networks: {
    hardhat: { type: "edr-simulated", chainId: 1337 },
  },
};
