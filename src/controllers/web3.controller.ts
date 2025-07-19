import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { web3Service } from '../services/web3.service';
import { log } from '../utils/logger';
import { AppError } from '../middleware/error-handler';

// Validation schemas
const GetBalanceSchema = z.object({
  address: z.string().refine((val) => web3Service.isValidAddress(val), {
    message: 'Invalid Ethereum address',
  }),
  chain: z.string().optional(),
});

const GetTransactionSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  chain: z.string().optional(),
});

const GetBlockSchema = z.object({
  blockNumber: z.union([
    z.literal('latest'),
    z.coerce.number().int().positive(),
  ]),
  chain: z.string().optional(),
});

const EstimateGasSchema = z.object({
  from: z.string().refine((val) => web3Service.isValidAddress(val), {
    message: 'Invalid from address',
  }),
  to: z.string().refine((val) => web3Service.isValidAddress(val), {
    message: 'Invalid to address',
  }),
  value: z.string(),
  data: z.string().optional(),
  chain: z.string().optional(),
});

const GetTokenBalanceSchema = z.object({
  tokenAddress: z.string().refine((val) => web3Service.isValidAddress(val), {
    message: 'Invalid token address',
  }),
  walletAddress: z.string().refine((val) => web3Service.isValidAddress(val), {
    message: 'Invalid wallet address',
  }),
  chain: z.string().optional(),
});

export class Web3Controller {
  constructor() {
    // Initialize Web3 service on controller creation
    this.initializeWeb3();
  }

  /**
   * Initialize Web3 service
   */
  private async initializeWeb3(): Promise<void> {
    try {
      await web3Service.initialize();
    } catch (error) {
      log.error('Failed to initialize Web3 service:', error);
    }
  }

  /**
   * Get balance for an address
   */
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { address } = req.params;
      const { chain } = req.query;

      // Validate request
      const validated = GetBalanceSchema.parse({
        address,
        chain: chain as string,
      });

      const balance = await web3Service.getBalance(
        validated.address,
        validated.chain || 'ethereum'
      );

      res.json({
        success: true,
        address: validated.address,
        chain: validated.chain || 'ethereum',
        ...balance,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { txHash } = req.params;
      const { chain } = req.query;

      // Validate request
      const validated = GetTransactionSchema.parse({
        txHash,
        chain: chain as string,
      });

      const transaction = await web3Service.getTransaction(
        validated.txHash,
        validated.chain || 'ethereum'
      );

      if (!transaction) {
        throw new AppError('Transaction not found', 404);
      }

      res.json({
        success: true,
        chain: validated.chain || 'ethereum',
        transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get block information
   */
  async getBlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { blockNumber } = req.params;
      const { chain } = req.query;

      // Validate request
      const validated = GetBlockSchema.parse({
        blockNumber: blockNumber === 'latest' ? 'latest' : parseInt(blockNumber, 10),
        chain: chain as string,
      });

      const block = await web3Service.getBlock(
        validated.blockNumber,
        validated.chain || 'ethereum'
      );

      res.json({
        success: true,
        chain: validated.chain || 'ethereum',
        block,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get gas price
   */
  async getGasPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain } = req.query;
      const chainName = (chain as string) || 'ethereum';

      const gasPrice = await web3Service.getGasPrice(chainName);

      res.json({
        success: true,
        chain: chainName,
        gasPrice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = EstimateGasSchema.parse(req.body);

      const estimate = await web3Service.estimateGas(
        validated.from,
        validated.to,
        validated.value,
        validated.data,
        validated.chain || 'ethereum'
      );

      res.json({
        success: true,
        chain: validated.chain || 'ethereum',
        ...estimate,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tokenAddress, walletAddress } = req.params;
      const { chain } = req.query;

      // Validate request
      const validated = GetTokenBalanceSchema.parse({
        tokenAddress,
        walletAddress,
        chain: chain as string,
      });

      const balance = await web3Service.getTokenBalance(
        validated.tokenAddress,
        validated.walletAddress,
        validated.chain || 'ethereum'
      );

      res.json({
        success: true,
        chain: validated.chain || 'ethereum',
        tokenAddress: validated.tokenAddress,
        walletAddress: validated.walletAddress,
        ...balance,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get supported chains
   */
  async getSupportedChains(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chains = web3Service.getSupportedChains();
      const chainDetails = chains.map(chain => ({
        id: chain,
        ...web3Service.getChainInfo(chain),
      }));

      res.json({
        success: true,
        count: chains.length,
        chains: chainDetails,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate address
   */
  async validateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { address } = req.params;
      const isValid = web3Service.isValidAddress(address);

      res.json({
        success: true,
        address,
        isValid,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Convert units
   */
  async convertUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { value, from, to } = req.body;

      let result: string;
      
      if (from === 'wei' && to === 'ether') {
        result = web3Service.weiToEther(value);
      } else if (from === 'ether' && to === 'wei') {
        result = web3Service.etherToWei(value);
      } else {
        throw new AppError('Invalid conversion. Supported: wei<->ether', 400);
      }

      res.json({
        success: true,
        value,
        from,
        to,
        result,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const web3Controller = new Web3Controller();