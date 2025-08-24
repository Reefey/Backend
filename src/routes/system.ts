import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, SystemStats } from '../types/model';

const router = Router();

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get comprehensive system statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SystemStats'
 */
router.get('/stats',
  asyncHandler(async (_req: Request, res: Response<ApiResponse<SystemStats>>) => {
    const stats = await db.getSystemStats();

    res.json({
      success: true,
      data: stats
    });
    return;
  })
);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Simple health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: connected
 *                     storage:
 *                       type: string
 *                       example: connected
 *                     ai:
 *                       type: string
 *                       example: connected
 */
router.get('/health',
  asyncHandler(async (_req: Request, res: Response) => {
    // Check database connection
    let dbStatus = 'connected';
    try {
      await db.getSystemStats();
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Check storage connection (placeholder)
    const storageStatus = 'connected';

    // Check AI service connection (placeholder)
    const aiStatus = 'connected';

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        storage: storageStatus,
        ai: aiStatus
      }
    });
    return;
  })
);

export default router;
