import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, validateQuery, validateParams, schemas } from '../middleware/validation';
import { ApiResponse, PaginationResponse, Spot } from '../types/model';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/spots:
 *   get:
 *     summary: Get snorkeling spots with filtering and sorting
 *     tags: [Spots]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Center latitude for location-based filtering
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Center longitude for location-based filtering
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Radius in km for location filtering
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Text search in spot name and description
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, distance, createdAt]
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
 *         description: List of spots
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
 *                     $ref: '#/components/schemas/Spot'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', 
  validateQuery(schemas.spotsQuery),
  asyncHandler(async (req: Request, res: Response<PaginationResponse<Spot>>) => {
    const startTime = Date.now();
    logger.apiRequest('GET', '/api/spots', req.query);
    
    const params: any = {};
    
    if (req.query['lat']) params.lat = parseFloat(req.query['lat'] as string);
    if (req.query['lng']) params.lng = parseFloat(req.query['lng'] as string);
    if (req.query['radius']) params.radius = parseFloat(req.query['radius'] as string);
    if (req.query['q']) params.q = req.query['q'] as string;
    if (req.query['sort']) params.sort = req.query['sort'] as string;
    if (req.query['page']) params.page = parseInt(req.query['page'] as string);
    if (req.query['size']) params.size = parseInt(req.query['size'] as string);

    // Set defaults
    params.radius = params.radius || 10;
    params.sort = params.sort || 'name';
    params.page = params.page || 1;
    params.size = params.size || 50;

    logger.dbQuery('SELECT', 'spots', params);
    const result = await db.getSpots(params);
    logger.dbResult('SELECT', 'spots', { count: result.data.length, total: result.total });

    // Transform data to match API response format with camelCase
    const transformedData = result.data.map((spot: any) => ({
      ...spot,
      topFish: '', // Would need to be calculated from spot_marine relationship
      topFishArray: [], // Would need to be calculated from spot_marine relationship
      distance: params.lat && params.lng ? 
        Math.sqrt(Math.pow(spot.lat - params.lat, 2) + Math.pow(spot.lng - params.lng, 2)) * 111 : 
        undefined
    }));

    const responseTime = Date.now() - startTime;
    logger.apiResponse('GET', '/api/spots', 200, responseTime);
    
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
 * /api/spots/{id}:
 *   get:
 *     summary: Get detailed information about a specific snorkeling spot
 *     tags: [Spots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Spot ID
 *     responses:
 *       200:
 *         description: Spot details with fish species found there
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SpotDetail'
 *       404:
 *         description: Spot not found
 */
router.get('/:id',
  validateParams(schemas.idParam),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const id = parseInt(req.params['id'] || '0');
    const spot = await db.getSpotById(id);

    if (!spot) {
      return res.status(404).json({
        success: false,
        error: 'Spot not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: spot
    });
    return;
  })
);

/**
 * @swagger
 * /api/spots:
 *   post:
 *     summary: Create a new snorkeling spot
 *     tags: [Spots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSpotRequest'
 *     responses:
 *       201:
 *         description: Spot created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Spot'
 *                 message:
 *                   type: string
 */
router.post('/',
  validate(schemas.createSpot),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const spotData = {
      name: req.body.name,
      lat: req.body.lat,
      lng: req.body.lng,
      description: req.body.description,
      difficulty: req.body.difficulty,
      bestTime: req.body.bestTime
    };

    const spot = await db.createSpot(spotData);

    // Handle fishSpecies relationships if provided
    if (req.body.fishSpecies && Array.isArray(req.body.fishSpecies)) {
      for (const fishSpecies of req.body.fishSpecies) {
        try {
          await db.createSpotMarineRelationship(
            spot.id,
            fishSpecies.fishId,
            fishSpecies.frequency,
            fishSpecies.seasonality,
            fishSpecies.notes
          );
        } catch (error) {
          // Log error but don't fail the spot creation
          console.error('Failed to create spot-marine relationship:', error);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        createdAt: spot.createdAt
      },
      message: 'Spot created successfully'
    });
    return;
  })
);

/**
 * @swagger
 * /api/spots/{id}:
 *   delete:
 *     summary: Delete a snorkeling spot
 *     tags: [Spots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Spot ID
 *     responses:
 *       200:
 *         description: Spot deleted successfully
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
 *         description: Spot not found
 */
router.delete('/:id',
  validateParams(schemas.idParam),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const id = parseInt(req.params['id'] || '0');
    
    try {
      await db.deleteSpot(id);
      
      res.json({
        success: true,
        message: 'Spot deleted successfully'
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Spot not found',
          code: 'NOT_FOUND'
        });
      }
      throw error;
    }
  })
);

export default router;
