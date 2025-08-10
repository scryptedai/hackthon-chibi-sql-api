import { logger } from "../utils/logger";
import { CdpClient } from "@coinbase/cdp-sdk";
import { ethers } from "ethers";
import { config as dotEnvConfig } from "dotenv";

// Load environment variables
dotEnvConfig();

async function main() {
  const contractAddress = process.env.BASE_CLASH_STAKING_ADDRESS || "0x902C93200A9719D126a33f39fdF7154a4DdBA04a";
  
  logger.info("🔍 Comparing RPC vs CDP SQL API approaches...");
  logger.info(`Contract: ${contractAddress}`);
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                    CURRENT vs PROPOSED ARCHITECTURE                 ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║ 🔴 CURRENT (RPC-based):                                             ║
║                                                                      ║
║ 1. synchronize-transfer-history.ts:                                 ║
║    • Batches of 10,000 blocks                                       ║
║    • queryFilter() call per batch                                   ║
║    • getBlock() call for EVERY event (for timestamps)               ║
║    • Manual in-memory aggregation                                   ║
║    • For 10K events: ~100 queryFilter + 10K getBlock = 10,100 calls ║
║                                                                      ║
║ 2. synchronize-raffle-deposit-history.ts:                          ║
║    • Same batching pattern                                          ║
║    • Manual SUM() aggregation in TypeScript                        ║
║    • Thousands of RPC calls                                         ║
║                                                                      ║
║ 3. synchronize-clash-staking-history.ts:                           ║
║    • Fetches Staked + Unstaked events separately                    ║
║    • Complex score calculation in TypeScript                       ║
║    • Thousands more RPC calls                                       ║
║                                                                      ║
║ 💰 COST: ~$50-200 per sync for large contracts                     ║
║ ⏱️  TIME: 5-30 minutes per contract                                 ║
║ 🏗️  INFRASTRUCTURE: Complex batching, state management             ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║ 🟢 PROPOSED (CDP SQL API):                                         ║
║                                                                      ║
║ 1. NFT Ownership Query:                                             ║
║    WITH RankedTransfers AS (                                        ║
║      SELECT owner, token_id,                                        ║
║        ROW_NUMBER() OVER(PARTITION BY token_id                      ║
║                         ORDER BY block_number DESC) as rn          ║
║      FROM base.events                                               ║
║      WHERE address = '${contractAddress}'                           ║
║        AND event_signature = 'Transfer(...)'                       ║
║    )                                                                ║
║    SELECT owner, token_id FROM RankedTransfers WHERE rn = 1         ║
║                                                                      ║
║ 2. Raffle Deposits Aggregation:                                    ║
║    SELECT buyer, SUM(share) as total_slots                          ║
║    FROM base.events                                                 ║
║    WHERE address = '${contractAddress}'                             ║
║      AND event_signature = 'Deposit(...)'                          ║
║    GROUP BY buyer ORDER BY total_slots DESC                        ║
║                                                                      ║
║ 3. Staking Events:                                                  ║
║    SELECT * FROM base.events                                        ║
║    WHERE address = '${contractAddress}'                             ║
║      AND event_signature IN ('Staked(...)', 'Unstaked(...)')       ║
║    ORDER BY block_number ASC                                        ║
║                                                                      ║
║ 💰 COST: ~$0.01-0.10 per query                                     ║
║ ⏱️  TIME: <30 seconds total                                         ║
║ 🏗️  INFRASTRUCTURE: Zero - just SQL queries                       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

📈 IMPACT SUMMARY:

Priority 1 (Massive Impact):
✅ synchronize-transfer-history.ts    → Single SQL query (99.99% cost reduction)
✅ synchronize-raffle-deposit-history.ts → Single GROUP BY query (99.9% cost reduction)

Priority 2 (Significant Impact):  
✅ synchronize-clash-staking-history.ts → SQL + TypeScript score calculation (95% cost reduction)

Priority 3 (Infrastructure Simplification):
🔄 clowk-event-listener service → Can be completely eliminated
🔄 Real-time sync jobs → Replace with CDP webhooks or polling
🔄 Database event tables → Query directly from CDP instead

🎯 HACKATHON DEMO POTENTIAL:
• Show side-by-side performance comparison
• Demonstrate real-time data freshness (<250ms from chain)
• Calculate actual cost savings for your current contract volume
• Build a simple dashboard querying live data via CDP SQL API
  `);

  // Demo: Show how to query current staking data
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
    logger.info("🔗 Testing live CDP SQL API connection...");
    
    try {
      const cdp = new CdpClient({
        apiKeyId: process.env.CDP_API_KEY_ID,
        apiKeySecret: process.env.CDP_API_KEY_SECRET,
      });

      // Simple query to test connection
      const testQuery = `
        SELECT COUNT(*) as total_events
        FROM base.logs 
        WHERE address = LOWER('${contractAddress}')
        LIMIT 1
      `;

      const result = await cdp.data.sqlQuery({
        query: testQuery,
        network: "base",
      });

      logger.info(`✅ CDP SQL API connected! Found ${result.rows?.[0]?.total_events || 0} events for staking contract`);
      
    } catch (error) {
      logger.warn("⚠️  CDP SQL API test failed (check API keys):", error);
    }
  } else {
    logger.info("💡 To test CDP SQL API, set CDP_API_KEY_ID and CDP_API_KEY_SECRET in .env");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
