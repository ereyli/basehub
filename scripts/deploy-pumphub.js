const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting PumpHubFactory deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy PumpHubFactory
  console.log("\n📄 Deploying PumpHubFactory...");
  const PumpHubFactory = await ethers.getContractFactory("PumpHubFactory");
  const pumpHubFactory = await PumpHubFactory.deploy();
  await pumpHubFactory.waitForDeployment();
  const pumpHubFactoryAddress = await pumpHubFactory.getAddress();
  console.log("✅ PumpHubFactory deployed to:", pumpHubFactoryAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  // Print summary
  console.log("\n🎉 Deployment Summary:");
  console.log("=====================");
  console.log("PumpHubFactory:", pumpHubFactoryAddress);
  console.log("Owner:", deployer.address);
  console.log("\n📋 Fee Structure:");
  console.log("- Token Creation Fee: 0.001 ETH (goes to platform)");
  console.log("- Trading Fee: 0.6% (0.3% platform + 0.3% creator)");
  console.log("\n💡 Update your .env file with:");
  console.log(`VITE_PUMPHUB_FACTORY_ADDRESS=${pumpHubFactoryAddress}`);

  // Save address to file
  const fs = require('fs');
  const addresses = {
    PumpHubFactory: pumpHubFactoryAddress,
    owner: deployer.address,
    network: {
      name: network.name,
      chainId: network.chainId.toString()
    },
    feeStructure: {
      creationFee: "0.001 ETH",
      tradingFee: "0.6%",
      platformShare: "0.3%",
      creatorShare: "0.3%"
    }
  };

  fs.writeFileSync(
    './deployed-pumphub.json',
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n💾 Addresses saved to deployed-pumphub.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
