import React, { useEffect, useState, useRef } from 'react';
import { WebSocketContext } from './websocket-types';
import type { WSMessage } from './websocket-types';

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = () => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Send initial ping
      ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;
        setLastMessage(message);
        
        // Handle pong messages
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 5000);
    };
    
    wsRef.current = ws;
  };

  const sendMessage = (message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ ws: wsRef.current, isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}; 