import { Request, Response } from 'express';
import { ApiResponse } from '../types/chat.js';

export const healthCheck = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  };
  
  res.json(response);
}; 