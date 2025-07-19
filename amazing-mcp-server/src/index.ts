import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import winston from 'winston';
import { MCPController } from './controllers/mcp.controller';
import { MCPError } from './types/mcp.types';
import { setupWebSocket } from './utils/websocket';

// Load environment variables
config();

// Logger setup
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Create Express app
const app: Express = express();
const server = createServer(app);

// Middleware setup
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Routes
app.get('/health', MCPController.healthCheck);

// MCP routes
app.get('/api/mcp', MCPController.getMCP);
app.post('/api/mcp/emotion/update', MCPController.updateEmotion);
app.post('/api/mcp/memory/add', MCPController.addMemory);
app.get('/api/mcp/memory/search', MCPController.searchMemories);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof MCPError) {
    logger.error('MCP Error:', err);
    res.status(err.code).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      timestamp: new Date().toISOString()
    });
  } else if (err.name === 'ZodError') {
    logger.error('Validation Error:', err);
    res.status(400).json({
      success: false,
      error: {
        code: 400,
        message: 'Validation error',
        details: err.errors
      },
      timestamp: new Date().toISOString()
    });
  } else {
    logger.error('Unexpected Error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 500,
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 404,
      message: 'Endpoint not found'
    },
    timestamp: new Date().toISOString()
  });
});

// Setup WebSocket server
const wss = new WebSocketServer({ server });
setupWebSocket(wss, logger);

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`🚀 Amazing-MCP Server started on port ${PORT}`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server }; 