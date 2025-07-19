import {
  isValidEthereumAddress,
  isValidTransactionHash,
  isValidChainId,
  isValidTokenAmount,
  isValidUrl,
  isValidApiKey,
  sanitizeInput,
  isValidEmotionPoints,
  isValidToolName,
  validateRequestParams,
  validatePaginationParams,
  validateDateRange,
} from '../../src/utils/validators';

describe('Validators', () => {
  describe('isValidEthereumAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f3232B',
        '0x0000000000000000000000000000000000000000',
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      validAddresses.forEach(address => {
        expect(isValidEthereumAddress(address)).toBe(true);
      });
    });

    it('should reject invalid Ethereum addresses', () => {
      const invalidAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f3232', // Too short
        '0x742d35Cc6634C0532925a3b844Bc9e7595f3232BB', // Too long
        '742d35Cc6634C0532925a3b844Bc9e7595f3232B', // Missing 0x
        '0xZZZd35Cc6634C0532925a3b844Bc9e7595f3232B', // Invalid characters
        '0x', // Too short
        '', // Empty
      ];

      invalidAddresses.forEach(address => {
        expect(isValidEthereumAddress(address)).toBe(false);
      });
    });
  });

  describe('isValidTransactionHash', () => {
    it('should validate correct transaction hashes', () => {
      const validHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ];

      validHashes.forEach(hash => {
        expect(isValidTransactionHash(hash)).toBe(true);
      });
    });

    it('should reject invalid transaction hashes', () => {
      const invalidHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde', // Too short
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeff', // Too long
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Missing 0x
        '0xGGGG567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Invalid characters
      ];

      invalidHashes.forEach(hash => {
        expect(isValidTransactionHash(hash)).toBe(false);
      });
    });
  });

  describe('isValidChainId', () => {
    it('should validate supported chain IDs', () => {
      const validChainIds = [1, 3, 4, 5, 42, 56, 97, 137, 80001];

      validChainIds.forEach(chainId => {
        expect(isValidChainId(chainId)).toBe(true);
      });
    });

    it('should reject unsupported chain IDs', () => {
      const invalidChainIds = [0, 2, 10, 100, 1000, -1];

      invalidChainIds.forEach(chainId => {
        expect(isValidChainId(chainId)).toBe(false);
      });
    });
  });

  describe('isValidTokenAmount', () => {
    it('should validate correct token amounts', () => {
      const validAmounts = [
        '1',
        '0.1',
        '100.5',
        '0.000001',
        '1000000',
      ];

      validAmounts.forEach(amount => {
        expect(isValidTokenAmount(amount)).toBe(true);
      });
    });

    it('should reject invalid token amounts', () => {
      const invalidAmounts = [
        '0', // Zero not allowed
        '-1', // Negative
        'abc', // Not a number
        '1.2.3', // Multiple decimals
        '', // Empty
        ' ', // Whitespace
      ];

      invalidAmounts.forEach(amount => {
        expect(isValidTokenAmount(amount)).toBe(false);
      });
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.example.com/v1/endpoint',
        'wss://websocket.example.com',
      ];

      validUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com', // Missing protocol
        '', // Empty
      ];

      invalidUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });

      // FTP is technically a valid URL
      expect(isValidUrl('ftp://example.com')).toBe(true);
    });
  });

  describe('isValidApiKey', () => {
    it('should validate correct API keys', () => {
      const validKeys = [
        'abcdef1234567890abcdef1234567890',
        'ABC123-XYZ789_abc123-xyz789_ABC123',
        'a'.repeat(32),
      ];

      validKeys.forEach(key => {
        expect(isValidApiKey(key)).toBe(true);
      });
    });

    it('should reject invalid API keys', () => {
      const invalidKeys = [
        'short', // Too short
        'has spaces in it 1234567890123456',
        'has@special#chars$1234567890123456',
        '', // Empty
      ];

      invalidKeys.forEach(key => {
        expect(isValidApiKey(key)).toBe(false);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize input strings', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeInput('normal text')).toBe('normal text');
      expect(sanitizeInput('')).toBe('');
    });
  });

  describe('isValidEmotionPoints', () => {
    it('should validate emotion points in range', () => {
      const validPoints = [-100, -50, 0, 50, 100];

      validPoints.forEach(points => {
        expect(isValidEmotionPoints(points)).toBe(true);
      });
    });

    it('should reject emotion points out of range', () => {
      const invalidPoints = [-101, -200, 101, 200];

      invalidPoints.forEach(points => {
        expect(isValidEmotionPoints(points)).toBe(false);
      });
    });
  });

  describe('isValidToolName', () => {
    it('should validate known tool names', () => {
      const validTools = [
        'uniswap', 'aave', 'chainlink', 'web3', 'exa',
        'crypto-prices', 'blockchain-data', 'crypto-news',
        'nft', 'wallet', 'crosschain', 'analytics',
        'security', 'fiat-ramps', 'ai-defi',
      ];

      validTools.forEach(tool => {
        expect(isValidToolName(tool)).toBe(true);
      });
    });

    it('should handle case insensitive tool names', () => {
      expect(isValidToolName('UNISWAP')).toBe(true);
      expect(isValidToolName('Web3')).toBe(true);
    });

    it('should reject unknown tool names', () => {
      const invalidTools = ['unknown', 'fake-tool', '', ' '];

      invalidTools.forEach(tool => {
        expect(isValidToolName(tool)).toBe(false);
      });
    });
  });

  describe('validateRequestParams', () => {
    it('should sanitize string parameters', () => {
      const params = {
        name: '  test  ',
        value: 123,
        nested: { text: '<script>xss</script>' },
      };

      const validated = validateRequestParams(params);

      expect(validated.name).toBe('test');
      expect(validated.value).toBe(123);
      expect(validated.nested).toEqual({ text: '<script>xss</script>' });
    });
  });

  describe('validatePaginationParams', () => {
    it('should provide defaults for missing params', () => {
      const result = validatePaginationParams();
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should enforce minimum page', () => {
      const result = validatePaginationParams(0, 10);
      
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit', () => {
      const result = validatePaginationParams(1, 200);
      
      expect(result.limit).toBe(100);
    });

    it('should accept valid params', () => {
      const result = validatePaginationParams(5, 50);
      
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });
  });

  describe('validateDateRange', () => {
    it('should provide defaults for missing dates', () => {
      const result = validateDateRange();
      const now = new Date();
      
      expect(result.end.getTime()).toBeCloseTo(now.getTime(), -3); // Within seconds
      expect(result.start.getTime()).toBeLessThan(result.end.getTime());
    });

    it('should parse valid date strings', () => {
      const result = validateDateRange('2024-01-01', '2024-01-31');
      
      expect(result.start.toISOString()).toContain('2024-01-01');
      expect(result.end.toISOString()).toContain('2024-01-31');
    });

    it('should swap dates if start is after end', () => {
      const result = validateDateRange('2024-01-31', '2024-01-01');
      
      expect(result.start.toISOString()).toContain('2024-01-01');
      expect(result.end.toISOString()).toContain('2024-01-31');
    });

    it('should cap future dates to now', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateDateRange(undefined, futureDate.toISOString());
      const now = new Date();
      
      expect(result.end.getTime()).toBeCloseTo(now.getTime(), -3);
    });

    it('should handle invalid date strings', () => {
      const result = validateDateRange('invalid', 'also-invalid');
      const now = new Date();
      
      expect(result.end.getTime()).toBeCloseTo(now.getTime(), -3);
      expect(result.start.getTime()).toBeLessThan(result.end.getTime());
    });
  });
});