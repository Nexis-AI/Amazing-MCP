import MemoryClient from 'mem0ai';
import { log } from '../utils/logger';
import { IMemory } from '../types/mcp.types';

class Mem0Integration {
  private client: MemoryClient | null = null;
  private initialized = false;

  /**
   * Initialize Mem0 client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const apiKey = process.env.MEM0_API_KEY;
    if (!apiKey) {
      log.warn('MEM0_API_KEY not found, Mem0 integration disabled');
      return;
    }

    try {
      this.client = new MemoryClient({
        apiKey,
      });
      
      this.initialized = true;
      log.info('Mem0 integration initialized successfully');
    } catch (error) {
      log.error('Failed to initialize Mem0 integration:', error);
      this.client = null;
    }
  }

  /**
   * Check if Mem0 is available
   */
  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Add memory to Mem0
   */
  async addMemory(
    content: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, using local storage');
      return null;
    }

    try {
      const messages = [
        {
          role: 'user' as 'user',
          content,
        },
      ];

      const result = await this.client!.add(messages, {
        user_id: userId,
        metadata: metadata || {},
      });

      if (result && result.length > 0 && result[0].id) {
        log.debug(`Added memory to Mem0: ${result[0].id}`);
        return result[0].id;
      }
      
      return null;
    } catch (error) {
      log.error('Failed to add memory to Mem0:', error);
      return null;
    }
  }

  /**
   * Search memories in Mem0
   */
  async searchMemories(
    query: string,
    options?: {
      userId?: string;
      limit?: number;
    }
  ): Promise<Array<{
    id: string;
    memory: string;
    user_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, returning empty results');
      return [];
    }

    try {
      const searchOptions: any = {
        limit: options?.limit || 10,
      };

      if (options?.userId) {
        searchOptions.user_id = options.userId;
      }

      const results = await this.client!.search(query, searchOptions);
      
      log.debug(`Found ${results.length} memories matching query: ${query}`);
      // Filter out any results without memory content and map to expected format
      return results
        .filter((r: any) => r.memory !== undefined)
        .map((r: any) => ({
          id: r.id,
          memory: r.memory as string,
          user_id: r.user_id,
          metadata: r.metadata || {},
          created_at: r.created_at,
        }));
    } catch (error) {
      log.error('Failed to search memories in Mem0:', error);
      return [];
    }
  }

  /**
   * Get all memories for a user
   */
  async getUserMemories(userId: string): Promise<Array<{
    id: string;
    memory: string;
    user_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, returning empty results');
      return [];
    }

    try {
      const memories = await this.client!.getAll({
        user_id: userId,
      });

      log.debug(`Retrieved ${memories.length} memories for user: ${userId}`);
      // Filter out any memories without content and map to expected format
      return memories
        .filter((m: any) => m.memory !== undefined)
        .map((m: any) => ({
          id: m.id,
          memory: m.memory as string,
          user_id: m.user_id,
          metadata: m.metadata || {},
          created_at: m.created_at,
        }));
    } catch (error) {
      log.error('Failed to get user memories from Mem0:', error);
      return [];
    }
  }

  /**
   * Update memory in Mem0
   */
  async updateMemory(
    memoryId: string,
    content: string
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, cannot update memory');
      return false;
    }

    try {
      await this.client!.update(memoryId, content);
      log.debug(`Updated memory in Mem0: ${memoryId}`);
      return true;
    } catch (error) {
      log.error('Failed to update memory in Mem0:', error);
      return false;
    }
  }

  /**
   * Delete memory from Mem0
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, cannot delete memory');
      return false;
    }

    try {
      await this.client!.delete(memoryId);
      log.debug(`Deleted memory from Mem0: ${memoryId}`);
      return true;
    } catch (error) {
      log.error('Failed to delete memory from Mem0:', error);
      return false;
    }
  }

  /**
   * Get memory by ID
   */
  async getMemory(memoryId: string): Promise<{
    id: string;
    memory: string;
    user_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  } | null> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, cannot get memory');
      return null;
    }

    try {
      const memory = await this.client!.get(memoryId);
      if (memory && memory.memory !== undefined) {
        return {
          id: memory.id,
          memory: memory.memory as string,
          user_id: memory.user_id || '',
          metadata: memory.metadata || {},
          created_at: memory.created_at instanceof Date ? memory.created_at.toISOString() : (memory.created_at || ''),
        };
      }
      return null;
    } catch (error) {
      log.error('Failed to get memory from Mem0:', error);
      return null;
    }
  }

  /**
   * Get memory history for a user
   */
  async getMemoryHistory(
    userId: string,
    memoryId?: string
  ): Promise<Array<{
    id: string;
    memory_id: string;
    prev_value: string;
    new_value: string;
    event: string;
    created_at: string;
  }>> {
    if (!this.isAvailable()) {
      log.warn('Mem0 not available, returning empty history');
      return [];
    }

    try {
      const options: any = {
        user_id: userId,
      };

      if (memoryId) {
        options.memory_id = memoryId;
      }

      const history = await this.client!.history(options);
      // Map to expected format
      return history.map((h: any) => ({
        id: h.id || '',
        memory_id: h.memory_id || '',
        prev_value: h.prev_value || '',
        new_value: h.new_value || '',
        event: h.event || '',
        created_at: h.created_at || '',
      }));
    } catch (error) {
      log.error('Failed to get memory history from Mem0:', error);
      return [];
    }
  }

  /**
   * Convert Mem0 memory to internal format
   */
  convertToInternalFormat(mem0Memory: {
    id: string;
    memory: string;
    user_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }): IMemory {
    return {
      id: mem0Memory.id,
      content: mem0Memory.memory,
      userId: mem0Memory.user_id,
      timestamp: new Date(mem0Memory.created_at),
      metadata: mem0Memory.metadata,
      tags: (mem0Memory.metadata?.tags as string[]) || [],
    };
  }
}

// Export singleton instance
export const mem0Integration = new Mem0Integration();