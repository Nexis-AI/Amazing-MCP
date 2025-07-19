import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface PriceData {
  [key: string]: {
    usd: number;
    change24h: number;
  };
}

export const PriceTicker: React.FC = () => {
  const { lastMessage } = useWebSocket();
  const [prices, setPrices] = useState<PriceData>({});
  
  useEffect(() => {
    if (lastMessage?.type === 'price_update' && lastMessage.data) {
      setPrices(lastMessage.data as PriceData);
    }
  }, [lastMessage]);
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 4 : 2
    }).format(price);
  };
  
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };
  
  return (
    <div className="flex items-center gap-6">
      {Object.entries(prices).map(([symbol, data]) => (
        <div key={symbol} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content-secondary uppercase">{symbol}</span>
            <span className="text-lg font-semibold text-content-primary">
              {formatPrice(data.usd)}
            </span>
          </div>
          <span className={`text-sm font-medium ${
            data.change24h >= 0 ? 'text-accent-green' : 'text-accent-red'
          }`}>
            {formatChange(data.change24h)}
          </span>
        </div>
      ))}
      
      {Object.keys(prices).length === 0 && (
        <div className="text-sm text-content-disabled">
          Waiting for price data...
        </div>
      )}
    </div>
  );
}; 