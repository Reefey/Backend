import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/model';

// Custom error class
export class CustomError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (
  err: Error | CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: _req.url,
    method: _req.method,
    timestamp: new Date().toISOString()
  });

  // Supabase errors
  if (err.message.includes('duplicate key')) {
    const message = 'Resource already exists';
    error = new CustomError(message, 409, 'DUPLICATE_ERROR');
  }

  if (err.message.includes('foreign key')) {
    const message = 'Referenced resource not found';
    error = new CustomError(message, 400, 'FOREIGN_KEY_ERROR');
  }

  // Validation errors
  if (err.message.includes('validation')) {
    const message = 'Validation failed';
    error = new CustomError(message, 400, 'VALIDATION_ERROR');
  }

  // File upload errors
  if (err.message.includes('File size exceeds')) {
    const message = 'File too large';
    error = new CustomError(message, 400, 'FILE_SIZE_ERROR');
  }

  if (err.message.includes('File type') || err.message.includes('File extension')) {
    const message = 'Invalid file type';
    error = new CustomError(message, 400, 'FILE_TYPE_ERROR');
  }

  // AI service errors
  if (err.message.includes('AI analysis failed') || err.message.includes('OpenAI')) {
    const message = 'AI service temporarily unavailable';
    error = new CustomError(message, 503, 'AI_SERVICE_ERROR');
  }

  // Rate limit errors
  if (err.message.includes('Rate limit exceeded')) {
    const message = 'Rate limit exceeded';
    error = new CustomError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Storage errors
  if (err.message.includes('Storage upload failed') || err.message.includes('Storage delete failed')) {
    const message = 'File storage error';
    error = new CustomError(message, 500, 'STORAGE_ERROR');
  }

  // Database errors
  if (err.message.includes('Database') || err.message.includes('Supabase')) {
    const message = 'Database operation failed';
    error = new CustomError(message, 500, 'DATABASE_ERROR');
  }

  // Default error
  if (!(error instanceof CustomError)) {
    error = new CustomError('Internal server error', 500, 'INTERNAL_ERROR');
  }

  const customError = error as CustomError;

  res.status(customError.statusCode).json({
    success: false,
    error: customError.message,
    code: customError.code,
    ...(customError.code === 'RATE_LIMIT_EXCEEDED' && {
      retryAfter: 86400, // 24 hours
      dailyLimit: 10,
      usedToday: 10
    })
  });
};

// Not found middleware
export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
