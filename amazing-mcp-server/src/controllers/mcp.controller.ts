import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { z } from 'zod';
import winston from 'winston';
import { 
  MCP, 
  Emotion, 
  validateMCP
} from '../mcp-schema';
import { APIResponse } from '../types/mcp.types';
import { loadPersonas } from '../utils/persona-loader';

// Initialize cache with 5-minute TTL
const mcpCache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/mcp-server.log' })
  ]
});

// In-memory emotion state (in production, use Redis or DB)
let emotionState = {
  currentEmotion: 'Neutral' as Emotion,
  points: 0,
  history: [] as Array<{ emotion: Emotion; timestamp: string; trigger?: string }>
};

// In-memory memories (in production, use Mem0 API)
let memoryStore: Map<string, any[]> = new Map();

export class MCPController {
  /**
   * Get the current MCP context
   */
  static async getMCP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tool, userId = 'default' } = req.query;

      // Check cache first
      const cacheKey = `mcp:${userId}:${tool || 'all'}`;
      const cached = mcpCache.get<MCP>(cacheKey);
      
      if (cached) {
        logger.info('MCP cache hit', { cacheKey });
        res.json({
          success: true,
          data: cached,
          timestamp: new Date().toISOString()
        } as APIResponse<MCP>);
        return;
      }

      // Build MCP context
      const personas = await loadPersonas(tool as string);
      const memories = memoryStore.get(userId as string) || [];
      
      const mcp: MCP = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        agentPersonas: personas,
        emotionSystem: {
          currentEmotion: emotionState.currentEmotion,
          points: emotionState.points,
          thresholds: {
            happy: 50,
            neutral: 0,
            sad: -50,
            scared: -75
          },
          history: emotionState.history.slice(-10) // Last 10 emotion changes
        },
        memoryManagement: {
          memories: memories.slice(-20), // Last 20 memories
          totalMemories: memories.length,
          lastUpdated: new Date().toISOString()
        },
        contextManagement: {
          // These would be populated by integration calls
          prices: {},
          exaResults: [],
          blockchainData: { blocks: [] },
          newsFeed: { articles: [] }
        },
        uiHooks: {
          components: [],
          theme: 'dark'
        }
      };

      // Validate before sending
      const validatedMCP = validateMCP(mcp);
      
      // Cache the result
      mcpCache.set(cacheKey, validatedMCP);
      
      logger.info('MCP context generated', { userId, tool });
      
      res.json({
        success: true,
        data: validatedMCP,
        timestamp: new Date().toISOString()
      } as APIResponse<MCP>);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update emotion points and calculate new emotion
   */
  static async updateEmotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        feedback: z.number().min(-10).max(10),
        trigger: z.string().optional()
      });

      const { feedback, trigger } = schema.parse(req.body);
      
      // Update points
      emotionState.points = Math.max(-100, Math.min(100, emotionState.points + feedback));
      
      // Calculate new emotion based on thresholds
      let newEmotion: Emotion = 'Neutral';
      if (emotionState.points >= 50) {
        newEmotion = 'Happy';
      } else if (emotionState.points >= 25) {
        newEmotion = 'Excited';
      } else if (emotionState.points >= 0) {
        newEmotion = 'Neutral';
      } else if (emotionState.points >= -25) {
        newEmotion = 'Anxious';
      } else if (emotionState.points >= -50) {
        newEmotion = 'Sad';
      } else {
        newEmotion = 'Scared';
      }
      
      // Update if emotion changed
      if (newEmotion !== emotionState.currentEmotion) {
        emotionState.currentEmotion = newEmotion;
        emotionState.history.push({
          emotion: newEmotion,
          timestamp: new Date().toISOString(),
          trigger
        });
        
        // Keep history limited
        if (emotionState.history.length > 100) {
          emotionState.history = emotionState.history.slice(-100);
        }
        
        logger.info('Emotion changed', { 
          newEmotion, 
          points: emotionState.points, 
          trigger 
        });
        
        // Clear MCP cache on emotion change
        mcpCache.flushAll();
      }
      
      res.status(201).json({
        success: true,
        data: {
          currentEmotion: emotionState.currentEmotion,
          points: emotionState.points,
          feedback,
          trigger
        },
        timestamp: new Date().toISOString()
      } as APIResponse);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add a memory
   */
  static async addMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        userId: z.string().default('default'),
        content: z.string().min(1),
        tags: z.array(z.string()).optional()
      });

      const { userId, content, tags } = schema.parse(req.body);
      
      if (!memoryStore.has(userId)) {
        memoryStore.set(userId, []);
      }
      
      const memory = {
        id: `mem_${Date.now()}`,
        userId,
        content,
        timestamp: new Date().toISOString(),
        tags,
        emotionAtCreation: emotionState.currentEmotion
      };
      
      memoryStore.get(userId)!.push(memory);
      
      // Clear cache for this user
      mcpCache.del(`mcp:${userId}:all`);
      
      logger.info('Memory added', { userId, memoryId: memory.id });
      
      res.status(201).json({
        success: true,
        data: memory,
        timestamp: new Date().toISOString()
      } as APIResponse);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search memories
   */
  static async searchMemories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId = 'default', query = '' } = req.query;
      
      const memories = memoryStore.get(userId as string) || [];
      
      // Simple search implementation
      const results = memories.filter(mem => 
        mem.content.toLowerCase().includes((query as string).toLowerCase()) ||
        (mem.tags && mem.tags.some((tag: string) => 
          tag.toLowerCase().includes((query as string).toLowerCase())
        ))
      );
      
      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      } as APIResponse);
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check endpoint
   */
  static async healthCheck(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        uptime: process.uptime(),
        emotion: emotionState.currentEmotion,
        memoryStoreSize: memoryStore.size
      },
      timestamp: new Date().toISOString()
    } as APIResponse);
  }
} 