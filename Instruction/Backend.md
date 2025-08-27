# Reefey Backend Implementation Guide

## Overview
Reefey is a marine life identification API that uses AI to identify marine species from photos. This document serves as the single source of truth for the complete backend implementation.

## Core Features

### 1. Marine Life Identification
- **AI-Powered Analysis**: Uses OpenAI GPT-4 Vision API for species detection
- **Multi-Species Detection**: Identifies multiple species in a single image
- **Bounding Box Generation**: Provides coordinates for each detected species
- **Confidence Scoring**: Returns confidence levels for each identification
- **Database Integration**: Links identifications to existing marine database

### 2. Snorkeling Spots Management
- **Location-Based Search**: Find spots by coordinates and radius
- **Marine Species Mapping**: Each spot shows what species can be found there
- **Difficulty Ratings**: Easy, Medium, Hard classifications
- **Seasonal Information**: When species are typically found

### 3. Marine Species Database
- **Comprehensive Catalog**: 30+ species with detailed information
- **Scientific Data**: Size, habitat, diet, behavior, danger levels
- **Conservation Status**: Endangered status and fun facts
- **Image Storage**: Each species can have reference images

### 4. User Collections
- **Personal Findings**: Users track their marine life discoveries
- **Photo Management**: Store multiple photos per species
- **Location Tracking**: GPS coordinates and spot associations
- **AI Integration**: Automatic species identification and database linking

## Architecture

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: OpenAI GPT-4 Vision API
- **Image Processing**: Sharp for format conversion, Canvas for annotations

### Project Structure
```
src/
├── config/          # Configuration and environment
├── middleware/      # Request validation and error handling
├── routes/          # API endpoints
├── services/        # Business logic (AI, database)
├── types/           # TypeScript type definitions
├── utils/           # Utilities (database, storage)
└── index.ts         # Application entry point
```

## Database Schema

### Core Tables
```sql
-- Snorkeling spots
spots (
  id, name, lat, lng, description, difficulty, best_time, created_at, updated_at
)

-- Master marine species database
marine (
  id, name, scientific_name, category, rarity, size_min_cm, size_max_cm, 
  habitat_type, diet, behavior, danger, venomous, description, 
  life_span, reproduction, migration, endangered, fun_fact, image_url,
  created_at, updated_at
)

-- Junction table linking spots and marine species
spot_marine (
  id, spot_id, marine_id, frequency, seasonality, notes, created_at
)

-- User collections (references marine table)
collections (
  id, device_id, marine_id, status, first_seen, last_seen, created_at, updated_at
)

-- Individual photos in collections
collection_photos (
  id, collection_id, url, annotated_url, date_found, spot_id, lat, lng,
  confidence, bounding_box, notes, storage_bucket, file_path, file_size,
  mime_type, created_at
)
```

## API Endpoints

### Spots Management
- `GET /api/spots` - Get spots with filtering and pagination
- `GET /api/spots/:id` - Get detailed spot information with marine species
- `POST /api/spots` - Create new snorkeling spot
- `DELETE /api/spots/:id` - Delete snorkeling spot

### Marine Species
- `GET /api/marine` - Get marine species with filtering and pagination
- `GET /api/marine/:id` - Get detailed species information with spots
- `POST /api/marine` - Add new marine species
- `DELETE /api/marine/:id` - Delete marine species

### Collections
- `GET /api/collections/:deviceId` - Get user's collection with filtering
- `POST /api/collections/:deviceId` - Add new finding to collection
- `POST /api/collections/:deviceId/:collectionId` - Add photo to existing collection
- `DELETE /api/collections/:id` - Delete finding from collection

### AI Intelligence
- `POST /api/ai/analyze-photo` - Analyze photo for marine life identification
- `POST /api/ai/analyze-photo-url` - Analyze photo from URL

### System
- `GET /api/stats` - Get comprehensive system statistics
- `GET /api/health` - Health check endpoint

## File Storage

### Storage Bucket
- **reefey-photos**: Single bucket for all images (original and processed)

### File Organization
```
reefey-photos/
├── collections/{deviceId}/{species}/
│   ├── photo1.jpg                    # Original photo
│   ├── photo1_annotated.jpg          # AI-annotated version
│   └── photo2.jpg
├── marine/{marineId}/
│   ├── clownfish.jpg                 # Reference image
│   └── clownfish_preview.jpg         # Preview version
└── spots/{spotId}/
    └── spot1.jpg
```

### Storage URL Generation
All storage URLs follow this pattern:
```
https://{project-id}.supabase.co/storage/v1/object/public/reefey-photos/{file-path}
```

