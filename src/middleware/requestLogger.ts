import { Request, Response, NextFunction } from 'express';

interface LoggedRequest extends Request {
  startTime?: number;
}

// Helper function to filter sensitive data from body
const filterSensitiveData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'api_key', 'apiKey'];
  const filtered = { ...obj };
  
  for (const field of sensitiveFields) {
    if (filtered[field]) {
      filtered[field] = '[REDACTED]';
    }
  }
  
  return filtered;
};

export const requestLogger = (req: LoggedRequest, res: Response, next: NextFunction) => {
  // Store start time for calculating response time
  req.startTime = Date.now();

  // Log request details
  console.log('\n📥 === INCOMING REQUEST ===');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);
  console.log(`📍 URL: ${req.originalUrl}`);
  console.log(`🔗 Protocol: ${req.protocol}`);
  console.log(`🌍 Host: ${req.get('host')}`);
  console.log(`👤 User Agent: ${req.get('user-agent')}`);
  console.log(`📱 IP Address: ${req.ip || req.connection.remoteAddress}`);
  
  // Log headers (excluding sensitive ones)
  const headers = { ...req.headers };
  delete headers.authorization;
  delete headers.cookie;
  // console.log(`📋 Headers:`, JSON.stringify(headers, null, 2));
  
  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log(`🔍 Query Parameters:`, JSON.stringify(req.query, null, 2));
  }
  
  // Enhanced body logging for all request types
  if (req.body) {
    const bodyKeys = Object.keys(req.body);
    if (bodyKeys.length > 0) {
      const filteredBody = filterSensitiveData(req.body);
      console.log(`📦 Request Body (${bodyKeys.length} fields):`, JSON.stringify(filteredBody, null, 2));
      
      // Log body size information
      const bodyString = JSON.stringify(req.body);
      console.log(`📏 Body Size: ${bodyString.length} characters`);
    } else {
      console.log(`📦 Request Body: {} (empty)`);
    }
  } else {
    console.log(`📦 Request Body: undefined/null`);
  }
  

  
  // Log files if present
  if (req.files) {
    const fileInfo = Array.isArray(req.files) 
      ? req.files.map((file: any) => ({
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        }))
      : Object.keys(req.files).map(key => ({
          fieldname: key,
          originalname: (req.files as any)[key].originalname,
          mimetype: (req.files as any)[key].mimetype,
          size: (req.files as any)[key].size
        }));
    
    console.log(`📎 Files (${fileInfo.length}):`, JSON.stringify(fileInfo, null, 2));
  }

  // Override res.end to log response details
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const responseTime = Date.now() - (req.startTime || 0);
    
    console.log('\n📤 === RESPONSE SENT ===');
    console.log(`⏱️  Response Time: ${responseTime}ms`);
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📏 Content Length: ${res.get('content-length') || 'unknown'}`);
    // console.log(`📋 Response Headers:`, JSON.stringify(res.getHeaders(), null, 2));
    
    // Log response body for errors or specific status codes
    if (res.statusCode >= 400) {
      const responseBody = chunk?.toString() || 'No error body';
      console.log(`❌ Error Response:`, responseBody);
    } else if (res.statusCode >= 200 && res.statusCode < 400) {
      // Log successful response body (truncated for large responses)
      const responseBody = chunk?.toString() || '';
      if (responseBody.length > 0) {
        const truncatedBody = responseBody.length > 500 
          ? responseBody.substring(0, 500) + '... [TRUNCATED]'
          : responseBody;
        console.log(`✅ Response Body:`, truncatedBody);
      }
    }
    
    console.log('=== END REQUEST ===\n');
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Custom Morgan format for additional logging
export const morganFormat = ':method :url :status :res[content-length] - :response-time ms - :remote-addr - :user-agent';
