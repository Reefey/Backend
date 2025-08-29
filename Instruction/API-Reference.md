# Reefey API Reference

## Base URL
```
http://localhost:3000/api
```

**Production URL Example:**
```
https://your-reefey-app.vercel.app/api
```

## Authentication
Simple device ID validation - no JWT tokens required. Pass `deviceId` as a parameter in relevant endpoints.

## Common Response Format
All endpoints return responses in this format:
```json
{
  "success": boolean,
  "data": object | array,
  "message": string,
  "error": string,
  "code": string
}
```

## Error Codes
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `AI_SERVICE_ERROR`: AI identification failed
- `STORAGE_ERROR`: File storage error
- `DATABASE_ERROR`: Database operation failed
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded

---

## Spots Management

### GET /api/spots
Get snorkeling spots with filtering and sorting.

**Query Parameters:**
- `lat, lng` (optional): Center coordinates for location-based filtering
- `radius` (optional): Radius in km for location filtering (default: 10)
- `q` (optional): Text search in spot name
- `sort` (optional): Sort order (`name`, `distance`, `createdAt`)
- `page` (optional): Page number (default: 1)
- `size` (optional): Results per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Menjangan Island",
      "lat": -8.1526,
      "lng": 114.5139,
      "distance": 2.5,
      "createdAt": "2025-01-21T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "size": 50,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

### GET /api/spots/:id
Get detailed information about a specific snorkeling spot.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Menjangan Island",
    "lat": -8.1526,
    "lng": 114.5139,
    "description": "Beautiful coral reef with diverse marine life",
    "difficulty": "Easy",
    "bestTime": "Morning",
    "marineSpecies": [
      {
        "marineId": 123,
        "name": "Clownfish",
        "scientificName": "Amphiprion ocellaris",
        "rarity": 2,
        "frequency": "Common",
        "seasonality": "Year-round",
        "notes": "Found near anemones in shallow waters"
      }
    ],
    "totalSpecies": 3,
    "createdAt": "2025-01-21T10:00:00Z"
  }
}
```

### POST /api/spots
Create a new snorkeling spot.

**Request Body:**
```json
{
  "name": "New Spot",
  "lat": -8.1526,
  "lng": 114.5139,
  "description": "Description of the spot",
  "difficulty": "Easy",
  "bestTime": "Morning",
  "marineSpecies": [
    {
      "marineId": 123,
      "frequency": "Common",
      "seasonality": "Year-round",
      "notes": "Found near anemones in shallow waters"
    }
  ]
}
```

### DELETE /api/spots/:id
Delete a snorkeling spot.

---

## Marine Species

### GET /api/marine
Get marine species with filtering and sorting.

**Note:** Images are automatically resized using an external resizer service for optimal performance. The `imageUrl` field will contain the resized image URL.

**Query Parameters:**
- `q` (optional): Text search in name, scientific name, category, description
- `rarity` (optional): Filter by rarity level (1-5)
- `category` (optional): Filter by category (`Fishes`, `Creatures`, `Corals`)
- `habitat` (optional): Filter by habitat type
- `diet` (optional): Filter by diet type
- `behavior` (optional): Filter by behavior type
- `sizeMin, sizeMax` (optional): Filter by size range in cm
- `danger` (optional): Filter by danger level (`Low`, `Medium`, `High`, `Extreme`)
- `venomous` (optional): Filter by venomous status (true/false)
- `sort` (optional): Sort order (`name`, `rarity`, `sizeMin`, `sizeMax`, `category`)
- `page` (optional): Page number (default: 1)
- `size` (optional): Results per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
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
      "imageUrl": "https://fls-9fbdb93b-a42f-4f1b-bd36-df123573e205.laravel.cloud/images/resized_1756373244_68b020fc280c3.jpg"
    }
  ],
  "pagination": {
    "total": 30,
    "page": 1,
    "size": 50,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

### GET /api/marine/:id
Get detailed information about a specific marine species.

**Note:** Images are automatically resized using an external resizer service for optimal performance. The `imageUrl` field will contain the resized image URL.

**Response:**
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
    "imageUrl": "https://fls-9fbdb93b-a42f-4f1b-bd36-df123573e205.laravel.cloud/images/resized_1756373244_68b020fc280c3.jpg",
    "lifeSpan": "6-10 years",
    "reproduction": "Eggs near anemone; male guards",
    "migration": "Site-attached to host",
    "endangered": "Least Concern",
    "funFact": "Sequential hermaphrodites",
    "foundAtSpots": [
      {
        "spotId": 1,
        "spotName": "Menjangan Island",
        "lat": -8.1526,
        "lng": 114.5139,
        "frequency": "Common",
        "seasonality": "Year-round",
        "notes": "Found near anemones in shallow waters"
      }
    ],
    "totalSpots": 2
  }
}
```

