import { z } from 'zod';

// Emotion enum and schema
export const EmotionEnum = z.enum(['Happy', 'Neutral', 'Sad', 'Scared', 'Excited', 'Anxious']);
export type Emotion = z.infer<typeof EmotionEnum>;

// Agent Persona schema
export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  guidelines: z.string(),
  tool: z.string(),
  dependencies: z.array(z.string()).optional(),
  emotionalTriggers: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string())
  }).optional()
});

// Memory schema
export const MemorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: z.string(),
  timestamp: z.string().datetime(),
  tags: z.array(z.string()).optional(),
  emotionAtCreation: EmotionEnum.optional()
});

// Context Management schema
export const ContextManagementSchema = z.object({
  exaResults: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    score: z.number().optional()
  })).optional(),
  prices: z.record(z.string(), z.object({
    usd: z.number(),
    change24h: z.number().optional()
  })).optional(),
  blockchainData: z.object({
    blocks: z.array(z.object({
      height: z.number(),
      timestamp: z.string(),
      hash: z.string()
    }))
  }).optional(),
  newsFeed: z.object({
    articles: z.array(z.object({
      title: z.string(),
      url: z.string(),
      sentiment: z.number(),
      publishedAt: z.string()
    }))
  }).optional()
});

// Web3 Context schema
export const Web3ContextSchema = z.object({
  provider: z.string(),
  chainId: z.number(),
  connected: z.boolean(),
  accounts: z.array(z.string()).optional(),
  balances: z.record(z.string(), z.string()).optional()
});

// DeFi Context schema
export const DefiContextSchema = z.object({
  yields: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  trades: z.array(z.object({
    from: z.string(),
    to: z.string(),
    amount: z.string(),
    quote: z.string(),
    slippage: z.number()
  })).optional(),
  protocols: z.array(z.string())
});

// Security Context schema
export const SecurityContextSchema = z.object({
  alerts: z.array(z.object({
    type: z.enum(['warning', 'error', 'info']),
    message: z.string(),
    timestamp: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical'])
  })),
  lastAudit: z.string().datetime().optional()
});

// Main MCP Schema
export const MCPSchema = z.object({
  version: z.string().default('1.0.0'),
  timestamp: z.string().datetime(),
  agentPersonas: z.array(PersonaSchema),
  emotionSystem: z.object({
    currentEmotion: EmotionEnum,
    points: z.number().min(-100).max(100),
    thresholds: z.object({
      happy: z.number().default(50),
      neutral: z.number().default(0),
      sad: z.number().default(-50),
      scared: z.number().default(-75)
    }),
    history: z.array(z.object({
      emotion: EmotionEnum,
      timestamp: z.string().datetime(),
      trigger: z.string().optional()
    }))
  }),
  memoryManagement: z.object({
    memories: z.array(MemorySchema),
    totalMemories: z.number(),
    lastUpdated: z.string().datetime()
  }),
  contextManagement: ContextManagementSchema,
  web3Context: Web3ContextSchema.optional(),
  defiContext: DefiContextSchema.optional(),
  securityContext: SecurityContextSchema.optional(),
  uiHooks: z.object({
    components: z.array(z.object({
      id: z.string(),
      type: z.string(),
      props: z.record(z.string(), z.any()),
      state: z.record(z.string(), z.any()).optional()
    })),
    theme: z.enum(['dark', 'light']).default('dark')
  }).optional()
});

// Type exports
export type MCP = z.infer<typeof MCPSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type ContextManagement = z.infer<typeof ContextManagementSchema>;
export type Web3Context = z.infer<typeof Web3ContextSchema>;
export type DefiContext = z.infer<typeof DefiContextSchema>;
export type SecurityContext = z.infer<typeof SecurityContextSchema>;

// Validation helpers
export const validateMCP = (data: unknown): MCP => {
  return MCPSchema.parse(data);
};

export const validatePartialMCP = (data: unknown) => {
  return MCPSchema.partial().parse(data);
}; 