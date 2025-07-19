"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = void 0;
// Test setup file
const dotenv_safe_1 = __importDefault(require("dotenv-safe"));
// Load test environment variables
dotenv_safe_1.default.config({
    example: '.env.example',
    path: '.env.test',
});
// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
// Mock console methods to reduce noise
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Increase test timeout for integration tests
jest.setTimeout(10000);
// Global test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.delay = delay;
// Clean up after tests
afterAll(async () => {
    // Close any open handles
    await new Promise(resolve => setTimeout(resolve, 500));
});
//# sourceMappingURL=setup.js.map