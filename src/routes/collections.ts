import express, { Request, Response } from 'express';
import multer from 'multer';
import { validateParams, validateQuery } from '../middleware/validation';
import { schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { DatabaseService } from '../utils/database';
import { StorageService } from '../utils/storage';
import { ApiResponse } from '../types/model';

const router = express.Router();
const db = new DatabaseService();
const storage = new StorageService();

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
 * /api/collections/{deviceId}:
 *   get:
 *     summary: Get user's collection with filtering and sorting
 *     tags: [Collections]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [dateDesc, dateAsc, marineName, spot, rarity, category, danger]
 *         description: Sort order
 *       - in: query
 *         name: filterMarine
 *         schema:
 *           type: string
 *         description: Filter by marine species name
 *       - in: query
 *         name: filterSpot
 *         schema:
 *           type: integer
 *         description: Filter by spot ID
 *       - in: query
 *         name: filterRarity
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter by marine species rarity level
 *       - in: query
 *         name: filterCategory
 *         schema:
 *           type: string
 *           enum: [Fishes, Creatures, Corals]
 *         description: Filter by category
 *       - in: query
 *         name: filterDanger
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Extreme]
 *         description: Filter by danger level
 *       - in: query
 *         name: filterDateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date from (YYYY-MM-DD)
 *       - in: query
 *         name: filterDateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date to (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: User's collection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CollectionEntry'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/:deviceId',
  validateParams(schemas.deviceIdParam),
  validateQuery(schemas.collectionsQuery),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.params['deviceId'];
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const params: any = {};
    
    if (req.query['sort']) params.sort = req.query['sort'] as string;
    if (req.query['filterMarine']) params.filterMarine = req.query['filterMarine'] as string;
    if (req.query['filterSpot']) params.filterSpot = parseInt(req.query['filterSpot'] as string);
    if (req.query['filterRarity']) params.filterRarity = parseInt(req.query['filterRarity'] as string);
    if (req.query['filterCategory']) params.filterCategory = req.query['filterCategory'] as string;
    if (req.query['filterDanger']) params.filterDanger = req.query['filterDanger'] as string;
    if (req.query['filterDateFrom']) params.filterDateFrom = req.query['filterDateFrom'] as string;
    if (req.query['filterDateTo']) params.filterDateTo = req.query['filterDateTo'] as string;
    if (req.query['page']) params.page = parseInt(req.query['page'] as string);
    if (req.query['size']) params.size = parseInt(req.query['size'] as string);

    // Set defaults
    params.page = params.page || 1;
    params.size = params.size || 50;

    const result = await db.getCollections(deviceId, params);

    // Transform data to match API response format with camelCase
    const transformedData = await Promise.all(result.data.map(async (collection: any) => {
      // Fetch spot details for each photo if spotId is available
      const photosWithSpotDetails = await Promise.all(collection.photos?.map(async (photo: any) => {
        let spotDetails = null;
        if (photo.spotId) {
          try {
            const spot = await db.getSpotById(photo.spotId);
            if (spot) {
              spotDetails = {
                name: spot.name,
                lat: spot.lat,
                lng: spot.lng
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch spot details for spotId ${photo.spotId}:`, error);
          }
        }

        return {
          id: photo.id,
          url: photo.url,

          annotatedUrl: photo.annotatedUrl,
          dateFound: photo.dateFound,
          spotId: photo.spotId,
          confidence: photo.confidence,
          boundingBox: photo.boundingBox,
          spots: spotDetails
        };
      }) || []);

      return {
        id: collection.id,
        deviceId: collection.deviceId,
        marineId: collection.marineId,
        species: collection.marine?.name || 'Unknown',
        scientificName: collection.marine?.scientificName,
        rarity: collection.marine?.rarity,
        sizeMinCm: collection.marine?.sizeMinCm,
        sizeMaxCm: collection.marine?.sizeMaxCm,
        habitatType: collection.marine?.habitatType || [],
        diet: collection.marine?.diet,
        behavior: collection.marine?.behavior,
        description: collection.marine?.description,
        marineImageUrl: collection.marine?.imageUrl,
        photos: photosWithSpotDetails,
        totalPhotos: photosWithSpotDetails.length,
        firstSeen: collection.firstSeen,
        lastSeen: collection.lastSeen,
        status: collection.status
      };
    }));

    res.json({
      success: true,
      data: transformedData,
      pagination: {
        total: result.total,
        page: result.page,
        size: result.size,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrevious: result.hasPrevious
      }
    } as any);
    return;
  })
);

/**
 * @swagger
 * /api/collections/{deviceId}:
 *   post:
 *     summary: Add new finding to user's collection
 *     tags: [Collections]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               species:
 *                 type: string
 *                 description: Marine species name
 *               spotId:
 *                 type: integer
 *                 description: Spot ID
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Photo file
 *               lat:
 *                 type: number
 *                 description: GPS latitude
 *               lng:
 *                 type: number
 *                 description: GPS longitude
 *               boundingBox:
 *                 type: string
 *                 description: JSON string of bounding box coordinates
 *               notes:
 *                 type: string
 *                 description: User notes about the photo
 *     responses:
 *       201:
 *         description: Finding added to collection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CollectionEntry'
 *                 message:
 *                   type: string
 */
router.post('/:deviceId',
  validateParams(schemas.deviceIdParam),
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.params['deviceId'];
    
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
    const species = req.body.species;
    const spotId = req.body.spotId ? parseInt(req.body.spotId) : undefined;
    const lat = req.body.lat ? parseFloat(req.body.lat) : undefined;
    const lng = req.body.lng ? parseFloat(req.body.lng) : undefined;
    const boundingBox = req.body.boundingBox ? JSON.parse(req.body.boundingBox) : undefined;
    const notes = req.body.notes;

    // Create or find collection
    const collectionData: any = {
      deviceId,
      status: 'pending',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    const collection = await db.createCollection(collectionData);

    // Upload photo with processed file
    const photoData = await storage.uploadCollectionPhoto(
      {
        ...req.file,
        buffer: processedFile.buffer,
        mimetype: processedFile.mimeType,
        originalname: processedFile.filename
      },
      deviceId,
      species || 'unknown',
      collection.id
    );

    // Add photo to collection
    const photoDataForDb: any = {
      collectionId: collection.id,
      url: photoData.originalUrl,

              dateFound: new Date().toISOString(),
        notes,
        storageBucket: 'reefey-photos',
        filePath: photoData.filePath,
      fileSize: processedFile.buffer.length,
      mimeType: processedFile.mimeType
    };

    if (photoData.annotatedUrl) photoDataForDb.annotatedUrl = photoData.annotatedUrl;
    if (spotId) photoDataForDb.spotId = spotId;
    if (lat) photoDataForDb.lat = lat;
    if (lng) photoDataForDb.lng = lng;
    if (boundingBox) photoDataForDb.boundingBox = boundingBox;

    const photo = await db.addPhotoToCollection(photoDataForDb);

    // Get updated collection with photos
    const updatedCollection = await db.getCollections(deviceId, {});
    const collectionEntry = updatedCollection.data.find((c: any) => c.id === collection.id);

    if (!collectionEntry) {
      throw new Error('Failed to retrieve created collection');
    }

    res.status(201).json({
      success: true,
      data: {
        id: collection.id,
        deviceId: collection.deviceId,
        marineId: collection.marineId,
        species: collectionEntry.marine?.name || 'Unknown',
        scientificName: collectionEntry.marine?.scientificName,
        rarity: collectionEntry.marine?.rarity,
        sizeMinCm: collectionEntry.marine?.sizeMinCm,
        sizeMaxCm: collectionEntry.marine?.sizeMaxCm,
        habitatType: collectionEntry.marine?.habitatType || [],
        diet: collectionEntry.marine?.diet,
        behavior: collectionEntry.marine?.behavior,
        description: collectionEntry.marine?.description,
        marineImageUrl: collectionEntry.marine?.imageUrl,
        photo: {
          id: photo.id,
          url: photo.url,

          annotatedUrl: photo.annotatedUrl,
          dateFound: photo.dateFound,
          spotId: photo.spotId,
          confidence: photo.confidence,
          boundingBox: photo.boundingBox
        },
        totalPhotos: 1,
        firstSeen: collection.firstSeen,
        lastSeen: collection.lastSeen,
        status: collection.status
      },
      message: 'Finding added to collection!'
    });
    return;
  })
);

/**
 * @swagger
 * /api/collections/{deviceId}/{collectionId}:
 *   get:
 *     summary: Get detailed information about a specific collection entry
 *     tags: [Collections]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Collection ID
 *     responses:
 *       200:
 *         description: Collection details with photos and spot information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CollectionEntry'
 *       404:
 *         description: Collection not found
 */
router.get('/:deviceId/:collectionId',
  validateParams(schemas.deviceIdAndCollectionIdParam),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.params['deviceId'];
    const collectionId = parseInt(req.params['collectionId'] || '0');
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get collections for the device and find the specific one
    const result = await db.getCollections(deviceId, {});
    const collection = result.data.find((c: any) => c.id === collectionId);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found',
        code: 'NOT_FOUND'
      });
    }

    // Fetch spot details for each photo if spotId is available
    const photosWithSpotDetails = await Promise.all(collection.photos?.map(async (photo: any) => {
      let spotDetails = null;
      if (photo.spotId) {
        try {
          const spot = await db.getSpotById(photo.spotId);
          if (spot) {
            spotDetails = {
              name: spot.name,
              lat: spot.lat,
              lng: spot.lng
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch spot details for spotId ${photo.spotId}:`, error);
        }
      }

      return {
        id: photo.id,
        url: photo.url,

        annotatedUrl: photo.annotatedUrl,
        dateFound: photo.dateFound,
        spotId: photo.spotId,
        confidence: photo.confidence,
        boundingBox: photo.boundingBox,
        spots: spotDetails
      };
    }) || []);

    const response = {
      id: collection.id,
      deviceId: collection.deviceId,
      marineId: collection.marineId,
      species: collection.marine?.name || 'Unknown',
      scientificName: collection.marine?.scientificName,
      rarity: collection.marine?.rarity,
      sizeMinCm: collection.marine?.sizeMinCm,
      sizeMaxCm: collection.marine?.sizeMaxCm,
      habitatType: collection.marine?.habitatType || [],
      diet: collection.marine?.diet,
      behavior: collection.marine?.behavior,
      description: collection.marine?.description,
      marineImageUrl: collection.marine?.imageUrl,
      photos: photosWithSpotDetails,
      totalPhotos: photosWithSpotDetails.length,
      firstSeen: collection.firstSeen,
      lastSeen: collection.lastSeen,
      status: collection.status
    };

    res.json({
      success: true,
      data: response
    });
    return;
  })
);

/**
 * @swagger
 * /api/collections/{deviceId}/{collectionId}:
 *   delete:
 *     summary: Delete a collection entry
 *     tags: [Collections]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Collection ID
 *     responses:
 *       200:
 *         description: Collection deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Collection not found
 */
router.delete('/:deviceId/:collectionId',
  validateParams(schemas.deviceIdAndCollectionIdParam),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.params['deviceId'];
    const collectionId = parseInt(req.params['collectionId'] || '0');
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Verify the collection belongs to the device
    const result = await db.getCollections(deviceId, {});
    const collection = result.data.find((c: any) => c.id === collectionId);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found',
        code: 'NOT_FOUND'
      });
    }

    // Delete the collection (this will cascade delete photos)
    await db.deleteCollection(collectionId, deviceId);

    res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
    return;
  })
);

