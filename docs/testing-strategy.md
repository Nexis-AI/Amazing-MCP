# Amazing-MCP Server Testing Strategy

## Overview
This document outlines a comprehensive testing strategy for the Amazing-MCP Server to ensure reliability, performance, and security across all components and integrations.

## Testing Pyramid

```
         /\
        /E2E\        5% - End-to-End Tests
       /------\
      /Integra-\     15% - Integration Tests  
     /tion Tests\
    /------------\
   / Unit Tests   \  80% - Unit Tests
  /________________\
```

## 1. Unit Testing

### Test Coverage Goals
- **Target**: 90% code coverage
- **Critical Paths**: 100% coverage for:
  - MCP Controller logic
  - Emotion system calculations
  - Validation schemas
  - Security modules

### Unit Test Examples

#### MCP Controller Tests
```typescript
// mcp.controller.test.ts
describe('MCPController', () => {
  describe('assembleMCP', () => {
    it('should return complete MCP context with default personas', async () => {
      const result = await mcpController.assembleMCP();
      expect(result).toHaveProperty('agentPersonas');
      expect(result.agentPersonas).toHaveLength(15);
      expect(result).toHaveProperty('emotionSystem');
    });

    it('should filter personas by tool parameter', async () => {
      const result = await mcpController.assembleMCP('uniswap');
      expect(result.agentPersonas).toHaveLength(1);
      expect(result.agentPersonas[0].tool).toBe('uniswap');
    });

    it('should handle invalid tool gracefully', async () => {
      const result = await mcpController.assembleMCP('invalid-tool');
      expect(result.agentPersonas).toHaveLength(0);
    });
  });
});
```

#### Emotion System Tests
```typescript
// emotion.service.test.ts
describe('EmotionService', () => {
  describe('updateEmotion', () => {
    it('should transition to Happy when points > 50', () => {
      const state = { points: 30, emotion: 'Neutral' };
      const newState = emotionService.update(state, 25);
      expect(newState.points).toBe(55);
      expect(newState.emotion).toBe('Happy');
    });

    it('should cap points at -100 minimum', () => {
      const state = { points: -90, emotion: 'Frustrated' };
      const newState = emotionService.update(state, -20);
      expect(newState.points).toBe(-100);
    });

    it('should log emotion changes to history', () => {
      const spy = jest.spyOn(emotionService, 'logHistory');
      emotionService.update({ points: 0 }, 60);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        from: 'Neutral',
        to: 'Happy',
        timestamp: expect.any(Date)
      }));
    });
  });
});
```

### Mocking Strategy
```typescript
// __mocks__/integrations/exa.ts
export const searchExa = jest.fn().mockResolvedValue([
  { title: 'Mock Result', url: 'https://example.com', snippet: 'Test' }
]);

// __mocks__/mem0-client.ts
export class Mem0Client {
  add = jest.fn().mockResolvedValue({ id: 'mock-id' });
  search = jest.fn().mockResolvedValue([{ content: 'Mock memory' }]);
  update = jest.fn().mockResolvedValue({ success: true });
}
```

## 2. Integration Testing

### API Integration Tests
```typescript
// integrations/coingecko.integration.test.ts
describe('CoinGecko Integration', () => {
  it('should fetch real prices from API', async () => {
    const prices = await getCryptoPrices(['bitcoin', 'ethereum']);
    expect(prices).toHaveProperty('bitcoin.usd');
    expect(prices).toHaveProperty('ethereum.usd');
    expect(typeof prices.bitcoin.usd).toBe('number');
  });

  it('should handle rate limiting gracefully', async () => {
    // Simulate 429 response
    nock('https://api.coingecko.com')
      .get('/api/v3/simple/price')
      .reply(429, { error: 'Rate limited' });
    
    const result = await getCryptoPrices(['bitcoin']);
    expect(result).toEqual({}); // Should return empty object
  });
});
```

### Database Integration Tests
```typescript
// mem0.integration.test.ts
describe('Mem0 Integration', () => {
  let mem0Client: Mem0Client;

  beforeAll(() => {
    mem0Client = new Mem0Client({ apiKey: process.env.MEM0_TEST_KEY });
  });

  it('should persist and retrieve memories', async () => {
    const memory = { content: 'Test memory', userId: 'test-user' };
    const added = await mem0Client.add(memory);
    
    const retrieved = await mem0Client.search({
      query: 'Test memory',
      userId: 'test-user'
    });
    
    expect(retrieved[0].content).toBe('Test memory');
  });
});
```

## 3. End-to-End Testing

### API E2E Tests
```typescript
// e2e/api.e2e.test.ts
describe('MCP API E2E', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should complete full MCP request flow', async () => {
    const response = await request(app)
      .get('/mcp?tool=uniswap')
      .expect(200);
    
    expect(response.body).toMatchObject({
      agentPersonas: expect.arrayContaining([
        expect.objectContaining({ tool: 'uniswap' })
      ]),
      emotionSystem: expect.objectContaining({
        currentEmotion: expect.any(String),
        points: expect.any(Number)
      })
    });
  });

  it('should handle WebSocket connections', (done) => {
    const ws = new WebSocket('ws://localhost:3000/ws/prices');
    
    ws.on('message', (data) => {
      const prices = JSON.parse(data);
      expect(prices).toHaveProperty('bitcoin');
      ws.close();
      done();
    });
  });
});
```

