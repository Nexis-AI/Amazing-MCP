import { ethers } from 'ethers';
import Web3 from 'web3';
import { log } from '../utils/logger';
import { cacheService } from './cache.service';

interface IWeb3Config {
  ethereum: string;
  polygon: string;
  bsc: string;
  arbitrum?: string;
  optimism?: string;
  avalanche?: string;
}

interface IChainInfo {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  blockExplorerUrl: string;
}

interface ITransactionDetails {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  nonce: number;
  blockNumber?: number;
  status?: number | null;
}

class Web3Service {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private web3Instances: Map<string, Web3> = new Map();
  private chainInfo: Map<string, IChainInfo> = new Map();
  private initialized = false;

  constructor() {
    this.initializeChainInfo();
  }

  /**
   * Initialize chain information
   */
  private initializeChainInfo(): void {
    // Ethereum Mainnet
    this.chainInfo.set('ethereum', {
      chainId: 1,
      name: 'Ethereum Mainnet',
      symbol: 'ETH',
      decimals: 18,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/demo',
      blockExplorerUrl: 'https://etherscan.io',
    });

    // Polygon
    this.chainInfo.set('polygon', {
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/',
      blockExplorerUrl: 'https://polygonscan.com',
    });

    // Binance Smart Chain
    this.chainInfo.set('bsc', {
      chainId: 56,
      name: 'Binance Smart Chain',
      symbol: 'BNB',
      decimals: 18,
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
      blockExplorerUrl: 'https://bscscan.com',
    });

    // Arbitrum
    this.chainInfo.set('arbitrum', {
      chainId: 42161,
      name: 'Arbitrum One',
      symbol: 'ETH',
      decimals: 18,
      rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      blockExplorerUrl: 'https://arbiscan.io',
    });

    // Optimism
    this.chainInfo.set('optimism', {
      chainId: 10,
      name: 'Optimism',
      symbol: 'ETH',
      decimals: 18,
      rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      blockExplorerUrl: 'https://optimistic.etherscan.io',
    });

    // Avalanche
    this.chainInfo.set('avalanche', {
      chainId: 43114,
      name: 'Avalanche C-Chain',
      symbol: 'AVAX',
      decimals: 18,
      rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
      blockExplorerUrl: 'https://snowtrace.io',
    });
  }

  /**
   * Initialize Web3 providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize providers for each chain
      for (const [chain, info] of this.chainInfo) {
        try {
          // Initialize ethers provider
          const provider = new ethers.JsonRpcProvider(info.rpcUrl);
          this.providers.set(chain, provider);

          // Initialize Web3 instance
          const web3 = new Web3(info.rpcUrl);
          this.web3Instances.set(chain, web3);

          // Test connection
          const blockNumber = await provider.getBlockNumber();
          log.info(`Connected to ${info.name} (Chain ID: ${info.chainId}, Block: ${blockNumber})`);
        } catch (error) {
          log.error(`Failed to connect to ${chain}:`, error);
        }
      }

      this.initialized = true;
      log.info('Web3 service initialized');
    } catch (error) {
      log.error('Failed to initialize Web3 service:', error);
      throw error;
    }
  }

  /**
   * Get ethers provider for a chain
   */
  getProvider(chain: string): ethers.JsonRpcProvider {
    const provider = this.providers.get(chain.toLowerCase());
    if (!provider) {
      throw new Error(`Provider not found for chain: ${chain}`);
    }
    return provider;
  }

