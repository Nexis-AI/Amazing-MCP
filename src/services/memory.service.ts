import { v4 as uuidv4 } from 'uuid';
import { IMemory } from '../types/mcp.types';
import { log } from '../utils/logger';
import { mem0Integration } from '../integrations/mem0';

class MemoryService {
  // In-memory storage as fallback when Mem0 is not available
  private memories: Map<string, IMemory> = new Map();
  private userMemories: Map<string, Set<string>> = new Map();
  private mem0Initialized = false;

  constructor() {
    this.initializeMem0();
  }

  /**
   * Initialize Mem0 integration
   */
  private async initializeMem0(): Promise<void> {
    try {
      await mem0Integration.initialize();
      this.mem0Initialized = mem0Integration.isAvailable();
      if (this.mem0Initialized) {
        log.info('Memory service using Mem0 for persistence');
      } else {
        log.info('Memory service using in-memory storage');
      }
    } catch (error) {
      log.error('Failed to initialize Mem0 in memory service:', error);
    }
  }

  /**
   * Add a new memory
   */
  async addMemory(
    content: string,
    userId: string,
    options?: {
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<IMemory> {
    const memory: IMemory = {
      id: uuidv4(),
      content,
      userId,
      timestamp: new Date(),
      tags: options?.tags || [],
      metadata: options?.metadata || {},
    };

    // Store memory
    this.memories.set(memory.id, memory);

    // Update user index
    if (!this.userMemories.has(userId)) {
      this.userMemories.set(userId, new Set());
    }
    this.userMemories.get(userId)!.add(memory.id);

    log.info(`Added memory ${memory.id} for user ${userId}`);

    // Persist to Mem0 if available
    if (this.mem0Initialized) {
      const mem0Id = await mem0Integration.addMemory(
        content,
        userId,
        { ...options?.metadata, tags: options?.tags }
      );
      if (mem0Id) {
        // Update memory with Mem0 ID
        memory.id = mem0Id;
        memory.metadata = { ...memory.metadata, mem0Id };
        this.memories.set(memory.id, memory);
      }
    }

    return memory;
  }

  /**
   * Search memories
   */
  async searchMemories(
    query: string,
    options?: {
      userId?: string;
      limit?: number;
      tags?: string[];
    }
  ): Promise<IMemory[]> {
    const limit = options?.limit || 10;

    // Try Mem0 first if available
    if (this.mem0Initialized) {
      try {
        const mem0Results = await mem0Integration.searchMemories(query, {
          userId: options?.userId,
          limit,
        });

        // Convert Mem0 results to internal format
        const results = mem0Results.map(m => mem0Integration.convertToInternalFormat(m));

        // Filter by tags if provided
        if (options?.tags && options.tags.length > 0) {
          return results.filter(memory =>
            options.tags!.some(tag => memory.tags?.includes(tag))
          );
        }

        return results;
      } catch (error) {
        log.error('Failed to search memories in Mem0, falling back to local search:', error);
      }
    }

    // Fallback to local search
    const results: IMemory[] = [];

    // Get memories to search
    let memoriesToSearch: IMemory[] = [];
    
    if (options?.userId) {
      const userMemoryIds = this.userMemories.get(options.userId) || new Set();
      memoriesToSearch = Array.from(userMemoryIds)
        .map(id => this.memories.get(id))
        .filter((m): m is IMemory => m !== undefined);
    } else {
      memoriesToSearch = Array.from(this.memories.values());
    }

    // Filter by tags if provided
    if (options?.tags && options.tags.length > 0) {
      memoriesToSearch = memoriesToSearch.filter(memory =>
        options.tags!.some(tag => memory.tags?.includes(tag))
      );
    }

    // Simple search implementation
    const queryLower = query.toLowerCase();
    for (const memory of memoriesToSearch) {
      if (memory.content.toLowerCase().includes(queryLower)) {
        results.push(memory);
        if (results.length >= limit) break;
      }
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    log.debug(`Found ${results.length} memories matching query: ${query}`);

    return results;
  }

  /**
   * Get recent memories for a user
   */
  async getRecentMemories(userId: string, limit = 10): Promise<IMemory[]> {
    // Try Mem0 first if available
    if (this.mem0Initialized) {
      try {
        const mem0Memories = await mem0Integration.getUserMemories(userId);
        // Convert and sort by timestamp
        return mem0Memories
          .map(m => mem0Integration.convertToInternalFormat(m))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);
      } catch (error) {
        log.error('Failed to get recent memories from Mem0, falling back to local:', error);
      }
    }

    // Fallback to local storage
    const userMemoryIds = this.userMemories.get(userId) || new Set();
    const userMemories = Array.from(userMemoryIds)
      .map(id => this.memories.get(id))
      .filter((m): m is IMemory => m !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return userMemories;
  }

  /**
   * Update a memory
   */
  async updateMemory(
    memoryId: string,
    updates: {
      content?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<IMemory | null> {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      return null;
    }

    // Update memory
    const updatedMemory: IMemory = {
      ...memory,
      ...updates,
      timestamp: new Date(),
    };

    this.memories.set(memoryId, updatedMemory);

    log.info(`Updated memory ${memoryId}`);

    // Update in Mem0 if available
    if (this.mem0Initialized && updates.content) {
      await mem0Integration.updateMemory(memoryId, updates.content);
    }

    return updatedMemory;
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      return false;
    }

    // Remove from memories
    this.memories.delete(memoryId);

    // Remove from user index
    const userMemoryIds = this.userMemories.get(memory.userId);
    if (userMemoryIds) {
      userMemoryIds.delete(memoryId);
    }

    log.info(`Deleted memory ${memoryId}`);

    // Delete from Mem0 if available
    if (this.mem0Initialized) {
      await mem0Integration.deleteMemory(memoryId);
    }

    return true;
  }

  /**
   * Get memory by ID
   */
  async getMemory(memoryId: string): Promise<IMemory | null> {
    // Try Mem0 first if available
    if (this.mem0Initialized) {
      try {
        const mem0Memory = await mem0Integration.getMemory(memoryId);
        if (mem0Memory) {
          return mem0Integration.convertToInternalFormat(mem0Memory);
        }
      } catch (error) {
        log.error('Failed to get memory from Mem0, falling back to local:', error);
      }
    }

    // Fallback to local storage
    return this.memories.get(memoryId) || null;
  }

  /**
   * Get all memories for a user
   */
  async getUserMemories(userId: string): Promise<IMemory[]> {
    // Try Mem0 first if available
    if (this.mem0Initialized) {
      try {
        const mem0Memories = await mem0Integration.getUserMemories(userId);
        return mem0Memories
          .map(m => mem0Integration.convertToInternalFormat(m))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      } catch (error) {
        log.error('Failed to get user memories from Mem0, falling back to local:', error);
      }
    }

    // Fallback to local storage
    const userMemoryIds = this.userMemories.get(userId) || new Set();
    return Array.from(userMemoryIds)
      .map(id => this.memories.get(id))
      .filter((m): m is IMemory => m !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear all memories (for testing)
   */
  async clearAllMemories(): Promise<void> {
    this.memories.clear();
    this.userMemories.clear();
    log.warn('All memories cleared');
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    totalMemories: number;
    totalUsers: number;
    averageMemoriesPerUser: number;
  } {
    const totalMemories = this.memories.size;
    const totalUsers = this.userMemories.size;
    const averageMemoriesPerUser = totalUsers > 0 ? totalMemories / totalUsers : 0;

    return {
      totalMemories,
      totalUsers,
      averageMemoriesPerUser,
    };
  }
}

// Export singleton instance
export const memoryService = new MemoryService();