### POST /api/marine
Add a new marine species.

**Request Body:**
```json
{
  "name": "New Marine Species",
  "scientificName": "Scientific name",
  "category": "Fishes",
  "rarity": 3,
  "sizeMinCm": 5.0,
  "sizeMaxCm": 10.0,
  "habitatType": ["Coral Reefs"],
  "diet": "Carnivore",
  "behavior": "Solitary",
  "danger": "Low",
  "venomous": false,
  "description": "Description of the marine species",
  "lifeSpan": "5-10 years",
  "reproduction": "Egg laying",
  "migration": "Local",
  "endangered": "Least Concern",
  "funFact": "Interesting fact about this species"
}
```

### DELETE /api/marine/:id
Delete a marine species.

---

## Collections

### GET /api/collections/:deviceId
Get user's collection with filtering and sorting.

**Query Parameters:**
- `sort` (optional): Sort order (`dateDesc`, `dateAsc`, `marineName`, `spot`, `rarity`, `category`, `danger`)
- `filterMarine` (optional): Filter by marine species name
- `filterSpot` (optional): Filter by spot ID
- `filterRarity` (optional): Filter by rarity level (1-5)
- `filterCategory` (optional): Filter by category (`Fishes`, `Creatures`, `Corals`)
- `filterDanger` (optional): Filter by danger level (`Low`, `Medium`, `High`, `Extreme`)
- `filterDateFrom` (optional): Filter by date from (YYYY-MM-DD)
- `filterDateTo` (optional): Filter by date to (YYYY-MM-DD)
- `page` (optional): Page number (default: 1)
- `size` (optional): Results per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "deviceId": "device123",
      "marineId": 123,
      "name": "Clownfish",
      "scientificName": "Amphiprion ocellaris",
      "rarity": 2,
      "sizeMinCm": 6.0,
      "sizeMaxCm": 11.0,
      "habitatType": ["Coral Reefs", "Anemones"],
      "diet": "Omnivore",
      "behavior": "Social",
      "description": "The iconic clownfish...",
      "marineImage": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/marine/123/clownfish.jpg",
      "photos": [
        {
          "id": "photo1",
          "url": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg",
          "annotatedUrl": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg",
          "dateFound": "2025-01-21T10:00:00Z",
          "spotId": 1,
          "confidence": 0.95,
          "boundingBox": {
            "x": 150,
            "y": 200,
            "width": 80,
            "height": 60
          },
          "spots": {
            "name": "Menjangan Island",
            "lat": -8.1526,
            "lng": 114.5139
          }
        }
      ],
      "totalPhotos": 2,
      "firstSeen": "2025-01-21T10:00:00Z",
      "lastSeen": "2025-01-22T14:30:00Z",
      "status": "identified"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "size": 50,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

### POST /api/collections/:deviceId
Add new finding to user's collection.