  /**
   * Get Web3 instance for a chain
   */
  getWeb3(chain: string): Web3 {
    const web3 = this.web3Instances.get(chain.toLowerCase());
    if (!web3) {
      throw new Error(`Web3 instance not found for chain: ${chain}`);
    }
    return web3;
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string, chain = 'ethereum'): Promise<{
    balance: string;
    formatted: string;
    symbol: string;
  }> {
    const cacheKey = `balance:${chain}:${address}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const provider = this.getProvider(chain);
        const chainData = this.chainInfo.get(chain.toLowerCase());
        
        if (!chainData) {
          throw new Error(`Chain info not found for: ${chain}`);
        }

        const balance = await provider.getBalance(address);
        const formatted = ethers.formatEther(balance);

        return {
          balance: balance.toString(),
          formatted,
          symbol: chainData.symbol,
        };
      } catch (error) {
        log.error(`Failed to get balance for ${address} on ${chain}:`, error);
        throw error;
      }
    }, 30); // Cache for 30 seconds
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string, chain = 'ethereum'): Promise<ITransactionDetails | null> {
    const cacheKey = `tx:${chain}:${txHash}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const provider = this.getProvider(chain);
        const tx = await provider.getTransaction(txHash);
        
        if (!tx) {
          return null;
        }

        const receipt = await provider.getTransactionReceipt(txHash);

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to || '',
          value: tx.value.toString(),
          gasPrice: tx.gasPrice?.toString() || '0',
          gasLimit: tx.gasLimit.toString(),
          nonce: tx.nonce,
          blockNumber: receipt?.blockNumber,
          status: receipt?.status,
        };
      } catch (error) {
        log.error(`Failed to get transaction ${txHash} on ${chain}:`, error);
        throw error;
      }
    }, 300); // Cache for 5 minutes
  }

  /**
   * Get current gas prices
   */
  async getGasPrice(chain = 'ethereum'): Promise<{
    standard: string;
    fast: string;
    instant: string;
    formatted: {
      standard: string;
      fast: string;
      instant: string;
    };
  }> {
    const cacheKey = `gas:${chain}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const provider = this.getProvider(chain);
        const feeData = await provider.getFeeData();
        
        const gasPrice = feeData.gasPrice || BigInt(0);
        const maxPriorityFee = feeData.maxPriorityFeePerGas || BigInt(0);
        
        // Calculate different gas price tiers
        const standard = gasPrice;
        const fast = gasPrice + (gasPrice * BigInt(20) / BigInt(100)); // 20% higher
        const instant = gasPrice + (gasPrice * BigInt(50) / BigInt(100)); // 50% higher

        return {
          standard: standard.toString(),
          fast: fast.toString(),
          instant: instant.toString(),
          formatted: {
            standard: ethers.formatUnits(standard, 'gwei'),
            fast: ethers.formatUnits(fast, 'gwei'),
            instant: ethers.formatUnits(instant, 'gwei'),
          },
        };
      } catch (error) {
        log.error(`Failed to get gas price for ${chain}:`, error);
        throw error;
      }
    }, 10); // Cache for 10 seconds
  }

  /**
   * Get block information
   */
  async getBlock(blockNumber: number | 'latest', chain = 'ethereum'): Promise<{
    number: number;
    hash: string;
    timestamp: number;
    gasLimit: string;
    gasUsed: string;
    miner: string;
    transactionCount: number;
  }> {
    const cacheKey = `block:${chain}:${blockNumber}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const provider = this.getProvider(chain);
        const block = await provider.getBlock(blockNumber);
        
        if (!block) {
          throw new Error(`Block not found: ${blockNumber}`);
        }

        return {
          number: block.number,
          hash: block.hash || '',
          timestamp: block.timestamp,
          gasLimit: block.gasLimit.toString(),
          gasUsed: block.gasUsed.toString(),
          miner: block.miner || '',
          transactionCount: block.transactions.length,
        };
      } catch (error) {
        log.error(`Failed to get block ${blockNumber} on ${chain}:`, error);
        throw error;
      }
    }, blockNumber === 'latest' ? 5 : 3600); // Cache latest for 5s, others for 1 hour
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    from: string,
    to: string,
    value: string,
    data?: string,
    chain = 'ethereum'
  ): Promise<{
    gasLimit: string;
    estimatedCost: string;
    estimatedCostFormatted: string;
  }> {
    try {
      const provider = this.getProvider(chain);
      const chainData = this.chainInfo.get(chain.toLowerCase());
      
      if (!chainData) {
        throw new Error(`Chain info not found for: ${chain}`);
      }

      const tx = {
        from,
        to,
        value: ethers.parseEther(value),
        data: data || '0x',
      };

      const gasLimit = await provider.estimateGas(tx);
      const gasPrice = await this.getGasPrice(chain);
      
      const estimatedCost = gasLimit * BigInt(gasPrice.standard);
      const estimatedCostFormatted = ethers.formatEther(estimatedCost);

      return {
        gasLimit: gasLimit.toString(),
        estimatedCost: estimatedCost.toString(),
        estimatedCostFormatted,
      };
    } catch (error) {
      log.error(`Failed to estimate gas on ${chain}:`, error);
      throw error;
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    chain = 'ethereum'
  ): Promise<{
    balance: string;
    decimals: number;
    symbol: string;
    name: string;
  }> {
    const cacheKey = `token:${chain}:${tokenAddress}:${walletAddress}`;
    
    return cacheService.wrap(cacheKey, async () => {
      try {
        const provider = this.getProvider(chain);
        
        // ERC20 ABI for basic functions
        const erc20Abi = [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function symbol() view returns (string)',
          'function name() view returns (string)',
        ];

        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        
        const [balance, decimals, symbol, name] = await Promise.all([
          contract.balanceOf(walletAddress),
          contract.decimals(),
          contract.symbol(),
          contract.name(),
        ]);

        return {
          balance: balance.toString(),
          decimals,
          symbol,
          name,
        };
      } catch (error) {
        log.error(`Failed to get token balance for ${tokenAddress} on ${chain}:`, error);
        throw error;
      }
    }, 60); // Cache for 1 minute
  }

  /**
   * Get chain information
   */
  getChainInfo(chain: string): IChainInfo | undefined {
    return this.chainInfo.get(chain.toLowerCase());
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): string[] {
    return Array.from(this.chainInfo.keys());
  }

  /**
   * Validate address format
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Convert wei to ether
   */
  weiToEther(wei: string): string {
    return ethers.formatEther(wei);
  }

  /**
   * Convert ether to wei
   */
  etherToWei(ether: string): string {
    return ethers.parseEther(ether).toString();
  }
}

// Export singleton instance
export const web3Service = new Web3Service();