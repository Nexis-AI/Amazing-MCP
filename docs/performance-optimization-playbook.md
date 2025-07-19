# Performance Optimization Implementation Playbook

## 1. Database Optimization

### Index Strategy
```sql
-- Core indexes for high-frequency queries
CREATE INDEX CONCURRENTLY idx_events_aggregate_id_version 
ON events(aggregate_id, event_version) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_events_created_at 
ON events(created_at DESC) 
INCLUDE (event_type, aggregate_id);

CREATE INDEX CONCURRENTLY idx_memories_user_id_created 
ON memories(user_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Partial indexes for specific queries
CREATE INDEX CONCURRENTLY idx_api_keys_active 
ON api_keys(key_hash) 
WHERE status = 'active' AND expires_at > NOW();

-- JSON indexes for JSONB columns
CREATE INDEX CONCURRENTLY idx_events_data_gin 
ON events USING gin(event_data);

CREATE INDEX CONCURRENTLY idx_mcp_context_tool 
ON mcp_contexts((data->>'tool')) 
WHERE data->>'tool' IS NOT NULL;
```

### Query Optimization
```typescript
// db/query-optimizer.ts
export class QueryOptimizer {
  private queryCache = new Map<string, PreparedStatement>();
  
  async optimizeQuery(sql: string, params: any[]): Promise<QueryResult> {
    // Use prepared statements
    const key = this.hashQuery(sql);
    let prepared = this.queryCache.get(key);
    
    if (!prepared) {
      prepared = await this.db.prepare(sql);
      this.queryCache.set(key, prepared);
    }
    
    // Execute with query plan analysis in dev
    if (process.env.NODE_ENV === 'development') {
      const plan = await this.db.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params);
      this.logSlowQuery(sql, plan);
    }
    
    return prepared.execute(params);
  }
  
  private logSlowQuery(sql: string, plan: any): void {
    const executionTime = plan.rows[0]['Execution Time'];
    if (executionTime > 100) { // 100ms threshold
      logger.warn('Slow query detected', {
        sql,
        executionTime,
        plan: plan.rows,
        suggestion: this.suggestOptimization(plan)
      });
    }
  }
  
  private suggestOptimization(plan: any): string {
    // Analyze plan for common issues
    const planText = JSON.stringify(plan);
    
    if (planText.includes('Seq Scan')) {
      return 'Consider adding an index';
    }
    if (planText.includes('Nested Loop') && plan.rows[0]['Total Cost'] > 10000) {
      return 'Consider rewriting as JOIN';
    }
    if (planText.includes('Sort') && plan.rows[0]['Total Cost'] > 5000) {
      return 'Consider adding a sorted index';
    }
    
    return 'Query plan looks optimal';
  }
}
```

### Database Partitioning
```sql
-- Partition events table by month
CREATE TABLE events_2024_01 PARTITION OF events
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automated partition management
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  start_date date;
  end_date date;
  partition_name text;
BEGIN
  start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
  end_date := start_date + interval '1 month';
  partition_name := 'events_' || to_char(start_date, 'YYYY_MM');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partition', '0 0 25 * *', 'SELECT create_monthly_partition()');
```

## 2. Connection Pooling

### PgBouncer Configuration
```ini
# pgbouncer.ini
[databases]
mcp_db = host=postgres-primary port=5432 dbname=mcp_production

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 100
max_user_connections = 100

# Performance
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
query_timeout = 0
query_wait_timeout = 120

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60
```

### Application Pool Configuration
```typescript
// db/connection-pool.ts
import { Pool } from 'pg';
import { createPool } from 'generic-pool';

export class DatabasePool {
  private readPool: Pool;
  private writePool: Pool;
  private analyticsPool: Pool;
  
  constructor() {
    // Write pool - smaller, dedicated
    this.writePool = new Pool({
      host: process.env.DB_WRITE_HOST,
      port: 6432, // PgBouncer
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Read pool - larger, load balanced
    this.readPool = new Pool({
      host: process.env.DB_READ_HOST, // Points to HAProxy
      port: 6432,
      database: process.env.DB_NAME,
      user: process.env.DB_READ_USER,
      password: process.env.DB_PASS,
      max: 50,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Analytics pool - separate to avoid blocking
    this.analyticsPool = new Pool({
      host: process.env.DB_ANALYTICS_HOST,
      port: 5432, // Direct connection
      database: process.env.DB_NAME,
      user: process.env.DB_ANALYTICS_USER,
      password: process.env.DB_PASS,
      max: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
    });
    
    this.setupPoolMonitoring();
  }
  
  private setupPoolMonitoring(): void {
    setInterval(() => {
      const metrics = {
        write: {
          total: this.writePool.totalCount,
          idle: this.writePool.idleCount,
          waiting: this.writePool.waitingCount,
        },
        read: {
          total: this.readPool.totalCount,
          idle: this.readPool.idleCount,
          waiting: this.readPool.waitingCount,
        }
      };
      
      statsd.gauge('db.pool.connections', metrics.write.total, { pool: 'write' });
      statsd.gauge('db.pool.connections', metrics.read.total, { pool: 'read' });
      
      // Alert on pool exhaustion
      if (metrics.write.waiting > 5) {
        logger.error('Write pool exhausted', metrics.write);
      }
    }, 10000);
  }
}
```

