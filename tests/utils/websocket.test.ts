import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { 
  initializeWebSocketServer,
  broadcast,
  broadcastPrices,
  broadcastNews,
  broadcastBlocks,
  broadcastEmotions,
  getConnectedClients,
  closeWebSocketServer
} from '../../src/utils/websocket';
import { log } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('ws');

describe('WebSocket Utils', () => {
  let mockServer: jest.Mocked<Server>;
  let mockWss: jest.Mocked<WebSocketServer>;
  let mockWs: jest.Mocked<WebSocket>;
  let connectionCallback: Function;
  let messageCallback: Function;
  let closeCallback: Function;
  let errorCallback: Function;
  let pongCallback: Function;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock HTTP server
    mockServer = {} as jest.Mocked<Server>;
    
    // Mock WebSocket
    mockWs = {
      send: jest.fn(),
      ping: jest.fn(),
      terminate: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'message') messageCallback = callback;
        if (event === 'close') closeCallback = callback;
        if (event === 'error') errorCallback = callback;
        if (event === 'pong') pongCallback = callback;
      }),
      readyState: WebSocket.OPEN,
    } as any;
    
    // Mock WebSocketServer
    mockWss = {
      on: jest.fn((event, callback) => {
        if (event === 'connection') connectionCallback = callback;
      }),
      close: jest.fn((callback) => callback()),
    } as any;
    
    // Mock WebSocketServer constructor
    (WebSocketServer as unknown as jest.Mock).mockImplementation(() => mockWss);
  });

  describe('initializeWebSocketServer', () => {
    it('should initialize WebSocket server with default configuration', () => {
      initializeWebSocketServer(mockServer);
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: mockServer,
        path: '/ws',
      });
      expect(log.info).toHaveBeenCalledWith('WebSocket server initialized on path /ws');
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWss.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle new connections', () => {
      initializeWebSocketServer(mockServer);
      
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      expect(log.info).toHaveBeenCalledWith('New WebSocket connection from 127.0.0.1');
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"custom"')
      );
    });

    it('should setup heartbeat mechanism', () => {
      jest.useFakeTimers();
      process.env.WS_HEARTBEAT_INTERVAL = '1000';
      
      initializeWebSocketServer(mockServer);
      
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      // Advance timer
      jest.advanceTimersByTime(1000);
      
      expect(mockWs.ping).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('should terminate client on failed heartbeat', () => {
      jest.useFakeTimers();
      process.env.WS_HEARTBEAT_INTERVAL = '1000';
      
      initializeWebSocketServer(mockServer);
      
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      // First heartbeat - client is alive
      jest.advanceTimersByTime(1000);
      expect(mockWs.ping).toHaveBeenCalled();
      
      // Second heartbeat - client didn't respond with pong
      jest.advanceTimersByTime(1000);
      expect(mockWs.terminate).toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith(
        'WebSocket client 127.0.0.1 failed heartbeat check'
      );
      
      jest.useRealTimers();
    });

    it('should handle pong messages', () => {
      jest.useFakeTimers();
      process.env.WS_HEARTBEAT_INTERVAL = '1000';
      
      initializeWebSocketServer(mockServer);
      
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      // First heartbeat
      jest.advanceTimersByTime(1000);
      
      // Client responds with pong
      pongCallback();
      
      // Second heartbeat - client should not be terminated
      jest.advanceTimersByTime(1000);
      expect(mockWs.terminate).not.toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      initializeWebSocketServer(mockServer);
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
    });

    it('should handle subscribe messages', () => {
      const message = {
        type: 'subscribe',
        channels: ['prices', 'news'],
      };
      
      messageCallback(JSON.stringify(message));
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscribed"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"channels":["prices","news"]')
      );
    });

    it('should handle unsubscribe messages', () => {
      // First subscribe
      const subscribeMessage = {
        type: 'subscribe',
        channels: ['prices'],
      };
      messageCallback(JSON.stringify(subscribeMessage));
      
      // Then unsubscribe
      const unsubscribeMessage = {
        type: 'unsubscribe',
        channels: ['prices'],
      };
      messageCallback(JSON.stringify(unsubscribeMessage));
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"unsubscribed"')
      );
    });

    it('should handle ping messages', () => {
      const message = { type: 'ping' };
      
      messageCallback(JSON.stringify(message));
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should handle unknown message types', () => {
      const message = { type: 'unknown' };
      
      messageCallback(JSON.stringify(message));
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Unknown message type')
      );
    });

    it('should handle invalid JSON messages', () => {
      messageCallback('invalid json');
      
      expect(log.error).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error)
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format')
      );
    });
  });

  describe('client lifecycle', () => {
    it('should handle client disconnect', () => {
      jest.useFakeTimers();
      
      initializeWebSocketServer(mockServer);
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      // Verify client was added
      expect(getConnectedClients()).toBe(1);
      
      // Disconnect client
      closeCallback();
      
      expect(log.info).toHaveBeenCalledWith(
        'WebSocket client 127.0.0.1 disconnected'
      );
      expect(getConnectedClients()).toBe(0);
      
      jest.useRealTimers();
    });

    it('should handle client errors', () => {
      jest.useFakeTimers();
      
      initializeWebSocketServer(mockServer);
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      const error = new Error('Client error');
      errorCallback(error);
      
      expect(log.error).toHaveBeenCalledWith(
        'WebSocket error for client 127.0.0.1:',
        error
      );
      expect(getConnectedClients()).toBe(0);
      
      jest.useRealTimers();
    });

    it('should handle server errors', () => {
      initializeWebSocketServer(mockServer);
      
      // Trigger server error
      const serverErrorCallback = mockWss.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      const error = new Error('Server error');
      if (serverErrorCallback) {
        serverErrorCallback(error);
      }
      
      expect(log.error).toHaveBeenCalledWith('WebSocket server error:', error);
    });
  });

  describe('broadcast functions', () => {
    beforeEach(() => {
      initializeWebSocketServer(mockServer);
    });

    it('should broadcast to all connected clients', () => {
      // Connect two clients
      const mockReq1 = { socket: { remoteAddress: '127.0.0.1' } };
      const mockReq2 = { socket: { remoteAddress: '127.0.0.2' } };
      
      const mockWs2 = { ...mockWs, send: jest.fn() };
      
      connectionCallback(mockWs, mockReq1);
      connectionCallback(mockWs2, mockReq2);
      
      broadcast('test', { data: 'test data' });
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test"')
      );
      expect(mockWs2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test"')
      );
    });

    it('should respect subscriptions when broadcasting', () => {
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      // Subscribe to prices only
      messageCallback(JSON.stringify({
        type: 'subscribe',
        channels: ['prices'],
      }));
      
      // Reset mock to clear previous calls
      mockWs.send.mockClear();
      
      // Broadcast prices - should receive
      broadcast('prices', { btc: 45000 });
      expect(mockWs.send).toHaveBeenCalled();
      
      // Broadcast news - should not receive
      mockWs.send.mockClear();
      broadcast('news', { articles: [] });
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle clients subscribed to "all"', () => {
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      // Subscribe to all channels
      messageCallback(JSON.stringify({
        type: 'subscribe',
        channels: ['all'],
      }));
      
      mockWs.send.mockClear();
      
      // Should receive all broadcasts
      broadcast('anything', { data: 'test' });
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should not send to clients with closed connections', () => {
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      (mockWs as any).readyState = WebSocket.CLOSED;
      
      connectionCallback(mockWs, mockReq);
      
      broadcast('test', { data: 'test' });
      
      // Should not attempt to send to closed connection
      expect(mockWs.send).toHaveBeenCalledTimes(1); // Only welcome message
    });

    it('should handle send errors gracefully', () => {
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      mockWs.send.mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      connectionCallback(mockWs, mockReq);
      
      // Should not throw
      expect(() => broadcast('test', { data: 'test' })).not.toThrow();
      expect(log.error).toHaveBeenCalledWith(
        'Error sending message to client:',
        expect.any(Error)
      );
    });
  });

  describe('specific broadcast functions', () => {
    beforeEach(() => {
      initializeWebSocketServer(mockServer);
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      mockWs.send.mockClear();
    });

    it('should broadcast prices', () => {
      const prices = { bitcoin: 45000, ethereum: 2500 };
      broadcastPrices(prices);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"prices"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"bitcoin":45000')
      );
    });

    it('should broadcast news', () => {
      const articles = [{ title: 'Test News' }];
      broadcastNews(articles);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"news"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"articles":[{"title":"Test News"}]')
      );
    });

    it('should broadcast blocks', () => {
      const blocks = [{ number: 123456 }];
      broadcastBlocks(blocks);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"blocks"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"blocks":[{"number":123456}]')
      );
    });

    it('should broadcast emotions', () => {
      const emotion = { current: 'happy', points: 50 };
      broadcastEmotions(emotion);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"emotions"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"current":"happy"')
      );
    });
  });

  describe('utility functions', () => {
    it('should track connected clients count', () => {
      initializeWebSocketServer(mockServer);
      
      expect(getConnectedClients()).toBe(0);
      
      // Connect client
      const mockReq = { socket: { remoteAddress: '127.0.0.1' } };
      connectionCallback(mockWs, mockReq);
      
      expect(getConnectedClients()).toBe(1);
      
      // Connect another client
      const mockWs2 = { ...mockWs };
      connectionCallback(mockWs2, mockReq);
      
      expect(getConnectedClients()).toBe(2);
      
      // Disconnect one
      closeCallback();
      
      expect(getConnectedClients()).toBe(1);
    });

    it('should close WebSocket server', async () => {
      initializeWebSocketServer(mockServer);
      
      await closeWebSocketServer();
      
      expect(mockWss.close).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith('WebSocket server closed');
    });

    it('should handle closing when server not initialized', async () => {
      // Don't initialize server
      await expect(closeWebSocketServer()).resolves.toBeUndefined();
    });
  });
});