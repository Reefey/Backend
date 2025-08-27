import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, validateQuery, validateParams, schemas } from '../middleware/validation';
import { ApiResponse, PaginationResponse, Marine } from '../types/model';

const router = Router();

/**
 * @swagger
 * /api/marine:
 *   get:
 *     summary: Get all marine species with filtering and sorting
 *     tags: [Marine]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Text search in name, scientific name, category, description
 *       - in: query
 *         name: rarity
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter by rarity level
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Fishes, Creatures, Corals]
 *         description: Filter by category
 *       - in: query
 *         name: habitat
 *         schema:
 *           type: string
 *         description: Filter by habitat type
 *       - in: query
 *         name: diet
 *         schema:
 *           type: string
 *         description: Filter by diet type
 *       - in: query
 *         name: behavior
 *         schema:
 *           type: string
 *         description: Filter by behavior type
 *       - in: query
 *         name: sizeMin
 *         schema:
 *           type: number
 *         description: Minimum size in cm
 *       - in: query
 *         name: sizeMax
 *         schema:
 *           type: number
 *         description: Maximum size in cm
 *       - in: query
 *         name: danger
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Extreme]
 *         description: Filter by danger level
 *       - in: query
 *         name: venomous
 *         schema:
 *           type: boolean
 *         description: Filter by venomous status
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, rarity, sizeMin, sizeMax, category]
 *           default: name
 *         description: Sort order
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
 *         description: List of marine species
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
 *                     $ref: '#/components/schemas/Marine'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/',
  validateQuery(schemas.marineQuery),
  asyncHandler(async (req: Request, res: Response<PaginationResponse<Marine>>) => {
    const params: any = {};
    
    if (req.query['q']) params.q = req.query['q'] as string;
    if (req.query['rarity']) params.rarity = parseInt(req.query['rarity'] as string);
    if (req.query['category']) params.category = req.query['category'] as string;
    if (req.query['habitat']) params.habitat = req.query['habitat'] as string;
    if (req.query['diet']) params.diet = req.query['diet'] as string;
    if (req.query['behavior']) params.behavior = req.query['behavior'] as string;
    if (req.query['sizeMin']) params.sizeMin = parseFloat(req.query['sizeMin'] as string);
    if (req.query['sizeMax']) params.sizeMax = parseFloat(req.query['sizeMax'] as string);
    if (req.query['danger']) params.danger = req.query['danger'] as string;
    if (req.query['venomous'] !== undefined) params.venomous = req.query['venomous'] === 'true';
    if (req.query['sort']) params.sort = req.query['sort'] as string;
    if (req.query['page']) params.page = parseInt(req.query['page'] as string);
    if (req.query['size']) params.size = parseInt(req.query['size'] as string);

    // Set defaults
    params.sort = params.sort || 'name';
    params.page = params.page || 1;
    params.size = params.size || 50;

    const result = await db.getMarine(params);

    // Transform data to match API response format with camelCase
    const transformedData = result.data.map((marine: any) => {
      const transformed: any = {
        ...marine,
        habitatType: marine.habitatType || []
      };
      
      // Only include size properties if they have values
      if (marine.sizeMinCm !== undefined) transformed.sizeMinCm = marine.sizeMinCm;
      if (marine.sizeMaxCm !== undefined) transformed.sizeMaxCm = marine.sizeMaxCm;
      
      return transformed;
    });

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
    });
    return;
  })
);

/**
 * @swagger
 * /api/marine/{id}:
 *   get:
 *     summary: Get detailed information about a specific marine species
 *     tags: [Marine]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Marine species ID
 *     responses:
 *       200:
 *         description: Marine species details with spots where it can be found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MarineDetail'
 *       404:
 *         description: Marine species not found
 */