## 3. Request Deduplication

### Idempotency Implementation
```typescript
// middleware/idempotency.ts
import { createHash } from 'crypto';
import Bloom from 'bloom-filters';

export class IdempotencyMiddleware {
  private cache: Redis;
  private bloomFilter: Bloom.BloomFilter;
  
  constructor() {
    // Bloom filter for fast negative lookups
    this.bloomFilter = new Bloom.BloomFilter(
      10000000, // 10M items
      4         // 4 hash functions
    );
    
    this.cache = new Redis({
      keyPrefix: 'idempotency:',
      ttl: 86400 // 24 hours
    });
  }
  
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only for mutations
      if (req.method === 'GET' || req.method === 'HEAD') {
        return next();
      }
      
      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (!idempotencyKey) {
        return res.status(400).json({ 
          error: 'Idempotency-Key header required for mutations' 
        });
      }
      
      // Quick bloom filter check
      if (!this.bloomFilter.has(idempotencyKey)) {
        this.bloomFilter.add(idempotencyKey);
        return this.processRequest(idempotencyKey, req, res, next);
      }
      
      // Check cache for existing response
      const cached = await this.cache.get(idempotencyKey);
      if (cached) {
        const { status, headers, body, inProgress } = JSON.parse(cached);
        
        if (inProgress) {
          // Request still processing
          return res.status(409).json({ 
            error: 'Request still processing',
            retryAfter: 5 
          });
        }
        
        // Return cached response
        res.set(headers);
        return res.status(status).json(body);
      }
      
      return this.processRequest(idempotencyKey, req, res, next);
    };
  }
  
  private async processRequest(
    key: string, 
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    // Mark as in progress
    await this.cache.setex(key, 300, JSON.stringify({ inProgress: true }));
    
    // Capture response
    const originalSend = res.send;
    res.send = function(body: any) {
      // Store response
      this.cache.setex(key, 86400, JSON.stringify({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: JSON.parse(body),
        inProgress: false,
        timestamp: new Date().toISOString()
      }));
      
      return originalSend.call(this, body);
    };
    
    next();
  }
}

// Request deduplication for parallel requests
export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<any>>();
  
  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Check if request already in flight
    const existing = this.inFlight.get(key);
    if (existing) {
      metrics.increment('request.deduplicated');
      return existing;
    }
    
    // Execute and store promise
    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });
    
    this.inFlight.set(key, promise);
    return promise;
  }
}

// Usage
const deduplicator = new RequestDeduplicator();

export const getCryptoPrices = async (coins: string[]) => {
  const key = `prices:${coins.sort().join(',')}`;
  
  return deduplicator.deduplicate(key, async () => {
    const prices = await coingeckoAPI.getPrices(coins);
    await cache.setex(key, 60, JSON.stringify(prices));
    return prices;
  });
};
```

## 4. Caching Strategy