**Request:** multipart/form-data
- `species` (optional): Marine species name
- `spotId` (optional): Spot ID
- `photo` (required): Photo file
- `lat, lng` (optional): GPS coordinates
- `boundingBox` (optional): JSON string of bounding box coordinates
- `notes` (optional): User notes about the photo

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "deviceId": "device123",
    "marineId": 123,
    "name": "Clownfish",
    "scientificName": "Amphiprion ocellaris",
    "photo": {
      "id": "photo1",
      "url": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg",
      "annotatedUrl": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg",
      "dateFound": "2025-01-21T10:00:00Z",
      "spotId": 1,
      "confidence": 0.95,
      "boundingBox": {
        "x": 150,
        "y": 200,
        "width": 80,
        "height": 60
      }
    },
    "totalPhotos": 1,
    "firstSeen": "2025-01-21T10:00:00Z",
    "lastSeen": "2025-01-21T10:00:00Z",
    "status": "identified"
  },
  "message": "Finding added to collection!"
}
```

### POST /api/collections/:deviceId/:collectionId
Add a new photo to an existing collection entry.

**Request:** multipart/form-data
- `photo` (required): Photo file from gallery
- `spotId` (optional): Spot ID where photo was taken
- `lat, lng` (optional): GPS coordinates where photo was taken
- `dateFound` (optional): Date when photo was taken (YYYY-MM-DD format)
- `notes` (optional): User notes about the photo

**Response:**
```json
{
  "success": true,
  "data": {
    "collectionId": 1,
    "marineId": 123,
    "name": "Clownfish",
    "scientificName": "Amphiprion ocellaris",
          "newPhoto": {
        "id": "photo3",
        "url": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo3.jpg",
        "dateFound": "2025-01-23T16:45:00Z",
        "spotId": 1,
        "confidence": null,
        "boundingBox": null,
        "notes": "Found this beautiful clownfish near the coral",
        "spots": {
          "name": "Menjangan Island",
          "lat": -8.1526,
          "lng": 114.5139
        }
      },
    "totalPhotos": 3,
    "lastSeen": "2025-01-23T16:45:00Z",
    "message": "Photo added to existing collection"
  }
}
```

### DELETE /api/collections/:id
Delete finding from user's collection.

**Query Parameters:**
- `deviceId` (required): Device identifier for security

---

## AI Intelligence

### POST /api/ai/analyze-photo
Analyze uploaded photo for marine life identification.

**Request:** multipart/form-data
- `deviceId` (required): Device identifier
- `photo` (required): Photo file (jpeg, png, heic, webp)
- `spotId` (optional): Associated snorkeling spot ID
- `lat, lng` (optional): GPS coordinates

**Response:**
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
            "boundingBox": {
              "x": 150,
              "y": 200,
              "width": 80,
              "height": 60
            },
            "confidence": 0.95
          }
        ]
      }
    ],
    "unknownSpecies": [
      {
        "description": "Small blue fish with yellow stripes",
        "gptResponse": "This appears to be a juvenile fish...",
        "confidence": 0.3,
        "instances": [
          {
            "boundingBox": {
              "x": 600,
              "y": 300,
              "width": 40,
              "height": 30
            },
            "confidence": 0.3
          }
        ]
      }
    ],
    "originalPhotoUrl": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg",
    "annotatedPhotoUrl": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg",
    "collectionEntries": [
      {
        "id": 456,
        "marineId": 123,
        "name": "Clownfish",
        "status": "identified",
        "photo": {
          "url": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1.jpg",
          "annotatedUrl": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/clownfish/photo1_annotated.jpg",
          "boundingBox": {
            "x": 150,
            "y": 200,
            "width": 80,
            "height": 60
          }
        }
      }
    ]
  },
  "message": "Photo analyzed successfully - 3 species detected"
}
```

### POST /api/ai/analyze-photo-url
Analyze photo from URL instead of file upload.

**Request Body:**
```json
{
  "deviceId": "device123",
  "photoUrl": "https://your-project.supabase.co/storage/v1/object/public/reefey-photos/collections/device123/photo.jpg",
  "spotId": 1,
  "lat": -8.1526,
  "lng": 114.5139
}
```

---

## System

### GET /api/stats
Get comprehensive system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "spots": {
      "total": 25,
      "recentlyAdded": 3
    },
    "marine": {
      "totalSpecies": 150,
      "rarityDistribution": { "1": 30, "2": 45, "3": 40, "4": 25, "5": 10 },
      "uniqueFamilies": 25,
      "averageSizeCm": 45.2,
      "sizeRange": { "min": 1.5, "max": 400.0 }
    },
    "collections": {
      "totalFindings": 1250,
      "uniqueUsers": 45,
      "identificationSuccessRate": 0.85
    },
    "storage": {
      "totalFiles": 1250,
      "totalSizeMb": 245.6,
      "bucketStats": {
        "collections": { "files": 1050, "sizeMb": 201.5 },
        "marine": { "files": 200, "sizeMb": 44.1 }
      }
    },
    "ai": {
      "totalAnalyses": 1500,
      "successRate": 0.78,
      "averageConfidence": 0.82
    }
  }
}
```

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-21T10:00:00Z",
  "services": {
    "database": "connected",
    "storage": "connected",
    "ai": "connected"
  }
}
```

---

## File Upload Specifications

### Supported Formats
- **Images**: JPEG, PNG, HEIC, WebP
- **Max Size**: 50MB per file
- **Storage**: Supabase Storage bucket

### File Organization
- **Collections**: `collections/{deviceId}/{species}/{filename}`
- **Marine Images**: `marine/{marineId}/{filename}`
- **Annotated Images**: `collections/{deviceId}/{species}/{filename}_annotated.jpg`

### Processing
- **Format Conversion**: HEIC/WebP → JPEG using Sharp
- **Annotation**: Bounding boxes drawn using Canvas
- **Validation**: Type, size, and content validation

---

## Rate Limiting

### AI Analysis
- **Limit**: 10 requests per day per device
- **Storage**: In-memory (no Redis required)
- **Reset**: 24 hours from first request

### API Endpoints
- **Limit**: 100 requests per 24 hours per IP
- **Window**: 24 hours
- **Storage**: In-memory

### Error Response
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 86400,
  "dailyLimit": 10,
  "usedToday": 10
}
```
