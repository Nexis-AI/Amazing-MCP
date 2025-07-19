import {
  EmotionSchema,
  PersonaSchema,
  MemorySchema,
  MCPResponseSchema,
  EmotionUpdateRequestSchema,
  MemorySearchRequestSchema,
  MemoryAddRequestSchema,
  validateEthereumAddress,
  validateTransactionHash,
} from '../src/mcp-schema';

describe('MCP Schema Validation', () => {
  describe('EmotionSchema', () => {
    it('should validate valid emotion', () => {
      const validEmotion = {
        current: 'happy',
        points: 75,
        lastUpdated: new Date(),
        history: [],
      };

      const result = EmotionSchema.safeParse(validEmotion);
      expect(result.success).toBe(true);
    });

    it('should reject invalid emotion state', () => {
      const invalidEmotion = {
        current: 'excited', // Invalid emotion
        points: 50,
        lastUpdated: new Date(),
        history: [],
      };

      const result = EmotionSchema.safeParse(invalidEmotion);
      expect(result.success).toBe(false);
    });

    it('should reject points outside range', () => {
      const invalidPoints = {
        current: 'happy',
        points: 150, // > 100
        lastUpdated: new Date(),
        history: [],
      };

      const result = EmotionSchema.safeParse(invalidPoints);
      expect(result.success).toBe(false);
    });
  });

  describe('PersonaSchema', () => {
    it('should validate valid persona', () => {
      const validPersona = {
        id: 'test-persona',
        name: 'Test Persona',
        guidelines: 'Test guidelines for the persona',
        tools: ['web3', 'defi'],
        dependencies: ['crypto-prices'],
        active: true,
      };

      const result = PersonaSchema.safeParse(validPersona);
      expect(result.success).toBe(true);
    });

    it('should allow persona without tools', () => {
      const personaWithoutTools = {
        id: 'general',
        name: 'General Assistant',
        guidelines: 'General help',
      };

      const result = PersonaSchema.safeParse(personaWithoutTools);
      expect(result.success).toBe(true);
      expect(result.data?.active).toBe(true); // Default value
    });
  });

  describe('MemorySchema', () => {
    it('should validate valid memory', () => {
      const validMemory = {
        id: 'mem-123',
        content: 'Important DeFi strategy',
        userId: 'user-456',
        timestamp: new Date(),
        tags: ['defi', 'strategy'],
        metadata: { importance: 'high' },
      };

      const result = MemorySchema.safeParse(validMemory);
      expect(result.success).toBe(true);
    });

    it('should allow memory without optional fields', () => {
      const minimalMemory = {
        id: 'mem-123',
        content: 'Simple memory',
        userId: 'user-456',
        timestamp: new Date(),
      };

      const result = MemorySchema.safeParse(minimalMemory);
      expect(result.success).toBe(true);
    });
  });

  describe('Request Schemas', () => {
    describe('EmotionUpdateRequestSchema', () => {
      it('should validate valid update request', () => {
        const validRequest = {
          points: 25,
          reason: 'Good trade executed',
        };

        const result = EmotionUpdateRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
      });

      it('should allow request without reason', () => {
        const requestWithoutReason = {
          points: -10,
        };

        const result = EmotionUpdateRequestSchema.safeParse(requestWithoutReason);
        expect(result.success).toBe(true);
      });

      it('should reject invalid points', () => {
        const invalidRequest = {
          points: 200, // > 100
        };

        const result = EmotionUpdateRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });
    });

    describe('MemorySearchRequestSchema', () => {
      it('should validate valid search request', () => {
        const validRequest = {
          query: 'DeFi strategies',
          userId: 'user-123',
          limit: 20,
          tags: ['defi'],
        };

        const result = MemorySearchRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
      });

      it('should apply default limit', () => {
        const requestWithoutLimit = {
          query: 'test',
        };

        const result = MemorySearchRequestSchema.safeParse(requestWithoutLimit);
        expect(result.success).toBe(true);
        expect(result.data?.limit).toBe(10);
      });

      it('should reject invalid limit', () => {
        const invalidRequest = {
          query: 'test',
          limit: 200, // > 100
        };

        const result = MemorySearchRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });
    });

    describe('MemoryAddRequestSchema', () => {
      it('should validate valid add request', () => {
        const validRequest = {
          content: 'New trading insight',
          userId: 'user-123',
          tags: ['trading', 'insight'],
          metadata: { source: 'market-analysis' },
        };

        const result = MemoryAddRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
      });

      it('should reject empty content', () => {
        const invalidRequest = {
          content: '',
          userId: 'user-123',
        };

        const result = MemoryAddRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Validation Helpers', () => {
    describe('validateEthereumAddress', () => {
      it('should validate correct Ethereum address', () => {
        const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f3232B';
        const result = validateEthereumAddress.safeParse(validAddress);
        expect(result.success).toBe(true);
      });

      it('should reject invalid Ethereum address', () => {
        const invalidAddresses = [
          '0x742d35Cc6634C0532925a3b844Bc9e7595f3232', // Too short
          '0x742d35Cc6634C0532925a3b844Bc9e7595f3232BB', // Too long
          '742d35Cc6634C0532925a3b844Bc9e7595f3232B', // Missing 0x
          '0xZZZd35Cc6634C0532925a3b844Bc9e7595f3232B', // Invalid characters
        ];

        invalidAddresses.forEach(address => {
          const result = validateEthereumAddress.safeParse(address);
          expect(result.success).toBe(false);
        });
      });
    });

    describe('validateTransactionHash', () => {
      it('should validate correct transaction hash', () => {
        const validHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const result = validateTransactionHash.safeParse(validHash);
        expect(result.success).toBe(true);
      });

      it('should reject invalid transaction hash', () => {
        const invalidHashes = [
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde', // Too short
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeff', // Too long
          '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Missing 0x
        ];

        invalidHashes.forEach(hash => {
          const result = validateTransactionHash.safeParse(hash);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe('MCPResponseSchema', () => {
    it('should validate complete MCP response', () => {
      const validResponse = {
        version: '1.0.0',
        timestamp: new Date(),
        agentPersonas: [
          {
            id: 'general',
            name: 'General Assistant',
            guidelines: 'General help',
          },
        ],
        emotionSystem: {
          current: 'neutral',
          points: 0,
          lastUpdated: new Date(),
          history: [],
        },
        memory: {
          enabled: true,
          entries: [],
        },
        contextManagement: {
          prices: { bitcoin: 45000 },
        },
        uiHooks: {
          componentType: 'OrbitingCircles',
          data: { test: true },
        },
        metadata: {
          requestId: 'req-123',
          processingTime: 150,
        },
      };

      const result = MCPResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate minimal MCP response', () => {
      const minimalResponse = {
        version: '1.0.0',
        timestamp: new Date(),
        agentPersonas: [],
        emotionSystem: {
          current: 'neutral',
          points: 0,
          lastUpdated: new Date(),
          history: [],
        },
        memory: {
          enabled: false,
        },
        contextManagement: {},
      };

      const result = MCPResponseSchema.safeParse(minimalResponse);
      expect(result.success).toBe(true);
    });
  });
});