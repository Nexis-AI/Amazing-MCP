# Security Hardening Implementation Playbook

## 1. API Key Rotation System

### Architecture
```typescript
// security/key-rotation.ts
import { randomBytes } from 'crypto';
import { sign, verify } from 'jsonwebtoken';

interface APIKey {
  id: string;
  key: string;
  scopes: string[];
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  rotationSchedule: 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'rotating' | 'deprecated' | 'revoked';
}

export class APIKeyManager {
  private readonly KEY_PREFIX = 'mcp_';
  private readonly ROTATION_OVERLAP = 3600000; // 1 hour overlap
  
  async generateKey(scopes: string[], schedule: APIKey['rotationSchedule']): Promise<APIKey> {
    const keyId = randomBytes(16).toString('hex');
    const keySecret = randomBytes(32).toString('base64url');
    const key = `${this.KEY_PREFIX}${keyId}.${keySecret}`;
    
    const apiKey: APIKey = {
      id: keyId,
      key: this.hashKey(key),
      scopes,
      createdAt: new Date(),
      expiresAt: this.calculateExpiry(schedule),
      rotationSchedule: schedule,
      status: 'active'
    };
    
    await this.store.save(apiKey);
    await this.audit.log('API_KEY_CREATED', { keyId, scopes });
    
    return { ...apiKey, key }; // Return unhashed key once
  }
  
  async rotateKey(keyId: string): Promise<APIKey> {
    const oldKey = await this.store.findById(keyId);
    if (!oldKey) throw new Error('Key not found');
    
    // Mark old key as rotating
    oldKey.status = 'rotating';
    await this.store.save(oldKey);
    
    // Generate new key
    const newKey = await this.generateKey(oldKey.scopes, oldKey.rotationSchedule);
    
    // Schedule old key deprecation
    setTimeout(async () => {
      oldKey.status = 'deprecated';
      await this.store.save(oldKey);
      
      // Schedule revocation
      setTimeout(async () => {
        oldKey.status = 'revoked';
        await this.store.save(oldKey);
        await this.audit.log('API_KEY_REVOKED', { keyId: oldKey.id });
      }, this.ROTATION_OVERLAP);
    }, this.ROTATION_OVERLAP);
    
    await this.notifyRotation(oldKey, newKey);
    return newKey;
  }
  
  async validateKey(rawKey: string): Promise<APIKey | null> {
    const [prefix, keyId, keySecret] = rawKey.split('.');
    if (prefix !== this.KEY_PREFIX.slice(0, -1)) return null;
    
    const apiKey = await this.store.findById(keyId);
    if (!apiKey || apiKey.status === 'revoked') return null;
    
    const hashedKey = this.hashKey(rawKey);
    if (hashedKey !== apiKey.key) return null;
    
    // Check expiry
    if (new Date() > apiKey.expiresAt) {
      apiKey.status = 'revoked';
      await this.store.save(apiKey);
      return null;
    }
    
    // Update last used
    apiKey.lastUsedAt = new Date();
    await this.store.save(apiKey);
    
    return apiKey;
  }
}

// middleware/auth.ts
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });
  
  const keyManager = new APIKeyManager();
  const validKey = await keyManager.validateKey(apiKey);
  
  if (!validKey) {
    await audit.log('INVALID_API_KEY', { ip: req.ip });
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // Check scopes
  const requiredScope = getRequiredScope(req.path, req.method);
  if (!validKey.scopes.includes(requiredScope)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  req.apiKey = validKey;
  next();
};
```

### Rotation Automation
```yaml
# k8s/cronjob-key-rotation.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: api-key-rotation
spec:
  schedule: "0 0 * * *" # Daily at midnight
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: key-rotator
            image: mcp-server:latest
            command: ["node", "scripts/rotate-keys.js"]
            env:
            - name: ROTATION_MODE
              value: "automatic"
            - name: NOTIFICATION_WEBHOOK
              valueFrom:
                secretKeyRef:
                  name: rotation-secrets
                  key: webhook-url
```

## 2. Zero-Knowledge Proof Implementation

### ZK-SNARK Integration
```typescript
// security/zkp/circuits/auth.circom
pragma circom 2.0.0;

template PrivateKeyAuth() {
    signal input privateKey;
    signal input publicKey;
    signal input challenge;
    signal output proof;
    
    // Verify private key corresponds to public key
    component hasher = Poseidon(1);
    hasher.inputs[0] <== privateKey;
    hasher.out === publicKey;
    
    // Generate proof for challenge
    component signer = EdDSASign(1);
    signer.privateKey <== privateKey;
    signer.message <== challenge;
    
    proof <== signer.signature;
}

// security/zkp/verifier.ts
import { groth16 } from 'snarkjs';

export class ZKPVerifier {
  private verificationKey: any;
  
  constructor() {
    this.verificationKey = require('./verification_key.json');
  }
  
  async verifyAuthProof(
    proof: string,
    publicSignals: string[]
  ): Promise<boolean> {
    try {
      const proofData = JSON.parse(proof);
      const valid = await groth16.verify(
        this.verificationKey,
        publicSignals,
        proofData
      );
      
      if (valid) {
        await this.audit.log('ZKP_AUTH_SUCCESS', {
          publicKey: publicSignals[0],
          timestamp: new Date()
        });
      }
      
      return valid;
    } catch (error) {
      await this.audit.log('ZKP_AUTH_FAILURE', { error: error.message });
      return false;
    }
  }
  
  async generateChallenge(userId: string): Promise<string> {
    const challenge = randomBytes(32).toString('hex');
    await this.cache.set(`zkp_challenge:${userId}`, challenge, 300); // 5 min TTL
    return challenge;
  }
}

// Usage in authentication
app.post('/auth/zkp/challenge', async (req, res) => {
  const { userId } = req.body;
  const verifier = new ZKPVerifier();
  const challenge = await verifier.generateChallenge(userId);
  res.json({ challenge });
});

app.post('/auth/zkp/verify', async (req, res) => {
  const { userId, proof, publicKey } = req.body;
  const verifier = new ZKPVerifier();
  
  const challenge = await cache.get(`zkp_challenge:${userId}`);
  if (!challenge) return res.status(400).json({ error: 'Challenge expired' });
  
  const valid = await verifier.verifyAuthProof(proof, [publicKey, challenge]);
  if (!valid) return res.status(401).json({ error: 'Invalid proof' });
  
  const token = generateJWT({ userId, publicKey, authMethod: 'zkp' });
  res.json({ token });
});
```

