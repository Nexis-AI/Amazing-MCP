import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

interface RequestWithStartTime extends Request {
  startTime?: number;
}

export const requestLogger = (req: RequestWithStartTime, res: Response, next: NextFunction): void => {
  // Record start time
  req.startTime = Date.now();

  // Log request
  log.http(`${req.method} ${req.path} - ${req.ip}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const message = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      log.warn(message);
    } else {
      log.http(message);
    }
  });

  next();
};