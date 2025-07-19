import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv-safe';
import { createServer } from 'http';
import { log } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import mcpRoutes from './routes/mcp.routes';
import web3Routes from './routes/web3.routes';
import cryptoRoutes from './routes/crypto.routes';
import { initializeWebSocketServer } from './utils/websocket';

// Load environment variables
dotenv.config({
  example: '.env.example',
});

// Create Express app
const app = express();
const httpServer = createServer(app);

// Parse environment variables
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

// Configure rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure CORS
const corsOptions: cors.CorsOptions = {
  origin: NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : true,
  credentials: true,
  optionsSuccessStatus: 200,
};

// Apply middleware
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use('/api', limiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

// API routes
app.use('/api/mcp', mcpRoutes);
app.use('/api/web3', web3Routes);
app.use('/api/crypto', cryptoRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Resource not found',
    timestamp: new Date(),
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize WebSocket server
initializeWebSocketServer(httpServer);

// Start server only if not in test mode
if (NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    log.info(`MCP Server started on port ${PORT} in ${NODE_ENV} mode`);
    log.info(`Health check available at http://localhost:${PORT}/health`);
    
    // Log enabled features
    const enabledFeatures = [];
    if (process.env.ENABLE_MEMORY_SYSTEM === 'true') enabledFeatures.push('Memory System');
    if (process.env.ENABLE_EMOTION_SYSTEM === 'true') enabledFeatures.push('Emotion System');
    if (process.env.ENABLE_REAL_TIME_PRICES === 'true') enabledFeatures.push('Real-time Prices');
    if (process.env.ENABLE_DEFI_INTEGRATIONS === 'true') enabledFeatures.push('DeFi Integrations');
    if (process.env.ENABLE_NFT_SUPPORT === 'true') enabledFeatures.push('NFT Support');
    if (process.env.ENABLE_CROSS_CHAIN === 'true') enabledFeatures.push('Cross-chain');
    
    log.info(`Enabled features: ${enabledFeatures.join(', ')}`);
  });
}

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  log.info('Received shutdown signal, closing server gracefully...');
  
  httpServer.close(() => {
    log.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    log.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

export default app;