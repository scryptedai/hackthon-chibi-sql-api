/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
import fs from "fs/promises";
import path from "path";
import dayjs from "dayjs";
import { logger } from "./logger";
import { ethers } from "ethers";
import fetch from "node-fetch";
import { generateJwt } from "@coinbase/cdp-sdk/auth";

enum LockPeriod {
  NO_LOCK,
  LOCK_30_DAYS,
  LOCK_60_DAYS,
  LOCK_90_DAYS,
}

enum TransactionStatus {
  STAKED,
  CANCELLED,
  UNSTAKED,
}

export interface Staked {
  type: "Staked";
  blockNumber: number;
  timestamp: number;
  transactionId: number;
  amount: number;
  stakedAt: number;
  sender: string;
  lockPeriod: LockPeriod;
}

export interface Unstaked {
  type: "Unstaked";
  blockNumber: number;
  timestamp: number;
  transactionId: number;
  status: TransactionStatus;
  score: number;
  unstakedAt: number;
}

export interface StakingEventHistory {
  events: (Staked | Unstaked)[];
  numberOfEvents: number;
  lastBlock: number;
}

interface Transaction {
  transactionId: number;
  sender: string;
  amount: number;
  stakedAt: number;
  lockPeriod: LockPeriod;
  status: TransactionStatus;
  score: number;
  unstakedAt: number;
}

interface Staker {
  address: string;
  amount: number;
  score: number;
  rank: number;
  transactionIds: number[];
  topStakingReward: number;
  standardReward: number;
}

const STAKING_HISTORY_FOLDER = "data/staking";

// Generate JWT token using CDP SDK's built-in function
const generateCdpToken = async () => {
  const apiKeyId = process.env.CDP_API_KEY_NAME;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  
  if (!apiKeyId || !apiKeySecret) {
    throw new Error("CDP_API_KEY_NAME and CDP_API_KEY_SECRET must be set");
  }
  
  try {
    // Use CDP SDK's built-in JWT generation
    const token = await generateJwt({
      apiKeyId: apiKeyId,
      apiKeySecret: apiKeySecret,
      requestMethod: "POST",
      requestHost: "api.cdp.coinbase.com",
      requestPath: "/platform/v2/data/query/run",
      expiresIn: 120 // 2 minutes as per CDP requirements
    });
    
    return token;
  } catch (error) {
    logger.error("Error generating JWT with CDP SDK:", error);
    throw new Error(`JWT generation failed: ${error}`);
  }
};

// Event signature hashes for the staking contract
const STAKED_EVENT_SIGNATURE = ethers.id("Staked(uint256,uint256,uint40,address,uint8)");
const UNSTAKED_EVENT_SIGNATURE = ethers.id("Unstaked(uint256,uint8,uint256,uint40)");

const loadHistory = async (fileLocation: string): Promise<StakingEventHistory> => {
  try {
    const fileContent = await fs.readFile(fileLocation, {
      encoding: "utf-8",
    });
    const data = JSON.parse(fileContent) as StakingEventHistory;
    logger.info(`Loaded staking history from ${fileLocation}`);
    return data;
  } catch (error) {
    return {
      events: [],
      numberOfEvents: 0,
      lastBlock: 0,
    };
  }
};

const calculateScore = (
  amount: number,
  lockPeriod: LockPeriod,
  stakedAt: number,
  timestamp: number,
  sender: string,
): number => {
  const SECONDS_PER_DAY = 24 * 60 * 60;
  const lockPeriodInSeconds = [0, 30, 60, 90][lockPeriod] * SECONDS_PER_DAY;
  const multiplier = [1, 1.25, 1.5, 2][lockPeriod];
  const numberOfPeriods = Math.floor((timestamp - stakedAt) / SECONDS_PER_DAY);
  const lockedPeriods = Math.floor(lockPeriodInSeconds / SECONDS_PER_DAY);
  
  return Math.floor(
    amount * multiplier * Math.max(0, numberOfPeriods - lockedPeriods),
  );
};

const writeData = async (
  events: (Staked | Unstaked)[],
  name: string,
  ownersFilePath: string,
  timestamp: number,
) => {
  const transactionMapping: Record<string, Transaction> = {};
  events.forEach((event) => {
    const transactionId = event.transactionId.toString();
    if (event.type === "Staked") {
      transactionMapping[transactionId] = {
        transactionId: event.transactionId,
        sender: event.sender,
        amount: event.amount,
        stakedAt: event.stakedAt,
        lockPeriod: event.lockPeriod,
        status: TransactionStatus.STAKED,
        score: 0,
        unstakedAt: 0,
      };
    } else {
      const transaction = transactionMapping[transactionId];
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }
      transaction.status = event.status;
      transaction.score = event.score;
      transaction.unstakedAt = event.unstakedAt;
    }
  });
  
  const transactions = Object.keys(transactionMapping)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => transactionMapping[key]);

  const stakerMap: Record<string, Staker> = {};
  transactions.forEach((transaction) => {
    const staker = stakerMap[transaction.sender];
    if (!staker) {
      stakerMap[transaction.sender] = {
        address: transaction.sender,
        amount: 0,
        score: 0,
        rank: 0,
        transactionIds: [],
        topStakingReward: 0,
        standardReward: 0,
      };
    }
    if (transaction.status === TransactionStatus.STAKED) {
      stakerMap[transaction.sender].score += calculateScore(
        transaction.amount,
        transaction.lockPeriod,
        transaction.stakedAt,
        timestamp,
        transaction.sender,
      );
      stakerMap[transaction.sender].amount += transaction.amount;
      stakerMap[transaction.sender].transactionIds.push(
        transaction.transactionId,
      );
    }
  });
  
  const stakers = Object.values(stakerMap)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
    
  stakers.forEach((staker, index) => {
    staker.rank = index + 1;
  });

  await fs.writeFile(ownersFilePath, JSON.stringify(stakers, null, 2), {
    encoding: "utf-8",
  });
  
  logger.info(`${name} - Total stakers: ${stakers.length}`);
};

