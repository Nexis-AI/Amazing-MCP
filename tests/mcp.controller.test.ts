import request from 'supertest';
import { emotionService } from '../src/services/emotion.service';
import { memoryService } from '../src/services/memory.service';

// Import app after mocking to ensure mocks are in place
let app: any;

// Mock the services
jest.mock('../src/services/emotion.service');
jest.mock('../src/services/memory.service');
jest.mock('../src/services/context.service', () => ({
  contextService: {
    getContextData: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('../src/services/persona.service', () => ({
  getDefaultPersonas: jest.fn().mockResolvedValue([
    {
      id: 'general-assistant',
      name: 'General Assistant',
      guidelines: 'A helpful AI assistant',
      tools: [],
      active: true,
    },
    {
      id: 'defi-expert',
      name: 'DeFi Expert',
      guidelines: 'DeFi specialist',
      tools: ['defi', 'uniswap', 'aave'],
      active: true,
    },
    {
      id: 'nft-specialist',
      name: 'NFT Specialist',
      guidelines: 'NFT expert',
      tools: ['nft'],
      active: true,
    },
  ]),
}));

describe('MCP Controller', () => {
  beforeAll(() => {
    // Import app after environment is setup
    app = require('../src/index').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure API_KEY is set for auth middleware
    process.env.API_KEY = 'test_api_key';
  });

  describe('GET /api/mcp', () => {
    it('should return MCP context successfully', async () => {
      // Mock emotion service
      (emotionService.getCurrentEmotion as jest.Mock).mockResolvedValue({
        current: 'neutral',
        points: 0,
        lastUpdated: new Date(),
        history: [],
      });

      const response = await request(app)
        .get('/api/mcp')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('agentPersonas');
      expect(response.body).toHaveProperty('emotionSystem');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('contextManagement');
    });

    it('should filter personas by tool', async () => {
      const response = await request(app)
        .get('/api/mcp?tool=defi')
        .expect(200);

      expect(response.body.agentPersonas).toBeDefined();
      // Personas should be filtered for DeFi tool
    });

    it('should include memory when requested', async () => {
      (memoryService.getRecentMemories as jest.Mock).mockResolvedValue([
        {
          id: 'test-memory-1',
          content: 'Test memory content',
          userId: 'test-user',
          timestamp: new Date(),
          tags: ['test'],
        },
      ]);

      const response = await request(app)
        .get('/api/mcp?userId=test-user&includeMemory=true')
        .expect(200);

      expect(response.body.memory.entries).toHaveLength(1);
      expect(response.body.memory.entries[0].content).toBe('Test memory content');
    });
  });

  describe('POST /api/mcp/emotion/update', () => {
    it('should update emotion with valid points', async () => {
      const updatedEmotion = {
        current: 'happy',
        points: 60,
        lastUpdated: new Date(),
        history: [],
      };

      (emotionService.updateEmotion as jest.Mock).mockResolvedValue(updatedEmotion);

      const response = await request(app)
        .post('/api/mcp/emotion/update')
        .set('x-api-key', 'test_api_key')
        .send({ points: 30, reason: 'Test update' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.emotion.current).toBe('happy');
      expect(response.body.emotion.points).toBe(60);
    });

    it('should reject invalid emotion points', async () => {
      const response = await request(app)
        .post('/api/mcp/emotion/update')
        .set('x-api-key', 'test_api_key')
        .send({ points: 150 }) // Invalid: > 100
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('points');
    });

    it('should require API key', async () => {
      const response = await request(app)
        .post('/api/mcp/emotion/update')
        .send({ points: 30 })
        .expect(401);

      expect(response.body.message).toContain('API key is required');
    });
  });

  describe('GET /api/mcp/emotion', () => {
    it('should return current emotion state', async () => {
      const emotion = {
        current: 'neutral',
        points: 0,
        lastUpdated: new Date(),
        history: [],
      };

      (emotionService.getCurrentEmotion as jest.Mock).mockResolvedValue(emotion);

      const response = await request(app)
        .get('/api/mcp/emotion')
        .expect(200);

      expect(response.body.current).toBe('neutral');
      expect(response.body.points).toBe(0);
    });
  });

  describe('GET /api/mcp/memory/search', () => {
    it('should search memories successfully', async () => {
      const memories = [
        {
          id: 'memory-1',
          content: 'DeFi yield farming strategy',
          userId: 'test-user',
          timestamp: new Date(),
          tags: ['defi', 'yield'],
        },
      ];

      (memoryService.searchMemories as jest.Mock).mockResolvedValue(memories);

      const response = await request(app)
        .get('/api/mcp/memory/search?query=defi')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.memories[0].content).toContain('DeFi');
    });

    it('should validate search parameters', async () => {
      const response = await request(app)
        .get('/api/mcp/memory/search?limit=200') // Invalid: > 100
        .expect(400);

      expect(response.body.message).toContain('Validation error');
    });
  });

  describe('POST /api/mcp/memory', () => {
    it('should add memory with valid data', async () => {
      const newMemory = {
        id: 'new-memory-1',
        content: 'Important trading insight',
        userId: 'test-user',
        timestamp: new Date(),
        tags: ['trading'],
      };

      (memoryService.addMemory as jest.Mock).mockResolvedValue(newMemory);

      const response = await request(app)
        .post('/api/mcp/memory')
        .set('x-api-key', 'test_api_key')
        .send({
          content: 'Important trading insight',
          userId: 'test-user',
          tags: ['trading'],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.memory.content).toBe('Important trading insight');
    });

    it('should require content and userId', async () => {
      const response = await request(app)
        .post('/api/mcp/memory')
        .set('x-api-key', 'test_api_key')
        .send({ content: 'Test' }) // Missing userId
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('userId');
    });
  });

  describe('GET /api/mcp/personas', () => {
    it('should return all active personas', async () => {
      const response = await request(app)
        .get('/api/mcp/personas')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.personas).toBeDefined();
      expect(Array.isArray(response.body.personas)).toBe(true);
    });

    it('should filter personas by tool', async () => {
      const response = await request(app)
        .get('/api/mcp/personas?tool=nft')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should only include personas with NFT tool
    });
  });
});