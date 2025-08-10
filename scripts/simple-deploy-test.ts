import { ethers } from "hardhat";

async function main() {
  console.log("Deploying CLASH Token to local network...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Get the contract factory
  const ClashToken = await ethers.getContractFactory("ClashToken");
  
  // Deploy the contract with treasury address
  const clashToken = await ClashToken.deploy(deployer.address);
  await clashToken.waitForDeployment();
  
  console.log(`CLASH Token deployed to: ${await clashToken.getAddress()}`);
  
  // Test basic functionality
  const totalSupply = await clashToken.totalSupply();
  const name = await clashToken.name();
  const symbol = await clashToken.symbol();
  
  console.log(`Token Name: ${name}`);
  console.log(`Token Symbol: ${symbol}`);
  console.log(`Total Supply: ${ethers.formatEther(totalSupply)} CLASH`);
  
  console.log("✅ Smart contracts are running successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
