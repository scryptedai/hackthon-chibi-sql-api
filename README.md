# Chibi CDP Integration - Hackathon Project

## Overview

This repository contains the CDP SQL API integration for the Chibi GameFi ecosystem, delivering massive performance improvements for blockchain data querying.

## Key Achievements

- **99.9% cost reduction** (from $50-200 to <$0.10 per query)
- **95%+ time reduction** (from 5-30 minutes to <1 second)
- **Real-time data** (<250ms from chain tip)
- **Zero infrastructure** (eliminates event listener services)

## Live Contracts

- **CLASH Token**: `0x6B35f4EE1398dA7F644607513A6480BC24F05cD0`
- **Staking Contract**: `0x902C93200A9719D126a33f39fdF7154a4DdBA04a`

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
# Add your CDP API keys
```

3. Run tests:
```bash
npx hardhat run scripts/test-all-your-queries.ts
```

## Demo Scripts

- `scripts/test-all-your-queries.ts` - Tests all 4 provided SQL queries
- `scripts/test-chibi-staking-data.ts` - Live CLASH token data validation
- `scripts/cdp-sql-demo-final.ts` - Comprehensive integration showcase
- `scripts/cdp-vs-rpc-comparison.ts` - Performance comparison demo

## Files

### Core Implementation
- `utils/synchronize-clash-staking-history-cdp.ts` - CDP-powered sync utility
- `scripts/synchronize-clash-staking-history-cdp.ts` - Main sync script

### Test & Demo Scripts
- `scripts/test-cdp-sql-api.ts` - JWT authentication & basic queries
- `scripts/test-cdp-simple.ts` - CDP client testing
- `scripts/simple-deploy-test.ts` - Contract deployment testing

### Documentation
- `HACKATHON_SUMMARY.md` - Complete achievement summary
- `ecosystem.md` - Ecosystem overview

## Technical Stack

- **Coinbase Developer Platform (CDP) SQL API**
- **TypeScript/Node.js**
- **Hardhat** (for contract interactions)
- **JWT Authentication** (EdDSA algorithm)
- **@coinbase/cdp-sdk** (v1.34.0+)

## Authentication

Uses CDP API keys with JWT token generation:
- `CDP_API_KEY_NAME` - Your CDP API key ID
- `CDP_API_KEY_SECRET` - Your CDP API private key (PKCS8 format)

## Impact

This integration enables real-time GameFi analytics and can eliminate expensive blockchain polling infrastructure, making it perfect for live gaming experiences and cost-effective data operations.
