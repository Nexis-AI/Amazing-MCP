// Re-export types from schema for convenience
export type {
  MCP,
  Persona,
  Memory,
  Emotion,
  ContextManagement,
  Web3Context,
  DefiContext,
  SecurityContext
} from '../mcp-schema';

// Additional interfaces for API responses
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<T> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// WebSocket message types
export interface WSMessage {
  type: 'price_update' | 'news_update' | 'emotion_change' | 'alert' | 'ping' | 'pong';
  data: any;
  timestamp: string;
}

// Integration-specific types
export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

export interface BlockData {
  chain: string;
  height: number;
  hash: string;
  timestamp: string;
  transactions: number;
  gasUsed?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: number;
  tags: string[];
  summary?: string;
}

export interface SwapQuote {
  from: string;
  to: string;
  amountIn: string;
  amountOut: string;
  price: number;
  priceImpact: number;
  slippage: number;
  route: string[];
  gas?: string;
}

export interface YieldData {
  protocol: string;
  asset: string;
  apy: number;
  tvl: string;
  risk: 'low' | 'medium' | 'high';
}

// Error types
export class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// Configuration types
export interface ServerConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  cache: {
    ttl: number;
    checkPeriod: number;
  };
  ws: {
    port: number;
    pingInterval: number;
  };
} 