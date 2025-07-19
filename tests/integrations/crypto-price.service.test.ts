import { cryptoPriceService } from '../../src/services/crypto-price.service';

// Mock axios to avoid actual API calls in tests
jest.mock('axios');
import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CryptoPriceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache to avoid test interference
    const { cacheService } = require('../../src/services/cache.service');
    cacheService.clear();
  });

  afterAll(() => {
    // Stop price updates to clean up
    cryptoPriceService.stopPriceUpdates();
  });

  describe('getPrice', () => {
    it('should get price for a single cryptocurrency', async () => {
      const mockResponse = {
        data: [{
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          current_price: 45000,
          market_cap: 900000000000,
          market_cap_rank: 1,
          price_change_percentage_24h: 2.5,
        }],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const price = await cryptoPriceService.getPrice('bitcoin');
      
      expect(price).toBeDefined();
      expect(price?.id).toBe('bitcoin');
      expect(price?.current_price).toBe(45000);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/coins/markets'),
        expect.objectContaining({
          params: expect.objectContaining({
            ids: 'bitcoin',
          }),
        })
      );
    });

    it('should return null for non-existent cryptocurrency', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      const price = await cryptoPriceService.getPrice('fakecoin');
      
      expect(price).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(cryptoPriceService.getPrice('bitcoin')).rejects.toThrow('API Error');
    });
  });

  describe('getMultiplePrices', () => {
    it('should get prices for multiple cryptocurrencies', async () => {
      const mockResponse = {
        data: [
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
        ],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const prices = await cryptoPriceService.getMultiplePrices(['bitcoin', 'ethereum']);
      
      expect(prices).toHaveLength(2);
      expect(prices[0].id).toBe('bitcoin');
      expect(prices[1].id).toBe('ethereum');
    });
  });

  describe('getHistoricalPrices', () => {
    it('should get historical price data', async () => {
      const mockResponse = {
        data: {
          prices: [[1640000000000, 45000], [1640086400000, 46000]],
          market_caps: [[1640000000000, 900000000000], [1640086400000, 920000000000]],
          total_volumes: [[1640000000000, 30000000000], [1640086400000, 32000000000]],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const historical = await cryptoPriceService.getHistoricalPrices('bitcoin', 7);
      
      expect(historical.prices).toHaveLength(2);
      expect(historical.market_caps).toHaveLength(2);
      expect(historical.total_volumes).toHaveLength(2);
    });
  });

  describe('getTrending', () => {
    it('should get trending cryptocurrencies', async () => {
      const mockResponse = {
        data: {
          coins: [
            {
              item: {
                id: 'shiba-inu',
                coin_id: 5994,
                name: 'Shiba Inu',
                symbol: 'SHIB',
                market_cap_rank: 15,
                score: 0,
              },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const trending = await cryptoPriceService.getTrending();
      
      expect(trending.coins).toHaveLength(1);
      expect(trending.coins[0].item.id).toBe('shiba-inu');
    });
  });

  describe('getGlobalData', () => {
    it('should get global market data', async () => {
      const mockResponse = {
        data: {
          data: {
            active_cryptocurrencies: 10000,
            markets: 500,
            total_market_cap: { usd: 2000000000000 },
            total_volume: { usd: 100000000000 },
            market_cap_percentage: { btc: 40.5, eth: 18.2 },
            market_cap_change_percentage_24h_usd: 2.5,
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const global = await cryptoPriceService.getGlobalData();
      
      expect(global.data.active_cryptocurrencies).toBe(10000);
      expect(global.data.total_market_cap.usd).toBe(2000000000000);
    });
  });

  describe('searchCoins', () => {
    it('should search for cryptocurrencies', async () => {
      const mockResponse = {
        data: {
          coins: [
            {
              id: 'bitcoin',
              name: 'Bitcoin',
              symbol: 'BTC',
              market_cap_rank: 1,
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const results = await cryptoPriceService.searchCoins('bitcoin');
      
      expect(results.coins).toHaveLength(1);
      expect(results.coins[0].id).toBe('bitcoin');
    });
  });

  describe('watchlist', () => {
    it('should add and remove coins from watchlist', () => {
      const initialWatchlist = cryptoPriceService.getWatchlist();
      const initialLength = initialWatchlist.length;

      // Add a coin
      cryptoPriceService.addToWatchlist('test-coin');
      expect(cryptoPriceService.getWatchlist()).toContain('test-coin');
      expect(cryptoPriceService.getWatchlist().length).toBe(initialLength + 1);

      // Try adding same coin again (should not duplicate)
      cryptoPriceService.addToWatchlist('test-coin');
      expect(cryptoPriceService.getWatchlist().length).toBe(initialLength + 1);

      // Remove the coin
      cryptoPriceService.removeFromWatchlist('test-coin');
      expect(cryptoPriceService.getWatchlist()).not.toContain('test-coin');
      expect(cryptoPriceService.getWatchlist().length).toBe(initialLength);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should get supported vs currencies', async () => {
      const mockResponse = {
        data: ['usd', 'eur', 'gbp', 'jpy', 'btc', 'eth'],
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const currencies = await cryptoPriceService.getSupportedCurrencies();
      
      expect(currencies).toContain('usd');
      expect(currencies).toContain('eur');
      expect(currencies).toContain('btc');
    });
  });

  describe('real-time updates', () => {
    it('should start and stop price updates', (done) => {
      // Mock the fetch prices method
      const fetchPricesSpy = jest.spyOn(cryptoPriceService as any, 'fetchPrices');
      fetchPricesSpy.mockImplementation(() => Promise.resolve());

      // Start updates with short interval
      cryptoPriceService.startPriceUpdates(100);

      // Wait for a couple of intervals
      setTimeout(() => {
        expect(fetchPricesSpy).toHaveBeenCalled();
        
        // Stop updates
        cryptoPriceService.stopPriceUpdates();
        
        const callCount = fetchPricesSpy.mock.calls.length;
        
        // Wait to ensure no more calls
        setTimeout(() => {
          expect(fetchPricesSpy).toHaveBeenCalledTimes(callCount);
          fetchPricesSpy.mockRestore();
          done();
        }, 150);
      }, 250);
    });
  });
});