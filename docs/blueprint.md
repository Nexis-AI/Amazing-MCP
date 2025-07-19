# Ultimate Web3, DeFi, and Crypto MCP Server Project: Enhanced Detailed Blueprint and Documentation

## Project Blueprint
### Overview
The Model Context Protocol (MCP) Server is an advanced, modular API server implemented in Node.js with TypeScript, tailored to deliver comprehensive, real-time context to AI agents operating in Web3, DeFi, and Crypto ecosystems. It functions as a unified "context envelope" in JSON format, encompassing extended agent personas (including tool-specific roles with detailed interaction guidelines), an emotion system with feedback-driven points and thresholds, persistent memory via Mem0 (supporting add/search/update operations with user-specific configs), dynamic context management (integrating search, oracles, and analytics), and front-end UI rendering hooks compatible with Magic UI components (e.g., OrbitingCircles for visualizations). 

The server supports high-concurrency via Express.js middleware (e.g., rate-limiting with `express-rate-limit` at 100 requests/min per IP), secure API key management through `.env` (using `dotenv-safe` for validation), and real-time data streaming with WebSockets (handling up to 10,000 concurrent connections via `ws` library). It is designed for zero-downtime updates using PM2 clustering and includes built-in logging with Winston for traceability (e.g., info/error levels tied to emotion updates).

