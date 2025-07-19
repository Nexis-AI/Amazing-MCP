import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from 'winston';
import { WSMessage } from '../types/mcp.types';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
}

/**
 * Setup WebSocket server for real-time communication
 */
export function setupWebSocket(wss: WebSocketServer, logger: Logger): void {
  // Keep track of connected clients
  const clients = new Set<ExtendedWebSocket>();

  // Ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        logger.debug('Terminating inactive WebSocket connection');
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, parseInt(process.env.WS_PING_INTERVAL || '30000'));

  wss.on('connection', (ws: WebSocket, req) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;
    
    // Extract user ID from query params if available
    const url = new URL(req.url || '', `http://localhost`);
    const userId = url.searchParams.get('userId') || 'anonymous';
    extWs.userId = userId;
    
    clients.add(extWs);
    logger.info(`WebSocket client connected: ${userId} (Total: ${clients.size})`);
    
    // Send welcome message
    const welcomeMsg: WSMessage = {
      type: 'ping',
      data: { message: 'Connected to Amazing-MCP Server' },
      timestamp: new Date().toISOString()
    };
    extWs.send(JSON.stringify(welcomeMsg));
    
    // Handle pong responses
    extWs.on('pong', () => {
      extWs.isAlive = true;
    });
    
    // Handle incoming messages
    extWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug('WebSocket message received:', message);
        
        // Handle different message types
        switch (message.type) {
          case 'ping':
            extWs.send(JSON.stringify({
              type: 'pong',
              data: { timestamp: Date.now() },
              timestamp: new Date().toISOString()
            } as WSMessage));
            break;
            
          case 'subscribe':
            // Handle subscription logic here
            logger.info(`Client ${userId} subscribed to: ${message.channel}`);
            break;
            
          case 'unsubscribe':
            // Handle unsubscription logic here
            logger.info(`Client ${userId} unsubscribed from: ${message.channel}`);
            break;
            
          default:
            logger.warn(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Handle client disconnect
    extWs.on('close', () => {
      clients.delete(extWs);
      logger.info(`WebSocket client disconnected: ${userId} (Total: ${clients.size})`);
    });
    
    // Handle errors
    extWs.on('error', (error) => {
      logger.error(`WebSocket error for client ${userId}:`, error);
    });
  });
  
  // Cleanup on server close
  wss.on('close', () => {
    clearInterval(pingInterval);
    logger.info('WebSocket server closed');
  });
  
  // Price update broadcaster (example)
  if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
      // This would be replaced with actual price fetching logic
      const priceUpdate: WSMessage = {
        type: 'price_update',
        data: {
          bitcoin: { usd: Math.random() * 50000 + 30000, change24h: Math.random() * 10 - 5 },
          ethereum: { usd: Math.random() * 3000 + 2000, change24h: Math.random() * 10 - 5 }
        },
        timestamp: new Date().toISOString()
      };
      
      broadcast(wss, priceUpdate);
    }, 10000); // Every 10 seconds
  }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcast(wss: WebSocketServer, message: WSMessage): void {
  const messageStr = JSON.stringify(message);
  
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

/**
 * Send message to specific user
 */
export function sendToUser(wss: WebSocketServer, userId: string, message: WSMessage): void {
  const messageStr = JSON.stringify(message);
  
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtendedWebSocket;
    if (extWs.readyState === WebSocket.OPEN && extWs.userId === userId) {
      extWs.send(messageStr);
    }
  });
} 