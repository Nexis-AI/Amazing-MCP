import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { cryptoPriceService } from '../services/crypto-price.service';
import { log } from '../utils/logger';
import { AppError } from '../middleware/error-handler';

// Validation schemas
const GetPriceSchema = z.object({
  coinId: z.string().min(1),
});

const GetMultiplePricesSchema = z.object({
  coinIds: z.array(z.string()).min(1).max(100),
});

const GetHistoricalSchema = z.object({
  coinId: z.string().min(1),
  days: z.coerce.number().int().min(1).max(365),
  interval: z.enum(['daily', 'hourly']).optional(),
});

const SearchSchema = z.object({
  query: z.string().min(1).max(100),
});

const WatchlistSchema = z.object({
  coinId: z.string().min(1),
});

export class CryptoController {
  /**
   * Get price for a single cryptocurrency
   */
  async getPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coinId } = req.params;
      
      // Validate request
      const validated = GetPriceSchema.parse({ coinId });
      
      const price = await cryptoPriceService.getPrice(validated.coinId);
      
      if (!price) {
        throw new AppError(`Cryptocurrency not found: ${validated.coinId}`, 404);
      }
      
      res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get prices for multiple cryptocurrencies
   */
  async getMultiplePrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coinIds } = req.body;
      
      // Validate request
      const validated = GetMultiplePricesSchema.parse({ coinIds });
      
      const prices = await cryptoPriceService.getMultiplePrices(validated.coinIds);
      
      res.json({
        success: true,
        count: prices.length,
        data: prices,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coinId } = req.params;
      const { days, interval } = req.query;
      
      // Validate request
      const validated = GetHistoricalSchema.parse({
        coinId,
        days: days || 7,
        interval: interval as string,
      });
      
      const historicalData = await cryptoPriceService.getHistoricalPrices(
        validated.coinId,
        validated.days,
        validated.interval || 'daily'
      );
      
      res.json({
        success: true,
        coinId: validated.coinId,
        days: validated.days,
        interval: validated.interval || 'daily',
        data: historicalData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trending cryptocurrencies
   */
  async getTrending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trending = await cryptoPriceService.getTrending();
      
      res.json({
        success: true,
        data: trending,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get global market data
   */
  async getGlobalData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const globalData = await cryptoPriceService.getGlobalData();
      
      res.json({
        success: true,
        data: globalData.data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search for cryptocurrencies
   */
  async searchCoins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query } = req.query;
      
      // Validate request
      const validated = SearchSchema.parse({ query });
      
      const results = await cryptoPriceService.searchCoins(validated.query);
      
      res.json({
        success: true,
        query: validated.query,
        count: results.coins.length,
        data: results.coins,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get watchlist
   */
  async getWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const watchlist = cryptoPriceService.getWatchlist();
      
      // Get current prices for watchlist
      const prices = await cryptoPriceService.getMultiplePrices(watchlist);
      
      res.json({
        success: true,
        count: watchlist.length,
        watchlist,
        prices,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coinId } = req.body;
      
      // Validate request
      const validated = WatchlistSchema.parse({ coinId });
      
      // Verify coin exists
      const price = await cryptoPriceService.getPrice(validated.coinId);
      if (!price) {
        throw new AppError(`Cryptocurrency not found: ${validated.coinId}`, 404);
      }
      
      cryptoPriceService.addToWatchlist(validated.coinId);
      
      res.json({
        success: true,
        message: `Added ${validated.coinId} to watchlist`,
        watchlist: cryptoPriceService.getWatchlist(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coinId } = req.params;
      
      // Validate request
      const validated = WatchlistSchema.parse({ coinId });
      
      cryptoPriceService.removeFromWatchlist(validated.coinId);
      
      res.json({
        success: true,
        message: `Removed ${validated.coinId} from watchlist`,
        watchlist: cryptoPriceService.getWatchlist(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get supported currencies
   */
  async getSupportedCurrencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currencies = await cryptoPriceService.getSupportedCurrencies();
      
      res.json({
        success: true,
        count: currencies.length,
        currencies,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Start/stop real-time updates
   */
  async controlRealTimeUpdates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action } = req.params;
      
      if (action === 'start') {
        const { interval } = req.body;
        cryptoPriceService.startPriceUpdates(interval || 30000);
        res.json({
          success: true,
          message: 'Real-time price updates started',
        });
      } else if (action === 'stop') {
        cryptoPriceService.stopPriceUpdates();
        res.json({
          success: true,
          message: 'Real-time price updates stopped',
        });
      } else {
        throw new AppError('Invalid action. Use "start" or "stop"', 400);
      }
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const cryptoController = new CryptoController();