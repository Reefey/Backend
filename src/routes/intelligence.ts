import express, { Request, Response } from 'express';
import multer from 'multer';
import { validateQuery } from '../middleware/validation';
import { schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { DatabaseService } from '../utils/database';
import { StorageService } from '../utils/storage';
import { AIService } from '../services/intelligence';
import { ApiResponse } from '../types/model';

const router = express.Router();
const db = new DatabaseService();
const storage = new StorageService();
const aiService = new AIService();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    // Accept all image types - we'll convert to JPG later
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * @swagger
 * /api/ai/analyze-photo:
 *   post:
 *     summary: Analyze uploaded photo to detect and identify marine life using AI
 *     tags: [Intelligence]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Photo file (jpeg, png, heic, webp)
 *               spotId:
 *                 type: integer
 *                 description: Associated snorkeling spot ID
 *               lat:
 *                 type: number
 *                 description: GPS latitude
 *               lng:
 *                 type: number
 *                 description: GPS longitude
 *     responses:
 *       200:
 *         description: Photo analyzed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     detections:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AIDetection'
 *                     unknownSpecies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UnknownSpecies'
 *                     originalPhotoUrl:
 *                       type: string
 *                     annotatedPhotoUrl:
 *                       type: string

 *                     collectionEntries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           species:
 *                             type: string
 *                           status:
 *                             type: string
 *                           photoUrl:
 *                             type: string
 *                           boundingBox:
 *                             type: object
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/analyze-photo',
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.body['deviceId'];
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Photo file is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Use the uploaded file directly
    const processedFile = {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname
    };

    // Extract form data
    const spotId = req.body['spotId'] ? parseInt(req.body['spotId']) : undefined;
    const lat = req.body['lat'] ? parseFloat(req.body['lat']) : undefined;
    const lng = req.body['lng'] ? parseFloat(req.body['lng']) : undefined;

    // Check rate limit
    const rateLimitInfo = aiService.getRateLimitInfo(deviceId);
    if (rateLimitInfo.used >= rateLimitInfo.limit) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      } as any);
    }

    // Analyze image with AI
    const analysis = await aiService.analyzeImage(processedFile.buffer, deviceId);

    // Upload original photo
    const photoData = await storage.uploadCollectionPhoto(
      {
        ...req.file,
        buffer: processedFile.buffer,
        mimetype: processedFile.mimeType,
        originalname: processedFile.filename
      },
      deviceId,
      'ai_analysis',
      0, // Use 0 as default collection ID
      analysis.detections // Pass detections for annotated image creation
    );

    // Create collection entries for each detected species
    const collectionEntries = [];
    
    for (const detection of analysis.detections) {
      // Create collection entry
      const collectionData: any = {
        deviceId,
        status: 'identified',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      if (detection.databaseId) {
        collectionData.marineId = detection.databaseId;
      }

      const collection = await db.createCollection(collectionData);

      // Add photo to collection
      const photoDataForDb: any = {
        collectionId: collection.id,
        url: photoData.originalUrl,

        dateFound: new Date().toISOString(),
        storageBucket: 'reefey-photos',
        filePath: photoData.filePath,
        fileSize: processedFile.buffer.length,
        mimeType: processedFile.mimeType
      };

      if (photoData.annotatedUrl) photoDataForDb.annotatedUrl = photoData.annotatedUrl;
      if (spotId) photoDataForDb.spotId = spotId;
      if (lat) photoDataForDb.lat = lat;
      if (lng) photoDataForDb.lng = lng;
      if (detection.instances[0]?.boundingBox) {
        photoDataForDb.boundingBox = detection.instances[0].boundingBox;
      }

      const photo = await db.addPhotoToCollection(photoDataForDb);

      collectionEntries.push({
        id: collection.id,
        marineId: detection.databaseId,
        name: detection.species,
        status: 'identified',
        photo: {
          url: photo.url,
          annotatedUrl: photo.annotatedUrl,
          boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
        }
      });
    }

    res.json({
      success: true,
      data: {
        detections: analysis.detections,
        unknownSpecies: analysis.unknownSpecies,
        originalPhotoUrl: photoData.originalUrl,
        annotatedPhotoUrl: photoData.annotatedUrl,

        collectionEntries
      },
      message: `Photo analyzed successfully - ${analysis.detections.length} species detected`
    });
    return;
  })
);

