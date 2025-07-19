import NodeCache from 'node-cache';
import { log } from '../utils/logger';

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
}

class CacheService {
  private cache: NodeCache;
  private readonly DEFAULT_TTL: number;
  private hits = 0;
  private misses = 0;

  constructor() {
    // Get TTL and check period from environment or use defaults
    this.DEFAULT_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
    const checkPeriod = parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10);

    this.cache = new NodeCache({
      stdTTL: this.DEFAULT_TTL,
      checkperiod: checkPeriod,
      useClones: true, // Clone stored values to prevent reference issues
      deleteOnExpire: true,
    });

    // Set up event listeners
    this.cache.on('set', (key) => {
      log.debug(`Cache SET: ${key}`);
    });

    this.cache.on('del', (key) => {
      log.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      log.debug(`Cache EXPIRED: ${key}`);
    });

    log.info(`Cache service initialized with TTL: ${this.DEFAULT_TTL}s, check period: ${checkPeriod}s`);
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        this.hits++;
        log.debug(`Cache HIT: ${key}`);
        return value;
      } else {
        this.misses++;
        log.debug(`Cache MISS: ${key}`);
        return undefined;
      }
    } catch (error) {
      log.error(`Cache GET error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      const success = this.cache.set(key, value, ttl || this.DEFAULT_TTL);
      if (success) {
        log.debug(`Cache SET success: ${key} (TTL: ${ttl || this.DEFAULT_TTL}s)`);
      }
      return success;
    } catch (error) {
      log.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    try {
      const deleted = this.cache.del(key);
      if (deleted > 0) {
        log.debug(`Cache DELETE success: ${key}`);
        return true;
      }
      return false;
    } catch (error) {
      log.error(`Cache DELETE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
    log.info('Cache cleared');
  }

  /**
   * Get multiple values from cache
   */
  mget<T>(keys: string[]): Record<string, T> {
    try {
      const result = this.cache.mget<T>(keys);
      const foundKeys = Object.keys(result);
      this.hits += foundKeys.length;
      this.misses += keys.length - foundKeys.length;
      log.debug(`Cache MGET: ${foundKeys.length}/${keys.length} hits`);
      return result;
    } catch (error) {
      log.error('Cache MGET error:', error);
      return {};
    }
  }

  /**
   * Set multiple values in cache
   */
  mset<T>(items: Array<{ key: string; val: T; ttl?: number }>): boolean {
    try {
      const success = this.cache.mset(items);
      if (success) {
        log.debug(`Cache MSET success: ${items.length} items`);
      }
      return success;
    } catch (error) {
      log.error('Cache MSET error:', error);
      return false;
    }
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys = this.cache.keys().length;
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      keys,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Get cache memory usage info
   */
  getMemoryStats(): {
    keys: number;
    dataSize: number;
    avgTTL: number;
  } {
    const keys = this.cache.keys();
    let totalSize = 0;
    let totalTTL = 0;

    keys.forEach((key) => {
      const ttl = this.cache.getTtl(key);
      if (ttl) {
        totalTTL += ttl - Date.now();
      }
      
      // Estimate size (rough approximation)
      const value = this.cache.get(key);
      if (value) {
        totalSize += JSON.stringify(value).length;
      }
    });

    return {
      keys: keys.length,
      dataSize: totalSize,
      avgTTL: keys.length > 0 ? Math.round(totalTTL / keys.length / 1000) : 0,
    };
  }

  /**
   * Touch a key to reset its TTL
   */
  touch(key: string, ttl?: number): boolean {
    try {
      return this.cache.ttl(key, ttl || this.DEFAULT_TTL);
    } catch (error) {
      log.error(`Cache TOUCH error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  getTTL(key: string): number | undefined {
    const ttl = this.cache.getTtl(key);
    if (ttl) {
      return Math.round((ttl - Date.now()) / 1000);
    }
    return undefined;
  }

  /**
   * Cache wrapper for async functions
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute function
    try {
      const result = await fn();
      this.set(key, result, ttl);
      return result;
    } catch (error) {
      log.error(`Cache wrap error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Enable/disable cache (useful for testing)
   */
  private enabled = true;

  enable(): void {
    this.enabled = true;
    log.info('Cache enabled');
  }

  disable(): void {
    this.enabled = false;
    this.clear();
    log.info('Cache disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const cacheService = new CacheService();