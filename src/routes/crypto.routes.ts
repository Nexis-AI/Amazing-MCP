import { Router } from 'express';
import { cryptoController } from '../controllers/crypto.controller';
import { asyncHandler } from '../middleware/async-handler';
import { validateApiKey } from '../middleware/auth';

const router = Router();

// Price endpoints
router.get('/price/:coinId', asyncHandler(cryptoController.getPrice.bind(cryptoController)));
router.post('/prices', asyncHandler(cryptoController.getMultiplePrices.bind(cryptoController)));

// Historical data
router.get('/historical/:coinId', asyncHandler(cryptoController.getHistoricalPrices.bind(cryptoController)));

// Market data
router.get('/trending', asyncHandler(cryptoController.getTrending.bind(cryptoController)));
router.get('/global', asyncHandler(cryptoController.getGlobalData.bind(cryptoController)));

// Search
router.get('/search', asyncHandler(cryptoController.searchCoins.bind(cryptoController)));

// Watchlist
router.get('/watchlist', asyncHandler(cryptoController.getWatchlist.bind(cryptoController)));
router.post('/watchlist', validateApiKey, asyncHandler(cryptoController.addToWatchlist.bind(cryptoController)));
router.delete('/watchlist/:coinId', validateApiKey, asyncHandler(cryptoController.removeFromWatchlist.bind(cryptoController)));

// Utility
router.get('/currencies', asyncHandler(cryptoController.getSupportedCurrencies.bind(cryptoController)));

// Real-time updates control
router.post('/realtime/:action', validateApiKey, asyncHandler(cryptoController.controlRealTimeUpdates.bind(cryptoController)));

export default router;