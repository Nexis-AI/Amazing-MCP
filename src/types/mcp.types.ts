export interface IPersona {
  id: string;
  name: string;
  guidelines: string;
  tools?: string[];
  dependencies?: string[];
  active?: boolean;
}

export interface IEmotion {
  current: 'happy' | 'neutral' | 'sad' | 'scared';
  points: number;
  lastUpdated: Date;
  history: IEmotionHistory[];
}

export interface IEmotionHistory {
  emotion: string;
  points: number;
  timestamp: Date;
  reason?: string;
}

export interface IMemory {
  id: string;
  content: string;
  userId: string;
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface IContextData {
  exaResults?: IExaResult[];
  prices?: Record<string, number>;
  web3Context?: IWeb3Context;
  blockchainData?: IBlockchainData;
  newsFeed?: INewsFeed;
  oracleFeeds?: Record<string, number>;
  walletConfig?: IWalletConfig;
  defiContext?: IDefiContext;
  nftManagement?: INFTMetadata;
  crossChain?: ICrossChainStatus;
}

export interface IExaResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface IWeb3Context {
  provider: string;
  chainId: number;
  balances?: Record<string, string>;
  currentBlock?: number;
}

export interface IBlockchainData {
  blocks: IBlock[];
  chain: string;
}

export interface IBlock {
  height: number;
  timestamp: string;
  hash?: string;
  transactions?: number;
}

export interface INewsFeed {
  articles: INewsArticle[];
  lastUpdated: Date;
}

export interface INewsArticle {
  title: string;
  url: string;
  sentiment: number;
  publishedAt: string;
  source?: string;
}

export interface IWalletConfig {
  accounts: string[];
  balances: Record<string, string>;
  connectedWallet?: string;
}

export interface IDefiContext {
  yields: Record<string, Record<string, number>>;
  trades: ITradeQuote[];
}

export interface ITradeQuote {
  from: string;
  to: string;
  amount: string;
  quote: string;
  route?: string[];
  slippage?: number;
}

export interface INFTMetadata {
  contract: string;
  tokenId: string;
  metadata: {
    title: string;
    description?: string;
    image: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

export interface ICrossChainStatus {
  bridges: Array<{
    from: string;
    to: string;
    status: 'pending' | 'completed' | 'failed';
    txHash?: string;
  }>;
}

export interface IMCPResponse {
  version: string;
  timestamp: Date;
  agentPersonas: IPersona[];
  emotionSystem: IEmotion;
  memory: {
    enabled: boolean;
    entries?: IMemory[];
  };
  contextManagement: IContextData;
  uiHooks?: {
    componentType?: string;
    data?: unknown;
  };
  metadata?: {
    requestId?: string;
    processingTime?: number;
  };
}

export interface IEmotionUpdateRequest {
  points: number;
  reason?: string;
}

export interface IMemorySearchRequest {
  query: string;
  userId?: string;
  limit?: number;
  tags?: string[];
}

export interface IMemoryAddRequest {
  content: string;
  userId: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface IErrorResponse {
  code: number;
  message: string;
  details?: string;
  timestamp: Date;
}

export interface IRateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface ICacheConfig {
  stdTTL: number;
  checkperiod: number;
  useClones: boolean;
}

export interface IWebSocketMessage {
  type: 'prices' | 'news' | 'blocks' | 'emotions' | 'custom';
  data: unknown;
  timestamp: Date;
}