/**
 * NEW: CDP SQL API-based synchronization
 * Replaces the inefficient RPC polling with a single SQL query
 */
export const synchronizeHistoryWithCDP = async (
  contractAddress: string,
  snapshotTimestamp: number,
) => {
  const name = "clash-staking";
  const historyFilePath = path.join(
    __dirname,
    "../",
    STAKING_HISTORY_FOLDER,
    `${name.split(" ").join("-")}-history-cdp.json`,
  );

  logger.info(`${name} - Using CDP SQL API to fetch staking events...`);

  try {
    // Generate authentication token
    const token = await generateCdpToken();

    // Single SQL query to replace all the RPC polling using correct parameter syntax!
    const stakingEventsQuery = `
      WITH StakedEvents AS (
        SELECT 
          'Staked' as event_type,
          block_number,
          block_timestamp,
          parameters['transactionId']::String as transaction_id,
          parameters['amount']::String as amount,
          parameters['stakedAt']::String as staked_at,
          parameters['sender']::String as sender,
          parameters['lockPeriod']::String as lock_period,
          '' as status,
          '' as score,
          '' as unstaked_at
        FROM base.events 
        WHERE address = LOWER('${contractAddress}')
          AND event_signature = 'Staked(uint256,uint256,uint40,address,uint8)'
          AND block_number > 0
      ),
      UnstakedEvents AS (
        SELECT 
          'Unstaked' as event_type,
          block_number,
          block_timestamp,
          parameters['transactionId']::String as transaction_id,
          '0' as amount,
          '0' as staked_at,
          '' as sender,
          '0' as lock_period,
          parameters['status']::String as status,
          parameters['score']::String as score,
          parameters['unstakedAt']::String as unstaked_at
        FROM base.events 
        WHERE address = LOWER('${contractAddress}')
          AND event_signature = 'Unstaked(uint256,uint8,uint256,uint40)'
          AND block_number > 0
      )
      SELECT * FROM StakedEvents
      UNION ALL
      SELECT * FROM UnstakedEvents
      ORDER BY block_number ASC
    `;

    // Execute the query via CDP SQL API REST endpoint
    const response = await fetch('https://api.cdp.coinbase.com/platform/v2/data/query/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: stakingEventsQuery
      })
    });

    if (!response.ok) {
      throw new Error(`CDP API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    logger.info(`${name} - Fetched ${data.result?.length || 0} events from CDP SQL API`);

    // Convert SQL results to our event format using the correct parameter syntax
    const events: (Staked | Unstaked)[] = [];
    
    if (data.result) {
      for (const row of data.result) {
        if (row.event_type === 'Staked') {
          events.push({
            type: "Staked",
            blockNumber: Number(row.block_number),
            timestamp: Number(row.block_timestamp),
            transactionId: Number(row.transaction_id),
            amount: Number(row.amount),
            stakedAt: Number(row.staked_at),
            sender: row.sender,
            lockPeriod: Number(row.lock_period) as LockPeriod,
          });
        } else if (row.event_type === 'Unstaked') {
          events.push({
            type: "Unstaked",
            blockNumber: Number(row.block_number),
            timestamp: Number(row.block_timestamp),
            transactionId: Number(row.transaction_id),
            status: Number(row.status) as TransactionStatus,
            score: Number(row.score),
            unstakedAt: Number(row.unstaked_at),
          });
        }
      }
    }

    // Save the complete history
    const history: StakingEventHistory = {
      events,
      numberOfEvents: events.length,
      lastBlock: Math.max(...events.map(e => e.blockNumber), 0),
    };

    await fs.writeFile(historyFilePath, JSON.stringify(history, null, 2), {
      encoding: "utf-8",
    });

    logger.info(`${name} - Saved CDP-fetched history with ${history.numberOfEvents} events`);

    // Generate current stakers data
    const ownersFilePath = path.join(
      __dirname,
      "../",
      STAKING_HISTORY_FOLDER,
      `${name.split(" ").join("-")}-stakers-cdp.json`,
    );
    await writeData(history.events, name, ownersFilePath, dayjs().unix());

    // Generate snapshot if requested
    if (snapshotTimestamp > 0) {
      const snapshotOwnersFilePath = path.join(
        __dirname,
        "../",
        STAKING_HISTORY_FOLDER,
        `${name.split(" ").join("-")}-stakers-snapshot-${snapshotTimestamp}-cdp.json`,
      );
      const snapshotEvents = history.events.filter(
        (e) => e.timestamp <= snapshotTimestamp,
      );
      await writeData(
        snapshotEvents,
        name,
        snapshotOwnersFilePath,
        snapshotTimestamp,
      );
      logger.info(
        `${name} - Wrote CDP snapshot data. Timestamp: ${snapshotTimestamp}`,
      );
    }

    logger.info(`✅ ${name} - CDP SQL API synchronization completed!`);
    
  } catch (error) {
    logger.error(`❌ ${name} - CDP SQL API error:`, error);
    throw error;
  }
};

/**
 * Legacy RPC-based synchronization (keep for comparison)
 * This is the old inefficient method
 */
export const synchronizeHistoryLegacy = async (
  contractAddress: string,
  snapshotTimestamp: number,
) => {
  logger.warn("⚠️  Using legacy RPC polling method - this is slow and expensive!");
  // ... (original implementation would go here)
};
