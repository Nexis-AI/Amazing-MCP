import { Router } from 'express';
import { mcpController } from '../controllers/mcp.controller';
import { asyncHandler } from '../middleware/async-handler';
import { validateApiKey } from '../middleware/auth';
import { cacheService } from '../services/cache.service';

const router = Router();

// Main MCP endpoints
router.get('/', asyncHandler(mcpController.getMCP.bind(mcpController)));

// Emotion endpoints
router.get('/emotion', asyncHandler(mcpController.getEmotion.bind(mcpController)));
router.post('/emotion/update', validateApiKey, asyncHandler(mcpController.updateEmotion.bind(mcpController)));

// Memory endpoints
router.get('/memory/search', asyncHandler(mcpController.searchMemories.bind(mcpController)));
router.post('/memory', validateApiKey, asyncHandler(mcpController.addMemory.bind(mcpController)));

// Persona endpoints
router.get('/personas', asyncHandler(mcpController.getPersonas.bind(mcpController)));

// Context endpoints (to be implemented)
router.get('/context/search', asyncHandler(async (req, res) => {
  res.json({ message: 'Context search endpoint - to be implemented' });
}));

// Integration endpoints (to be implemented)
router.get('/web3/balance/:address', asyncHandler(async (req, res) => {
  res.json({ message: 'Web3 balance endpoint - to be implemented', address: req.params.address });
}));

router.get('/crypto-prices', asyncHandler(async (req, res) => {
  res.json({ message: 'Crypto prices endpoint - to be implemented' });
}));

router.get('/defi/swap', asyncHandler(async (req, res) => {
  res.json({ message: 'DeFi swap endpoint - to be implemented' });
}));

router.get('/nft/metadata/:contract/:tokenId', asyncHandler(async (req, res) => {
  res.json({ 
    message: 'NFT metadata endpoint - to be implemented',
    contract: req.params.contract,
    tokenId: req.params.tokenId,
  });
}));

// Cache management endpoints
router.get('/cache/stats', asyncHandler(async (req, res) => {
  const stats = cacheService.getStats();
  const memoryStats = cacheService.getMemoryStats();
  res.json({
    ...stats,
    memory: memoryStats,
    enabled: cacheService.isEnabled(),
  });
}));

router.delete('/cache/clear', validateApiKey, asyncHandler(async (req, res) => {
  cacheService.clear();
  res.json({ success: true, message: 'Cache cleared successfully' });
}));

router.delete('/cache/:key', validateApiKey, asyncHandler(async (req, res) => {
  const success = cacheService.delete(req.params.key);
  res.json({ 
    success, 
    message: success ? 'Key deleted successfully' : 'Key not found',
  });
}));

export default router;