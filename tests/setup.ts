// Test setup file
import dotenv from 'dotenv-safe';

// Suppress dotenv logs in tests
const originalLog = console.log;
console.log = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('[dotenv@')) {
    return;
  }
  originalLog(...args);
};

// Load test environment variables
dotenv.config({
  example: '.env.example',
  path: '.env.test',
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Ensure API_KEY is set for tests
if (!process.env.API_KEY) {
  process.env.API_KEY = 'test_api_key';
}

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
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Clean up after tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});