import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  port: process.env['PORT'] || 3000,
  nodeEnv: process.env['NODE_ENV'] || 'development',
  
  // Supabase Configuration
  supabase: {
    url: process.env['SUPABASE_URL']!,
    anonKey: process.env['SUPABASE_ANON_KEY']!,
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  },
  
  // OpenAI Configuration
  openai: {
    apiKey: process.env['OPENAI_API_KEY']!,
  },
  
  // AI Configuration
  ai: {
    rateLimitPerDay: parseInt(process.env['AI_RATE_LIMIT_PER_DAY'] || '10'),
    confidenceThreshold: parseFloat(process.env['AI_CONFIDENCE_THRESHOLD'] || '0.7'),
    maxFileSize: parseInt(process.env['AI_MAX_FILE_SIZE'] || '10485760'), // 10MB
    timeout: parseInt(process.env['AI_TIMEOUT'] || '30000'), // 30 seconds
  },
  
  // Storage Configuration - Single bucket approach
  storage: {
    bucket: process.env['STORAGE_BUCKET'] || 'reefey-photos',
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'image/heif',
      'image/webp'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'],
  },
  
  // Rate Limiting Configuration
  rateLimit: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 100, // limit each IP to 100 requests per windowMs
  },
  
  // CORS Configuration
  cors: {
    origin: process.env['NODE_ENV'] === 'production' 
      ? ['http://586b5915665f.ngrok-free.app', 'https://586b5915665f.ngrok-free.app'] 
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080', 'http://586b5915665f.ngrok-free.app', 'https://586b5915665f.ngrok-free.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
      'X-Platform',
      'Cache-Control',
      'Pragma'
    ],
    exposedHeaders: [
      'Content-Length',
      'Content-Range',
      'X-Total-Count',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset'
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