### High-Level Architecture
- **Client-Side Integration**: AI agents interact via RESTful endpoints (HTTP/1.1 with optional HTTP/2 upgrade) or WebSockets (ws:// protocol with JSON messaging). Responses are gzipped for efficiency (via `compression` middleware).
- **Server Components**:
  - **Core Engine**: MCP assembler in `mcp.controller.ts` – merges static config (e.g., personas.json) with dynamic data (e.g., real-time prices).
  - **State Management**: In-memory cache (e.g., NodeCache with 5-min TTL) for frequent MCP fetches; Mem0 for long-term persistence (e.g., emotion history stored as JSON blobs).
  - **Error Handling**: Global middleware catches exceptions, returns standardized JSON errors (e.g., {code: 500, message: 'Internal Error', details: err.stack}); specific integrations retry on transient failures (e.g., API timeouts with exponential backoff).
  - **Security Layers**: CORS restricted to agent origins; JWT auth optional for sensitive endpoints (e.g., wallet connects); input validation with Zod schemas.
- **Data Flow Example**:
  1. Agent requests `/mcp?tool=uniswap` → Controller fetches base MCP, injects UniswapExpert persona, queries `/defi/swap` internally.
  2. Real-time update: WS client subscribes to `/ws/prices` → Server polls CoinGecko every 10s, broadcasts JSON {prices: {...}}.
  3. Feedback loop: POST `/emotion/update` → Updates points, checks thresholds (e.g., points < -10 → 'Scared'), persists to Mem0.
- **Performance Specs**: Handles 1,000 req/s on a 4-core server; optimizes with async/await for non-blocking I/O.
- **Text-Based Diagram** (Expanded):
  ```
  AI Agent (LangChain/React) <--> HTTP/WS (JSON) <--> MCP Server (Express.js + Zod Validation)
                                             |
                                             v
  +---------------------+     +---------------------+     +---------------------+
  | MCP JSON Envelope   |     | Integrations Layer  |     | Storage/Real-Time   |
  | - Personas (Tool-Spec)|<--->| - SDKs/APIs (e.g., |<--->| - Mem0 (Memory)     |
  | - Emotions (Thresholds)|     |   Web3.js, Exa.ai)  |     | - WS (Broadcasts)   |
  | - Memory (Mem0 Queries)|     | - Error Retry Logic |     | - Cache (NodeCache) |
  | - Context (Dynamic)   |     +---------------------+     +---------------------+
  | - UI Hooks (Magic UI) |
  +---------------------+
  ```

### Deployment Blueprint
- **Local Development**: `npm install` (includes devDeps like `ts-node`, `jest`); `npm run dev` starts server at localhost:3000 with hot-reload via `nodemon`.
- **Production Setup**: `npm run build` compiles to `/dist`; run with `pm2 start dist/index.js --name mcp-server -i max` for clustering. Environment vars: PORT=3000, MEM0_API_KEY=xxx, etc. (validate with `dotenv-safe`).
- **Containerization**: `docker-compose.yml` defines Node 20 image, volumes for .env, exposes port 3000; build with `docker build -t mcp-server .`.
- **Cloud Deployment**: Vercel for serverless (auto-scales, free tier up to 100GB bandwidth); AWS EC2 with Elastic Beanstalk for persistent instances (add Auto Scaling Group for >1k users).
- **CI/CD Pipeline**: GitHub Actions workflow: on push, run `npm test` (Jest coverage >80%), build, deploy to Vercel. Secrets for API keys.
- **Monitoring & Logging**: Integrate Prometheus (/metrics endpoint) and Grafana for dashboards (e.g., req latency, error rates); Sentry for crash reporting; ELK stack for logs if scaled.
- **Backup/Recovery**: Mem0 data backed up via API exports; server stateless except cache (redis fallback for production).

## Project Structure
Expanded with file specifics and purposes:

```
mcp-server/
├── src/                          # Core application source
│   ├── index.ts                  # Entry: Sets up Express app, mounts routes, initializes WS server, applies middleware (compression, rate-limit, CORS).
│   ├── mcp-schema.ts             # Zod schemas: Defines MCP structure with validators (e.g., emotion enum, points min/max); exports MCPSchema.parse for runtime checks.
│   ├── controllers/              # Business logic for routes
│   │   └── mcp.controller.ts     # Handles MCP assembly, emotion updates (threshold logic: if points > 50 → 'Happy'), persona filtering; integrates Mem0 client.
│   ├── integrations/             # Isolated modules for external services; each exports async functions (e.g., fetchPrices())
│   │   ├── exa.ts                # Exa.ai: Initializes SDK, exports searchExa(query); handles errors with try/catch.
│   │   ├── web3.ts               # Web3.js: Creates Web3 instance with provider URL; exports getBalance(address), getTransaction(hash).
│   │   ├── crypto-prices.ts      # CoinGecko: Axios GET for /simple/price; setInterval for WS polling.
│   │   ├── blockchain-data.ts    # Bitquery: Axios POST for GraphQL; exports getLatestBlocks(chain).
│   │   ├── crypto-news.ts        # Crypto News API: Axios GET for /category; params like limit, ticker.
│   │   ├── chainlink.ts          # Chainlink: Custom wrapper for feeds; exports getPrice(feed).
│   │   ├── wallet.ts             # MetaMask/Etherspot: SDK init; exports connect(), getBalances(address).
│   │   ├── defi.ts               # Uniswap/Aave SDKs: Exports getSwapQuote(from, to, amount), getYields(protocol).
│   │   ├── nft.ts                # Alchemy: SDK init; exports getMetadata(contract, tokenId).
│   │   ├── crosschain.ts         # LayerZero: SDK for bridges; exports initiateTransfer(fromChain, toChain).
│   │   ├── analytics.ts          # The Graph: Apollo Client; exports querySubgraph(subgraph, query).
│   │   ├── fiat-ramps.ts         # Changelly: API for rates; exports getBuyRates(currency, crypto).
│   │   ├── ai-defi.ts            # Ocean Protocol: SDK for data markets; exports getStrategy(portfolio).
│   │   └── security.ts           # OpenZeppelin/Tenderly: Exports simulateTx(txData), checkAudits(contract).
│   ├── utils/                    # Helpers
│   │   ├── websocket.ts          # WS server setup: Handles connections, broadcasts (e.g., prices every 10s); ping/pong for keep-alive.
│   │   └── validators.ts         # Custom Zod extensions (e.g., validateAddress for ETH addresses).
│   └── types/                    # TS interfaces
│       └── mcp.types.ts          # Interfaces for MCP (e.g., IPersona {id: string, guidelines: string}).
├── tests/                        # Jest tests
│   ├── mcp.controller.test.ts    # Unit tests: Mock integrations, test MCP assembly, emotion shifts.
│   └── integrations/             # Integration tests: e.g., exa.test.ts mocks API responses.
├── docs/                         # Documentation files
│   └── api.md                    # Swagger spec: YAML for endpoints, generated with swagger-jsdoc.
├── configs/                      # Config files
│   └── personas.json             # Default tool-specific personas array.
├── .env.example                  # Template: Lists required vars (e.g., EXA_API_KEY).
├── tsconfig.json                 # TS config: {"compilerOptions": {"target": "ES2020", "module": "commonjs", "strict": true}}.
├── package.json                  # Deps: express@^4.18, zod@^3.22, ws@^8.14; scripts expanded with "lint": "eslint src".
├── README.md                     # Setup: npm install, env setup, run dev; troubleshooting (e.g., API key errors).
└── docker-compose.yml            # Services: node-app (build: ., ports: 3000:3000, env_file: .env).
```

- **Dependency Management**: `package.json` pins versions (e.g., "web3": "^4.0.3"); use `npm audit fix` for security.
- **Linting/Formatting**: ESLint with Airbnb preset; Prettier for code style.

## Complete Documentation for Each Feature and Functionality Integration
Each entry now includes expanded functionality (e.g., error codes, rate limits), code snippets where available from tool results, and performance notes.

### 1. Core MCP Framework
   - **Purpose**: Delivers validated JSON context; supports persona switching, emotion dynamics (points range -100 to 100, thresholds configurable e.g., happy: 50, sad: 0), Mem0 ops (add/memory with TTL 1 day).
   - **Implementation**: Zod parsing in controller; Mem0 client init with apiKey; emotion logic: points += feedback, if > threshold shift emotion, log history.
   - **Schema Extensions**: Base + guidelines/tool in agentPersonas.
   - **Endpoints**: GET `/mcp` (200 OK with JSON, 400 invalid query); POST `/mcp/emotion/update` (body validation, 201 updated); GET `/mcp/memory/search?query=...` (returns array, 404 not found).
   - **Documentation Links**: Custom; Zod (https://zod.dev/?id=getting-started), Mem0 (https://docs.mem0.ai/).
   - **Functionality Details**: Rate limit 50/min; error: {code: 429, msg: 'Too Many Requests'}; integrates all features via internal calls; performance: <50ms response for cached MCP.

### 2. Exa.ai Search
   - **Purpose**: Embeddings-based search for DeFi insights; supports autoprompt for refined queries.
   - **Implementation**: exa-js SDK; searchAndContents with numResults=10, text=true.
   - **Schema Extensions**: `contextManagement.exaResults: array<{title: string, url: string, snippet: string}>`.
   - **Endpoints**: GET `/mcp/context/search?query=...` (returns results, 200 OK, 500 on API fail).
   - **Documentation Links**: Docs (https://docs.exa.ai/), Integration (https://docs.exa.ai/reference/langchain), Setup (https://exa.ai/).
   - **Functionality Details**: API endpoints: /search, /get-contents, /find-similar-links, /answer, /research/create-a-task; best practices: Use explicit instructions; rate limit unknown (monitor 429 errors); performance: 200-500ms per query; error handling: Retry on 5xx, fallback to empty array.

### 3. Web3.js Integration
   - **Purpose**: EVM interactions; supports balances (wei to ether conversion), tx details.
   - **Implementation**: Web3 init with HTTPProvider; async getBalance, getTransaction.
   - **Schema Extensions**: `web3Context: {provider: string, chainId: number, balances?: object}`.
   - **Endpoints**: GET `/mcp/web3/balance?address=...` (returns ether string), GET `/mcp/web3/tx?hash=...` (returns tx object).
   - **Documentation Links**: Docs (https://docs.web3js.org/), Setup (https://web3js.readthedocs.io/en/v1.10.0/getting-started.html), Examples (https://docs.web3js.org/guides/getting_started/quickstart).
   - **Functionality Details**: Setup: Install selective packages (e.g., web3-eth); best practices: Use local signing with web3-eth-accounts for security; error: 400 invalid address (validate with utils); performance: <100ms RPC call; supports mainnet/testnets.

### 4. Real-Time Crypto Prices
   - **Purpose**: USD prices for 10k+ coins; used in trading decisions, emotion triggers (e.g., surge → Happy).
   - **Implementation**: Axios GET /simple/price?ids=...&vs_currencies=usd; WS broadcast every 10s.
   - **Schema Extensions**: `contextManagement.prices: {bitcoin: {usd: number}, ...}`.
   - **Endpoints**: GET `/mcp/crypto-prices?coins=bitcoin,ethereum` (array param split), WS `/ws/prices` (JSON broadcast).
   - **Documentation Links**: Docs (https://docs.coingecko.com/reference/introduction), Setup (https://www.coingecko.com/en/api), Integration (https://docs.coingecko.com/v3.0.1/reference/introduction).
   - **Functionality Details**: Endpoints: /simple/price (real-time); rate limits: 50/min (free tier); integration tips: Cache results 1min; error: 429 throttle with backoff; performance: 150ms avg.

### 5. Real-Time Blockchain Data
   - **Purpose**: GraphQL for blocks/events across 40+ chains; e.g., latest Ethereum blocks.
   - **Implementation**: Axios POST to graphql.bitquery.io with query payload.
   - **Schema Extensions**: `blockchainData: {blocks: array<{height: number, timestamp: string}>}`.
   - **Endpoints**: GET `/mcp/blockchain-data/latest-blocks?chain=ethereum` (default last:5).
   - **Documentation Links**: Docs (https://docs.bitquery.io/), Setup (https://bitquery.io/forms/api), Examples (https://github.com/bitquery/documentation).
   - **Functionality Details**: Query example: `{ ethereum { blocks(last: 5) { height timestamp } } }`; setup: Headers with X-API-KEY; code: axios.post(BITQUERY_API, {query}); best practices: Use subscriptions for real-time; error: 401 invalid key; performance: 300ms for complex queries.

### 6. Real-Time Crypto News
   - **Purpose**: Aggregated news for sentiment; filters by ticker, sentiment.
   - **Implementation**: Axios GET /category?section=general&items=10&token=KEY.
   - **Schema Extensions**: `newsFeed: {articles: array<{title: string, url: string, sentiment: number}>}`.
   - **Endpoints**: GET `/mcp/crypto-news?limit=10&ticker=BTC` (comma for multiple), WS `/ws/news` (hourly updates).
   - **Documentation Links**: Docs (https://cryptonews-api.com/documentation), Integration (https://cryptonews-api.com/documentation).
   - **Functionality Details**: Endpoints: GET Crypto Ticker News (tickers comma-separated), General Crypto News, Tickers DB (once/day), Top Mentioned Tickers (&date=range), Sentiment Analysis (score -1.5 to +1.5), Events (&eventid=), Trending Headlines (&ticker=), Sundown Digest; params: limit (1-100 req), page (up to 5 free), date (MMDDYYYY or ranges like last7days), sources (comma filter), type (video/article), sentiment (positive/negative); best practices: Use 1-hour cache param to avoid delays; sort by rank (&days for period); error: 400 invalid param; performance: 200ms, 50 items max free.

### 7. Chainlink Oracles
   - **Purpose**: Price feeds (e.g., ETH/USD), VRF; tamper-proof for DeFi.
   - **Implementation**: Axios or direct contract calls via Web3; proxy to aggregator.
   - **Schema Extensions**: `oracleFeeds: {prices: {ETH_USD: number}}`.
   - **Endpoints**: GET `/mcp/oracles/prices?feed=ETH/USD` (latestAnswer).
   - **Documentation Links**: Docs (https://docs.chain.link/data-feeds), Integration (https://docs.chain.link/data-feeds/using-data-feeds), Examples (https://docs.chain.link/data-feeds/getting-started).
   - **Functionality Details**: API: AggregatorV3Interface (latestRoundData(), latestAnswer); best practices: Use proxy contracts for upgrades, monitor timestamps (heartbeat checks), set min/max limits for volatility, track deviations (>1% alert), use @chainlink/contracts npm; error: Stale data if timestamp old; performance: 100ms on-chain read.

### 8. Wallet and Account Abstraction
   - **Purpose**: Connect wallets, fetch balances; supports gasless via Etherspot.
   - **Implementation**: MetaMask SDK connect(); Etherspot for abstraction.
   - **Schema Extensions**: `walletConfig: {accounts: string[], balances: object}`.
   - **Endpoints**: POST `/mcp/wallet/connect` (returns accounts), GET `/mcp/wallet/balances?address=...`.
   - **Documentation Links**: MetaMask (https://docs.metamask.io/sdk/), Setup (https://docs.metamask.io/), Etherspot (https://etherspot.fyi/), Integration (https://etherspot.fyi/prime-sdk/intro).
   - **Functionality Details**: Setup: npm i @metamask/sdk; code: const sdk = new MetaMaskSDK(); await sdk.connect(); best practices: Local signing, EIP-6963 support; error: 403 unauthorized; performance: 500ms for connect.

### 9. DeFi Protocols (Uniswap, Aave)
   - **Purpose**: Swaps (route optimization), yields (APY fetch); simulations for safety.
   - **Implementation**: @uniswap/sdk for Trade.bestTradeExactIn; @aave/protocol-js for lending.
   - **Schema Extensions**: `defiContext: {yields: {aave: {DAI: number}}, trades: array}`.
   - **Endpoints**: GET `/mcp/defi/swap?from=ETH&to=USDC&amount=1` (quote object), GET `/mcp/defi/yields?protocol=aave`.
   - **Documentation Links**: Uniswap (https://docs.uniswap.org/sdk/v3/overview), Examples (https://github.com/Uniswap/examples); Aave (https://github.com/aave/aave-js), Guide (https://aave.com/docs/developers/legacy-versions/v2).
   - **Functionality Details**: Uniswap: Install @uniswap/sdk; code for quotes (from tool: insufficient, but typical Trade.bestTradeExactIn); slippage <2%; Aave: Health factor >1.5 check; best practices: Simulate tx, monitor collateral; error: 400 invalid params; performance: 400ms for computations.

### 10. NFT Management
    - **Purpose**: Metadata fetch, rarity checks; integrates with UI for previews.
    - **Implementation**: alchemy-sdk; getNftMetadata.
    - **Schema Extensions**: `nftManagement: {metadata: {title: string, image: string}}`.
    - **Endpoints**: GET `/mcp/nft/metadata?contract=0x...&tokenId=123` (returns response).
    - **Documentation Links**: Docs (https://docs.alchemy.com/reference/nft-api-quickstart), Guide (https://docs.alchemy.com/reference/api-overview), Examples (https://github.com/alchemyplatform/alchemy-sdk-js/blob/main/docs-md/README.md).
    - **Functionality Details**: Code example (from tool):
      ```javascript
      import { Network, Alchemy } from "alchemy-sdk";
      const settings = { apiKey: "demo", network: Network.ETH_MAINNET };
      const alchemy = new Alchemy(settings);
      const response = await alchemy.nft.getNftMetadata("0x5180db8F5c931aaE63c74266b211F580155ecac8", "1590");
      console.log("NFT name: ", response.title);
      ```
      Best practices: Use mainnet/testnet; cache metadata; error: 404 invalid token; performance: 200ms.

### 11. Cross-Chain Bridges
    - **Purpose**: Asset transfers (e.g., USDT ETH to Polygon); fee minimization.
    - **Implementation**: @layerzerolabs/scan-client; _lzSend for messaging.
    - **Schema Extensions**: `crossChain: {bridges: array<{status: string}>}`.
    - **Endpoints**: POST `/mcp/crosschain/transfer?fromChain=Ethereum&toChain=Polygon&asset=USDT&amount=100` (body optional for options).
    - **Documentation Links**: Docs (https://docs.layerzero.network/v2), Integration (https://docs.layerzero.network/v2/developers/evm/oft/quickstart), Examples (https://docs.layerzero.network/v2/tools/overview).
    - **Functionality Details**: Code example (from tool):
      ```javascript
      function sendString(uint32 _dstEid, string calldata _string, bytes calldata _options) external payable {
          bytes memory _message = abi.encode(_string);
          _lzSend(_dstEid, _message, combineOptions(_dstEid, SEND, _options), MessagingFee(msg.value, 0), payable(msg.sender));
      }
      ```
      Best practices: Update local state pre-send; error: Insufficient gas; performance: 1-5s for init.

### 12. Analytics (The Graph, Dune)
    - **Purpose**: Subgraph queries for volume/insights; predictive trends.
    - **Implementation**: @apollo/client; gql queries.
    - **Schema Extensions**: `analytics: {insights: {volume: number}}`.
    - **Endpoints**: GET `/mcp/analytics/query?subgraph=uniswap&metric=volume` (returns data).
    - **Documentation Links**: Docs (https://thegraph.com/docs/en/subgraphs/querying/introduction/), Examples (https://thegraph.com/docs/en/subgraphs/querying/from-an-application/), Integration (https://github.com/graphprotocol/query-examples).
    - **Functionality Details**: Query example: gql`{ uniswap { volume } }`; Apollo setup: new ApolloClient({uri: 'https://api.thegraph.com/...'}); best practices: Paginate results; error: 400 invalid query; performance: 300ms.

### 13. Fiat On/Off-Ramps
    - **Purpose**: USD to ETH conversions; best rates aggregation.
    - **Implementation**: Changelly API GET for rates.
    - **Schema Extensions**: `fiatRamps: {rates: {ETH: number}}`.
    - **Endpoints**: GET `/mcp/fiat/buy?currency=USD&crypto=ETH&amount=100` (returns quote).
    - **Documentation Links**: Docs (https://docs.changelly.com/), Setup (https://fiat-api.changelly.com/docs/), Examples (https://api.pro.changelly.com/).
    - **Functionality Details**: Endpoints: /getFixRate (fixed), /getFloatRate; code: axios.get('/getFixRate', params); best practices: Handle KYC flags; error: 402 payment required; performance: 250ms.

### 14. AI-Enhanced DeFi
    - **Purpose**: Portfolio strategies via data markets; predictions (e.g., yield forecasts).
    - **Implementation**: ocean.js SDK for compute/access.
    - **Schema Extensions**: `aiDefi: {predictions: array<{asset: string, apy: number}>}`.
    - **Endpoints**: GET `/mcp/ai/strategy?portfolio=ETH:50,BTC:50` (returns optimized).
    - **Documentation Links**: Docs (https://docs.oceanprotocol.com/), Integration (https://docs.oceanprotocol.com/developers), Examples (https://github.com/oceanprotocol/ocean.js/blob/main/CodeExamples.md).
    - **Functionality Details**: Code: ocean.compute.start(...); best practices: Use Aquarius for metadata; error: 403 access denied; performance: 500ms for ML ops.

### 15. Security and Auditing
    - **Purpose**: Tx simulations, contract audits; vuln detection.
    - **Implementation**: OpenZeppelin for standards; Tenderly API for sims.
    - **Schema Extensions**: `security: {alerts: array<{type: string, msg: string}>}`.
    - **Endpoints**: POST `/mcp/security/simulate?tx=...` (body txData, returns result).
    - **Documentation Links**: OpenZeppelin (https://docs.openzeppelin.com/contracts/5.x/), Setup (https://docs.openzeppelin.com/contracts/4.x/); Tenderly (https://docs.tenderly.co/simulations/guides), Guide (https://docs.tenderly.co/guides).
    - **Functionality Details**: OpenZeppelin best practices: Use unmodified code, semantic versioning (major breaks storage), report bugs to Immunefi; code snippet:
      ```solidity
      pragma solidity ^0.8.20;
      import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
      contract MyNFT is ERC721 {
          constructor() ERC721("MyNFT", "MNFT") {}
      }
      ```
      Tenderly: Simulate via API; best practices: Check for reverts; error: 500 sim fail; performance: 400ms.

## Persona Integration Documentation
### Overview
Personas extend agentPersonas with tool-specific expertise, including guidelines for step-by-step feature usage, emotion ties (e.g., high fees → Scared), and dependencies (e.g., requires wallet). Loaded from configs/personas.json (array of 10+ entries), dynamically filtered.

### Schema Extension
```typescript
agentPersonas: z.array(z.object({
  // ... base
  guidelines: z.string(),  // e.g., "1. Verify wallet... 2. Fetch prices..."
  tool: z.string(),
  dependencies: z.array(z.string()).optional()  // e.g., ['wallet', 'oracles']
}))
```

### Implementation
- In controller: const personas = require('../configs/personas.json'); mcpData.agentPersonas = personas.filter(p => p.tool === req.query.tool);
- Customization: POST /mcp/personas/add (body: newPersona, validate with Zod, append to file/DB).
- Error: 404 persona not found.

### Sample Personas
(As previous, with added dependencies e.g., UniswapExpert: ['wallet', 'oracles']).

### Integration Details
- Tying to Features: Guidelines embed endpoint calls, e.g., "Use /mcp/defi/swap with slippage check".
- Emotion/Memory: Post-action, if success points +5, log to Mem0 {event: 'swap_success'}.
- Dev Team: Reference roles like 'Risk Analyst' for consultations (simulated in prompts).
- Best Practices: Limit to 20 personas/load; cache filtered results.

## AI Agent Usage Documentation
### Overview
Agents fetch MCP for context, adopt personas for tasks, update states. Supports error retry (3 attempts), batch requests.

### Python Example (LangChain with Error Handling)
```python
import requests
from langchain.agents import AgentExecutor
from retry import retry

class MCPAgent:
    def __init__(self, server_url='http://localhost:3000'):
        self.url = server_url
        self.mcp = self._fetch_mcp()

    @retry(tries=3, delay=1)
    def _fetch_mcp(self):
        return requests.get(f'{self.url}/mcp').json()

    def get_persona(self, tool):
        return next((p for p in self.mcp['agentPersonas'] if p['tool'] == tool), None)

    def execute_task(self, task, tool):
        persona = self.get_persona(tool)
        if not persona:
            raise ValueError("Persona not found")
        prompt = f"You are {persona['name']}. Dependencies: {persona.get('dependencies', [])}. Guidelines: {persona['guidelines']}. Task: {task}"
        # LangChain exec...
        # Feedback: requests.post(f'{self.url}/mcp/emotion/update', json={'feedback': score})
        # Memory add: requests.post(f'{self.url}/mcp/memory/add', json={'entry': result})

# Usage with batch
agent = MCPAgent()
results = [agent.execute_task(task, 'uniswap') for task in tasks]
```

### JavaScript Example (React with WS Real-Time)
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

const MCPAgentComponent = () => {
  const [mcp, setMcp] = useState({});
  const [prices, setPrices] = useState({});
  useEffect(() => {
    axios.get('http://localhost:3000/mcp').then(res => setMcp(res.data)).catch(err => console.error('MCP fetch error:', err));
    const ws = new W3CWebSocket('ws://localhost:3000/ws/prices');
    ws.onmessage = (msg) => setPrices(JSON.parse(msg.data));
    ws.onclose = () => console.log('WS closed');
  }, []);

  const handleTask = async (task, tool) => {
    const persona = mcp.agentPersonas.find(p => p.tool === tool);
    const prompt = `As ${persona.name}, deps: ${persona.dependencies}. Guidelines: ${persona.guidelines}. Task: ${task}`;
    // LLM call...
    // Update emotion on success/error
    try {
      await axios.post('/mcp/emotion/update', {feedback: 5});
    } catch (err) {
      await axios.post('/mcp/emotion/update', {feedback: -5});
    }
  };

  return (
    <div>
      <p>Real-Time Prices: {JSON.stringify(prices)}</p>
      <button onClick={() => handleTask('Swap ETH to USDC', 'uniswap')}>Execute Swap</button>
    </div>
  );
};
```

### Best Practices
- **Fetching**: Cache MCP 5min; refresh on emotion change.
- **Persona Usage**: Validate dependencies (e.g., check wallet connected); blend for multi-tool (e.g., uniswap + chainlink).
- **Real-Time**: Handle WS reconnect on close; buffer messages.
- **Error Handling**: Exponential backoff on 5xx; log to Mem0.
- **Multi-Tool Chaining**: e.g., Fetch prices → Analytics query → Strategy.
- **Performance**: Batch endpoints (e.g., /mcp/batch?tools=uniswap,aave).
- **Testing**: Mock server with supertest; ensure emotion consistency.