import { Request, Response, NextFunction } from 'express';

export const corsMiddleware = (req: any, res: any, next: any): void => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
}; 