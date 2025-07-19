import { Router } from 'express';
import { web3Controller } from '../controllers/web3.controller';
import { asyncHandler } from '../middleware/async-handler';
import { validateApiKey } from '../middleware/auth';

const router = Router();

// Get supported chains
router.get('/chains', asyncHandler(web3Controller.getSupportedChains.bind(web3Controller)));

// Balance endpoints
router.get('/balance/:address', asyncHandler(web3Controller.getBalance.bind(web3Controller)));

// Transaction endpoints
router.get('/transaction/:txHash', asyncHandler(web3Controller.getTransaction.bind(web3Controller)));

// Block endpoints
router.get('/block/:blockNumber', asyncHandler(web3Controller.getBlock.bind(web3Controller)));

// Gas endpoints
router.get('/gas-price', asyncHandler(web3Controller.getGasPrice.bind(web3Controller)));
router.post('/estimate-gas', validateApiKey, asyncHandler(web3Controller.estimateGas.bind(web3Controller)));

// Token endpoints
router.get('/token/:tokenAddress/balance/:walletAddress', 
  asyncHandler(web3Controller.getTokenBalance.bind(web3Controller))
);

// Utility endpoints
router.get('/validate/:address', asyncHandler(web3Controller.validateAddress.bind(web3Controller)));
router.post('/convert', asyncHandler(web3Controller.convertUnits.bind(web3Controller)));

export default router;