/**
 * @swagger
 * /api/ai/analyze-photo-url:
 *   post:
 *     summary: Analyze photo from URL to detect and identify marine life using AI
 *     tags: [Intelligence]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - photoUrl
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier
 *               photoUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL of the photo to analyze
 *               spotId:
 *                 type: integer
 *                 description: Associated snorkeling spot ID
 *               lat:
 *                 type: number
 *                 description: GPS latitude
 *               lng:
 *                 type: number
 *                 description: GPS longitude
 *     responses:
 *       200:
 *         description: Photo analyzed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     detections:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AIDetection'
 *                     unknownSpecies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UnknownSpecies'
 *                     originalPhotoUrl:
 *                       type: string
 *                     annotatedPhotoUrl:
 *                       type: string

 *                     collectionEntries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           species:
 *                             type: string
 *                           status:
 *                             type: string
 *                           photoUrl:
 *                             type: string
 *                           boundingBox:
 *                             type: object
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/analyze-photo-url',
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const { deviceId, photoUrl, spotId, lat, lng } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Photo URL is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Check rate limit
    const rateLimitInfo = aiService.getRateLimitInfo(deviceId);
    if (rateLimitInfo.used >= rateLimitInfo.limit) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      } as any);
    }

    try {
      // Download image from URL
      const response = await fetch(photoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Process and validate the downloaded file
      const mockFile = {
        buffer,
        mimetype: response.headers.get('content-type') || 'image/jpeg',
        originalname: 'downloaded_image.jpg',
        size: buffer.length
      } as Express.Multer.File;
      
      const processedFile = {
        buffer: mockFile.buffer,
        mimeType: mockFile.mimetype,
        filename: mockFile.originalname
      };

      // Analyze image with AI
      const analysis = await aiService.analyzeImage(processedFile.buffer, deviceId);

      // Upload original photo
      const photoData = await storage.uploadCollectionPhoto(
        {
          ...mockFile,
          buffer: processedFile.buffer,
          mimetype: processedFile.mimeType,
          originalname: processedFile.filename
        },
        deviceId,
        'ai_analysis',
        0, // Use 0 as default collection ID
        analysis.detections // Pass detections for annotated image creation
      );

      // Create collection entries for each detected species
      const collectionEntries = [];
      
      for (const detection of analysis.detections) {
        // Create collection entry
        const collectionData: any = {
          deviceId,
          status: 'identified',
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        };

        if (detection.databaseId) {
          collectionData.marineId = detection.databaseId;
        }

        const collection = await db.createCollection(collectionData);

        // Add photo to collection
        const photoDataForDb: any = {
          collectionId: collection.id,
          url: photoData.originalUrl,

          dateFound: new Date().toISOString(),
          storageBucket: 'reefey-photos',
          filePath: photoData.filePath,
          fileSize: processedFile.buffer.length,
          mimeType: processedFile.mimeType
        };

        if (photoData.annotatedUrl) photoDataForDb.annotatedUrl = photoData.annotatedUrl;
        if (spotId) photoDataForDb.spotId = spotId;
        if (lat) photoDataForDb.lat = lat;
        if (lng) photoDataForDb.lng = lng;
        if (detection.instances[0]?.boundingBox) {
          photoDataForDb.boundingBox = detection.instances[0].boundingBox;
        }

        const photo = await db.addPhotoToCollection(photoDataForDb);

        collectionEntries.push({
          id: collection.id,
          marineId: detection.databaseId,
          name: detection.species,
          status: 'identified',
          photo: {
            url: photo.url,
            annotatedUrl: photo.annotatedUrl,
            boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
          }
        });
      }

      res.json({
        success: true,
        data: {
          detections: analysis.detections,
          unknownSpecies: analysis.unknownSpecies,
          originalPhotoUrl: photoData.originalUrl,
          annotatedPhotoUrl: photoData.annotatedUrl,

          collectionEntries
        },
        message: `Photo analyzed successfully - ${analysis.detections.length} species detected`
      });
      return;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Failed to process image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'PROCESSING_ERROR'
      });
    }
  })
);

/**
 * @swagger
 * /api/ai/rate-limit:
 *   get:
 *     summary: Get AI rate limit information for device
 *     tags: [Intelligence]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *     responses:
 *       200:
 *         description: Rate limit information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     resetTime:
 *                       type: integer
 */
router.get('/rate-limit',
  validateQuery(schemas.deviceIdQuery),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.query['deviceId'] as string;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const rateLimitInfo = aiService.getRateLimitInfo(deviceId);

    res.json({
      success: true,
      data: rateLimitInfo
    });
    return;
  })
);

export default router;
