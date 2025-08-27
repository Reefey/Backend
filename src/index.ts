import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from './config/global';
import { swaggerOptions } from './utils/swagger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import spotsRoutes from './routes/spots';
import marineRoutes from './routes/marine';
import collectionsRoutes from './routes/collections';
import intelligenceRoutes from './routes/intelligence';
import systemRoutes from './routes/system';

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Create Express app
const app = express();

// Security middleware - disable CSP for development to avoid conflicts
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS middleware
app.use(cors(config.cors));

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use('/api/', limiter);

// Morgan logging middleware (additional)
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom request logging middleware (after body parsing)
app.use(requestLogger);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api/spots', spotsRoutes);
app.use('/api/marine', marineRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/ai', intelligenceRoutes);
app.use('/api', systemRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Reefey API - Marine Life Identification',
    version: '1.0.0',
    documentation: '/api-docs',
    health: '/api/health'
  });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    app.listen(config.port, () => {
      const baseUrl = config.nodeEnv === 'production' 
        ? 'https://586b5915665f.ngrok-free.app'
        : `http://localhost:${config.port}`;
      
      console.log(`🚀 Reefey API server running on port ${config.port}`);
      console.log(`📚 API Documentation: ${baseUrl}/api-docs`);
      console.log(`🏥 Health Check: ${baseUrl}/api/health`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
startServer();

export default app;
