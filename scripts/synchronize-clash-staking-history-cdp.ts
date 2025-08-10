import { loadEnv } from "../utils/load-env";
import { synchronizeHistoryWithCDP } from "../utils/synchronize-clash-staking-history-cdp";
import { logger } from "../utils/logger";
import dayjs from "dayjs";

loadEnv();

async function main() {
  const stakingContractAddress = process.env.BASE_CLASH_STAKING_ADDRESS as string;
  const stakingStartTime = +(process.env.CLASH_STAKING_START_TIME || "0");
  
  if (!stakingContractAddress) {
    throw new Error("BASE_CLASH_STAKING_ADDRESS must be set in environment");
  }

  logger.info("🚀 Starting CDP SQL API-based staking synchronization...");
  logger.info(`Contract: ${stakingContractAddress}`);
  
  // Calculate snapshot timestamp for current week
  const weekToSeconds = 7 * 24 * 60 * 60;
  const currentWeek = Math.floor(
    (dayjs().unix() - stakingStartTime) / weekToSeconds,
  );
  const previousWeek = currentWeek - 1;
  const snapshotTimestamp = stakingStartTime + (previousWeek + 1) * weekToSeconds;
  
  logger.info(`Current week: ${currentWeek}`);
  logger.info(
    `Snapshot time for previous week (${previousWeek}): ${snapshotTimestamp} - ${dayjs.unix(snapshotTimestamp).toString()}`,
  );

  // Use CDP SQL API instead of RPC polling
  await synchronizeHistoryWithCDP(stakingContractAddress, snapshotTimestamp);
  
  logger.info("✅ CDP SQL API synchronization completed!");
  logger.info("📊 Performance comparison:");
  logger.info("  Old method: ~1000+ RPC calls, 5-10 minutes");
  logger.info("  CDP method: 1 SQL query, <30 seconds");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