### UI E2E Tests (Cypress)
```javascript
// cypress/e2e/dashboard.cy.js
describe('Dashboard E2E', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');
  });

  it('should display real-time prices', () => {
    cy.get('[data-testid="price-display"]').should('exist');
    cy.wait(11000); // Wait for price update
    cy.get('[data-testid="price-update-indicator"]').should('be.visible');
  });

  it('should update emotion display', () => {
    cy.get('[data-testid="emotion-display"]').should('contain', 'Neutral');
    
    // Trigger positive action
    cy.get('[data-testid="success-action"]').click();
    cy.get('[data-testid="emotion-display"]').should('contain', 'Happy');
  });
});
```

## 4. Performance Testing

### Load Testing (k6)
```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  const res = http.get('http://localhost:3000/mcp');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

### Stress Testing
```javascript
// k6/stress-test.js
export const options = {
  stages: [
    { duration: '5m', target: 1000 }, // Beyond expected capacity
    { duration: '10m', target: 1000 },
    { duration: '5m', target: 0 },
  ],
};
```

## 5. Security Testing

### OWASP ZAP Automated Scan
```bash
# zap-scan.sh
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r security-report.html
```

### Security Test Cases
```typescript
// security/injection.test.ts
describe('Security - Injection Prevention', () => {
  it('should prevent SQL injection in search', async () => {
    const maliciousQuery = "'; DROP TABLE users; --";
    const response = await request(app)
      .get(`/mcp/memory/search?query=${encodeURIComponent(maliciousQuery)}`)
      .expect(200);
    
    // Should handle safely without error
    expect(response.body).toHaveProperty('results');
  });

  it('should prevent XSS in emotion updates', async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const response = await request(app)
      .post('/mcp/emotion/update')
      .send({ feedback: xssPayload })
      .expect(400); // Should reject invalid input
  });
});
```

## 6. Contract Testing

### Consumer-Driven Contract Tests
```typescript
// contracts/mcp-consumer.pact.ts
describe('MCP API Consumer Contract', () => {
  const provider = new Pact({
    consumer: 'AI Agent',
    provider: 'MCP Server',
  });

  it('should return MCP context', async () => {
    await provider.addInteraction({
      state: 'MCP server is available',
      uponReceiving: 'a request for MCP context',
      withRequest: {
        method: 'GET',
        path: '/mcp',
      },
      willRespondWith: {
        status: 200,
        body: Matchers.like({
          agentPersonas: Matchers.eachLike({
            id: Matchers.string(),
            name: Matchers.string(),
            tool: Matchers.string(),
          }),
          emotionSystem: {
            currentEmotion: Matchers.string(),
            points: Matchers.integer(),
          },
        }),
      },
    });
  });
});
```

## 7. Monitoring & Alerting Tests

### Synthetic Monitoring
```typescript
// monitoring/synthetic.ts
const syntheticTests = [
  {
    name: 'MCP API Health',
    interval: '1m',
    test: async () => {
      const start = Date.now();
      const response = await fetch('http://localhost:3000/mcp');
      const duration = Date.now() - start;
      
      assert(response.status === 200, 'API should return 200');
      assert(duration < 1000, 'Response time should be under 1s');
    },
  },
  {
    name: 'WebSocket Connectivity',
    interval: '5m',
    test: async () => {
      const ws = new WebSocket('ws://localhost:3000/ws/prices');
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      ws.close();
    },
  },
];
```

## 8. Test Automation

### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:3000'
```

## 9. Test Data Management

### Test Data Factory
```typescript
// test/factories/mcp.factory.ts
export const mcpFactory = {
  persona: (overrides = {}) => ({
    id: faker.datatype.uuid(),
    name: faker.name.jobTitle(),
    tool: faker.helpers.arrayElement(['uniswap', 'aave', 'chainlink']),
    guidelines: faker.lorem.paragraph(),
    ...overrides,
  }),
  
  emotion: (overrides = {}) => ({
    currentEmotion: 'Neutral',
    points: 0,
    history: [],
    ...overrides,
  }),
  
  memory: (overrides = {}) => ({
    id: faker.datatype.uuid(),
    content: faker.lorem.sentence(),
    userId: faker.datatype.uuid(),
    timestamp: faker.date.recent(),
    ...overrides,
  }),
};
```

## 10. Testing Best Practices

### Test Organization
- Group tests by feature/module
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### Test Maintenance
- Regular test review and updates
- Remove flaky tests
- Monitor test execution time
- Maintain test documentation

### Testing Checklist
- [ ] Unit tests for all new functions
- [ ] Integration tests for external APIs
- [ ] E2E tests for critical user flows
- [ ] Performance tests for high-load scenarios
- [ ] Security tests for vulnerabilities
- [ ] Contract tests for API consumers
- [ ] Documentation updated
- [ ] CI/CD pipeline passing 