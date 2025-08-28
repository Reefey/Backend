import express, { Request, Response } from 'express';
import multer from 'multer';
import { validateQuery, validate } from '../middleware/validation';
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
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Configure multer for multiple files
const uploadMultiple = multer({
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
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10 // Maximum 10 files per request
  }
});

/**
 * @swagger
 * /api/ai/batch-analyze-photos:
 *   post:
 *     summary: Batch analyze multiple photos for comprehensive marine life annotation
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
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple photo files (jpeg, png, heic, webp)
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
 *         description: Photos analyzed successfully
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
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           filename:
 *                             type: string
 *                           success:
 *                             type: boolean
 *                           analysis:
 *                             type: object
 *                           error:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalImages:
 *                           type: integer
 *                         successfulAnalyses:
 *                           type: integer
 *                         failedAnalyses:
 *                           type: integer
 *                         totalDetections:
 *                           type: integer
 *                         averageConfidence:
 *                           type: number
 *                         processingTime:
 *                           type: integer
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/batch-analyze-photos',
  uploadMultiple.array('photos', 10),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.body['deviceId'];
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one photo file is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Check rate limit for batch processing
    const rateLimitInfo = aiService.getRateLimitInfo(deviceId);
    const files = req.files as Express.Multer.File[];
    const requiredRequests = files.length;
    if (rateLimitInfo.used + requiredRequests > rateLimitInfo.limit) {
      return res.status(429).json({
        success: false,
        error: `Rate limit would be exceeded. Required: ${requiredRequests}, Available: ${rateLimitInfo.limit - rateLimitInfo.used}`,
        code: 'RATE_LIMIT_EXCEEDED'
      } as any);
    }

    // Extract form data
    const spotId = req.body['spotId'] ? parseInt(req.body['spotId']) : undefined;
    const lat = req.body['lat'] ? parseFloat(req.body['lat']) : undefined;
    const lng = req.body['lng'] ? parseFloat(req.body['lng']) : undefined;

    // Prepare images for batch processing
    const images = files.map((file: Express.Multer.File) => ({
      buffer: file.buffer,
      filename: file.originalname
    }));

    // Perform batch analysis
    const batchResult = await aiService.batchAnalyzeImages(images, deviceId, spotId, lat, lng);

    // Process successful analyses and create collection entries
    const processedResults = [];
    
    for (const result of batchResult.results) {
      if (result.success) {
        const analysis = result.analysis;
        
        // Upload photos and create collection entries for each detection
        const photoData = await storage.uploadCollectionPhoto(
          {
            buffer: analysis.processedImageBuffer || Buffer.from([]),
            mimetype: 'image/jpeg',
            originalname: result.filename,
            size: analysis.processedImageBuffer?.length || 0
          } as Express.Multer.File,
          deviceId,
          'batch_analysis',
          0,
          analysis.detections,
          analysis.processedImageBuffer
        );

        // Create collection entries for each detected species
        const collectionEntries = [];
        
        for (const detection of analysis.detections) {
          if (!detection.databaseId) {
            continue; // Skip detections without database ID
          }

          // Check if collection already exists for this marine species and device
          const existingCollection = await db.findCollectionByMarineAndDevice(detection.databaseId, deviceId);

          let collectionId: number;
          let isNewCollection = false;

          if (existingCollection) {
            // Use existing collection and update last seen timestamp
            collectionId = existingCollection.id;
            await db.updateCollectionLastSeen(existingCollection.id, deviceId);
          } else {
            // Create new collection entry
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
            collectionId = collection.id;
            isNewCollection = true;
          }

          // Add photo to collection
          const photoDataForDb: any = {
            collectionId: collectionId,
            url: photoData.originalUrl,
            dateFound: new Date().toISOString(),
            storageBucket: 'reefey-photos',
            filePath: photoData.filePath,
            fileSize: analysis.processedImageBuffer?.length || 0,
            mimeType: 'image/jpeg'
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
            id: collectionId,
            marineId: detection.databaseId,
            name: detection.species,
            status: 'identified',
            isNewCollection,
            ...(detection.marineData && { marineData: detection.marineData }),
            photo: {
              url: photo.url,
              annotatedUrl: photo.annotatedUrl,
              boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
            }
          });
        }

        processedResults.push({
          filename: result.filename,
          success: true,
          analysis: {
            ...analysis,
            originalPhotoUrl: photoData.originalUrl,
            annotatedPhotoUrl: photoData.annotatedUrl,
            collectionEntries
          }
        });
      } else {
        processedResults.push(result);
      }
    }

    res.json({
      success: true,
      data: {
        results: processedResults,
        summary: batchResult.summary
      },
      message: `Batch analysis completed - ${batchResult.summary.successfulAnalyses}/${batchResult.summary.totalImages} images processed successfully`
    });
    return;
  })
);

/**
 * @swagger
 * /api/ai/analyze-photo-base64:
 *   post:
 *     summary: Analyze base64 encoded photo to detect and identify marine life using AI
 *     tags: [Intelligence]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier
 *               photo:
 *                 type: string
 *                 description: Base64 encoded image (data URL or plain base64)
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
 *                         type: object
 *                         properties:
 *                           species:
 *                             type: string
 *                           scientificName:
 *                             type: string
 *                           confidence:
 *                             type: number
 *                           confidenceReasoning:
 *                             type: string
 *                           wasInDatabase:
 *                             type: boolean
 *                           databaseId:
 *                             type: integer
 *                           description:
 *                             type: string
 *                           behavioralNotes:
 *                             type: string
 *                           sizeEstimate:
 *                             type: string
 *                           habitatContext:
 *                             type: string
 *                           interactions:
 *                             type: string
 *                           imageQuality:
 *                             type: string
 *                           estimatedCharacteristics:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                                 enum: [Fishes, Creatures, Corals]
 *                               sizeRange:
 *                                 type: string
 *                                 enum: [small, medium, large]
 *                               habitatType:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               diet:
 *                                 type: string
 *                               behavior:
 *                                 type: string
 *                               dangerLevel:
 *                                 type: string
 *                                 enum: [Low, Medium, High, Extreme]
 *                               venomous:
 *                                 type: boolean
 *                               conservationStatus:
 *                                 type: string
 *                           marineData:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               scientificName:
 *                                 type: string
 *                               category:
 *                                 type: string
 *                                 enum: [Fishes, Creatures, Corals]
 *                               rarity:
 *                                 type: integer
 *                               sizeMinCm:
 *                                 type: number
 *                               sizeMaxCm:
 *                                 type: number
 *                               habitatType:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               diet:
 *                                 type: string
 *                               behavior:
 *                                 type: string
 *                               danger:
 *                                 type: string
 *                                 enum: [Low, Medium, High, Extreme]
 *                               venomous:
 *                                 type: boolean
 *                               description:
 *                                 type: string
 *                               lifeSpan:
 *                                 type: string
 *                               reproduction:
 *                                 type: string
 *                               migration:
 *                                 type: string
 *                               endangered:
 *                                 type: string
 *                               funFact:
 *                                 type: string
 *                               imageUrl:
 *                                 type: string
 *                           instances:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 boundingBox:
 *                                   type: object
 *                                   properties:
 *                                     x:
 *                                       type: number
 *                                     y:
 *                                       type: number
 *                                     width:
 *                                       type: number
 *                                     height:
 *                                       type: number
 *                                 confidence:
 *                                   type: number
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
 *                           marineId:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           status:
 *                             type: string
 *                           marineData:
 *                             type: object
 *                             description: Enhanced marine species data from database
 *                           photo:
 *                             type: object
 *                             properties:
 *                               url:
 *                                 type: string
 *                               annotatedUrl:
 *                                 type: string
 *                               boundingBox:
 *                                 type: object
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/analyze-photo-base64',
  validate(schemas.base64AIAnalysis),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.body['deviceId'];
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!req.body.photo) {
      return res.status(400).json({
        success: false,
        error: 'Photo is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Process base64 image
    const processedFile = await storage.processImageInput(req.body.photo);

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

    // Upload original photo and create annotated version using the processed buffer
    const photoData = await storage.uploadCollectionPhoto(
      {
        buffer: processedFile.buffer,
        mimetype: processedFile.mimeType,
        originalname: processedFile.filename,
        size: processedFile.size
      } as Express.Multer.File,
      deviceId,
      'ai_analysis',
      0, // Use 0 as default collection ID
      analysis.detections, // Pass detections for annotated image creation
      analysis.processedImageBuffer // Use the exact same buffer that AI analyzed
    );

    // Create collection entries for each detected species
    const collectionEntries = [];
    
    for (const detection of analysis.detections) {
      if (!detection.databaseId) {
        continue; // Skip detections without database ID
      }

      // Check if collection already exists for this marine species and device
      const existingCollection = await db.findCollectionByMarineAndDevice(detection.databaseId, deviceId);

      let collectionId: number;
      let isNewCollection = false;

      if (existingCollection) {
        // Use existing collection and update last seen timestamp
        collectionId = existingCollection.id;
        await db.updateCollectionLastSeen(existingCollection.id, deviceId);
      } else {
        // Create new collection entry
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
        collectionId = collection.id;
        isNewCollection = true;
      }

      // Add photo to collection
      const photoDataForDb: any = {
        collectionId: collectionId,
        url: photoData.originalUrl,
        dateFound: new Date().toISOString(),
        storageBucket: 'reefey-photos',
        filePath: photoData.filePath,
        fileSize: processedFile.size,
        mimeType: processedFile.mimeType
      };

      if (photoData.annotatedUrl) photoDataForDb.annotatedUrl = photoData.annotatedUrl;
      if (spotId) photoDataForDb.spotId = spotId;
      if (lat) photoDataForDb.lat = lat;
      if (lng) photoDataForDb.lng = lng;
      if (detection.instances[0]?.boundingBox) {
        photoDataForDb.boundingBox = detection.instances[0].boundingBox;
      }

      await db.addPhotoToCollection(photoDataForDb);

      collectionEntries.push({
        id: collectionId,
        species: detection.species,
        status: isNewCollection ? 'new' : 'existing',
        ...(detection.marineData && { marineData: detection.marineData }),
        photoUrl: photoData.originalUrl,
        boundingBox: detection.instances[0]?.boundingBox
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        detections: analysis.detections,
        unknownSpecies: analysis.unknownSpecies,
        originalPhotoUrl: photoData.originalUrl,
        annotatedPhotoUrl: photoData.annotatedUrl,
        collectionEntries,
        ...(analysis.imageAnalysis && { imageAnalysis: analysis.imageAnalysis }),
        ...(analysis.annotationMetadata && { annotationMetadata: analysis.annotationMetadata })
      },
      message: 'Photo analyzed successfully'
    });
  })
);

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

    // Upload original photo and create annotated version using the processed buffer
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
      analysis.detections, // Pass detections for annotated image creation
      analysis.processedImageBuffer // Use the exact same buffer that AI analyzed
    );

    // Create collection entries for each detected species
    const collectionEntries = [];
    
    for (const detection of analysis.detections) {
      if (!detection.databaseId) {
        continue; // Skip detections without database ID
      }

      // Check if collection already exists for this marine species and device
      const existingCollection = await db.findCollectionByMarineAndDevice(detection.databaseId, deviceId);

      let collectionId: number;
      let isNewCollection = false;

      if (existingCollection) {
        // Use existing collection and update last seen timestamp
        collectionId = existingCollection.id;
        await db.updateCollectionLastSeen(existingCollection.id, deviceId);
      } else {
        // Create new collection entry
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
        collectionId = collection.id;
        isNewCollection = true;
      }

      // Add photo to collection
      const photoDataForDb: any = {
        collectionId: collectionId,
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

      await db.addPhotoToCollection(photoDataForDb);

      collectionEntries.push({
        id: collectionId,
        marineId: detection.databaseId,
        name: detection.species,
        status: 'identified',
        isNewCollection,
        ...(detection.marineData && { marineData: detection.marineData }),
        photo: {
          url: photoData.originalUrl,
          annotatedUrl: photoData.annotatedUrl,
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
        collectionEntries,
        // Include enhanced annotation data
        ...(analysis.imageAnalysis && { imageAnalysis: analysis.imageAnalysis }),
        ...(analysis.annotationMetadata && { annotationMetadata: analysis.annotationMetadata })
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
        if (!detection.databaseId) {
          continue; // Skip detections without database ID
        }

        // Check if collection already exists for this marine species and device
        const existingCollection = await db.findCollectionByMarineAndDevice(detection.databaseId, deviceId);

        let collectionId: number;
        let isNewCollection = false;

        if (existingCollection) {
          // Use existing collection and update last seen timestamp
          collectionId = existingCollection.id;
          await db.updateCollectionLastSeen(existingCollection.id, deviceId);
        } else {
          // Create new collection entry
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
          collectionId = collection.id;
          isNewCollection = true;
        }

        // Add photo to collection
        const photoDataForDb: any = {
          collectionId: collectionId,
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

        await db.addPhotoToCollection(photoDataForDb);

        collectionEntries.push({
          id: collectionId,
          marineId: detection.databaseId,
          name: detection.species,
          status: 'identified',
          isNewCollection,
          ...(detection.marineData && { marineData: detection.marineData }),
          photo: {
            url: photoData.originalUrl,
            annotatedUrl: photoData.annotatedUrl,
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
          collectionEntries,
          // Include enhanced annotation data
          ...(analysis.imageAnalysis && { imageAnalysis: analysis.imageAnalysis }),
          ...(analysis.annotationMetadata && { annotationMetadata: analysis.annotationMetadata })
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

/**
 * @swagger
 * /api/ai/species-details:
 *   post:
 *     summary: Get detailed species information including image URL from AI
 *     tags: [Intelligence]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - speciesName
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier
 *               speciesName:
 *                 type: string
 *                 description: Name of the marine species
 *               scientificName:
 *                 type: string
 *                 description: Scientific name (optional, helps with accuracy)
 *     responses:
 *       200:
 *         description: Species details retrieved successfully
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
 *                     name:
 *                       type: string
 *                     scientificName:
 *                       type: string
 *                     category:
 *                       type: string
 *                       enum: [Fishes, Creatures, Corals]
 *                     rarity:
 *                       type: integer
 *                       minimum: 1
 *                       maximum: 5
 *                     sizeMinCm:
 *                       type: number
 *                     sizeMaxCm:
 *                       type: number
 *                     habitatType:
 *                       type: array
 *                       items:
 *                         type: string
 *                     diet:
 *                       type: string
 *                     behavior:
 *                       type: string
 *                     danger:
 *                       type: string
 *                       enum: [Low, Medium, High, Extreme]
 *                     venomous:
 *                       type: boolean
 *                     edibility:
 *                       type: boolean
 *                     poisonous:
 *                       type: boolean
 *                     endangeredd:
 *                       type: boolean
 *                     description:
 *                       type: string
 *                     lifeSpan:
 *                       type: string
 *                     reproduction:
 *                       type: string
 *                     migration:
 *                       type: string
 *                     endangered:
 *                       type: string
 *                     funFact:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                       nullable: true
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/species-details',
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const { deviceId, speciesName, scientificName } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!speciesName) {
      return res.status(400).json({
        success: false,
        error: 'Species name is required',
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
      // Get detailed species information including image URL
      const speciesDetails = await aiService.getSpeciesDetails(speciesName);

      // If no image URL was provided, try to search for one
      if (!speciesDetails.imageUrl) {
        try {
          speciesDetails.imageUrl = await aiService.searchMarineImage(speciesName, scientificName);
        } catch (error) {
          console.warn(`Failed to search for image for ${speciesName}:`, error);
        }
      }

      res.json({
        success: true,
        data: speciesDetails,
        message: `Species details retrieved successfully for ${speciesName}`
      });
      return;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Failed to get species details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'PROCESSING_ERROR'
      });
    }
  })
);

/**
 * @swagger
 * /api/ai/update-species-image:
 *   post:
 *     summary: Update existing species with image URL from internet search
 *     tags: [Intelligence]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - marineId
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier
 *               marineId:
 *                 type: integer
 *                 description: ID of the marine species to update
 *     responses:
 *       200:
 *         description: Species updated successfully
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
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                       nullable: true
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/update-species-image',
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const { deviceId, marineId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!marineId) {
      return res.status(400).json({
        success: false,
        error: 'Marine ID is required',
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
      // Get existing marine species
      const marine = await db.getMarineById(marineId);

      // Search for image URL
      const imageUrl = await aiService.searchMarineImage(marine.name, marine.scientificName);

      if (imageUrl) {
        // Update the marine species with the new image URL
        await db.updateMarine(marineId, { imageUrl });
        
        res.json({
          success: true,
          data: {
            id: marine.id,
            name: marine.name,
            imageUrl: imageUrl
          },
          message: `Image URL updated successfully for ${marine.name}`
        });
      } else {
        res.json({
          success: false,
          data: {
            id: marine.id,
            name: marine.name,
            imageUrl: null
          },
          message: `No suitable image found for ${marine.name}`
        });
      }
      return;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Failed to update species image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'PROCESSING_ERROR'
      });
    }
  })
);

export default router;
