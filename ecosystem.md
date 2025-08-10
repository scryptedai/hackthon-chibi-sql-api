## Current Smart Contracts in Chibi Ecosystem

Based on my analysis, here are the key smart contracts currently deployed:

### **Core Contracts on Base Network:**
- **ChibiKingdomV3** (`0x0fEEa4E2DdACa247c0b81f69139B34e276aFF966`) - Main land NFT contract
- **ClashToken** (`0x6B35f4EE1398dA7F644607513A6480BC24F05cD0`) - Main game token (ERC-20)
- **ClashStaking** (`0x902C93200A9719D126a33f39fdF7154a4DdBA04a`) - Token staking contract
- **ChibiBattleItem** (`0xAF476F5c943d539D745A39f3B61f0e7EdAaF1A0B`) - Battle items NFT (ERC-1155)
- **ClashGemPurchase** (`0x67396aa07b2f831080f427590c146F2b4BbEC988`) - Gem purchasing system
- **ChibiKingdomStakingRewards** (`0xff9c0e76E3Bb9A300FE6dca56f094bADEc58D6eB`) - Reward distribution
- **DepositRaffleMinter** (`0x52Ac4DDBb2dD1ef70F8395d481F73591e1b6FC0a`) - Raffle system

### **Legacy Contracts on Polygon:**
- **ChibiLegends** (`0xa26cdf13ed82a04ed711664b3c92124e9b8715f6`) - Original NFT collection
- **ChibiCitizen** (`0xB42268790688dF8de4F7db71cA8B151661e20b87`) - Citizen NFTs
- **SealLegends** (`0x5eaa8e628659b474320773ffcebe3756a5df76d1`) - Seal NFTs
- **ChibiLuckyToken** (`0xa44ECb5292571C372d4a8304f135c2Bf9F5D0673`) - Lucky tokens (ERC-1155)
- **RaffleDrawV3** (`0x3512155E46E7a22c8a51607Aa8B33ee00a3c0269`) - Raffle system
- **TreasureChest** (`0x439C90963c551803Cf5d38Fd9afa3cBCdFd8Ac2d`) - Treasure chest NFTs

## Current Data Aggregators

### **Primary: Alchemy**
Your ecosystem heavily relies on **Alchemy** as the main blockchain data provider:

- **Base Mainnet**: `https://base-mainnet.g.alchemy.com/v2/gD8jM5UlUlWOqRWl68NEYguRB5aY-NFK`
- **Polygon Mainnet**: `https://polygon-mainnet.g.alchemy.com/v2/gD8jM5UlUlWOqRWl68NEYguRB5aY-NFK`
- **Ethereum Mainnet**: `https://eth-mainnet.g.alchemy.com/v2/gD8jM5UlUlWOqRWl68NEYguRB5aY-NFK`
- **Arbitrum**: `https://arb-mainnet.g.alchemy.com/v2/gD8jM5UlUlWOqRWl68NEYguRB5aY-NFK`
- **BSC**: `https://bnb-mainnet.g.alchemy.com/v2/gD8jM5UlUlWOqRWl68NEYguRB5aY-NFK`

### **Event Listening Architecture:**
1. **clowk-event-listener** - Uses Alchemy WebSocket to monitor contract events
2. **Real-time sync** - Posts to API endpoints when events are detected
3. **Batch processing** - API pulls historical events in 5,000 block chunks
4. **Database storage** - Events are processed and stored in PostgreSQL

### **Current Data Flow:**
```
Blockchain Events → Alchemy WebSocket → clowk-event-listener → chibi-clash-api → PostgreSQL
```

## How CDP SQL API Could Replace This

The [CDP SQL API](https://docs.cdp.coinbase.com/data/sql-api/welcome) offers several advantages over your current Alchemy-based approach:

### **Key Benefits:**
- **Zero Infrastructure**: No need to manage event listeners or sync services
- **Real-time Data**: <250ms from chain tip with <500ms query latency
- **Custom SQL Queries**: Flexible data retrieval vs fixed API endpoints
- **Multi-chain Support**: Unified interface across networks

### **Perfect Use Cases for Your Ecosystem:**
1. **Onchain Games**: Track player inventory, asset upgrades, and progression in real time
2. **Portfolio & Treasury**: Live view of wallet balances and historical flows
3. **Payment Tracking**: Real-time stablecoin transactions for rewards

### **Migration Strategy:**

Instead of your current pattern:
```typescript
// Current: Manual event syncing
const events = await getAllEvents(contract, contract.filters.Staked, lastBlock, currentBlock);
```

You could use CDP SQL API:
```sql
-- Query staking events directly
SELECT * FROM base.logs 
WHERE address = '0x902C93200A9719D126a33f39fdF7154a4DdBA04a' 
AND topic0 = '0x...' -- Staked event signature
AND block_number > last_synced_block
```

### **Recommended Implementation:**
1. **Keep existing API endpoints** - Don't break current integrations
2. **Replace backend data fetching** - Use CDP SQL API instead of Alchemy event polling
3. **Simplify infrastructure** - Remove `clowk-event-listener` service
4. **Real-time updates** - Use CDP's fresh data instead of manual sync jobs

This would eliminate your Tuesday manual distribution issues and provide a much more robust, real-time data layer for your GameFi platform.

Would you like me to help you implement a proof-of-concept using CDP SQL API for one of your contracts, like the staking rewards system?