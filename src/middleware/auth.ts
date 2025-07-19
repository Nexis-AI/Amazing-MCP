import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { log } from '../utils/logger';
import { isValidApiKey } from '../utils/validators';

interface AuthenticatedRequest extends Request {
  apiKey?: string;
  userId?: string;
}

/**
 * Validate API key middleware
 */
export const validateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      throw new AppError('API key is required', 401);
    }

    // Validate API key format
    if (!isValidApiKey(apiKey)) {
      throw new AppError('Invalid API key format', 401);
    }

    // Check against environment API key (in production, this would check against a database)
    const validApiKey = process.env.API_KEY;
    if (validApiKey && apiKey !== validApiKey) {
      // Skip warning in test environment
      if (process.env.NODE_ENV !== 'test') {
        log.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
      }
      throw new AppError('Invalid API key', 401);
    }

    // Attach API key to request for logging
    req.apiKey = apiKey;
    
    // In production, you would also attach the user ID associated with the API key
    // req.userId = getUserIdFromApiKey(apiKey);
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional API key validation (doesn't fail if no key provided)
 */
export const optionalApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
    
    if (apiKey && isValidApiKey(apiKey)) {
      const validApiKey = process.env.API_KEY;
      if (!validApiKey || apiKey === validApiKey) {
        req.apiKey = apiKey;
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth
    next();
  }
};

/**
 * Rate limit by API key
 */
export const rateLimitByApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // This would integrate with the rate limiter to apply different limits based on API key tier
  // For now, just pass through
  next();
};