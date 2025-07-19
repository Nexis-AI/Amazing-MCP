import { cacheService } from '../../src/services/cache.service';

describe('Cache Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
  });

  afterAll(() => {
    // Clean up after all tests
    cacheService.clear();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      
      const setResult = cacheService.set(key, value);
      expect(setResult).toBe(true);
      
      const retrieved = cacheService.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cacheService.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should check if key exists', () => {
      const key = 'exists-key';
      
      expect(cacheService.has(key)).toBe(false);
      
      cacheService.set(key, 'value');
      expect(cacheService.has(key)).toBe(true);
    });

    it('should delete keys', () => {
      const key = 'delete-key';
      cacheService.set(key, 'value');
      
      const deleteResult = cacheService.delete(key);
      expect(deleteResult).toBe(true);
      expect(cacheService.has(key)).toBe(false);
      
      // Deleting non-existent key should return false
      expect(cacheService.delete(key)).toBe(false);
    });

    it('should clear all cache entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      
      expect(cacheService.keys().length).toBe(3);
      
      cacheService.clear();
      expect(cacheService.keys().length).toBe(0);
    });
  });

  describe('TTL functionality', () => {
    it('should respect custom TTL', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      
      // Set with 1 second TTL
      cacheService.set(key, value, 1);
      expect(cacheService.get(key)).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(cacheService.get(key)).toBeUndefined();
    });

    it('should get remaining TTL', () => {
      const key = 'ttl-check';
      cacheService.set(key, 'value', 60);
      
      const ttl = cacheService.getTTL(key);
      expect(ttl).toBeDefined();
      expect(ttl).toBeLessThanOrEqual(60);
      expect(ttl).toBeGreaterThan(55);
    });

    it('should touch key to reset TTL', () => {
      const key = 'touch-key';
      cacheService.set(key, 'value', 10);
      
      const initialTTL = cacheService.getTTL(key);
      
      // Touch with new TTL
      const touched = cacheService.touch(key, 60);
      expect(touched).toBe(true);
      
      const newTTL = cacheService.getTTL(key);
      expect(newTTL).toBeGreaterThan(initialTTL!);
    });
  });

  describe('batch operations', () => {
    it('should get multiple values', () => {
      cacheService.set('multi1', 'value1');
      cacheService.set('multi2', 'value2');
      cacheService.set('multi3', 'value3');
      
      const result = cacheService.mget(['multi1', 'multi2', 'multi4']);
      
      expect(result).toEqual({
        multi1: 'value1',
        multi2: 'value2',
      });
    });

    it('should set multiple values', () => {
      // Test with string values
      const stringItems = [
        { key: 'batch1', val: 'value1' },
        { key: 'batch2', val: 'value2', ttl: 60 },
        { key: 'batch3', val: 'value3' },
      ];
      
      const result1 = cacheService.mset(stringItems);
      expect(result1).toBe(true);
      
      expect(cacheService.get('batch1')).toBe('value1');
      expect(cacheService.get('batch2')).toBe('value2');
      expect(cacheService.get('batch3')).toBe('value3');
      
      // Test with object values
      const objectItems = [
        { key: 'obj1', val: { type: 'object1' } },
        { key: 'obj2', val: { type: 'object2' }, ttl: 60 },
      ];
      
      const result2 = cacheService.mset(objectItems);
      expect(result2).toBe(true);
      
      expect(cacheService.get('obj1')).toEqual({ type: 'object1' });
      expect(cacheService.get('obj2')).toEqual({ type: 'object2' });
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', () => {
      // Reset stats
      cacheService.clear();
      
      cacheService.set('stat-key', 'value');
      
      // Hit
      cacheService.get('stat-key');
      // Miss
      cacheService.get('non-existent');
      // Another hit
      cacheService.get('stat-key');
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(66.67);
    });

    it('should get memory statistics', () => {
      cacheService.clear();
      
      cacheService.set('mem1', 'short');
      cacheService.set('mem2', { larger: 'object with more data' });
      
      const memStats = cacheService.getMemoryStats();
      expect(memStats.keys).toBe(2);
      expect(memStats.dataSize).toBeGreaterThan(0);
      expect(memStats.avgTTL).toBeGreaterThan(0);
    });
  });

  describe('wrap function', () => {
    it('should cache async function results', async () => {
      let callCount = 0;
      const expensiveFunction = async () => {
        callCount++;
        return { result: 'expensive computation' };
      };
      
      // First call - should execute function
      const result1 = await cacheService.wrap('wrap-key', expensiveFunction);
      expect(result1).toEqual({ result: 'expensive computation' });
      expect(callCount).toBe(1);
      
      // Second call - should return cached result
      const result2 = await cacheService.wrap('wrap-key', expensiveFunction);
      expect(result2).toEqual({ result: 'expensive computation' });
      expect(callCount).toBe(1); // Function not called again
    });

    it('should handle errors in wrapped function', async () => {
      const errorFunction = async () => {
        throw new Error('Test error');
      };
      
      await expect(
        cacheService.wrap('error-key', errorFunction)
      ).rejects.toThrow('Test error');
      
      // Error should not be cached
      expect(cacheService.has('error-key')).toBe(false);
    });
  });

  describe('enable/disable functionality', () => {
    it('should disable and enable cache', () => {
      cacheService.set('test-key', 'value');
      expect(cacheService.isEnabled()).toBe(true);
      
      cacheService.disable();
      expect(cacheService.isEnabled()).toBe(false);
      expect(cacheService.keys().length).toBe(0); // Cache cleared
      
      cacheService.enable();
      expect(cacheService.isEnabled()).toBe(true);
    });
  });
});