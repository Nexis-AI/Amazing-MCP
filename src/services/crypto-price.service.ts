import axios from 'axios';
import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import { cacheService } from './cache.service';
import { broadcastPrices } from '../utils/websocket';

interface ICryptoCurrency {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation?: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply?: number;
  max_supply?: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

interface IPriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  changePercentage24h: number;
  timestamp: Date;
}

class CryptoPriceService extends EventEmitter {
  private readonly COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
  private readonly API_KEY = process.env.COINGECKO_API_KEY || '';
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private watchList: string[] = [
    'bitcoin',
    'ethereum',
    'binancecoin',
    'solana',
    'cardano',
    'ripple',
    'avalanche-2',
    'polkadot',
    'chainlink',
    'polygon',
    'uniswap',
    'aave',
    'maker',
    'compound',
    'curve-dao-token',
  ];
  private isRunning = false;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private initialize(): void {
    if (!this.API_KEY) {
      log.warn('CoinGecko API key not found, using demo mode');
    }
    
    if (process.env.ENABLE_REAL_TIME_PRICES === 'true') {
      this.startPriceUpdates();
    }
  }

  /**
   * Start real-time price updates
   */
  startPriceUpdates(intervalMs = 30000): void { // 30 seconds default
    if (this.isRunning) {
      log.warn('Price updates already running');
      return;
    }

    this.isRunning = true;
    log.info(`Starting crypto price updates every ${intervalMs / 1000} seconds`);

    // Initial fetch
    this.fetchPrices();

    // Set up interval
    this.priceUpdateInterval = setInterval(() => {
      this.fetchPrices();
    }, intervalMs);
  }

  /**
   * Stop real-time price updates
   */
  stopPriceUpdates(): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
      this.isRunning = false;
      log.info('Stopped crypto price updates');
    }
  }

  /**
   * Fetch prices for watchlist
   */
  private async fetchPrices(): Promise<void> {
    try {
      const prices = await this.getMultiplePrices(this.watchList);
      
      // Emit price updates
      for (const crypto of prices) {
        const update: IPriceUpdate = {
          symbol: crypto.symbol,
          price: crypto.current_price,
          change24h: crypto.price_change_24h,
          changePercentage24h: crypto.price_change_percentage_24h,
          timestamp: new Date(),
        };
        
        this.emit('priceUpdate', update);
      }

      // Broadcast via WebSocket
      const priceMap = prices.reduce((acc, crypto) => {
        acc[crypto.symbol] = crypto.current_price;
        return acc;
      }, {} as Record<string, number>);
      
      broadcastPrices(priceMap);
      
      log.debug(`Fetched prices for ${prices.length} cryptocurrencies`);
    } catch (error) {
      log.error('Failed to fetch crypto prices:', error);
    }
  }

  /**
   * Get current price for a single cryptocurrency
   */
  async getPrice(coinId: string): Promise<ICryptoCurrency | null> {
    const cacheKey = `crypto-price:${coinId}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/coins/markets`,
          {
            params: {
              vs_currency: 'usd',
              ids: coinId,
              order: 'market_cap_desc',
              per_page: 1,
              page: 1,
              sparkline: false,
            },
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        if (response.data && response.data.length > 0) {
          return response.data[0] as ICryptoCurrency;
        }

        return null;
      } catch (error) {
        log.error(`Failed to get price for ${coinId}:`, error);
        throw error;
      }
    }, 60); // Cache for 1 minute
  }

  /**
   * Get prices for multiple cryptocurrencies
   */
  async getMultiplePrices(coinIds: string[]): Promise<ICryptoCurrency[]> {
    const cacheKey = `crypto-prices:${coinIds.join(',')}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/coins/markets`,
          {
            params: {
              vs_currency: 'usd',
              ids: coinIds.join(','),
              order: 'market_cap_desc',
              per_page: coinIds.length,
              page: 1,
              sparkline: false,
            },
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        return response.data as ICryptoCurrency[];
      } catch (error) {
        log.error('Failed to get multiple prices:', error);
        throw error;
      }
    }, 60); // Cache for 1 minute
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(
    coinId: string,
    days: number,
    interval: 'daily' | 'hourly' = 'daily'
  ): Promise<{
    prices: Array<[number, number]>;
    market_caps: Array<[number, number]>;
    total_volumes: Array<[number, number]>;
  }> {
    const cacheKey = `crypto-history:${coinId}:${days}:${interval}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/coins/${coinId}/market_chart`,
          {
            params: {
              vs_currency: 'usd',
              days,
              interval,
            },
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        return response.data;
      } catch (error) {
        log.error(`Failed to get historical prices for ${coinId}:`, error);
        throw error;
      }
    }, 3600); // Cache for 1 hour
  }

  /**
   * Get trending cryptocurrencies
   */
  async getTrending(): Promise<{
    coins: Array<{
      item: {
        id: string;
        coin_id: number;
        name: string;
        symbol: string;
        market_cap_rank: number;
        thumb: string;
        score: number;
      };
    }>;
  }> {
    const cacheKey = 'crypto-trending';
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/search/trending`,
          {
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        return response.data;
      } catch (error) {
        log.error('Failed to get trending cryptocurrencies:', error);
        throw error;
      }
    }, 300); // Cache for 5 minutes
  }

  /**
   * Get global crypto market data
   */
  async getGlobalData(): Promise<{
    data: {
      active_cryptocurrencies: number;
      upcoming_icos: number;
      ongoing_icos: number;
      ended_icos: number;
      markets: number;
      total_market_cap: Record<string, number>;
      total_volume: Record<string, number>;
      market_cap_percentage: Record<string, number>;
      market_cap_change_percentage_24h_usd: number;
      updated_at: number;
    };
  }> {
    const cacheKey = 'crypto-global';
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/global`,
          {
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        return response.data;
      } catch (error) {
        log.error('Failed to get global crypto data:', error);
        throw error;
      }
    }, 300); // Cache for 5 minutes
  }

  /**
   * Search for cryptocurrencies
   */
  async searchCoins(query: string): Promise<{
    coins: Array<{
      id: string;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
    }>;
  }> {
    const cacheKey = `crypto-search:${query}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/search`,
          {
            params: { query },
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        return response.data;
      } catch (error) {
        log.error(`Failed to search for ${query}:`, error);
        throw error;
      }
    }, 600); // Cache for 10 minutes
  }

  /**
   * Add coin to watchlist
   */
  addToWatchlist(coinId: string): void {
    if (!this.watchList.includes(coinId)) {
      this.watchList.push(coinId);
      log.info(`Added ${coinId} to watchlist`);
    }
  }

  /**
   * Remove coin from watchlist
   */
  removeFromWatchlist(coinId: string): void {
    const index = this.watchList.indexOf(coinId);
    if (index > -1) {
      this.watchList.splice(index, 1);
      log.info(`Removed ${coinId} from watchlist`);
    }
  }

  /**
   * Get current watchlist
   */
  getWatchlist(): string[] {
    return [...this.watchList];
  }

  /**
   * Get supported vs currencies
   */
  async getSupportedCurrencies(): Promise<string[]> {
    const cacheKey = 'crypto-currencies';
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const response = await axios.get(
          `${this.COINGECKO_API_URL}/simple/supported_vs_currencies`,
          {
            headers: this.API_KEY ? {
              'x-cg-demo-api-key': this.API_KEY,
            } : {},
          }
        );

        return response.data;
      } catch (error) {
        log.error('Failed to get supported currencies:', error);
        throw error;
      }
    }, 86400); // Cache for 24 hours
  }
}

// Export singleton instance
export const cryptoPriceService = new CryptoPriceService();