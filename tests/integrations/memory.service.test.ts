import { memoryService } from '../../src/services/memory.service';

describe('Memory Service', () => {
  beforeEach(async () => {
    // Clear all memories before each test
    await memoryService.clearAllMemories();
  });

  describe('addMemory', () => {
    it('should add a new memory', async () => {
      const memory = await memoryService.addMemory(
        'Test memory content',
        'user-123',
        {
          tags: ['test', 'unit'],
          metadata: { priority: 'high' },
        }
      );

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Test memory content');
      expect(memory.userId).toBe('user-123');
      expect(memory.tags).toEqual(['test', 'unit']);
      expect(memory.metadata).toEqual({ priority: 'high' });
    });

    it('should add memory without optional fields', async () => {
      const memory = await memoryService.addMemory(
        'Simple memory',
        'user-456'
      );

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Simple memory');
      expect(memory.userId).toBe('user-456');
      expect(memory.tags).toEqual([]);
      expect(memory.metadata).toEqual({});
    });
  });

  describe('searchMemories', () => {
    beforeEach(async () => {
      // Add test memories
      await memoryService.addMemory('Bitcoin price analysis', 'user-1', { tags: ['bitcoin', 'analysis'] });
      await memoryService.addMemory('Ethereum DeFi strategy', 'user-1', { tags: ['ethereum', 'defi'] });
      await memoryService.addMemory('Bitcoin trading tips', 'user-2', { tags: ['bitcoin', 'trading'] });
      await memoryService.addMemory('General crypto news', 'user-1', { tags: ['news'] });
    });

    it('should search memories by query', async () => {
      const results = await memoryService.searchMemories('bitcoin');

      expect(results).toHaveLength(2);
      expect(results[0].content).toContain('Bitcoin');
      expect(results[1].content).toContain('Bitcoin');
    });

    it('should search memories by user', async () => {
      const results = await memoryService.searchMemories('', { userId: 'user-1' });

      expect(results).toHaveLength(3);
      results.forEach(memory => {
        expect(memory.userId).toBe('user-1');
      });
    });

    it('should search memories by tags', async () => {
      const results = await memoryService.searchMemories('', { tags: ['bitcoin'] });

      expect(results).toHaveLength(2);
      results.forEach(memory => {
        expect(memory.tags).toContain('bitcoin');
      });
    });

    it('should combine query and filters', async () => {
      const results = await memoryService.searchMemories('bitcoin', { 
        userId: 'user-1',
        tags: ['analysis'] 
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Bitcoin price analysis');
    });

    it('should respect limit parameter', async () => {
      const results = await memoryService.searchMemories('', { limit: 2 });

      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await memoryService.searchMemories('dogecoin');

      expect(results).toHaveLength(0);
    });
  });

  describe('getRecentMemories', () => {
    beforeEach(async () => {
      // Add memories with delays to ensure order
      await memoryService.addMemory('First memory', 'user-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await memoryService.addMemory('Second memory', 'user-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await memoryService.addMemory('Third memory', 'user-1');
      await memoryService.addMemory('Other user memory', 'user-2');
    });

    it('should get recent memories for user', async () => {
      const memories = await memoryService.getRecentMemories('user-1');

      expect(memories).toHaveLength(3);
      expect(memories[0].content).toBe('Third memory'); // Most recent first
      expect(memories[1].content).toBe('Second memory');
      expect(memories[2].content).toBe('First memory');
    });

    it('should respect limit', async () => {
      const memories = await memoryService.getRecentMemories('user-1', 2);

      expect(memories).toHaveLength(2);
      expect(memories[0].content).toBe('Third memory');
      expect(memories[1].content).toBe('Second memory');
    });

    it('should return empty array for unknown user', async () => {
      const memories = await memoryService.getRecentMemories('unknown-user');

      expect(memories).toHaveLength(0);
    });
  });

  describe('updateMemory', () => {
    it('should update existing memory', async () => {
      const original = await memoryService.addMemory('Original content', 'user-1');
      
      const updated = await memoryService.updateMemory(original.id, {
        content: 'Updated content',
        tags: ['updated'],
        metadata: { edited: true },
      });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.tags).toEqual(['updated']);
      expect(updated!.metadata).toEqual({ edited: true });
      expect(updated!.userId).toBe('user-1'); // Unchanged
    });

    it('should update timestamp on modification', async () => {
      const original = await memoryService.addMemory('Test', 'user-1');
      const originalTime = original.timestamp;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await memoryService.updateMemory(original.id, {
        content: 'Modified',
      });

      expect(updated!.timestamp.getTime()).toBeGreaterThan(originalTime.getTime());
    });

    it('should return null for non-existent memory', async () => {
      const result = await memoryService.updateMemory('fake-id', {
        content: 'New content',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('should delete existing memory', async () => {
      const memory = await memoryService.addMemory('To be deleted', 'user-1');
      
      const deleted = await memoryService.deleteMemory(memory.id);
      expect(deleted).toBe(true);

      // Verify it's gone
      const found = await memoryService.getMemory(memory.id);
      expect(found).toBeNull();
    });

    it('should remove from user index', async () => {
      const memory = await memoryService.addMemory('To be deleted', 'user-1');
      await memoryService.deleteMemory(memory.id);

      const userMemories = await memoryService.getUserMemories('user-1');
      expect(userMemories).toHaveLength(0);
    });

    it('should return false for non-existent memory', async () => {
      const deleted = await memoryService.deleteMemory('fake-id');
      expect(deleted).toBe(false);
    });
  });

  describe('getMemory', () => {
    it('should get memory by ID', async () => {
      const created = await memoryService.addMemory('Test memory', 'user-1');
      
      const retrieved = await memoryService.getMemory(created.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.content).toBe('Test memory');
    });

    it('should return null for non-existent memory', async () => {
      const retrieved = await memoryService.getMemory('fake-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getUserMemories', () => {
    it('should get all memories for a user', async () => {
      await memoryService.addMemory('Memory 1', 'user-1');
      await memoryService.addMemory('Memory 2', 'user-1');
      await memoryService.addMemory('Memory 3', 'user-2');

      const memories = await memoryService.getUserMemories('user-1');
      
      expect(memories).toHaveLength(2);
      memories.forEach(memory => {
        expect(memory.userId).toBe('user-1');
      });
    });

    it('should return memories sorted by timestamp', async () => {
      await memoryService.addMemory('Old', 'user-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await memoryService.addMemory('New', 'user-1');

      const memories = await memoryService.getUserMemories('user-1');
      
      expect(memories[0].content).toBe('New');
      expect(memories[1].content).toBe('Old');
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct statistics', async () => {
      await memoryService.addMemory('Memory 1', 'user-1');
      await memoryService.addMemory('Memory 2', 'user-1');
      await memoryService.addMemory('Memory 3', 'user-2');
      await memoryService.addMemory('Memory 4', 'user-2');
      await memoryService.addMemory('Memory 5', 'user-3');

      const stats = memoryService.getMemoryStats();
      
      expect(stats.totalMemories).toBe(5);
      expect(stats.totalUsers).toBe(3);
      expect(stats.averageMemoriesPerUser).toBeCloseTo(5 / 3, 2);
    });

    it('should handle empty state', () => {
      const stats = memoryService.getMemoryStats();
      
      expect(stats.totalMemories).toBe(0);
      expect(stats.totalUsers).toBe(0);
      expect(stats.averageMemoriesPerUser).toBe(0);
    });
  });
});