### Multi-Tier Cache Implementation
```typescript
// cache/strategy.ts
export class CacheStrategy {
  private layers: CacheLayer[] = [
    new MemoryCache({ maxSize: 1000, ttl: 60 }),
    new RedisCache({ ttl: 300 }),
    new CDNCache({ ttl: 3600 })
  ];
  
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const span = tracer.startSpan('cache.get');
    span.setAttribute('cache.key', key);
    
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const value = await layer.get<T>(key);
      
      if (value !== null) {
        span.setAttribute('cache.hit', true);
        span.setAttribute('cache.layer', i);
        
        // Promote to higher layers
        for (let j = 0; j < i; j++) {
          await this.layers[j].set(key, value, options);
        }
        
        span.end();
        return value;
      }
    }
    
    span.setAttribute('cache.hit', false);
    span.end();
    return null;
  }
  
  async set<T>(
    key: string, 
    value: T, 
    options?: CacheOptions
  ): Promise<void> {
    const promises = this.layers.map(layer => 
      layer.set(key, value, options)
    );
    await Promise.all(promises);
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Invalidate across all layers
    await Promise.all(
      this.layers.map(layer => layer.invalidate(pattern))
    );
    
    // Publish invalidation event
    await pubsub.publish('cache.invalidation', { pattern });
  }
}

// Cache warming
export class CacheWarmer {
  async warmCache(): Promise<void> {
    const criticalKeys = [
      'mcp:personas:all',
      'prices:bitcoin,ethereum',
      'config:system'
    ];
    
    for (const key of criticalKeys) {
      const [type, ...params] = key.split(':');
      
      switch (type) {
        case 'mcp':
          await this.warmMCP(params.join(':'));
          break;
        case 'prices':
          await this.warmPrices(params[0].split(','));
          break;
        case 'config':
          await this.warmConfig(params[0]);
          break;
      }
    }
  }
  
  private async warmMCP(key: string): Promise<void> {
    const mcp = await mcpService.assemble(key);
    await cache.set(`mcp:${key}`, mcp, { ttl: 300 });
  }
}
```

## 5. APM and Monitoring

### Application Performance Monitoring
```typescript
// monitoring/apm.ts
import * as apm from 'elastic-apm-node';

// Initialize APM
const apmAgent = apm.start({
  serviceName: 'mcp-server',
  secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
  serverUrl: process.env.ELASTIC_APM_SERVER_URL,
  environment: process.env.NODE_ENV,
  transactionSampleRate: 1.0,
  captureBody: 'all',
  captureHeaders: true,
  metricsInterval: '10s',
  breakdownMetrics: true,
  captureSpanStackTraces: true,
  sourceLinesSpanAppFrames: 5,
  sourceLinesSpanLibraryFrames: 5,
  errorOnAbortedRequests: true,
  abortedErrorThreshold: '25s',
  ignoreUrls: ['/health', '/metrics'],
  
  // Custom context
  globalLabels: {
    region: process.env.AWS_REGION,
    cluster: process.env.K8S_CLUSTER_NAME,
    version: process.env.APP_VERSION
  }
});

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  
  // Add custom transaction labels
  const transaction = apm.currentTransaction;
  if (transaction) {
    transaction.setLabel('user_id', req.user?.id);
    transaction.setLabel('api_key', req.apiKey?.id);
    transaction.setLabel('tool', req.query.tool);
  }
  
  // Monitor response
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode
      });
    }
    
    // Custom metrics
    metrics.histogram('http.request.duration', duration, {
      method: req.method,
      route: req.route?.path || 'unknown',
      status: res.statusCode,
      tool: req.query.tool || 'none'
    });
  });
  
  next();
};

// Database query monitoring
export const monitorQuery = async <T>(
  name: string,
  query: () => Promise<T>
): Promise<T> => {
  const span = apm.startSpan(name, 'db', 'query');
  const start = process.hrtime.bigint();
  
  try {
    const result = await query();
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    
    if (span) {
      span.setLabel('duration_ms', duration);
      span.setOutcome('success');
    }
    
    metrics.histogram('db.query.duration', duration, { query: name });
    return result;
  } catch (error) {
    if (span) {
      span.captureError(error);
      span.setOutcome('failure');
    }
    throw error;
  } finally {
    if (span) span.end();
  }
};
```

### Performance Dashboard Configuration
```yaml
# grafana/dashboards/performance.json
{
  "dashboard": {
    "title": "MCP Server Performance",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(http_requests_total[5m])",
          "legendFormat": "{{method}} {{route}}"
        }]
      },
      {
        "title": "P95 Latency",
        "targets": [{
          "expr": "histogram_quantile(0.95, http_request_duration_ms)",
          "legendFormat": "{{route}}"
        }]
      },
      {
        "title": "Database Pool Utilization",
        "targets": [{
          "expr": "db_pool_connections_active / db_pool_connections_total",
          "legendFormat": "{{pool}}"
        }]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [{
          "expr": "rate(cache_hits_total[5m]) / rate(cache_requests_total[5m])",
          "legendFormat": "{{layer}}"
        }]
      },
      {
        "title": "Circuit Breaker Status",
        "targets": [{
          "expr": "circuit_breaker_state",
          "legendFormat": "{{service}}"
        }]
      }
    ]
  }
}
``` 