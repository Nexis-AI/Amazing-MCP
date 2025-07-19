import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { log } from '../utils/logger';
import { IErrorResponse } from '../types/mcp.types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: string | undefined;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    details = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    log.warn(`Validation error: ${details}`);
  }
  // Handle custom AppError
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    if (!err.isOperational) {
      log.error(`Operational error: ${err.message}`, err.stack);
    }
  }
  // Handle other errors
  else {
    log.error(`Unexpected error: ${err.message}`, err.stack);
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred';
    } else {
      message = err.message;
      details = err.stack;
    }
  }

  const errorResponse: IErrorResponse = {
    code: statusCode,
    message,
    details,
    timestamp: new Date(),
  };

  res.status(statusCode).json(errorResponse);
};