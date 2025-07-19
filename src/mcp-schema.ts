import { z } from 'zod';

// Emotion system schemas
export const EmotionEnum = z.enum(['happy', 'neutral', 'sad', 'scared']);

export const EmotionHistorySchema = z.object({
  emotion: z.string(),
  points: z.number(),
  timestamp: z.date(),
  reason: z.string().optional(),
});

export const EmotionSchema = z.object({
  current: EmotionEnum,
  points: z.number().min(-100).max(100),
  lastUpdated: z.date(),
  history: z.array(EmotionHistorySchema),
});

// Persona schemas
export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  guidelines: z.string(),
  tools: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  active: z.boolean().optional().default(true),
});

// Memory schemas
export const MemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  userId: z.string(),
  timestamp: z.date(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Context data schemas
export const ExaResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  score: z.number().optional(),
});

export const Web3ContextSchema = z.object({
  provider: z.string(),
  chainId: z.number(),
  balances: z.record(z.string()).optional(),
  currentBlock: z.number().optional(),
});

export const BlockSchema = z.object({
  height: z.number(),
  timestamp: z.string(),
  hash: z.string().optional(),
  transactions: z.number().optional(),
});

export const BlockchainDataSchema = z.object({
  blocks: z.array(BlockSchema),
  chain: z.string(),
});

export const NewsArticleSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  sentiment: z.number().min(-1.5).max(1.5),
  publishedAt: z.string(),
  source: z.string().optional(),
});

export const NewsFeedSchema = z.object({
  articles: z.array(NewsArticleSchema),
  lastUpdated: z.date(),
});

export const WalletConfigSchema = z.object({
  accounts: z.array(z.string()),
  balances: z.record(z.string()),
  connectedWallet: z.string().optional(),
});

export const TradeQuoteSchema = z.object({
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  quote: z.string(),
  route: z.array(z.string()).optional(),
  slippage: z.number().optional(),
});

export const DefiContextSchema = z.object({
  yields: z.record(z.record(z.number())),
  trades: z.array(TradeQuoteSchema),
});

export const NFTMetadataSchema = z.object({
  contract: z.string(),
  tokenId: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    image: z.string(),
    attributes: z.array(z.object({
      trait_type: z.string(),
      value: z.union([z.string(), z.number()]),
    })).optional(),
  }),
});

export const CrossChainStatusSchema = z.object({
  bridges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    txHash: z.string().optional(),
  })),
});

export const ContextDataSchema = z.object({
  exaResults: z.array(ExaResultSchema).optional(),
  prices: z.record(z.number()).optional(),
  web3Context: Web3ContextSchema.optional(),
  blockchainData: BlockchainDataSchema.optional(),
  newsFeed: NewsFeedSchema.optional(),
  oracleFeeds: z.record(z.number()).optional(),
  walletConfig: WalletConfigSchema.optional(),
  defiContext: DefiContextSchema.optional(),
  nftManagement: NFTMetadataSchema.optional(),
  crossChain: CrossChainStatusSchema.optional(),
});

// Main MCP response schema
export const MCPResponseSchema = z.object({
  version: z.string(),
  timestamp: z.date(),
  agentPersonas: z.array(PersonaSchema),
  emotionSystem: EmotionSchema,
  memory: z.object({
    enabled: z.boolean(),
    entries: z.array(MemorySchema).optional(),
  }),
  contextManagement: ContextDataSchema,
  uiHooks: z.object({
    componentType: z.string().optional(),
    data: z.unknown().optional(),
  }).optional(),
  metadata: z.object({
    requestId: z.string().optional(),
    processingTime: z.number().optional(),
  }).optional(),
});

// Request schemas
export const EmotionUpdateRequestSchema = z.object({
  points: z.number().min(-100).max(100),
  reason: z.string().optional(),
});

export const MemorySearchRequestSchema = z.object({
  query: z.string(),
  userId: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(10),
  tags: z.array(z.string()).optional(),
});

export const MemoryAddRequestSchema = z.object({
  content: z.string().min(1),
  userId: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Validation helpers
export const validateEthereumAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const validateTransactionHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');

export const validateChainId = z.number().positive();

export const validateTokenAmount = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid token amount');

// Export type inference helpers
export type Emotion = z.infer<typeof EmotionSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type MCPResponse = z.infer<typeof MCPResponseSchema>;
export type EmotionUpdateRequest = z.infer<typeof EmotionUpdateRequestSchema>;
export type MemorySearchRequest = z.infer<typeof MemorySearchRequestSchema>;
export type MemoryAddRequest = z.infer<typeof MemoryAddRequestSchema>;