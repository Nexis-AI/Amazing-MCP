You are an expert full-stack developer tasked with building the "Ultimate Web3, DeFi, and Crypto MCP Server Project" from scratch. Follow these steps precisely, documenting code, configs, and rationale at each stage. Use Node.js/TypeScript for backend, React/Vite/Tailwind/Magic UI for frontend. Ensure modularity, security, and real-time features.

1. **Project Setup**:
   - Create root directory `mcp-server`.
   - Init backend: `npm init -y`, add deps (express, typescript, zod, ws, dotenv, mem0-client, exa-js, web3, alchemy-sdk, @uniswap/sdk, @aave/protocol-js, @layerzerolabs/scan-client, @apollo/client, axios, openzeppelin/contracts, tenderly, changelly-wrapper, ocean.js, etc.). Add devDeps (ts-node, jest, eslint).
   - Config tsconfig.json: {"compilerOptions": {"target": "ES2020", "module": "commonjs", "strict": true}}.
   - Create .env.example with keys (e.g., EXA_API_KEY).
   - Init frontend: `npx create-vite@latest frontend --template react-ts`, cd frontend, npm i tailwindcss postcss autoprefixer magicui recharts kbar swagger-ui-react framer-motion react-query zustand axios websocket.
   - Config Tailwind: npx tailwindcss init -p, extend config with Magic UI themes.
   - Add docker-compose.yml for backend+nginx.

2. **Backend Structure**:
   - Create src/index.ts: Express app setup, middleware (json, compression, rate-limit), routes mount, WS init.
   - src/mcp-schema.ts: Zod schema for MCP (personas with guidelines/tool/dependencies, emotions, etc.).
   - src/controllers/mcp.controller.ts: Endpoints (/mcp, /emotion/update, /memory/search, /metrics, /commands, /docs).
   - src/integrations/*: One file per tool (e.g., exa.ts: searchExa async fn with SDK).
   - src/utils/websocket.ts: WS server, broadcasts (prices every 10s).
   - src/types/mcp.types.ts: Interfaces.
   - configs/personas.json: Tool-specific personas array (e.g., UniswapExpert with guidelines referencing endpoints).
   - Add logging (winston), auth (jwt optional).
   - Implement each integration: Code from docs (e.g., Web3 init, Exa searchAndContents).

3. **Frontend Structure**:
   - src/App.tsx: React Router routes (Dashboard, Commands, Docs).
   - src/components/*: UsageChart (Recharts), PersonaSelector (OrbitingCircles).
   - src/pages/Dashboard.tsx: Fetch metrics, display with NumberTicker, PieChart, Marquee logs.
   - src/pages/Commands.tsx: Kbar palette with actions (axios calls).
   - src/pages/Docs.tsx: SwaggerUI embed, MDX for personas.
   - src/hooks/useMCPFetch.ts: React Query wrapper.
   - src/hooks/useWebSocket.ts: WS for real-time.
   - vite.config.ts: Proxy /api to :3000.
   - Add theme toggle (Zustand store).

4. **Integration & Features**:
   - For each backend feature (e.g., Exa.ai): Implement fn, endpoint, schema extension, test.
   - Tie personas: Load/filter in controller, guidelines with steps/endpoints.
   - Real-time: WS for prices/news/emotions.
   - Metrics: Logging middleware, expose JSON.

5. **Testing & Docs**:
   - tests/*: Jest for units (mock integrations), integration tests.
   - docs/api.md: Swagger YAML.
   - E2E: Cypress for frontend.

6. **Deployment**:
   - Build backend/frontend.
   - Run: npm start (backend), vite preview (frontend).
   - Docker: Build images, compose up.

Output complete code/files at each step, explain decisions, test incrementally. Use best practices (error handling, validation). Complete in sequence without skipping.