# Reefey API Logging Guide

## Overview

The Reefey API now includes comprehensive request logging that provides detailed information about all incoming requests and responses. This logging system consists of two main components:

1. **Automatic Request Logging Middleware** - Logs all requests automatically
2. **Custom Logger Utility** - For manual logging in route handlers

## Automatic Request Logging

The `requestLogger` middleware automatically logs all incoming requests with detailed information:

### What Gets Logged Automatically:

- **Request Details:**
  - Timestamp
  - HTTP Method
  - URL
  - Protocol
  - Host
  - User Agent
  - IP Address
  - Headers (excluding sensitive ones like Authorization)
  - Query Parameters
  - Request Body (for non-GET requests)
  - Uploaded Files

- **Response Details:**
  - Response Time
  - Status Code
  - Content Length
  - Response Headers
  - Error Response Body (for 4xx/5xx status codes)

### Example Console Output:

```
📥 === INCOMING REQUEST ===
⏰ Timestamp: 2024-01-15T10:30:45.123Z
🌐 Method: POST
📍 URL: /api/ai/analyze-photo
🔗 Protocol: http
🌍 Host: localhost:3000
👤 User Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...
📱 IP Address: ::1
📋 Headers: {
  "content-type": "multipart/form-data; boundary=...",
  "accept": "application/json"
}
📦 Request Body: {
  "deviceId": "device123",
  "spotId": 1
}

📤 === RESPONSE SENT ===
⏱️  Response Time: 2450ms
📊 Status Code: 200
📏 Content Length: 1024
📋 Response Headers: {
  "content-type": "application/json",
  "content-length": "1024"
}
=== END REQUEST ===
```

## Custom Logger Utility

The `logger` utility provides structured logging functions for use in your route handlers:

### Available Log Levels:

- `logger.debug()` - Detailed debugging information
- `logger.info()` - General information
- `logger.warn()` - Warning messages
- `logger.error()` - Error messages

### Specialized Logging Methods:

- `logger.apiRequest()` - Log API requests
- `logger.apiResponse()` - Log API responses
- `logger.dbQuery()` - Log database queries
- `logger.dbResult()` - Log database results
- `logger.fileUpload()` - Log file uploads
- `logger.fileProcessed()` - Log file processing

### Usage Example:

```typescript
import { logger } from '../utils/logger';

router.get('/spots', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Log the incoming request
  logger.apiRequest('GET', '/api/spots', req.query);
  
  // Log database operations
  logger.dbQuery('SELECT', 'spots', { lat: req.query.lat, lng: req.query.lng });
  const result = await db.getSpots(params);
  logger.dbResult('SELECT', 'spots', { count: result.data.length });
  
  // Log the response
  const responseTime = Date.now() - startTime;
  logger.apiResponse('GET', '/api/spots', 200, responseTime);
  
  res.json(result);
}));
```

## Environment-Based Logging

The logging level is automatically adjusted based on the environment:

- **Development**: All log levels (DEBUG, INFO, WARN, ERROR)
- **Production**: INFO, WARN, ERROR only

## Configuration

The logging is configured in `src/config/global.ts` and can be customized by modifying:

- `config.nodeEnv` - Controls log level
- `config.rateLimit` - Affects request processing
- `config.cors` - Affects request headers

## Best Practices

1. **Use the logger utility** for consistent formatting and environment-based filtering
2. **Log at appropriate levels** - Use DEBUG for detailed info, INFO for general flow, WARN for issues, ERROR for problems
3. **Include relevant context** - Log parameters, results, and timing information
4. **Avoid logging sensitive data** - The middleware automatically excludes Authorization headers
5. **Use specialized methods** - Use `logger.apiRequest()` and `logger.apiResponse()` for API operations

## Troubleshooting

If you're not seeing logs:

1. Check that `NODE_ENV` is set correctly
2. Verify the middleware is properly imported in `src/index.ts`
3. Ensure console output is not being redirected
4. Check that the request is reaching your application

## Performance Impact

The logging middleware has minimal performance impact:
- Request logging adds ~1-5ms per request
- Response logging adds ~1-3ms per response
- The logger utility has negligible overhead

For high-traffic applications, consider adjusting log levels in production to reduce console output.