**Examples:**
- Marine image: `https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/marine/1/clownfish.jpg`
- Collection photo: `https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg`
- Annotated image: `https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg`

### Image Processing
- **Format Conversion**: HEIC/WebP → JPEG using Sharp
- **Annotation**: Bounding boxes drawn on images using Canvas
- **File Validation**: Type, size, and content validation
- **Unique Naming**: Timestamp + random string for uniqueness

## AI Processing Pipeline

### 1. Image Validation
- Check file type (JPEG, PNG, HEIC, WebP)
- Validate file size (max 50MB)
- Extract metadata (GPS, timestamp)

### 2. Image Preprocessing
- Convert to JPEG format
- Optimize for AI processing
- Preserve metadata

### 3. AI Analysis
- Send to OpenAI GPT-4 Vision API
- Use structured prompt for marine identification
- Parse JSON response with species data

### 4. Database Processing
- Search existing marine database
- Create new species if not found
- Link to "unknown" if AI can't identify

### 5. Image Annotation
- Generate annotated image with bounding boxes
- Color-code different species
- Add confidence scores to labels

### 6. Collection Creation
- Create collection entries for each species
- Store photos with metadata
- Update collection statistics

## Security & Performance

### Authentication
- **Simple Device ID**: No JWT tokens, device ID validation only
- **Stateless Design**: No session management required
- **Public Storage**: reefey-photos bucket is publicly accessible

### Rate Limiting
- **AI Analysis**: 10 requests per day per device
- **API Endpoints**: 100 requests per 24 hours per IP
- **In-Memory Storage**: No Redis required

### File Security
- **Type Validation**: Strict MIME type checking
- **Size Limits**: 50MB maximum file size
- **Content Validation**: Image content verification
- **Sanitized Names**: Safe filename generation

## Environment Variables

### Required Variables
```env
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# AI Configuration
AI_RATE_LIMIT_PER_DAY=10
AI_CONFIDENCE_THRESHOLD=0.7
AI_MAX_FILE_SIZE=52428800
AI_TIMEOUT=30000
```

### Optional Variables
```env
# Storage (single bucket)
STORAGE_BUCKET=reefey-photos

# CORS (auto-configured for development/production)
```

## Data Import & Mapping

### CSV to Database Field Mapping
The original CSV data has been converted and included in the `Database-Data.sql` file. Here's the mapping used:

```sql
-- CSV Column → Database Field
Common name → name
Scientific name → scientific_name
Category → category
Rarity in Bali → rarity (converted to 1-5 scale)
Size ranges → size_min_cm, size_max_cm
Habitats → habitat_type (as TEXT array)
What it eats → diet
Behavior patterns → behavior
Danger (level & why) → danger
Venomous? → venomous
Life span → life_span
Reproduction → reproduction
Migration patterns → migration
Endangered? → endangered
Fun fact → fun_fact
```

### Data Conversion Notes
- **Rarity Scale**: Converted from text descriptions to 1-5 numeric scale
- **Size Ranges**: Parsed from text descriptions to min/max cm values
- **Habitats**: Converted comma-separated text to PostgreSQL TEXT arrays
- **Danger Levels**: Standardized to 'Low', 'Medium', 'High', 'Extreme'
- **Boolean Fields**: Converted 'Yes'/'No' to true/false

## Implementation Checklist

### 1. Database Setup
- [ ] Run Database-Schema.sql script in Supabase
- [ ] Run Database-Data.sql script in Supabase
- [ ] Create storage bucket with correct permissions
- [ ] Verify all tables and indexes created
- [ ] Check sample data inserted correctly

### 2. Environment Configuration
- [ ] Set all required environment variables
- [ ] Test Supabase connection
- [ ] Test OpenAI API connection
- [ ] Verify file upload limits

### 3. API Implementation
- [ ] Implement all route handlers
- [ ] Add request validation middleware
- [ ] Implement error handling
- [ ] Add rate limiting
- [ ] Test all endpoints

### 4. File Processing
- [ ] Implement image format conversion
- [ ] Add annotation generation
- [ ] Test file upload and storage
- [ ] Verify URL generation

### 5. AI Integration
- [ ] Implement OpenAI API calls
- [ ] Add rate limiting for AI requests
- [ ] Test species detection
- [ ] Verify database integration

### 6. Testing & Deployment
- [ ] Test all API endpoints
- [ ] Verify file operations
- [ ] Test AI identification
- [ ] Deploy to production

## API Response Examples

