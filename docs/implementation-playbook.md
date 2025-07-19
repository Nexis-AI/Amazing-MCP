# Implementation Playbook: Architecture & Scalability

## 1. GraphQL API Implementation

### Schema Design
```graphql
# schema.graphql
type Query {
  mcp(tool: String): MCPContext! @cacheControl(maxAge: 300)
  cryptoPrices(coins: [String!]!): [Price!]! @rateLimit(limit: 100, duration: 60)
  defiSwapQuote(input: SwapInput!): SwapQuote! @auth(requires: USER)
}

type Mutation {
  updateEmotion(feedback: Int!): EmotionState! @auth(requires: USER)
  addMemory(content: String!): Memory! @auth(requires: USER)
}

type Subscription {
  priceUpdates(coins: [String!]!): PriceUpdate! @auth(requires: USER)
  emotionChanges(userId: ID!): EmotionUpdate! @auth(requires: ADMIN)
}

directive @auth(requires: Role!) on FIELD_DEFINITION
directive @rateLimit(limit: Int!, duration: Int!) on FIELD_DEFINITION
directive @cacheControl(maxAge: Int!) on FIELD_DEFINITION
```

### Resolver Architecture
```typescript
// resolvers/index.ts
import { GraphQLResolverMap } from '@apollo/server';
import DataLoader from 'dataloader';

export const resolvers: GraphQLResolverMap = {
  Query: {
    mcp: async (_, { tool }, { dataSources, cache }) => {
      const cacheKey = `mcp:${tool || 'all'}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
      
      const result = await dataSources.mcpAPI.getMCP(tool);
      await cache.set(cacheKey, result, { ttl: 300 });
      return result;
    },
    
    cryptoPrices: async (_, { coins }, { loaders }) => {
      return loaders.priceLoader.loadMany(coins);
    }
  },
  
  Mutation: {
    updateEmotion: async (_, { feedback }, { userId, dataSources }) => {
      return dataSources.emotionAPI.update(userId, feedback);
    }
  },
  
  Subscription: {
    priceUpdates: {
      subscribe: (_, { coins }, { pubsub }) => {
        return pubsub.asyncIterator(coins.map(c => `PRICE_UPDATE_${c}`));
      }
    }
  }
};

// DataLoader for batching
export const createLoaders = () => ({
  priceLoader: new DataLoader(async (coins: string[]) => {
    const prices = await getCryptoPrices(coins);
    return coins.map(coin => prices[coin]);
  })
});
```

### Implementation Steps
1. **Week 1**: Schema design and federation setup
2. **Week 2**: Resolver implementation with DataLoader
3. **Week 3**: Auth directives and rate limiting
4. **Week 4**: Subscription infrastructure and testing

### Rollback Plan
- Feature flag for GraphQL endpoint
- Maintain REST API in parallel for 2 months
- Automated regression tests comparing responses

---

## 2. Event Sourcing Implementation

### Event Store Design
```typescript
// event-store/schema.sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INT NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_aggregate (aggregate_id, event_version),
  INDEX idx_event_type (event_type, created_at)
);

