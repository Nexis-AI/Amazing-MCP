import { Request, Response, NextFunction } from 'express';
import { validateApiKey, optionalApiKey, rateLimitByApiKey } from '../../src/middleware/auth';
import { AppError } from '../../src/middleware/error-handler';
import { log } from '../../src/utils/logger';
import * as validators from '../../src/utils/validators';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/validators');

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'test';
    
    // Setup mocks
    mockReq = {
      headers: {},
    };
    mockRes = {};
    mockNext = jest.fn();
    
    // Mock validator
    (validators.isValidApiKey as jest.Mock).mockImplementation((key) => {
      return typeof key === 'string' && key.length >= 10;
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API key in x-api-key header', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'x-api-key': 'test_api_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('test_api_key_123');
    });

    it('should accept valid API key in authorization header', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'authorization': 'Bearer test_api_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('test_api_key_123');
    });

    it('should reject request without API key', () => {
      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API key is required',
          statusCode: 401,
        })
      );
    });

    it('should reject invalid API key format', () => {
      mockReq.headers = { 'x-api-key': 'short' };
      (validators.isValidApiKey as jest.Mock).mockReturnValue(false);

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid API key format',
          statusCode: 401,
        })
      );
    });

    it('should reject incorrect API key', () => {
      process.env.API_KEY = 'correct_key';
      mockReq.headers = { 'x-api-key': 'wrong_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid API key',
          statusCode: 401,
        })
      );
    });

    it('should log invalid API key attempts in non-test environment', () => {
      process.env.NODE_ENV = 'development';
      process.env.API_KEY = 'correct_key';
      mockReq.headers = { 'x-api-key': 'wrong_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid API key attempt: wrong_key')
      );
    });

    it('should not log in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.API_KEY = 'correct_key';
      mockReq.headers = { 'x-api-key': 'wrong_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(log.warn).not.toHaveBeenCalled();
    });

    it('should allow any valid API key when environment key not set', () => {
      delete process.env.API_KEY;
      mockReq.headers = { 'x-api-key': 'any_valid_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('any_valid_key_123');
    });

    it('should handle authorization header with different casing', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'Authorization': 'bearer test_api_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle errors thrown during validation', () => {
      mockReq.headers = { 'x-api-key': 'test_key' };
      (validators.isValidApiKey as jest.Mock).mockImplementation(() => {
        throw new Error('Validation error');
      });

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('optionalApiKey', () => {
    it('should accept valid API key', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'x-api-key': 'test_api_key_123' };

      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('test_api_key_123');
    });

    it('should accept request without API key', () => {
      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBeUndefined();
    });

    it('should ignore invalid API key format', () => {
      mockReq.headers = { 'x-api-key': 'short' };
      (validators.isValidApiKey as jest.Mock).mockReturnValue(false);

      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBeUndefined();
    });

    it('should ignore incorrect API key', () => {
      process.env.API_KEY = 'correct_key';
      mockReq.headers = { 'x-api-key': 'wrong_key_123' };

      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBeUndefined();
    });

    it('should attach valid API key from authorization header', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'authorization': 'Bearer test_api_key_123' };

      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('test_api_key_123');
    });

    it('should handle errors gracefully', () => {
      mockReq.headers = { 'x-api-key': 'test_key' };
      (validators.isValidApiKey as jest.Mock).mockImplementation(() => {
        throw new Error('Validation error');
      });

      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      // Should not fail, just continue
      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBeUndefined();
    });

    it('should attach API key when no environment key is set', () => {
      delete process.env.API_KEY;
      mockReq.headers = { 'x-api-key': 'any_valid_key_123' };

      optionalApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('any_valid_key_123');
    });
  });

  describe('rateLimitByApiKey', () => {
    it('should pass through requests', () => {
      rateLimitByApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass through even with API key', () => {
      (mockReq as any).apiKey = 'test_api_key_123';

      rateLimitByApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass through without API key', () => {
      rateLimitByApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty authorization header', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'authorization': '' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API key is required',
          statusCode: 401,
        })
      );
    });

    it('should handle authorization without Bearer prefix', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = { 'authorization': 'test_api_key_123' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('test_api_key_123');
    });

    it('should handle malformed Bearer token', () => {
      mockReq.headers = { 'authorization': 'Bearer ' };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API key is required',
          statusCode: 401,
        })
      );
    });

    it('should prioritize x-api-key over authorization header', () => {
      process.env.API_KEY = 'test_api_key_123';
      mockReq.headers = {
        'x-api-key': 'test_api_key_123',
        'authorization': 'Bearer different_key',
      };

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('test_api_key_123');
    });
  });
});