/**
 * @swagger
 * /api/collections/{deviceId}/{collectionId}:
 *   post:
 *     summary: Add a new photo to an existing collection entry
 *     tags: [Collections]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Collection ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Photo file from gallery
 *               spotId:
 *                 type: integer
 *                 description: Spot ID where photo was taken
 *               lat:
 *                 type: number
 *                 description: GPS latitude where photo was taken
 *               lng:
 *                 type: number
 *                 description: GPS longitude where photo was taken
 *               dateFound:
 *                 type: string
 *                 format: date
 *                 description: Date when photo was taken (YYYY-MM-DD format)
 *               notes:
 *                 type: string
 *                 description: User notes about the photo
 *     responses:
 *       200:
 *         description: Photo added to existing collection
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
 *                     collectionId:
 *                       type: integer
 *                     newPhoto:
 *                       $ref: '#/components/schemas/CollectionPhoto'
 *                     totalPhotos:
 *                       type: integer
 *                     lastSeen:
 *                       type: string
 *                     message:
 *                       type: string
 */
router.post('/:deviceId/:collectionId',
  validateParams(schemas.deviceIdAndCollectionIdParam),
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const deviceId = req.params['deviceId'];
    const collectionId = parseInt(req.params['collectionId'] || '0');
    
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

    // Verify collection belongs to device
    const collections = await db.getCollections(deviceId, {});
    const collection = collections.data.find((c: any) => c.id === collectionId);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found',
        code: 'NOT_FOUND'
      });
    }

    // Extract form data
    const spotId = req.body.spotId ? parseInt(req.body.spotId) : undefined;
    const lat = req.body.lat ? parseFloat(req.body.lat) : undefined;
    const lng = req.body.lng ? parseFloat(req.body.lng) : undefined;
    const dateFound = req.body.dateFound ? new Date(req.body.dateFound).toISOString() : new Date().toISOString();
    const notes = req.body.notes;

    // Upload photo
    const photoData = await storage.uploadCollectionPhoto(
      req.file,
      deviceId,
      collection.marine?.name || 'unknown',
      collectionId
    );

    // Add photo to collection
    const photoDataForDb: any = {
      collectionId,
      url: photoData.originalUrl,

              dateFound,
        notes,
        storageBucket: 'reefey-photos',
        filePath: photoData.filePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };

    if (spotId) photoDataForDb.spotId = spotId;
    if (lat) photoDataForDb.lat = lat;
    if (lng) photoDataForDb.lng = lng;

    const photo = await db.addPhotoToCollection(photoDataForDb);

    // Get updated collection with photos
    const updatedCollections = await db.getCollections(deviceId, {});
    const updatedCollection = updatedCollections.data.find((c: any) => c.id === collectionId);

    if (!updatedCollection) {
      throw new Error('Failed to retrieve updated collection');
    }

    res.json({
      success: true,
      data: {
        collectionId: collection.id,
        marineId: collection.marineId,
        species: collection.marine?.name || 'Unknown',
        scientificName: collection.marine?.scientificName,
        newPhoto: {
          id: photo.id,
          url: photo.url,

          dateFound: photo.dateFound,
          spotId: photo.spotId,
          confidence: photo.confidence,
          boundingBox: photo.boundingBox,
          notes: photo.notes
        },
        totalPhotos: updatedCollection.photos?.length || 0,
        lastSeen: photo.dateFound,
        message: 'Photo added to existing collection'
      }
    });
    return;
  })
);

export default router;
