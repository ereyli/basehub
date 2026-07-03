const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const feeWallet = process.env.FEE_WALLET || deployer.address;
  console.log("Fee wallet / owner:", feeWallet);

  // Deploy GM Game
  console.log("\n🌅 Deploying GMGame...");
  const GMGame = await ethers.getContractFactory("GMGame");
  const gmGame = await GMGame.deploy(feeWallet);
  await gmGame.waitForDeployment();
  const gmGameAddress = await gmGame.getAddress();
  console.log("✅ GMGame deployed to:", gmGameAddress);

  // Deploy GN Game
  console.log("\n🌙 Deploying GNGame...");
  const GNGame = await ethers.getContractFactory("GNGame");
  const gnGame = await GNGame.deploy(feeWallet);
  await gnGame.waitForDeployment();
  const gnGameAddress = await gnGame.getAddress();
  console.log("✅ GNGame deployed to:", gnGameAddress);

  // Deploy Flip Game
  console.log("\n🪙 Deploying FlipGame...");
  const FlipGame = await ethers.getContractFactory("FlipGame");
  const flipGame = await FlipGame.deploy(feeWallet);
  await flipGame.waitForDeployment();
  const flipGameAddress = await flipGame.getAddress();
  console.log("✅ FlipGame deployed to:", flipGameAddress);

  // Deploy Lucky Number Game
  console.log("\n🎲 Deploying LuckyNumber...");
  const LuckyNumber = await ethers.getContractFactory("LuckyNumber");
  const luckyNumber = await LuckyNumber.deploy(feeWallet);
  await luckyNumber.waitForDeployment();
  const luckyNumberAddress = await luckyNumber.getAddress();
  console.log("✅ LuckyNumber deployed to:", luckyNumberAddress);

  // Deploy Dice Roll Game
  console.log("\n🎲 Deploying DiceRoll...");
  const DiceRoll = await ethers.getContractFactory("DiceRoll");
  const diceRoll = await DiceRoll.deploy(feeWallet);
  await diceRoll.waitForDeployment();
  const diceRollAddress = await diceRoll.getAddress();
  console.log("✅ DiceRoll deployed to:", diceRollAddress);

  // Print summary
  console.log("\n🎉 Deployment Summary:");
  console.log("=====================");
  console.log("Fee wallet / owner:", feeWallet);
  console.log("GMGame:", gmGameAddress);
  console.log("GNGame:", gnGameAddress);
  console.log("FlipGame:", flipGameAddress);
  console.log("LuckyNumber:", luckyNumberAddress);
  console.log("DiceRoll:", diceRollAddress);
  console.log("\n📋 Copy these addresses to your config file!");

  // Save addresses to file
  const addresses = {
    feeWallet,
    GMGame: gmGameAddress,
    GNGame: gnGameAddress,
    FlipGame: flipGameAddress,
    LuckyNumber: luckyNumberAddress,
    DiceRoll: diceRollAddress,
    network: await deployer.provider.getNetwork()
  };

  const fs = require('fs');
  fs.writeFileSync(
    './deployed-addresses.json',
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n💾 Addresses saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
