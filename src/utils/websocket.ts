import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { log } from './logger';
import { IWebSocketMessage } from '../types/mcp.types';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export const initializeWebSocketServer = (server: Server): void => {
  const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);
  const HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10);

  // Create WebSocket server
  wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  log.info(`WebSocket server initialized on path /ws`);

  // Handle new connections
  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    log.info(`New WebSocket connection from ${clientIp}`);
    
    clients.add(ws);
    
    // Send welcome message
    const welcomeMessage: IWebSocketMessage = {
      type: 'custom',
      data: { message: 'Connected to MCP WebSocket server' },
      timestamp: new Date(),
    };
    ws.send(JSON.stringify(welcomeMessage));

    // Setup heartbeat
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });

    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        log.warn(`WebSocket client ${clientIp} failed heartbeat check`);
        ws.terminate();
        clients.delete(ws);
        clearInterval(heartbeatInterval);
        return;
      }
      
      isAlive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL);

    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        log.debug(`Received WebSocket message: ${JSON.stringify(message)}`);
        
        // Handle different message types
        switch (message.type) {
          case 'subscribe':
            handleSubscription(ws, message.channels);
            break;
          case 'unsubscribe':
            handleUnsubscription(ws, message.channels);
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
            break;
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Unknown message type',
              timestamp: new Date(),
            }));
        }
      } catch (error) {
        log.error('Failed to parse WebSocket message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format',
          timestamp: new Date(),
        }));
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      log.info(`WebSocket client ${clientIp} disconnected`);
      clients.delete(ws);
      clearInterval(heartbeatInterval);
    });

    // Handle errors
    ws.on('error', (error) => {
      log.error(`WebSocket error for client ${clientIp}:`, error);
      clients.delete(ws);
      clearInterval(heartbeatInterval);
    });
  });

  // Handle server errors
  wss.on('error', (error) => {
    log.error('WebSocket server error:', error);
  });
};

// Subscription management
const subscriptions = new Map<WebSocket, Set<string>>();

const handleSubscription = (ws: WebSocket, channels: string[]): void => {
  if (!subscriptions.has(ws)) {
    subscriptions.set(ws, new Set());
  }
  
  const clientSubs = subscriptions.get(ws)!;
  channels.forEach(channel => clientSubs.add(channel));
  
  ws.send(JSON.stringify({
    type: 'subscribed',
    channels,
    timestamp: new Date(),
  }));
};

const handleUnsubscription = (ws: WebSocket, channels: string[]): void => {
  const clientSubs = subscriptions.get(ws);
  if (clientSubs) {
    channels.forEach(channel => clientSubs.delete(channel));
  }
  
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    channels,
    timestamp: new Date(),
  }));
};

// Broadcast functions
export const broadcast = (type: string, data: unknown): void => {
  const message: IWebSocketMessage = {
    type: type as any,
    data,
    timestamp: new Date(),
  };
  
  const messageStr = JSON.stringify(message);
  let sent = 0;
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Check if client is subscribed to this type
      const clientSubs = subscriptions.get(client);
      if (!clientSubs || clientSubs.has(type) || clientSubs.has('all')) {
        try {
          client.send(messageStr);
          sent++;
        } catch (error) {
          log.error('Error sending message to client:', error);
        }
      }
    }
  });
  
  if (sent > 0) {
    log.debug(`Broadcast ${type} to ${sent} clients`);
  }
};

export const broadcastPrices = (prices: Record<string, number>): void => {
  broadcast('prices', prices);
};

export const broadcastNews = (articles: unknown[]): void => {
  broadcast('news', { articles });
};

export const broadcastBlocks = (blocks: unknown[]): void => {
  broadcast('blocks', { blocks });
};

export const broadcastEmotions = (emotion: unknown): void => {
  broadcast('emotions', emotion);
};

// Get connected clients count
export const getConnectedClients = (): number => {
  return clients.size;
};

// Cleanup function
export const closeWebSocketServer = (): Promise<void> => {
  return new Promise((resolve) => {
    if (wss) {
      wss.close(() => {
        log.info('WebSocket server closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
};