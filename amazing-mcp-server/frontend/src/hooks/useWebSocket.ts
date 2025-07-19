import { useContext } from 'react';
import { WebSocketContext } from '../contexts/websocket-types';

export const useWebSocket = () => useContext(WebSocketContext); 