const { ethers } = require("hardhat");

const BASE_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const BASE_SEPOLIA_IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const DEFAULT_FEE_WALLET = "0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const identityRegistry =
    process.env.ERC8004_IDENTITY_REGISTRY ||
    (chainId === 84532 ? BASE_SEPOLIA_IDENTITY_REGISTRY : BASE_IDENTITY_REGISTRY);
  const feeWallet = process.env.FEE_WALLET || DEFAULT_FEE_WALLET;
  const feeEth = process.env.ERC8004_FEE_ETH;
  if (!feeEth && chainId !== 1337 && chainId !== 31337) {
    throw new Error("Set ERC8004_FEE_ETH to the current 1 USD worth of ETH before deploying.");
  }
  const resolvedFeeEth = feeEth || "0.00025";
  const feeWei = ethers.parseEther(resolvedFeeEth);

  console.log("Deploying BaseHubERC8004Registrar");
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", chainId);
  console.log("Identity Registry:", identityRegistry);
  console.log("Fee Wallet:", feeWallet);
  console.log("Fee ETH:", resolvedFeeEth);

  const Registrar = await ethers.getContractFactory("BaseHubERC8004Registrar");
  const registrar = await Registrar.deploy(identityRegistry, feeWallet, feeWei);
  await registrar.waitForDeployment();

  console.log("BaseHubERC8004Registrar:", await registrar.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
