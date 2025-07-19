import { z } from 'zod';

// Ethereum address validation
export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Transaction hash validation
export const isValidTransactionHash = (hash: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

// Chain ID validation
export const isValidChainId = (chainId: number): boolean => {
  const validChainIds = [1, 3, 4, 5, 42, 56, 97, 137, 80001]; // mainnet, testnets, BSC, Polygon
  return validChainIds.includes(chainId);
};

// Token amount validation
export const isValidTokenAmount = (amount: string): boolean => {
  return /^\d+(\.\d+)?$/.test(amount) && parseFloat(amount) > 0;
};

// URL validation
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// API key validation (basic check)
export const isValidApiKey = (key: string): boolean => {
  return key.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(key);
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// Validate emotion points
export const isValidEmotionPoints = (points: number): boolean => {
  return points >= -100 && points <= 100;
};

// Validate tool name
export const isValidToolName = (tool: string): boolean => {
  const validTools = [
    'uniswap',
    'aave',
    'chainlink',
    'web3',
    'exa',
    'crypto-prices',
    'blockchain-data',
    'crypto-news',
    'nft',
    'wallet',
    'crosschain',
    'analytics',
    'security',
    'fiat-ramps',
    'ai-defi',
  ];
  return validTools.includes(tool.toLowerCase());
};

// Custom Zod schemas with additional validation
export const EthereumAddressSchema = z.string().refine(isValidEthereumAddress, {
  message: 'Invalid Ethereum address format',
});

export const TransactionHashSchema = z.string().refine(isValidTransactionHash, {
  message: 'Invalid transaction hash format',
});

export const ChainIdSchema = z.number().refine(isValidChainId, {
  message: 'Unsupported chain ID',
});

export const TokenAmountSchema = z.string().refine(isValidTokenAmount, {
  message: 'Invalid token amount format',
});

export const ApiKeySchema = z.string().refine(isValidApiKey, {
  message: 'Invalid API key format',
});

export const ToolNameSchema = z.string().refine(isValidToolName, {
  message: 'Invalid tool name',
});

// Validate request parameters
export const validateRequestParams = (params: Record<string, unknown>): Record<string, unknown> => {
  const validated: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      validated[key] = sanitizeInput(value);
    } else {
      validated[key] = value;
    }
  }
  
  return validated;
};

// Validate pagination parameters
export const validatePaginationParams = (page?: number, limit?: number): { page: number; limit: number } => {
  const validatedPage = Math.max(1, page || 1);
  const validatedLimit = Math.min(100, Math.max(1, limit || 10));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
  };
};

// Validate date range
export const validateDateRange = (startDate?: string, endDate?: string): { start: Date; end: Date } => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  let start: Date;
  let end: Date;
  
  try {
    start = startDate ? new Date(startDate) : thirtyDaysAgo;
    end = endDate ? new Date(endDate) : now;
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date');
    }
    
    if (start > end) {
      // Swap dates
      const temp = start;
      start = end;
      end = temp;
    }
    
    if (end > now) {
      end = now;
    }
  } catch {
    start = thirtyDaysAgo;
    end = now;
  }
  
  return { start, end };
};