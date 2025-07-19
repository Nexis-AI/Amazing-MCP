import { createContext } from 'react';

export interface PriceData {
  [key: string]: { usd: number; change24h: number };
}

export interface WSMessage {
  type: 'price_update' | 'news_update' | 'emotion_change' | 'alert' | 'ping' | 'pong';
  data: PriceData | Record<string, unknown>;
  timestamp: string;
}

export interface WebSocketContextType {
  ws: WebSocket | null;
  isConnected: boolean;
  lastMessage: WSMessage | null;
  sendMessage: (message: Record<string, unknown>) => void;
}

export const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  isConnected: false,
  lastMessage: null,
  sendMessage: () => {},
}); 