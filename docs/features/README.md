# Amazing-MCP Server Features Documentation

## Overview
The Amazing-MCP Server provides a comprehensive suite of features for AI agents operating in Web3, DeFi, and cryptocurrency ecosystems. This document details all available features, tools, and actions.

## Table of Contents
- [Core Features](#core-features)
- [Integration Features](#integration-features)
- [Real-Time Features](#real-time-features)
- [AI Enhancement Features](#ai-enhancement-features)
- [Security Features](#security-features)
- [API Endpoints](#api-endpoints)

## Core Features

### 1. Model Context Protocol (MCP) Framework
**Purpose**: Provides validated JSON context envelopes for AI agents
- **Persona Management**: Dynamic loading of tool-specific expert personas
- **Emotion System**: Point-based emotional state tracking (-100 to 100)
- **Memory Persistence**: Long-term memory storage via Mem0
- **Context Assembly**: Merges static config with dynamic data

**Endpoints**:
- `GET /mcp` - Retrieve full MCP context
- `GET /mcp?tool={toolname}` - Get tool-specific context
- `POST /mcp/emotion/update` - Update emotional state
- `GET /mcp/memory/search?query={query}` - Search memories

### 2. Persona System
**Purpose**: Provides specialized AI personalities for different tasks
- **15+ Pre-configured Personas**: Including UniswapExpert, NFTCurator, SecurityAuditor
- **Dynamic Switching**: Real-time persona changes based on task
- **Dependency Management**: Each persona declares required integrations
- **Custom Guidelines**: Step-by-step instructions for each persona

**Features**:
- Tool-specific expertise injection
- Emotional response patterns
- Memory integration
- Dependency validation

### 3. Emotion System
**Purpose**: Tracks and responds to agent emotional states
- **Point System**: -100 (extremely negative) to +100 (extremely positive)
- **Automatic Transitions**: Threshold-based emotion changes
- **Feedback History**: Tracks emotional journey
- **Persistence**: Stores emotional states in Mem0

**Emotions**: Happy, Excited, Curious, Neutral, Worried, Scared, Frustrated

## Integration Features

### 4. Exa.ai Search Integration
**Purpose**: Advanced semantic search for DeFi insights
- **Embeddings-based Search**: Find relevant content by meaning
- **Auto-prompt Enhancement**: Automatically improves queries
- **Content Retrieval**: Full text extraction from results

**Endpoints**:
- `GET /mcp/context/search?query={query}` - Semantic search
- `GET /mcp/context/similar?url={url}` - Find similar content

### 5. Web3.js Blockchain Integration
**Purpose**: Direct blockchain interaction capabilities
- **EVM Support**: Ethereum and compatible chains
- **Account Management**: Balance queries, transaction details
- **Smart Contract Interaction**: Read/write operations
- **Gas Estimation**: Accurate fee predictions

**Endpoints**:
- `GET /mcp/web3/balance?address={address}` - Get ETH balance
- `GET /mcp/web3/tx?hash={hash}` - Transaction details
- `POST /mcp/web3/contract/call` - Contract interactions

### 6. Real-Time Crypto Prices (CoinGecko)
**Purpose**: Live cryptocurrency price feeds
- **10,000+ Tokens**: Comprehensive coverage
- **WebSocket Streaming**: Updates every 10 seconds
- **Historical Data**: Price charts and trends
- **Multi-currency Support**: USD, EUR, BTC pairs

**Endpoints**:
- `GET /mcp/crypto-prices?coins={coins}` - Current prices
- `WS /ws/prices` - Real-time price stream

### 7. Blockchain Data (Bitquery)
**Purpose**: Deep blockchain analytics
- **40+ Chains**: Multi-chain support
- **GraphQL Queries**: Flexible data retrieval
- **Block/Transaction Data**: Detailed on-chain info
- **DEX Analytics**: Trading volumes and pairs

**Endpoints**:
- `GET /mcp/blockchain-data/latest-blocks?chain={chain}` - Recent blocks
- `POST /mcp/blockchain-data/query` - Custom GraphQL queries

### 8. Crypto News Aggregation
**Purpose**: Real-time news and sentiment analysis
- **Multi-source Aggregation**: 50+ news sources
- **Sentiment Scoring**: -1.5 to +1.5 scale
- **Ticker Filtering**: News by specific tokens
- **Event Tracking**: Major crypto events

**Endpoints**:
- `GET /mcp/crypto-news?ticker={ticker}&limit={limit}` - Latest news
- `WS /ws/news` - Real-time news stream

### 9. Chainlink Oracle Integration
**Purpose**: Reliable price feeds and VRF
- **Price Feeds**: Tamper-proof market data
- **VRF**: Verifiable random functions
- **Proof of Reserve**: Asset backing verification
- **Automation**: Keeper network integration

**Endpoints**:
- `GET /mcp/oracles/prices?feed={feed}` - Oracle price data
- `GET /mcp/oracles/vrf` - Random number generation

### 10. Wallet & Account Abstraction
**Purpose**: Wallet connectivity and management
- **MetaMask Integration**: Browser wallet support
- **Account Abstraction**: Gasless transactions
- **Multi-wallet Support**: Hardware and software wallets
- **Balance Aggregation**: Cross-chain balances

**Endpoints**:
- `POST /mcp/wallet/connect` - Connect wallet
- `GET /mcp/wallet/balances?address={address}` - Get balances
- `POST /mcp/wallet/gasless/tx` - Gasless transaction

### 11. DeFi Protocol Integration
**Purpose**: Direct DeFi protocol interactions

#### Uniswap Integration
- **Swap Quotes**: Best route calculations
- **Liquidity Provision**: LP token management
- **Pool Analytics**: TVL and volume data

#### Aave Integration
- **Lending/Borrowing**: Rate calculations
- **Health Factor**: Liquidation monitoring
- **Yield Optimization**: Best APY strategies

**Endpoints**:
- `GET /mcp/defi/swap?from={from}&to={to}&amount={amount}` - Swap quote
- `GET /mcp/defi/yields?protocol={protocol}` - Yield rates
- `POST /mcp/defi/simulate` - Transaction simulation

### 12. NFT Management (Alchemy)
**Purpose**: NFT data and metadata handling
- **Metadata Fetching**: Token details and images
- **Collection Analytics**: Floor prices and rarity
- **Transfer Tracking**: Ownership history
- **IPFS Integration**: Decentralized storage

**Endpoints**:
- `GET /mcp/nft/metadata?contract={contract}&tokenId={id}` - NFT details
- `GET /mcp/nft/collection?contract={contract}` - Collection data

### 13. Cross-Chain Bridge Integration
**Purpose**: Asset transfers across blockchains
- **LayerZero Protocol**: Omnichain messaging
- **Fee Optimization**: Best bridge selection
- **Status Tracking**: Transfer monitoring
- **Multi-asset Support**: Tokens and NFTs

**Endpoints**:
- `POST /mcp/crosschain/transfer` - Initiate transfer
- `GET /mcp/crosschain/status?id={id}` - Transfer status

### 14. Analytics Integration
**Purpose**: On-chain data analytics

#### The Graph Protocol
- **Subgraph Queries**: Indexed blockchain data
- **Custom Indexing**: Project-specific data
- **Real-time Updates**: Live data feeds

#### Dune Analytics
- **SQL Queries**: Complex analytics
- **Dashboard Integration**: Visual data
- **Custom Metrics**: KPI tracking

**Endpoints**:
- `GET /mcp/analytics/query?subgraph={subgraph}&metric={metric}` - Query data
- `POST /mcp/analytics/custom` - Custom analytics

### 15. Fiat On/Off Ramps
**Purpose**: Fiat to crypto conversions
- **Rate Aggregation**: Best exchange rates
- **KYC Integration**: Compliance support
- **Payment Methods**: Cards, banks, e-wallets
- **Global Coverage**: 180+ countries

**Endpoints**:
- `GET /mcp/fiat/buy?currency={fiat}&crypto={crypto}&amount={amount}` - Buy rates
- `POST /mcp/fiat/order` - Create order

## AI Enhancement Features

### 16. AI-Enhanced DeFi Strategies
**Purpose**: ML-powered DeFi optimization
- **Portfolio Optimization**: Risk-adjusted strategies
- **Yield Prediction**: APY forecasting
- **Risk Assessment**: Market analysis
- **Strategy Backtesting**: Historical performance

**Endpoints**:
- `GET /mcp/ai/strategy?portfolio={assets}` - Get strategy
- `POST /mcp/ai/backtest` - Test strategy

### 17. Ocean Protocol Integration
**Purpose**: Data marketplace and compute-to-data
- **Data Token Management**: Access control
- **Compute Services**: Privacy-preserving analytics
- **Data Publishing**: Monetization tools
- **Algorithm Marketplace**: ML model sharing

**Endpoints**:
- `POST /mcp/ocean/compute` - Run computation
- `GET /mcp/ocean/datasets` - Available datasets

## Security Features

### 18. Security & Auditing Tools
**Purpose**: Smart contract security

#### OpenZeppelin Integration
- **Security Standards**: Battle-tested contracts
- **Access Control**: Role management
- **Upgradeability**: Proxy patterns
- **Security Primitives**: Reentrancy guards

#### Tenderly Integration
- **Transaction Simulation**: Pre-execution testing
- **Debugging Tools**: Stack trace analysis
- **Alert System**: Real-time monitoring
- **Fork Testing**: Mainnet simulations

**Endpoints**:
- `POST /mcp/security/simulate?tx={txData}` - Simulate transaction
- `GET /mcp/security/audit?contract={address}` - Contract audit
- `POST /mcp/security/monitor` - Set up monitoring

## Real-Time Features

### 19. WebSocket Streaming
**Purpose**: Live data feeds
- **Price Streams**: Crypto prices every 10s
- **News Feeds**: Real-time news updates
- **Transaction Monitoring**: Blockchain events
- **Custom Subscriptions**: Filtered streams

**WebSocket Endpoints**:
- `WS /ws/prices` - Price updates
- `WS /ws/news` - News stream
- `WS /ws/blocks` - New blocks
- `WS /ws/events` - Custom events

### 20. Event System
**Purpose**: Real-time notifications
- **Threshold Alerts**: Price movements
- **Transaction Confirmations**: On-chain events
- **DeFi Events**: Liquidations, large swaps
- **Custom Triggers**: User-defined alerts

## API Endpoints

### Core MCP Endpoints
```
GET    /mcp                          # Full MCP context
GET    /mcp?tool={tool}             # Tool-specific context
POST   /mcp/emotion/update          # Update emotion
GET    /mcp/memory/search           # Search memories
POST   /mcp/memory/add              # Add memory
GET    /mcp/metrics                 # System metrics
GET    /mcp/commands                # Available commands
GET    /mcp/docs/api.yaml          # OpenAPI spec
```

### Integration Endpoints
```
# Search & Context
GET    /mcp/context/search?query={query}
GET    /mcp/context/similar?url={url}

# Blockchain
GET    /mcp/web3/balance?address={address}
GET    /mcp/web3/tx?hash={hash}
POST   /mcp/web3/contract/call

# Prices & Data
GET    /mcp/crypto-prices?coins={coins}
GET    /mcp/blockchain-data/latest-blocks?chain={chain}
GET    /mcp/crypto-news?ticker={ticker}

# DeFi
GET    /mcp/defi/swap?from={from}&to={to}&amount={amount}
GET    /mcp/defi/yields?protocol={protocol}
POST   /mcp/defi/simulate

# NFTs
GET    /mcp/nft/metadata?contract={contract}&tokenId={id}
GET    /mcp/nft/collection?contract={contract}

# Cross-chain
POST   /mcp/crosschain/transfer
GET    /mcp/crosschain/status?id={id}

# Analytics
GET    /mcp/analytics/query?subgraph={subgraph}
POST   /mcp/analytics/custom

# Security
POST   /mcp/security/simulate
GET    /mcp/security/audit?contract={address}
```

### WebSocket Endpoints
```
WS     /ws/prices                   # Price updates
WS     /ws/news                     # News stream
WS     /ws/blocks                   # Blockchain events
WS     /ws/events                   # Custom events
```

## Performance Specifications

### Rate Limits
- **Default**: 100 requests/minute per IP
- **Authenticated**: 500 requests/minute
- **WebSocket**: 10,000 concurrent connections
- **Burst**: 10 requests/second max

### Response Times
- **Cached Data**: <50ms
- **Blockchain Queries**: <100ms
- **External APIs**: 200-500ms
- **Complex Analytics**: <1000ms

### Caching Strategy
- **MCP Context**: 5-minute TTL
- **Price Data**: 10-second refresh
- **News**: 1-minute cache
- **NFT Metadata**: 1-hour cache

## Error Handling

### Standard Error Format
```json
{
  "code": 400,
  "message": "Invalid request",
  "details": "Address parameter required",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Error Codes
- **400**: Bad Request - Invalid parameters
- **401**: Unauthorized - Invalid API key
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource doesn't exist
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error
- **502**: Bad Gateway - External service error
- **503**: Service Unavailable - Maintenance mode

## Security Considerations

### Authentication
- **API Keys**: Required for sensitive endpoints
- **JWT Tokens**: Optional user authentication
- **OAuth2**: Third-party integrations
- **Wallet Signatures**: Web3 authentication

### Data Protection
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection**: Parameterized queries
- **XSS Prevention**: Output sanitization
- **CORS**: Whitelist allowed origins

### Compliance
- **GDPR**: User data handling
- **Data Retention**: 30-day default
- **Right to Delete**: Memory purge API
- **Audit Logs**: All actions logged 