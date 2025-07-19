import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
  // File transport for errors
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for morgan
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Export logger methods with additional context
export const log = {
  error: (message: string, meta?: unknown): void => {
    logger.error(message, meta);
  },
  warn: (message: string, meta?: unknown): void => {
    logger.warn(message, meta);
  },
  info: (message: string, meta?: unknown): void => {
    logger.info(message, meta);
  },
  http: (message: string, meta?: unknown): void => {
    logger.http(message, meta);
  },
  debug: (message: string, meta?: unknown): void => {
    logger.debug(message, meta);
  },
};

export default logger;