CREATE TABLE snapshots (
  aggregate_id UUID PRIMARY KEY,
  aggregate_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Event Implementation
```typescript
// events/base.event.ts
export abstract class DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly eventType: string,
    public readonly eventVersion: number,
    public readonly occurredAt: Date = new Date()
  ) {}
  
  abstract getEventData(): Record<string, any>;
}

// events/emotion.events.ts
export class EmotionUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly oldEmotion: string,
    public readonly newEmotion: string,
    public readonly points: number,
    public readonly feedback: number
  ) {
    super(aggregateId, 'EmotionUpdated', 1);
  }
  
  getEventData() {
    return {
      oldEmotion: this.oldEmotion,
      newEmotion: this.newEmotion,
      points: this.points,
      feedback: this.feedback
    };
  }
}

// event-store/store.ts
export class EventStore {
  async append(event: DomainEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO events 
      (aggregate_id, aggregate_type, event_type, event_version, event_data, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      event.aggregateId,
      event.constructor.name,
      event.eventType,
      event.eventVersion,
      event.getEventData(),
      { userId: this.context.userId, timestamp: event.occurredAt }
    ]);
    
    await this.publishEvent(event);
  }
  
  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const query = fromVersion 
      ? 'WHERE aggregate_id = $1 AND event_version > $2'
      : 'WHERE aggregate_id = $1';
      
    const events = await this.db.query(`
      SELECT * FROM events ${query} ORDER BY event_version
    `, fromVersion ? [aggregateId, fromVersion] : [aggregateId]);
    
    return events.map(e => this.deserializeEvent(e));
  }
}
```

---

## 3. Circuit Breaker Implementation

### Circuit Breaker Pattern
```typescript
// circuit-breaker/breaker.ts
import CircuitBreaker from 'opossum';

interface BreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
}

export class ServiceBreaker {
  private breakers = new Map<string, CircuitBreaker>();
  
  private defaultOptions: BreakerOptions = {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10
  };
  
  wrap<T>(name: string, fn: (...args: any[]) => Promise<T>, options?: Partial<BreakerOptions>): (...args: any[]) => Promise<T> {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(fn, { ...this.defaultOptions, ...options });
      
      breaker.on('open', () => {
        logger.error(`Circuit breaker ${name} opened`);
        metrics.increment('circuit_breaker.open', { service: name });
      });
      
      breaker.on('halfOpen', () => {
        logger.info(`Circuit breaker ${name} half-open`);
      });
      
      breaker.fallback(() => {
        throw new Error(`Service ${name} unavailable`);
      });
      
      this.breakers.set(name, breaker);
    }
    
    return this.breakers.get(name)!.fire.bind(this.breakers.get(name));
  }
}

// Usage in integrations
const breaker = new ServiceBreaker();

export const getCryptoPrices = breaker.wrap(
  'coingecko',
  async (coins: string[]) => {
    const response = await axios.get('/prices', { params: { ids: coins.join(',') } });
    return response.data;
  },
  { timeout: 5000, errorThresholdPercentage: 30 }
);
```

---

## 4. Redis Integration

### Redis Architecture
```typescript
// redis/config.ts
import Redis from 'ioredis';
import RedisCluster from 'ioredis/built/cluster';

export const createRedisClient = () => {
  if (process.env.REDIS_CLUSTER === 'true') {
    return new RedisCluster([
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 },
      { host: 'redis-3', port: 6379 }
    ], {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        db: 0
      },
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300
    });
  }
  
  return new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
  });
};

// cache/multi-tier.ts
export class MultiTierCache {
  constructor(
    private l1: NodeCache,    // In-memory
    private l2: Redis,        // Redis
    private l3?: S3           // Optional cold storage
  ) {}
  
  async get<T>(key: string): Promise<T | null> {
    // Check L1
    const l1Result = this.l1.get<T>(key);
    if (l1Result) {
      metrics.increment('cache.hit', { tier: 'l1' });
      return l1Result;
    }
    
    // Check L2
    const l2Result = await this.l2.get(key);
    if (l2Result) {
      metrics.increment('cache.hit', { tier: 'l2' });
      const parsed = JSON.parse(l2Result);
      this.l1.set(key, parsed, 60); // Promote to L1
      return parsed;
    }
    
    // Check L3 if available
    if (this.l3) {
      const l3Result = await this.l3.getObject(key);
      if (l3Result) {
        metrics.increment('cache.hit', { tier: 'l3' });
        await this.l2.setex(key, 3600, JSON.stringify(l3Result));
        this.l1.set(key, l3Result, 60);
        return l3Result;
      }
    }
    
    metrics.increment('cache.miss');
    return null;
  }
}
```

---

## 5. Message Queue Implementation

### Kafka Integration
```typescript
// kafka/producer.ts
import { Kafka, Producer, CompressionTypes } from 'kafkajs';

export class EventProducer {
  private producer: Producer;
  
  constructor(private kafka: Kafka) {
    this.producer = kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      compression: CompressionTypes.GZIP
    });
  }
  
  async publish(topic: string, event: any): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          'event-type': event.eventType,
          'correlation-id': context.correlationId
        }
      }]
    });
  }
}

// kafka/consumer.ts
export class EventConsumer {
  async subscribe(topics: string[], handler: (event: any) => Promise<void>): Promise<void> {
    const consumer = this.kafka.consumer({ 
      groupId: 'mcp-server',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    await consumer.subscribe({ topics, fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const span = tracer.startSpan('kafka.consume', {
          attributes: { topic, partition }
        });
        
        try {
          const event = JSON.parse(message.value.toString());
          await handler(event);
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error);
          // Send to DLQ
          await this.sendToDLQ(topic, message, error);
        } finally {
          span.end();
        }
      }
    });
  }
}
```

---

## 6. Multi-Chain Compatibility Layer

### Chain Abstraction
```typescript
// chains/abstract.ts
export abstract class BlockchainAdapter {
  abstract getBalance(address: string): Promise<bigint>;
  abstract getTransaction(hash: string): Promise<Transaction>;
  abstract estimateFee(tx: any): Promise<bigint>;
  abstract sendTransaction(tx: any): Promise<string>;
  abstract subscribeToEvents(filter: any): AsyncIterator<Event>;
}

// chains/evm.adapter.ts
export class EVMAdapter extends BlockchainAdapter {
  constructor(private web3: Web3) {
    super();
  }
  
  async getBalance(address: string): Promise<bigint> {
    return this.web3.eth.getBalance(address);
  }
  
  // ... other implementations
}

// chains/solana.adapter.ts
export class SolanaAdapter extends BlockchainAdapter {
  constructor(private connection: Connection) {
    super();
  }
  
  async getBalance(address: string): Promise<bigint> {
    const pubkey = new PublicKey(address);
    const balance = await this.connection.getBalance(pubkey);
    return BigInt(balance);
  }
  
  // ... other implementations
}

// chains/registry.ts
export class ChainRegistry {
  private adapters = new Map<string, BlockchainAdapter>();
  
  register(chain: string, adapter: BlockchainAdapter): void {
    this.adapters.set(chain, adapter);
  }
  
  getAdapter(chain: string): BlockchainAdapter {
    const adapter = this.adapters.get(chain);
    if (!adapter) throw new Error(`Unsupported chain: ${chain}`);
    return adapter;
  }
}
```

### Infrastructure as Code (Terraform)
```hcl
# infrastructure/redis.tf
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "mcp-redis-cluster"
  replication_group_description = "Redis cluster for MCP server"
  engine                     = "redis"
  engine_version            = "7.0"
  node_type                 = "cache.r6g.large"
  number_cache_clusters     = 3
  port                      = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = random_password.redis_auth.result
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:06:00"
  
  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# infrastructure/kafka.tf
resource "aws_msk_cluster" "kafka" {
  cluster_name           = "mcp-kafka-cluster"
  kafka_version         = "3.4.0"
  number_of_broker_nodes = 3
  
  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.kafka.id]
    
    storage_info {
      ebs_storage_info {
        volume_size = 100
        provisioned_throughput {
          enabled           = true
          volume_throughput = 250
        }
      }
    }
  }
  
  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
    
    encryption_at_rest_kms_key_arn = aws_kms_key.kafka.arn
  }
  
  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }
  
  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.kafka.name
      }
    }
  }
}
``` 