router.get('/:id',
  validateParams(schemas.idParam),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const id = parseInt(req.params['id'] || '0');
    const marine = await db.getMarineById(id);

    if (!marine) {
      return res.status(404).json({
        success: false,
        error: 'Marine species not found',
        code: 'NOT_FOUND'
      });
    }

    // Transform spot_marine data to match API response format with camelCase
    const foundAtSpots = marine.spotMarine?.map((sm: any) => ({
      spotId: sm.spotId,
      frequency: sm.frequency,
      seasonality: sm.seasonality,
      notes: sm.notes
    })) || [];

    const response = {
      id: marine.id,
      name: marine.name,
      scientificName: marine.scientificName,
      category: marine.category,
      rarity: marine.rarity,
      sizeMinCm: marine.sizeMinCm,
      sizeMaxCm: marine.sizeMaxCm,
      habitatType: marine.habitatType || [],
      diet: marine.diet,
      behavior: marine.behavior,
      danger: marine.danger,
      venomous: marine.venomous,
      description: marine.description,
      imageUrl: marine.imageUrl,
      lifeSpan: marine.lifeSpan,
      reproduction: marine.reproduction,
      migration: marine.migration,
      endangered: marine.endangered,
      funFact: marine.funFact,
      foundAtSpots,
      totalSpots: foundAtSpots.length
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
 * /api/marine:
 *   post:
 *     summary: Add a new marine species to the database
 *     tags: [Marine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMarineRequest'
 *     responses:
 *       201:
 *         description: Marine species added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Marine'
 *                 message:
 *                   type: string
 */
router.post('/',
  validate(schemas.createMarine),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const marineData = {
      name: req.body.name,
      scientificName: req.body.scientificName,
      category: req.body.category,
      rarity: req.body.rarity,
      sizeMinCm: req.body.sizeMinCm,
      sizeMaxCm: req.body.sizeMaxCm,
      habitatType: req.body.habitatType,
      diet: req.body.diet,
      behavior: req.body.behavior,
      danger: req.body.danger,
      venomous: req.body.venomous,
      description: req.body.description,
      lifeSpan: req.body.lifeSpan,
      reproduction: req.body.reproduction,
      migration: req.body.migration,
      endangered: req.body.endangered,
      funFact: req.body.funFact
    };

    const marine = await db.createMarine(marineData);

    res.status(201).json({
      success: true,
      data: {
        id: marine.id,
        name: marine.name,
        createdAt: marine.createdAt
      },
      message: 'Marine species added successfully'
    });
    return;
  })
);

/**
 * @swagger
 * /api/marine/{id}:
 *   delete:
 *     summary: Delete a marine species from the database
 *     tags: [Marine]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Marine species ID
 *     responses:
 *       200:
 *         description: Marine species deleted successfully
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
 *         description: Marine species not found
 */
router.delete('/:id',
  validateParams(schemas.idParam),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const id = parseInt(req.params['id'] || '0');
    
    try {
      await db.deleteMarine(id);
      
      res.json({
        success: true,
        message: 'Marine species deleted successfully'
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Marine species not found',
          code: 'NOT_FOUND'
        });
      }
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/marine/all/{deviceId}:
 *   get:
 *     summary: Get all marine species with user collection data (collected species appear first)
 *     tags: [Marine]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Text search in name, scientific name, category, description
 *       - in: query
 *         name: rarity
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter by rarity level
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Fishes, Creatures, Corals]
 *         description: Filter by category
 *       - in: query
 *         name: habitat
 *         schema:
 *           type: string
 *         description: Filter by habitat type
 *       - in: query
 *         name: diet
 *         schema:
 *           type: string
 *         description: Filter by diet type
 *       - in: query
 *         name: behavior
 *         schema:
 *           type: string
 *         description: Filter by behavior type
 *       - in: query
 *         name: sizeMin
 *         schema:
 *           type: number
 *         description: Minimum size in cm
 *       - in: query
 *         name: sizeMax
 *         schema:
 *           type: number
 *         description: Maximum size in cm
 *       - in: query
 *         name: danger
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Extreme]
 *         description: Filter by danger level
 *       - in: query
 *         name: venomous
 *         schema:
 *           type: boolean
 *         description: Filter by venomous status
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, rarity, sizeMin, sizeMax, category, collected]
 *           default: collected
 *         description: Sort order (collected puts user's collected species first)
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
 *         description: List of marine species with collection data
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
 *                     $ref: '#/components/schemas/MarineWithCollection'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/all/:deviceId',
  validateParams(schemas.deviceIdParam),
  validateQuery(schemas.marineQuery),
  asyncHandler(async (req: Request, res: Response<any>) => {
    const deviceId = req.params['deviceId'];
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required',
        code: 'VALIDATION_ERROR',
        data: [],
        pagination: {
          total: 0,
          page: 1,
          size: 50,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false
        }
      });
    }
    
    const params: any = {};
    
    if (req.query['q']) params.q = req.query['q'] as string;
    if (req.query['rarity']) params.rarity = parseInt(req.query['rarity'] as string);
    if (req.query['category']) params.category = req.query['category'] as string;
    if (req.query['habitat']) params.habitat = req.query['habitat'] as string;
    if (req.query['diet']) params.diet = req.query['diet'] as string;
    if (req.query['behavior']) params.behavior = req.query['behavior'] as string;
    if (req.query['sizeMin']) params.sizeMin = parseFloat(req.query['sizeMin'] as string);
    if (req.query['sizeMax']) params.sizeMax = parseFloat(req.query['sizeMax'] as string);
    if (req.query['danger']) params.danger = req.query['danger'] as string;
    if (req.query['venomous'] !== undefined) params.venomous = req.query['venomous'] === 'true';
    if (req.query['sort']) params.sort = req.query['sort'] as string;
    if (req.query['page']) params.page = parseInt(req.query['page'] as string);
    if (req.query['size']) params.size = parseInt(req.query['size'] as string);

    // Set defaults
    params.sort = params.sort || 'collected';
    params.page = params.page || 1;
    params.size = params.size || 50;

    try {
      // Get ALL marine species (without pagination to get complete list)
      const allMarineParams = { ...params };
      delete allMarineParams.page;
      delete allMarineParams.size;
      allMarineParams.size = 10000; // Large enough to get all species
      allMarineParams.page = 1;
      
      const marineResult = await db.getMarine(allMarineParams);
      
      // Get user's collections
      let collectionResult;
      try {
        collectionResult = await db.getCollections(deviceId, { size: 1000 });
      } catch (error) {
        console.warn(`Failed to get collections for device ${deviceId}:`, error);
        collectionResult = { data: [] };
      }
      
      // Create a map of user's collections by marine ID
      const collectionMap = new Map();
      collectionResult.data.forEach((collection: any) => {
        if (collection.marineId) {
          collectionMap.set(collection.marineId, collection);
        }
      });

      // Combine marine species with collection data
      const combinedData = marineResult.data.map((marine: any) => {
        const userCollection = collectionMap.get(marine.id);
        
        // Start with marine data
        const combined: any = {
          ...marine,
          habitatType: marine.habitatType || []
        };
        
        // Only include size properties if they have values
        if (marine.sizeMinCm !== undefined) combined.sizeMinCm = marine.sizeMinCm;
        if (marine.sizeMaxCm !== undefined) combined.sizeMaxCm = marine.sizeMaxCm;
        
        // Add collection data if user has this species
        if (userCollection) {
          combined.inUserCollection = true;
          combined.hasAnalyzedPhotos = userCollection.photos?.some((p: any) => p.confidence && p.confidence > 0) || false;
          combined.lastSeen = userCollection.lastSeen;
          combined.firstSeen = userCollection.firstSeen;
          combined.totalPhotos = userCollection.photos?.length || 0;
          combined.userPhotos = userCollection.photos || [];
          combined.collectionId = userCollection.id;
          combined.status = userCollection.status;
        } else {
          combined.inUserCollection = false;
          combined.hasAnalyzedPhotos = false;
          combined.totalPhotos = 0;
          combined.userPhotos = [];
        }
        
        return combined;
      });

      // Sort data based on sort parameter
      if (params.sort === 'collected') {
        combinedData.sort((a: any, b: any) => {
          // Primary sort: collected species first
          if (a.inUserCollection && !b.inUserCollection) return -1;
          if (!a.inUserCollection && b.inUserCollection) return 1;
          
          // Secondary sort: within collected group, sort by last seen
          if (a.inUserCollection && b.inUserCollection) {
            const aDate = new Date(a.lastSeen || 0);
            const bDate = new Date(b.lastSeen || 0);
            if (aDate.getTime() !== bDate.getTime()) {
              return bDate.getTime() - aDate.getTime(); // Most recent first
            }
          }
          
          // Tertiary sort: by name
          return a.name.localeCompare(b.name);
        });
      }

      // Apply pagination to the combined data
      const startIndex = (params.page - 1) * params.size;
      const endIndex = startIndex + params.size;
      const paginatedData = combinedData.slice(startIndex, endIndex);

      const total = combinedData.length;
      const totalPages = Math.ceil(total / params.size);
      const hasNext = params.page < totalPages;
      const hasPrevious = params.page > 1;

      res.json({
        success: true,
        data: paginatedData,
        pagination: {
          total,
          page: params.page,
          size: params.size,
          totalPages,
          hasNext,
          hasPrevious
        }
      });
      return;
      
    } catch (error) {
      console.error('Error in marine/all/:deviceId route:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
      return;
    }
  })
);

export default router;
