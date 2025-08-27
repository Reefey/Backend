import { config } from '../config/global';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private getLogLevel(): LogLevel {
    switch (config.nodeEnv) {
      case 'development':
        return LogLevel.DEBUG;
      case 'production':
        return LogLevel.INFO;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.getLogLevel();
  }

  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`🔍 [DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`ℹ️  [INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.log(`⚠️  [WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`❌ [ERROR] ${message}`, error ? JSON.stringify(error, null, 2) : '');
    }
  }

  // Special logging for API operations
  apiRequest(method: string, url: string, params?: any) {
    this.info(`API Request: ${method} ${url}`, params);
  }

  apiResponse(method: string, url: string, statusCode: number, responseTime?: number) {
    const emoji = statusCode >= 400 ? '❌' : '✅';
    this.info(`${emoji} API Response: ${method} ${url} - ${statusCode}${responseTime ? ` (${responseTime}ms)` : ''}`);
  }

  // Database operations logging
  dbQuery(operation: string, table?: string, params?: any) {
    this.debug(`DB Query: ${operation}${table ? ` on ${table}` : ''}`, params);
  }

  dbResult(operation: string, table?: string, result?: any) {
    this.debug(`DB Result: ${operation}${table ? ` on ${table}` : ''}`, result);
  }

  // File operations logging
  fileUpload(filename: string, size: number, type: string) {
    this.info(`📁 File Upload: ${filename} (${size} bytes, ${type})`);
  }

  fileProcessed(filename: string, operation: string) {
    this.info(`✅ File Processed: ${filename} - ${operation}`);
  }
}

export const logger = new Logger();
