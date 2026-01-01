const hre = require("hardhat");

async function main() {
  const SWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
  const FEE_BPS = 30;
  const FEE_RECIPIENT = process.env.FEE_RECIPIENT || "0xYourFeeRecipientAddress";

  console.log("Deploying UniMiniAggregator...");
  console.log("SwapRouter:", SWAP_ROUTER);
  console.log("Fee BPS:", FEE_BPS);
  console.log("Fee Recipient:", FEE_RECIPIENT);

  const UniMiniAggregator = await hre.ethers.getContractFactory("UniMiniAggregator");
  const aggregator = await UniMiniAggregator.deploy(
    SWAP_ROUTER,
    FEE_BPS,
    FEE_RECIPIENT
  );

  await aggregator.waitForDeployment();

  const address = await aggregator.getAddress();
  console.log("\nUniMiniAggregator deployed to:", address);
  console.log("\nVerify with:");
  console.log(`npx hardhat verify --network base ${address} ${SWAP_ROUTER} ${FEE_BPS} ${FEE_RECIPIENT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});