### Marine Species Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Clownfish",
    "scientificName": "Amphiprion ocellaris",
    "category": "Fishes",
    "rarity": 2,
    "sizeMinCm": 6.0,
    "sizeMaxCm": 11.0,
    "habitatType": ["Coral Reefs", "Anemones"],
    "diet": "Plankton, small inverts, algae",
    "behavior": "Social",
    "danger": "Low",
    "venomous": false,
    "description": "The iconic clownfish...",
    "marineImage": "https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/marine/1/clownfish.jpg",
    "lifeSpan": "6-10 years",
    "reproduction": "Eggs near anemone; male guards",
    "migration": "Site-attached to host",
    "endangered": "Least Concern",
    "funFact": "Sequential hermaphrodites"
  }
}
```

### AI Analysis Response
```json
{
  "success": true,
  "data": {
    "detections": [
      {
        "species": "Clownfish",
        "scientificName": "Amphiprion ocellaris",
        "confidence": 0.95,
        "wasInDatabase": true,
        "databaseId": 123,
        "instances": [
          {
            "boundingBox": {"x": 150, "y": 200, "width": 80, "height": 60},
            "confidence": 0.95
          }
        ]
      }
    ],
    "unknownSpecies": [],
    "originalPhotoUrl": "https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg",
    "annotatedPhotoUrl": "https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg",
    "collectionEntries": [
      {
        "id": 456,
        "marineId": 123,
        "name": "Clownfish",
        "status": "identified",
        "photo": {
          "url": "https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg",
          "annotatedUrl": "https://your-project-id.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg",
          "boundingBox": {"x": 150, "y": 200, "width": 80, "height": 60}
        }
      }
    ]
  }
}
```

## Field Name Conversion

### Database to API Response Mapping
When converting from database `snake_case` to API `camelCase`:

```typescript
// Database fields → API response fields
scientific_name → scientificName
size_min_cm → sizeMinCm
size_max_cm → sizeMaxCm
habitat_type → habitatType
life_span → lifeSpan
best_time → bestTime
created_at → createdAt
updated_at → updatedAt
date_found → dateFound
spot_id → spotId
marine_id → marineId
device_id → deviceId
bounding_box → boundingBox
file_path → filePath
file_size → fileSize
mime_type → mimeType
storage_bucket → storageBucket
annotated_url → annotatedUrl
```

### Implementation Example
```typescript
// Database query result
const dbResult = {
  scientific_name: "Amphiprion ocellaris",
  size_min_cm: 6.0,
  created_at: "2025-01-21T10:00:00Z"
};

// Convert to API response
const apiResponse = {
  scientificName: dbResult.scientific_name,
  sizeMinCm: dbResult.size_min_cm,
  createdAt: dbResult.created_at
};
```

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `AI_SERVICE_ERROR`: AI identification failed
- `STORAGE_ERROR`: File storage error
- `DATABASE_ERROR`: Database operation failed
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded

## Implementation Examples

### Middleware Setup
```typescript
// src/middleware/validation.ts
import Joi from 'joi';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  };
};

// Usage example
const marineSchema = Joi.object({
  name: Joi.string().required(),
  scientificName: Joi.string(),
  category: Joi.string().valid('Fishes', 'Creatures', 'Corals').required(),
  rarity: Joi.number().min(1).max(5).required()
});
```

### Error Handler Middleware
```typescript
// src/middleware/errorHandler.ts
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'DATABASE_ERROR'
  });
};
```

### Rate Limiting Implementation
```typescript
// src/middleware/rateLimit.ts
const rateLimitStore = new Map();

export const aiRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const deviceId = req.body.deviceId || req.params.deviceId;
  const now = Date.now();
  const dayStart = new Date().setHours(0, 0, 0, 0);
  
  const key = `ai_${deviceId}_${dayStart}`;
  const currentCount = rateLimitStore.get(key) || 0;
  
  if (currentCount >= 10) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 86400,
      dailyLimit: 10,
      usedToday: 10
    });
  }
  
  rateLimitStore.set(key, currentCount + 1);
  next();
};
```

## Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Test environment
npm run test:env

# Test Supabase connection
npm run test:supabase
```

## Documentation Files

- **README.md**: This implementation guide
- **API-Reference.md**: Complete API documentation with all endpoints
- **Database.sql**: Database schema and sample data
- **Supabase.md**: Supabase setup guide
- **Database-Schema.sql**: Database structure creation
- **Database-Data.sql**: Sample data insertion

All documentation is now consolidated and provides a single source of truth for implementation.
