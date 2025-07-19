import request from 'supertest';
import { web3Controller } from '../../src/controllers/web3.controller';
import { web3Service } from '../../src/services/web3.service';
import { AppError } from '../../src/middleware/error-handler';

// Import app after mocking to ensure mocks are in place
let app: any;

// Mock dependencies
jest.mock('../../src/services/web3.service');
jest.mock('../../src/utils/logger');

describe('Web3 Controller', () => {
  beforeAll(() => {
    // Mock web3 service initialization
    (web3Service.initialize as jest.Mock).mockResolvedValue(undefined);
    // Import app after environment is setup
    app = require('../../src/index').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Set API key for auth middleware if needed
    process.env.API_KEY = 'test_api_key';
    
    // Setup common mocks
    (web3Service.isValidAddress as jest.Mock).mockImplementation((address) => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    });
  });

  describe('GET /api/web3/balance/:address', () => {
    const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b890';
    
    it('should return balance for valid address', async () => {
      const mockBalance = {
        balance: '1000000000000000000',
        formatted: '1.0',
        symbol: 'ETH',
      };

      (web3Service.getBalance as jest.Mock).mockResolvedValue(mockBalance);

      const response = await request(app)
        .get(`/api/web3/balance/${validAddress}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        address: validAddress,
        chain: 'ethereum',
        ...mockBalance,
      });
      expect(web3Service.getBalance).toHaveBeenCalledWith(validAddress, 'ethereum');
    });

    it('should support different chains', async () => {
      const mockBalance = {
        balance: '500000000000000000',
        formatted: '0.5',
        symbol: 'BNB',
      };

      (web3Service.getBalance as jest.Mock).mockResolvedValue(mockBalance);

      const response = await request(app)
        .get(`/api/web3/balance/${validAddress}?chain=bsc`)
        .expect(200);

      expect(response.body.chain).toBe('bsc');
      expect(web3Service.getBalance).toHaveBeenCalledWith(validAddress, 'bsc');
    });

    it('should reject invalid address', async () => {
      const response = await request(app)
        .get('/api/web3/balance/invalid-address')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('Invalid Ethereum address');
    });
  });

  describe('GET /api/web3/transaction/:txHash', () => {
    const validTxHash = '0x' + 'a'.repeat(64);
    
    it('should return transaction details', async () => {
      const mockTransaction = {
        hash: validTxHash,
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b890',
        to: '0x0000000000000000000000000000000000000000',
        value: '1000000000000000000',
        gasPrice: '20000000000',
        gasLimit: '21000',
        nonce: 5,
        blockNumber: 12345678,
        status: 1,
      };

      (web3Service.getTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      const response = await request(app)
        .get(`/api/web3/transaction/${validTxHash}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        chain: 'ethereum',
        transaction: mockTransaction,
      });
      expect(web3Service.getTransaction).toHaveBeenCalledWith(validTxHash, 'ethereum');
    });

    it('should return 404 for non-existent transaction', async () => {
      (web3Service.getTransaction as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/web3/transaction/${validTxHash}`)
        .expect(404);

      expect(response.body.message).toBe('Transaction not found');
    });

    it('should reject invalid transaction hash', async () => {
      const response = await request(app)
        .get('/api/web3/transaction/invalid-hash')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('Invalid transaction hash');
    });
  });

  describe('GET /api/web3/block/:blockNumber', () => {
    it('should return block by number', async () => {
      const mockBlock = {
        number: 12345678,
        hash: '0x' + 'b'.repeat(64),
        timestamp: 1640995200,
        gasLimit: '15000000',
        gasUsed: '14000000',
        miner: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b890',
        transactionCount: 150,
      };

      (web3Service.getBlock as jest.Mock).mockResolvedValue(mockBlock);

      const response = await request(app)
        .get('/api/web3/block/12345678')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        chain: 'ethereum',
        block: mockBlock,
      });
      expect(web3Service.getBlock).toHaveBeenCalledWith(12345678, 'ethereum');
    });

    it('should support latest block', async () => {
      const mockBlock = {
        number: 12345679,
        hash: '0x' + 'c'.repeat(64),
        timestamp: 1640995300,
      };

      (web3Service.getBlock as jest.Mock).mockResolvedValue(mockBlock);

      const response = await request(app)
        .get('/api/web3/block/latest')
        .expect(200);

      expect(web3Service.getBlock).toHaveBeenCalledWith('latest', 'ethereum');
    });

    it('should validate block number', async () => {
      const response = await request(app)
        .get('/api/web3/block/invalid')
        .expect(400);

      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('GET /api/web3/gas-price', () => {
    it('should return gas price', async () => {
      const mockGasPrice = {
        standard: '20000000000',
        fast: '25000000000',
        instant: '30000000000',
        formatted: {
          standard: '20',
          fast: '25',
          instant: '30',
        },
      };

      (web3Service.getGasPrice as jest.Mock).mockResolvedValue(mockGasPrice);

      const response = await request(app)
        .get('/api/web3/gas-price')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        chain: 'ethereum',
        gasPrice: mockGasPrice,
      });
      expect(web3Service.getGasPrice).toHaveBeenCalledWith('ethereum');
    });

    it('should support different chains', async () => {
      (web3Service.getGasPrice as jest.Mock).mockResolvedValue({
        standard: '5000000000',
        fast: '6000000000',
        instant: '7000000000',
      });

      const response = await request(app)
        .get('/api/web3/gas-price?chain=polygon')
        .expect(200);

      expect(response.body.chain).toBe('polygon');
      expect(web3Service.getGasPrice).toHaveBeenCalledWith('polygon');
    });
  });

  describe('POST /api/web3/estimate-gas', () => {
    const validRequest = {
      from: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b890',
      to: '0x0000000000000000000000000000000000000000',
      value: '1000000000000000000',
    };

    it('should estimate gas for transaction', async () => {
      const mockEstimate = {
        gasLimit: '21000',
        gasPrice: '20000000000',
        totalCost: '420000000000000',
        totalCostFormatted: '0.00042',
      };

      (web3Service.estimateGas as jest.Mock).mockResolvedValue(mockEstimate);

      const response = await request(app)
        .post('/api/web3/estimate-gas')
        .send(validRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        chain: 'ethereum',
        ...mockEstimate,
      });
      expect(web3Service.estimateGas).toHaveBeenCalledWith(
        validRequest.from,
        validRequest.to,
        validRequest.value,
        undefined,
        'ethereum'
      );
    });

    it('should support data field', async () => {
      const requestWithData = {
        ...validRequest,
        data: '0x123456',
      };

      (web3Service.estimateGas as jest.Mock).mockResolvedValue({
        gasLimit: '50000',
      });

      await request(app)
        .post('/api/web3/estimate-gas')
        .send(requestWithData)
        .expect(200);

      expect(web3Service.estimateGas).toHaveBeenCalledWith(
        validRequest.from,
        validRequest.to,
        validRequest.value,
        '0x123456',
        'ethereum'
      );
    });

    it('should validate addresses', async () => {
      const invalidRequest = {
        from: 'invalid-address',
        to: validRequest.to,
        value: validRequest.value,
      };

      const response = await request(app)
        .post('/api/web3/estimate-gas')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('Invalid from address');
    });
  });

  describe('GET /api/web3/token-balance/:tokenAddress/:walletAddress', () => {
    const tokenAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b890';
    const walletAddress = '0x0000000000000000000000000000000000000001';

    it('should return token balance', async () => {
      const mockBalance = {
        balance: '1000000000000000000000',
        formatted: '1000.0',
        decimals: 18,
        symbol: 'USDT',
      };

      (web3Service.getTokenBalance as jest.Mock).mockResolvedValue(mockBalance);

      const response = await request(app)
        .get(`/api/web3/token-balance/${tokenAddress}/${walletAddress}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        chain: 'ethereum',
        tokenAddress,
        walletAddress,
        ...mockBalance,
      });
      expect(web3Service.getTokenBalance).toHaveBeenCalledWith(
        tokenAddress,
        walletAddress,
        'ethereum'
      );
    });

    it('should validate token address', async () => {
      const response = await request(app)
        .get(`/api/web3/token-balance/invalid-address/${walletAddress}`)
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('Invalid token address');
    });

    it('should validate wallet address', async () => {
      const response = await request(app)
        .get(`/api/web3/token-balance/${tokenAddress}/invalid-address`)
        .expect(400);

      expect(response.body.message).toBe('Validation error');
      expect(response.body.details).toContain('Invalid wallet address');
    });
  });

  describe('GET /api/web3/chains', () => {
    it('should return supported chains', async () => {
      const mockChains = ['ethereum', 'polygon', 'bsc'];
      const mockChainInfo = {
        chainId: 1,
        name: 'Ethereum Mainnet',
        symbol: 'ETH',
        decimals: 18,
        rpcUrl: 'https://mainnet.infura.io/v3/demo',
        blockExplorerUrl: 'https://etherscan.io',
      };

      (web3Service.getSupportedChains as jest.Mock).mockReturnValue(mockChains);
      (web3Service.getChainInfo as jest.Mock).mockReturnValue(mockChainInfo);

      const response = await request(app)
        .get('/api/web3/chains')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.chains).toHaveLength(3);
      expect(response.body.chains[0]).toEqual({
        id: 'ethereum',
        ...mockChainInfo,
      });
    });
  });

  describe('GET /api/web3/validate/:address', () => {
    it('should validate valid address', async () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b890';

      const response = await request(app)
        .get(`/api/web3/validate/${validAddress}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        address: validAddress,
        isValid: true,
      });
    });

    it('should reject invalid address', async () => {
      const response = await request(app)
        .get('/api/web3/validate/invalid-address')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        address: 'invalid-address',
        isValid: false,
      });
    });
  });

  describe('POST /api/web3/convert', () => {
    it('should convert wei to ether', async () => {
      (web3Service.weiToEther as jest.Mock).mockReturnValue('1.0');

      const response = await request(app)
        .post('/api/web3/convert')
        .send({
          value: '1000000000000000000',
          from: 'wei',
          to: 'ether',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        value: '1000000000000000000',
        from: 'wei',
        to: 'ether',
        result: '1.0',
      });
      expect(web3Service.weiToEther).toHaveBeenCalledWith('1000000000000000000');
    });

    it('should convert ether to wei', async () => {
      (web3Service.etherToWei as jest.Mock).mockReturnValue('1000000000000000000');

      const response = await request(app)
        .post('/api/web3/convert')
        .send({
          value: '1',
          from: 'ether',
          to: 'wei',
        })
        .expect(200);

      expect(response.body.result).toBe('1000000000000000000');
      expect(web3Service.etherToWei).toHaveBeenCalledWith('1');
    });

    it('should reject invalid conversion', async () => {
      const response = await request(app)
        .post('/api/web3/convert')
        .send({
          value: '100',
          from: 'gwei',
          to: 'ether',
        })
        .expect(400);

      expect(response.body.message).toBe('Invalid conversion. Supported: wei<->ether');
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      (web3Service.getBalance as jest.Mock).mockRejectedValue(
        new Error('RPC connection failed')
      );

      const response = await request(app)
        .get('/api/web3/balance/0x742d35Cc6634C0532925a3b844Bc9e7595f5b890')
        .expect(500);

      expect(response.body.message).toBe('RPC connection failed');
    });

    it('should handle initialization errors', async () => {
      // This is already handled in the constructor
      expect(web3Service.initialize).toHaveBeenCalled();
    });
  });
});