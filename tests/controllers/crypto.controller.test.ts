import request from 'supertest';
import { cryptoController } from '../../src/controllers/crypto.controller';
import { cryptoPriceService } from '../../src/services/crypto-price.service';
import { AppError } from '../../src/middleware/error-handler';

// Import app after mocking to ensure mocks are in place
let app: any;

// Mock dependencies
jest.mock('../../src/services/crypto-price.service');
jest.mock('../../src/utils/logger');

describe('Crypto Controller', () => {
  beforeAll(() => {
    // Import app after environment is setup
    app = require('../../src/index').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Set API key for auth middleware if needed
    process.env.API_KEY = 'test_api_key';
  });

  describe('GET /api/crypto/price/:coinId', () => {
    it('should return price for valid coin', async () => {
      const mockPrice = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 45000,
        price_change_24h: 1000,
        price_change_percentage_24h: 2.27,
        market_cap: 850000000000,
        total_volume: 25000000000,
        last_updated: '2024-01-01T00:00:00Z',
      };

      (cryptoPriceService.getPrice as jest.Mock).mockResolvedValue(mockPrice);

      const response = await request(app)
        .get('/api/crypto/price/bitcoin')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPrice,
      });
      expect(cryptoPriceService.getPrice).toHaveBeenCalledWith('bitcoin');
    });

    it('should return 404 for non-existent coin', async () => {
      (cryptoPriceService.getPrice as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/crypto/price/nonexistent')
        .expect(404);

      expect(response.body.message).toContain('Cryptocurrency not found');
    });

    it('should validate coin ID', async () => {
      const response = await request(app)
        .get('/api/crypto/price/')
        .expect(404); // Route not found because coinId is empty
    });
  });

  describe('POST /api/crypto/prices', () => {
    it('should return prices for multiple coins', async () => {
      const mockPrices = [
        {
          id: 'bitcoin',
          symbol: 'btc',
          current_price: 45000,
        },
        {
          id: 'ethereum',
          symbol: 'eth',
          current_price: 2500,
        },
      ];

      (cryptoPriceService.getMultiplePrices as jest.Mock).mockResolvedValue(mockPrices);

      const response = await request(app)
        .post('/api/crypto/prices')
        .send({ coinIds: ['bitcoin', 'ethereum'] })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        count: 2,
        data: mockPrices,
      });
      expect(cryptoPriceService.getMultiplePrices).toHaveBeenCalledWith(['bitcoin', 'ethereum']);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/crypto/prices')
        .send({ coinIds: [] })
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });

    it('should limit number of coins', async () => {
      const tooManyCoins = Array(101).fill('bitcoin');

      const response = await request(app)
        .post('/api/crypto/prices')
        .send({ coinIds: tooManyCoins })
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('GET /api/crypto/historical/:coinId', () => {
    it('should return historical prices', async () => {
      const mockHistoricalData = {
        prices: [
          [1640995200000, 45000],
          [1641081600000, 46000],
        ],
      };

      (cryptoPriceService.getHistoricalPrices as jest.Mock).mockResolvedValue(mockHistoricalData);

      const response = await request(app)
        .get('/api/crypto/historical/bitcoin?days=7')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        coinId: 'bitcoin',
        days: 7,
        interval: 'daily',
        data: mockHistoricalData,
      });
      expect(cryptoPriceService.getHistoricalPrices).toHaveBeenCalledWith('bitcoin', 7, 'daily');
    });

    it('should use default days if not provided', async () => {
      (cryptoPriceService.getHistoricalPrices as jest.Mock).mockResolvedValue({ prices: [] });

      const response = await request(app)
        .get('/api/crypto/historical/bitcoin')
        .expect(200);

      expect(response.body.days).toBe(7);
      expect(cryptoPriceService.getHistoricalPrices).toHaveBeenCalledWith('bitcoin', 7, 'daily');
    });

    it('should validate interval parameter', async () => {
      (cryptoPriceService.getHistoricalPrices as jest.Mock).mockResolvedValue({ prices: [] });

      const response = await request(app)
        .get('/api/crypto/historical/bitcoin?interval=hourly')
        .expect(200);

      expect(response.body.interval).toBe('hourly');
      expect(cryptoPriceService.getHistoricalPrices).toHaveBeenCalledWith('bitcoin', 7, 'hourly');
    });

    it('should reject invalid interval', async () => {
      const response = await request(app)
        .get('/api/crypto/historical/bitcoin?interval=invalid')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });

    it('should validate days range', async () => {
      const response = await request(app)
        .get('/api/crypto/historical/bitcoin?days=400')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('GET /api/crypto/trending', () => {
    it('should return trending cryptocurrencies', async () => {
      const mockTrending = {
        coins: [
          { item: { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' } },
          { item: { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' } },
        ],
      };

      (cryptoPriceService.getTrending as jest.Mock).mockResolvedValue(mockTrending);

      const response = await request(app)
        .get('/api/crypto/trending')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockTrending,
      });
      expect(cryptoPriceService.getTrending).toHaveBeenCalled();
    });
  });

  describe('GET /api/crypto/global', () => {
    it('should return global market data', async () => {
      const mockGlobalData = {
        data: {
          active_cryptocurrencies: 10000,
          markets: 500,
          total_market_cap: { usd: 2000000000000 },
          total_volume: { usd: 100000000000 },
          market_cap_percentage: { btc: 42.5, eth: 18.2 },
        },
      };

      (cryptoPriceService.getGlobalData as jest.Mock).mockResolvedValue(mockGlobalData);

      const response = await request(app)
        .get('/api/crypto/global')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockGlobalData.data,
      });
      expect(cryptoPriceService.getGlobalData).toHaveBeenCalled();
    });
  });

  describe('GET /api/crypto/search', () => {
    it('should search for cryptocurrencies', async () => {
      const mockSearchResults = {
        coins: [
          { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
          { id: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH' },
        ],
      };

      (cryptoPriceService.searchCoins as jest.Mock).mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/crypto/search?query=bitcoin')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        query: 'bitcoin',
        count: 2,
        data: mockSearchResults.coins,
      });
      expect(cryptoPriceService.searchCoins).toHaveBeenCalledWith('bitcoin');
    });

    it('should validate search query', async () => {
      const response = await request(app)
        .get('/api/crypto/search')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });

    it('should limit search query length', async () => {
      const longQuery = 'a'.repeat(101);

      const response = await request(app)
        .get(`/api/crypto/search?query=${longQuery}`)
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('Watchlist endpoints', () => {
    describe('GET /api/crypto/watchlist', () => {
      it('should return watchlist with prices', async () => {
        const mockWatchlist = ['bitcoin', 'ethereum'];
        const mockPrices = [
          { id: 'bitcoin', current_price: 45000 },
          { id: 'ethereum', current_price: 2500 },
        ];

        (cryptoPriceService.getWatchlist as jest.Mock).mockReturnValue(mockWatchlist);
        (cryptoPriceService.getMultiplePrices as jest.Mock).mockResolvedValue(mockPrices);

        const response = await request(app)
          .get('/api/crypto/watchlist')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          count: 2,
          watchlist: mockWatchlist,
          prices: mockPrices,
        });
        expect(cryptoPriceService.getMultiplePrices).toHaveBeenCalledWith(mockWatchlist);
      });

      it('should handle empty watchlist', async () => {
        (cryptoPriceService.getWatchlist as jest.Mock).mockReturnValue([]);
        (cryptoPriceService.getMultiplePrices as jest.Mock).mockResolvedValue([]);

        const response = await request(app)
          .get('/api/crypto/watchlist')
          .expect(200);

        expect(response.body.count).toBe(0);
        expect(response.body.watchlist).toEqual([]);
        expect(response.body.prices).toEqual([]);
      });
    });

    describe('POST /api/crypto/watchlist', () => {
      it('should add coin to watchlist', async () => {
        const mockPrice = { id: 'bitcoin', current_price: 45000 };
        const updatedWatchlist = ['bitcoin'];

        (cryptoPriceService.getPrice as jest.Mock).mockResolvedValue(mockPrice);
        (cryptoPriceService.addToWatchlist as jest.Mock).mockImplementation(() => {});
        (cryptoPriceService.getWatchlist as jest.Mock).mockReturnValue(updatedWatchlist);

        const response = await request(app)
          .post('/api/crypto/watchlist')
          .send({ coinId: 'bitcoin' })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Added bitcoin to watchlist',
          watchlist: updatedWatchlist,
        });
        expect(cryptoPriceService.addToWatchlist).toHaveBeenCalledWith('bitcoin');
      });

      it('should verify coin exists before adding', async () => {
        (cryptoPriceService.getPrice as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .post('/api/crypto/watchlist')
          .send({ coinId: 'nonexistent' })
          .expect(404);

        expect(response.body.message).toContain('Cryptocurrency not found');
        expect(cryptoPriceService.addToWatchlist).not.toHaveBeenCalled();
      });

      it('should validate request body', async () => {
        const response = await request(app)
          .post('/api/crypto/watchlist')
          .send({})
          .expect(400);

        expect(response.body.message).toBe('Validation error');
      });
    });

    describe('DELETE /api/crypto/watchlist/:coinId', () => {
      it('should remove coin from watchlist', async () => {
        const updatedWatchlist = ['ethereum'];

        (cryptoPriceService.removeFromWatchlist as jest.Mock).mockImplementation(() => {});
        (cryptoPriceService.getWatchlist as jest.Mock).mockReturnValue(updatedWatchlist);

        const response = await request(app)
          .delete('/api/crypto/watchlist/bitcoin')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Removed bitcoin from watchlist',
          watchlist: updatedWatchlist,
        });
        expect(cryptoPriceService.removeFromWatchlist).toHaveBeenCalledWith('bitcoin');
      });
    });
  });

  describe('GET /api/crypto/currencies', () => {
    it('should return supported currencies', async () => {
      const mockCurrencies = ['usd', 'eur', 'gbp', 'jpy'];

      (cryptoPriceService.getSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);

      const response = await request(app)
        .get('/api/crypto/currencies')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        count: 4,
        currencies: mockCurrencies,
      });
      expect(cryptoPriceService.getSupportedCurrencies).toHaveBeenCalled();
    });
  });

  describe('POST /api/crypto/realtime/:action', () => {
    it('should start real-time updates', async () => {
      (cryptoPriceService.startPriceUpdates as jest.Mock).mockImplementation(() => {});

      const response = await request(app)
        .post('/api/crypto/realtime/start')
        .send({ interval: 60000 })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Real-time price updates started',
      });
      expect(cryptoPriceService.startPriceUpdates).toHaveBeenCalledWith(60000);
    });

    it('should use default interval if not provided', async () => {
      (cryptoPriceService.startPriceUpdates as jest.Mock).mockImplementation(() => {});

      await request(app)
        .post('/api/crypto/realtime/start')
        .send({})
        .expect(200);

      expect(cryptoPriceService.startPriceUpdates).toHaveBeenCalledWith(30000);
    });

    it('should stop real-time updates', async () => {
      (cryptoPriceService.stopPriceUpdates as jest.Mock).mockImplementation(() => {});

      const response = await request(app)
        .post('/api/crypto/realtime/stop')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Real-time price updates stopped',
      });
      expect(cryptoPriceService.stopPriceUpdates).toHaveBeenCalled();
    });

    it('should reject invalid action', async () => {
      const response = await request(app)
        .post('/api/crypto/realtime/invalid')
        .expect(400);

      expect(response.body.message).toBe('Invalid action. Use "start" or "stop"');
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      (cryptoPriceService.getPrice as jest.Mock).mockRejectedValue(
        new Error('CoinGecko API error')
      );

      const response = await request(app)
        .get('/api/crypto/price/bitcoin')
        .expect(500);

      expect(response.body.message).toBe('CoinGecko API error');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .get('/api/crypto/historical/bitcoin?days=invalid')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });
  });
});