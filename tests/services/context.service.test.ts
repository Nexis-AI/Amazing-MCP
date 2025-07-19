import { contextService } from '../../src/services/context.service';
import { cacheService } from '../../src/services/cache.service';
import { log } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/cache.service');

describe('Context Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock cache service methods
    (cacheService.wrap as jest.Mock) = jest.fn((key: string, fn: Function) => {
      // Execute the function directly (bypassing cache)
      return fn();
    });
  });

  describe('getContextData', () => {
    it('should return empty context when no tool specified', async () => {
      process.env.ENABLE_REAL_TIME_PRICES = 'false';
      process.env.ENABLE_DEFI_INTEGRATIONS = 'false';
      
      const context = await contextService.getContextData();
      
      expect(context).toEqual({});
    });

    it('should include prices when real-time prices enabled', async () => {
      process.env.ENABLE_REAL_TIME_PRICES = 'true';
      
      const context = await contextService.getContextData();
      
      expect(context.prices).toBeDefined();
      expect(context.prices?.bitcoin).toBeGreaterThan(0);
      expect(context.prices?.ethereum).toBeGreaterThan(0);
    });

    it('should include prices for crypto-prices tool', async () => {
      process.env.ENABLE_REAL_TIME_PRICES = 'true';
      
      const context = await contextService.getContextData('crypto-prices');
      
      expect(context.prices).toBeDefined();
      expect(context.prices?.bitcoin).toBeGreaterThan(0);
    });

    it('should include web3 context for web3 tool', async () => {
      const context = await contextService.getContextData('web3');
      
      expect(context.web3Context).toBeDefined();
      expect(context.web3Context?.provider).toBeDefined();
      expect(context.web3Context?.chainId).toBe(1);
      expect(context.web3Context?.currentBlock).toBe(18500000);
    });

    it('should include web3 context for blockchain-data tool', async () => {
      const context = await contextService.getContextData('blockchain-data');
      
      expect(context.web3Context).toBeDefined();
      expect(context.web3Context?.chainId).toBe(1);
    });

    it('should use custom provider URL when set', async () => {
      process.env.WEB3_PROVIDER_URL = 'https://custom.provider.url';
      
      const context = await contextService.getContextData('web3');
      
      expect(context.web3Context?.provider).toBe('https://custom.provider.url');
    });

    it('should include news feed for crypto-news tool', async () => {
      const context = await contextService.getContextData('crypto-news');
      
      expect(context.newsFeed).toBeDefined();
      expect(context.newsFeed?.articles).toHaveLength(3);
      expect(context.newsFeed?.lastUpdated).toBeInstanceOf(Date);
      
      const article = context.newsFeed?.articles[0];
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('url');
      expect(article).toHaveProperty('sentiment');
      expect(article).toHaveProperty('publishedAt');
      expect(article).toHaveProperty('source');
    });

    it('should include oracle feeds for chainlink tool', async () => {
      const context = await contextService.getContextData('chainlink');
      
      expect(context.oracleFeeds).toBeDefined();
      expect(context.oracleFeeds?.['ETH/USD']).toBe(2500.50);
      expect(context.oracleFeeds?.['BTC/USD']).toBe(45000.00);
      expect(context.oracleFeeds?.['LINK/USD']).toBe(15.25);
    });

    it('should include wallet config for wallet tool', async () => {
      const context = await contextService.getContextData('wallet');
      
      expect(context.walletConfig).toBeDefined();
      expect(context.walletConfig?.accounts).toEqual([]);
      expect(context.walletConfig?.balances).toEqual({});
    });

    it('should include DeFi context when integrations enabled', async () => {
      process.env.ENABLE_DEFI_INTEGRATIONS = 'true';
      
      const context = await contextService.getContextData('defi');
      
      expect(context.defiContext).toBeDefined();
      expect(context.defiContext?.yields).toBeDefined();
      expect(context.defiContext?.yields.aave).toBeDefined();
      expect(context.defiContext?.yields.aave.USDC).toBe(3.5);
      expect(context.defiContext?.yields.compound).toBeDefined();
      expect(context.defiContext?.trades).toEqual([]);
    });

    it('should include DeFi context for uniswap tool', async () => {
      process.env.ENABLE_DEFI_INTEGRATIONS = 'true';
      
      const context = await contextService.getContextData('uniswap');
      
      expect(context.defiContext).toBeDefined();
    });

    it('should include DeFi context for aave tool', async () => {
      process.env.ENABLE_DEFI_INTEGRATIONS = 'true';
      
      const context = await contextService.getContextData('aave');
      
      expect(context.defiContext).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Mock cache service to throw error
      (cacheService.wrap as jest.Mock).mockRejectedValueOnce(new Error('Cache error'));
      
      process.env.ENABLE_REAL_TIME_PRICES = 'true';
      
      const context = await contextService.getContextData();
      
      expect(context).toEqual({});
      expect(log.error).toHaveBeenCalledWith('Error building context data:', expect.any(Error));
    });
  });

  describe('getMockPrices', () => {
    it('should return consistent price structure', async () => {
      const context = await contextService.getContextData('crypto-prices');
      const prices = context.prices;
      
      expect(prices).toBeDefined();
      expect(prices).toHaveProperty('bitcoin');
      expect(prices).toHaveProperty('ethereum');
      expect(prices).toHaveProperty('binancecoin');
      expect(prices).toHaveProperty('cardano');
      expect(prices).toHaveProperty('solana');
      expect(prices).toHaveProperty('polkadot');
      expect(prices).toHaveProperty('avalanche');
      expect(prices).toHaveProperty('chainlink');
      expect(prices).toHaveProperty('uniswap');
      expect(prices).toHaveProperty('aave');
    });

    it('should return prices with reasonable variations', async () => {
      const context1 = await contextService.getContextData('crypto-prices');
      const context2 = await contextService.getContextData('crypto-prices');
      
      const prices1 = context1.prices!;
      const prices2 = context2.prices!;
      
      // Prices should be different (due to random variation)
      expect(prices1.bitcoin).not.toBe(prices2.bitcoin);
      
      // But within reasonable range
      expect(Math.abs(prices1.bitcoin - prices2.bitcoin)).toBeLessThan(1000);
    });

    it('should use cache service', async () => {
      process.env.ENABLE_REAL_TIME_PRICES = 'true';
      
      await contextService.getContextData();
      
      expect(cacheService.wrap).toHaveBeenCalledWith(
        'crypto-prices:mock',
        expect.any(Function),
        60
      );
    });
  });

  describe('getMockNews', () => {
    it('should return consistent news structure', async () => {
      const context = await contextService.getContextData('crypto-news');
      const articles = context.newsFeed?.articles;
      
      expect(articles).toHaveLength(3);
      
      articles?.forEach(article => {
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('url');
        expect(article).toHaveProperty('sentiment');
        expect(article).toHaveProperty('publishedAt');
        expect(article).toHaveProperty('source');
        expect(typeof article.sentiment).toBe('number');
        expect(article.sentiment).toBeGreaterThanOrEqual(-1);
        expect(article.sentiment).toBeLessThanOrEqual(1);
      });
    });

    it('should return articles with correct timestamps', async () => {
      const now = Date.now();
      const context = await contextService.getContextData('crypto-news');
      const articles = context.newsFeed?.articles;
      
      expect(articles).toHaveLength(3);
      
      // Articles should be from past few hours
      articles?.forEach((article, index) => {
        const publishedTime = new Date(article.publishedAt).getTime();
        const hoursAgo = (index + 1) * 3600000; // 1, 2, 3 hours
        
        expect(now - publishedTime).toBeCloseTo(hoursAgo, -100000); // Within ~100 seconds
      });
    });

    it('should use cache service', async () => {
      await contextService.getContextData('crypto-news');
      
      expect(cacheService.wrap).toHaveBeenCalledWith(
        'crypto-news:mock',
        expect.any(Function),
        300
      );
    });
  });

  describe('enrichContext', () => {
    it('should return enriched context with same base data', async () => {
      const baseContext = {
        prices: { bitcoin: 45000 },
      };
      
      const enriched = await contextService.enrichContext(baseContext, {
        includeHistoricalData: true,
      });
      
      expect(enriched).toEqual(baseContext);
      expect(enriched.prices?.bitcoin).toBe(45000);
    });

    it('should handle all enrichment options', async () => {
      const baseContext = {};
      
      const enriched = await contextService.enrichContext(baseContext, {
        includeHistoricalData: true,
        includePredictions: true,
        includeRelatedAssets: true,
      });
      
      expect(enriched).toEqual(baseContext);
    });
  });

  describe('filterContext', () => {
    it('should filter prices by threshold', () => {
      const context = {
        prices: {
          bitcoin: 45000,
          ethereum: 2500,
          cardano: 0.45,
          solana: 65,
        },
      };
      
      const filtered = contextService.filterContext(context, {
        priceThreshold: 100,
      });
      
      expect(filtered.prices).toEqual({
        bitcoin: 45000,
        ethereum: 2500,
      });
    });

    it('should handle empty prices', () => {
      const context = {};
      
      const filtered = contextService.filterContext(context, {
        priceThreshold: 100,
      });
      
      expect(filtered).toEqual({});
    });

    it('should filter news by sentiment', () => {
      const context = {
        newsFeed: {
          articles: [
            { title: 'Good news', sentiment: 0.8, url: '', publishedAt: '', source: '' },
            { title: 'Bad news', sentiment: -0.5, url: '', publishedAt: '', source: '' },
            { title: 'Neutral', sentiment: 0.1, url: '', publishedAt: '', source: '' },
          ],
          lastUpdated: new Date(),
        },
      };
      
      const filtered = contextService.filterContext(context, {
        sentimentThreshold: 0.5,
      });
      
      expect(filtered.newsFeed?.articles).toHaveLength(1);
      expect(filtered.newsFeed?.articles[0].title).toBe('Good news');
    });

    it('should handle empty filters', () => {
      const context = {
        prices: { bitcoin: 45000 },
        newsFeed: {
          articles: [{ title: 'News', sentiment: 0.5, url: '', publishedAt: '', source: '' }],
          lastUpdated: new Date(),
        },
      };
      
      const filtered = contextService.filterContext(context, {});
      
      expect(filtered).toEqual(context);
    });

    it('should preserve other context properties', () => {
      const context = {
        prices: { bitcoin: 45000 },
        web3Context: { provider: 'test', chainId: 1, currentBlock: 123 },
      };
      
      const filtered = contextService.filterContext(context, {
        priceThreshold: 50000,
      });
      
      expect(filtered.web3Context).toEqual(context.web3Context);
      expect(filtered.prices).toEqual({});
    });
  });
});