import { logger } from "../utils/logger";
import fetch from "node-fetch";
import { config as dotEnvConfig } from "dotenv";

// Load environment variables
dotEnvConfig();

async function main() {
  const stakingContractAddress = process.env.BASE_CLASH_STAKING_ADDRESS || "0x902C93200A9719D126a33f39fdF7154a4DdBA04a";
  
  logger.info("🧪 Testing CDP SQL API with simple approach...");
  logger.info(`Contract: ${stakingContractAddress}`);
  logger.info("Your credentials:");
  logger.info(`  CDP_API_KEY_NAME: ${process.env.CDP_API_KEY_NAME?.substring(0, 8)}...`);
  logger.info(`  CDP_API_KEY_SECRET: ${process.env.CDP_API_KEY_SECRET?.substring(0, 20)}...`);
  logger.info(`  CDP_WALLET_SECRET: ${process.env.CDP_WALLET_SECRET?.substring(0, 20)}...`);
  
  // Let's try a different approach - maybe use the CDP SDK directly
  try {
    const { CdpClient } = await import("@coinbase/cdp-sdk");
    
    logger.info("🔍 Trying to initialize CDP SDK client...");
    
    // Try different initialization methods
    let cdpClient;
    
    try {
      // Method 1: Using API key credentials
      cdpClient = new CdpClient({
        apiKeyId: process.env.CDP_API_KEY_NAME!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      });
      logger.info("✅ CDP Client initialized with API key only");
    } catch (e1) {
      try {
        // Method 2: Using all credentials
        cdpClient = new CdpClient({
          apiKeyId: process.env.CDP_API_KEY_NAME!,
          apiKeySecret: process.env.CDP_API_KEY_SECRET!,
          walletSecret: process.env.CDP_WALLET_SECRET!,
        });
        logger.info("✅ CDP Client initialized with all credentials");
      } catch (e2) {
        logger.error("Both initialization methods failed:", { e1: e1.message, e2: e2.message });
        throw new Error("Could not initialize CDP client");
      }
    }
    
    // Now let's see what methods are available
    logger.info("🔍 Exploring CDP client structure...");
    const props = Object.getOwnPropertyNames(cdpClient);
    logger.info("Available properties:", props);
    
    // Let's explore the prototype chain too
    const proto = Object.getPrototypeOf(cdpClient);
    const protoProps = Object.getOwnPropertyNames(proto);
    logger.info("Prototype properties:", protoProps);
    
    // Check each property that might contain data methods
    for (const prop of [...props, ...protoProps]) {
      if (prop.toLowerCase().includes('data') || prop.toLowerCase().includes('onchain') || prop.toLowerCase().includes('query')) {
        logger.info(`🔍 Found potential data property: ${prop}`);
        try {
          const propValue = (cdpClient as any)[prop];
          if (propValue && typeof propValue === 'object') {
            logger.info(`  ${prop} methods:`, Object.getOwnPropertyNames(propValue));
          }
        } catch (e) {
          logger.info(`  ${prop}: ${typeof (cdpClient as any)[prop]}`);
        }
      }
    }
    
    // Try to make a simple SQL query using the REST API directly since SDK might not expose it yet
    logger.info("🔍 Testing direct REST API approach...");
    
    const testQuery = `
      SELECT COUNT(*) as total_events
      FROM base.events 
      WHERE address = LOWER('${stakingContractAddress}')
      LIMIT 1
    `;
    
    // We'll use a simple API key approach for now
    const response = await fetch('https://api.cdp.coinbase.com/platform/v2/data/query/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_KEY_NAME}:${process.env.CDP_API_KEY_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: testQuery
      })
    });
    
    logger.info(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      logger.info("🔍 401 Unauthorized - Need proper JWT token generation");
    } else if (response.ok) {
      const data = await response.json();
      logger.info("✅ Query successful!", data);
    } else {
      const errorText = await response.text();
      logger.info("❌ Query failed:", errorText);
    }
    
    logger.info("🎯 Next steps:");
    logger.info("1. Your CDP credentials are loaded correctly");
    logger.info("2. CDP SDK client can be initialized");
    logger.info("3. We need to find the correct method for SQL queries");
    logger.info("4. Once we find it, we can replace the RPC polling!");
    
  } catch (error) {
    logger.error("❌ CDP SDK test failed:", error);
    
    logger.info("📋 Troubleshooting guide:");
    logger.info("1. Verify your CDP API keys are correct at https://portal.cdp.coinbase.com/");
    logger.info("2. Make sure the keys have the right permissions for onchain data");
    logger.info("3. The CDP_WALLET_SECRET might not be needed for SQL queries");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