## 3. Advanced Monitoring Stack

### Distributed Tracing
```typescript
// monitoring/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  serviceName: 'mcp-server',
  spanProcessor: new BatchSpanProcessor(jaegerExporter),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// Custom span creation
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('mcp-server', '1.0.0');

export function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) span.setAttributes(attributes);
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Usage
export const getCryptoPrices = (coins: string[]) => 
  traceAsync('crypto.prices.fetch', async (span) => {
    span.setAttribute('coins.count', coins.length);
    span.setAttribute('coins.list', coins.join(','));
    
    const prices = await axios.get('/api/prices');
    span.setAttribute('prices.count', Object.keys(prices).length);
    
    return prices;
  });
```

### Anomaly Detection
```typescript
// monitoring/anomaly-detection.ts
import { StatsD } from 'hot-shots';

export class AnomalyDetector {
  private statsD: StatsD;
  private baselines = new Map<string, { mean: number; stdDev: number }>();
  
  constructor() {
    this.statsD = new StatsD({
      host: process.env.STATSD_HOST,
      port: 8125,
      prefix: 'mcp.anomaly.'
    });
    
    this.loadBaselines();
    setInterval(() => this.updateBaselines(), 3600000); // Hourly
  }
  
  async detectAnomaly(metric: string, value: number): Promise<boolean> {
    const baseline = this.baselines.get(metric);
    if (!baseline) return false;
    
    const zScore = Math.abs((value - baseline.mean) / baseline.stdDev);
    const isAnomaly = zScore > 3; // 3 standard deviations
    
    if (isAnomaly) {
      this.statsD.increment(`${metric}.anomaly`);
      await this.alert({
        metric,
        value,
        baseline,
        zScore,
        severity: zScore > 5 ? 'critical' : 'warning'
      });
    }
    
    return isAnomaly;
  }
  
  private async alert(anomaly: any): Promise<void> {
    // Send to PagerDuty for critical
    if (anomaly.severity === 'critical') {
      await pagerduty.trigger({
        routingKey: process.env.PAGERDUTY_ROUTING_KEY,
        eventAction: 'trigger',
        payload: {
          summary: `Anomaly detected in ${anomaly.metric}`,
          severity: 'error',
          source: 'mcp-server',
          customDetails: anomaly
        }
      });
    }
    
    // Always send to Slack
    await slack.send({
      channel: '#alerts',
      text: `🚨 Anomaly detected in ${anomaly.metric}`,
      attachments: [{
        color: anomaly.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Metric', value: anomaly.metric },
          { title: 'Value', value: anomaly.value },
          { title: 'Expected', value: `${anomaly.baseline.mean} ± ${anomaly.baseline.stdDev}` },
          { title: 'Z-Score', value: anomaly.zScore.toFixed(2) }
        ]
      }]
    });
  }
}
```

### SIEM Integration
```typescript
// monitoring/siem.ts
import { SplunkLogger } from 'splunk-logging';

export class SIEMConnector {
  private splunk: SplunkLogger;
  
  constructor() {
    this.splunk = new SplunkLogger({
      token: process.env.SPLUNK_HEC_TOKEN,
      url: process.env.SPLUNK_HEC_URL,
      source: 'mcp-server',
      sourcetype: 'json'
    });
  }
  
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const enrichedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      service: 'mcp-server',
      correlationId: context.get('correlationId'),
      // Enrichment
      geoIp: await this.getGeoIP(event.ip),
      userAgent: this.parseUserAgent(event.userAgent),
      riskScore: this.calculateRiskScore(event)
    };
    
    await this.splunk.send({
      message: enrichedEvent,
      metadata: {
        source: 'mcp-server',
        sourcetype: 'security',
        index: 'security'
      }
    });
    
    // Real-time analysis
    if (enrichedEvent.riskScore > 80) {
      await this.triggerIncidentResponse(enrichedEvent);
    }
  }
  
  private calculateRiskScore(event: SecurityEvent): number {
    let score = 0;
    
    // Failed auth attempts
    if (event.type === 'AUTH_FAILURE') score += 20;
    if (event.failedAttempts > 5) score += 40;
    
    // Suspicious patterns
    if (event.ip && this.isTorExitNode(event.ip)) score += 30;
    if (event.pattern === 'RAPID_REQUESTS') score += 25;
    if (event.pattern === 'SCANNING') score += 35;
    
    // Anomalous behavior
    if (event.anomalyScore > 0.8) score += 50;
    
    return Math.min(score, 100);
  }
}
```

### Security Configuration
```yaml
# k8s/security-policies.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: mcp-server-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'secret'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mcp-server-netpol
spec:
  podSelector:
    matchLabels:
      app: mcp-server
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: database
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - namespaceSelector:
            matchLabels:
              name: redis
      ports:
        - protocol: TCP
          port: 6379
    # External APIs
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443
``` 