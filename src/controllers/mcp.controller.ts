import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { 
  IMCPResponse, 
  IPersona, 
  IEmotion, 
  IMemory,
  IEmotionUpdateRequest,
  IMemorySearchRequest,
  IMemoryAddRequest,
} from '../types/mcp.types';
import {
  MCPResponseSchema,
  EmotionUpdateRequestSchema,
  MemorySearchRequestSchema,
  MemoryAddRequestSchema,
  PersonaSchema,
} from '../mcp-schema';
import { broadcastEmotions } from '../utils/websocket';
import { getDefaultPersonas } from '../services/persona.service';
import { emotionService } from '../services/emotion.service';
import { memoryService } from '../services/memory.service';
import { contextService } from '../services/context.service';
import { cacheService } from '../services/cache.service';

export class MCPController {
  /**
   * Get MCP context
   */
  async getMCP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();
      const requestId = uuidv4();
      
      // Extract query parameters
      const { tool, userId, includeMemory } = req.query;
      const cacheKey = `mcp:${tool || 'default'}:${userId || 'anonymous'}`;
      
      // Check cache
      const cachedResponse = cacheService.get<IMCPResponse>(cacheKey);
      if (cachedResponse && process.env.NODE_ENV === 'production') {
        log.debug(`Cache hit for key: ${cacheKey}`);
        res.json(cachedResponse);
        return;
      }
      
      // Build MCP response
      const response = await this.buildMCPResponse({
        tool: tool as string,
        userId: userId as string,
        includeMemory: includeMemory === 'true',
        requestId,
      });
      
      // Validate response
      const validatedResponse = MCPResponseSchema.parse(response);
      
      // Cache response
      cacheService.set(cacheKey, validatedResponse);
      
      // Add processing time
      validatedResponse.metadata = {
        ...validatedResponse.metadata,
        processingTime: Date.now() - startTime,
      };
      
      res.json(validatedResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update emotion state
   */
  async updateEmotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validatedRequest = EmotionUpdateRequestSchema.parse(req.body);
      
      // Update emotion
      const updatedEmotion = await emotionService.updateEmotion(
        validatedRequest.points,
        validatedRequest.reason,
      );
      
      // Broadcast emotion update
      broadcastEmotions(updatedEmotion);
      
      // Clear relevant caches
      cacheService.clear();
      
      res.status(200).json({
        success: true,
        emotion: updatedEmotion,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current emotion state
   */
  async getEmotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const emotion = await emotionService.getCurrentEmotion();
      res.json(emotion);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search memories
   */
  async searchMemories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validatedRequest = MemorySearchRequestSchema.parse(req.query);
      
      // Check if memory system is enabled
      if (process.env.ENABLE_MEMORY_SYSTEM !== 'true') {
        throw new AppError('Memory system is disabled', 503);
      }
      
      // Search memories
      const memories = await memoryService.searchMemories(
        validatedRequest.query,
        {
          userId: validatedRequest.userId,
          limit: validatedRequest.limit,
          tags: validatedRequest.tags,
        },
      );
      
      res.json({
        success: true,
        count: memories.length,
        memories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add memory
   */
  async addMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validatedRequest = MemoryAddRequestSchema.parse(req.body);
      
      // Check if memory system is enabled
      if (process.env.ENABLE_MEMORY_SYSTEM !== 'true') {
        throw new AppError('Memory system is disabled', 503);
      }
      
      // Add memory
      const memory = await memoryService.addMemory(
        validatedRequest.content,
        validatedRequest.userId,
        {
          tags: validatedRequest.tags,
          metadata: validatedRequest.metadata,
        },
      );
      
      res.status(201).json({
        success: true,
        memory,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get personas
   */
  async getPersonas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tool } = req.query;
      const personas = await this.getFilteredPersonas(tool as string);
      
      res.json({
        success: true,
        count: personas.length,
        personas,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Build complete MCP response
   */
  private async buildMCPResponse(options: {
    tool?: string;
    userId?: string;
    includeMemory: boolean;
    requestId: string;
  }): Promise<IMCPResponse> {
    const { tool, userId, includeMemory, requestId } = options;
    
    // Get personas
    const personas = await this.getFilteredPersonas(tool);
    
    // Get emotion state
    const emotion = await emotionService.getCurrentEmotion();
    
    // Get memories if requested
    let memories: IMemory[] = [];
    if (includeMemory && userId && process.env.ENABLE_MEMORY_SYSTEM === 'true') {
      memories = await memoryService.getRecentMemories(userId, 10);
    }
    
    // Get context data
    const contextData = await contextService.getContextData(tool);
    
    // Build response
    const response: IMCPResponse = {
      version: '1.0.0',
      timestamp: new Date(),
      agentPersonas: personas,
      emotionSystem: emotion,
      memory: {
        enabled: process.env.ENABLE_MEMORY_SYSTEM === 'true',
        entries: memories,
      },
      contextManagement: contextData,
      metadata: {
        requestId,
      },
    };
    
    // Add UI hooks if applicable
    if (tool === 'crypto-prices') {
      response.uiHooks = {
        componentType: 'OrbitingCircles',
        data: contextData.prices,
      };
    }
    
    return response;
  }

  /**
   * Get filtered personas based on tool
   */
  private async getFilteredPersonas(tool?: string): Promise<IPersona[]> {
    const allPersonas = await getDefaultPersonas();
    
    if (!tool) {
      return allPersonas.filter(p => p.active !== false);
    }
    
    // Filter personas based on tool
    return allPersonas.filter(persona => {
      if (persona.active === false) return false;
      if (!persona.tools || persona.tools.length === 0) return true;
      return persona.tools.includes(tool);
    });
  }
}

// Export singleton instance
export const mcpController = new MCPController();